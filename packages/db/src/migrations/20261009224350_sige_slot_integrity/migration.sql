ALTER TABLE "schedule_slot" DROP CONSTRAINT "schedule_slot_course_fk";--> statement-breakpoint
ALTER TABLE "schedule_slot" DROP CONSTRAINT "schedule_slot_teacher_fk";--> statement-breakpoint
ALTER TABLE "teacher_assignment" DROP CONSTRAINT "teacher_assignment_teacher_fk";--> statement-breakpoint
ALTER TABLE "offering" ADD CONSTRAINT "offering_organizationId_id_teacherPersonId_unique" UNIQUE("organization_id","id","teacher_person_id");--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_offering_teacher_fk" FOREIGN KEY ("organization_id","offering_id","teacher_person_id") REFERENCES "offering"("organization_id","id","teacher_person_id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "teacher_assignment" DROP CONSTRAINT "teacher_assignment_offering_fk", ADD CONSTRAINT "teacher_assignment_offering_fk" FOREIGN KEY ("organization_id","offering_id","teacher_person_id") REFERENCES "offering"("organization_id","id","teacher_person_id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
-- Hand-written. Null-teacher hole of schedule_slot_offering_teacher_fk: a composite FK is MATCH
-- SIMPLE, so it is skipped when the slot's teacher is null, and MATCH FULL would reject that case
-- outright (the other columns are not null). A slot without a teacher must still be consistent with
-- an offering that has one, so a trigger closes the gap in both directions:
--   1. a slot cannot be written with a null teacher while its offering has a teacher (23514);
--   2. when an offering goes from no teacher to a teacher, its slots take it (the FK cascade only
--      follows changes of a non-null value). Offering teacher X -> Y or X -> null already cascade.
CREATE FUNCTION "schedule_slot_check_teacher_sync"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."teacher_person_id" IS NULL AND EXISTS (
		SELECT 1 FROM "offering" o
		WHERE o."organization_id" = NEW."organization_id"
			AND o."id" = NEW."offering_id"
			AND o."teacher_person_id" IS NOT NULL
	) THEN
		RAISE EXCEPTION 'schedule_slot teacher must match the offering teacher'
			USING ERRCODE = '23514', CONSTRAINT = 'schedule_slot_teacher_sync_check', TABLE = 'schedule_slot';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "schedule_slot_teacher_sync_check" BEFORE INSERT OR UPDATE OF "teacher_person_id", "offering_id" ON "schedule_slot"
	FOR EACH ROW EXECUTE FUNCTION "schedule_slot_check_teacher_sync"();--> statement-breakpoint
CREATE FUNCTION "offering_sync_slot_teacher"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	UPDATE "schedule_slot" SET "teacher_person_id" = NEW."teacher_person_id"
	WHERE "organization_id" = NEW."organization_id" AND "offering_id" = NEW."id";
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "offering_sync_slot_teacher" AFTER UPDATE OF "teacher_person_id" ON "offering"
	FOR EACH ROW WHEN (OLD."teacher_person_id" IS NULL AND NEW."teacher_person_id" IS NOT NULL)
	EXECUTE FUNCTION "offering_sync_slot_teacher"();--> statement-breakpoint
-- Hand-written. D1 exclusions only constrain active slots (`is_active`): an inactive slot no longer
-- occupies its room, teacher or course. Drop and recreate with a WHERE predicate.
ALTER TABLE "schedule_slot" DROP CONSTRAINT "schedule_slot_classroom_overlap_excl";--> statement-breakpoint
ALTER TABLE "schedule_slot" DROP CONSTRAINT "schedule_slot_teacher_overlap_excl";--> statement-breakpoint
ALTER TABLE "schedule_slot" DROP CONSTRAINT "schedule_slot_course_overlap_excl";--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_classroom_overlap_excl" EXCLUDE USING gist (
	"organization_id" WITH =,
	"academic_year" WITH =,
	"day_of_week" WITH =,
	"classroom_id" WITH =,
	tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
) WHERE ("is_active");--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_teacher_overlap_excl" EXCLUDE USING gist (
	"organization_id" WITH =,
	"academic_year" WITH =,
	"day_of_week" WITH =,
	"teacher_person_id" WITH =,
	tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
) WHERE ("is_active" AND "teacher_person_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_course_overlap_excl" EXCLUDE USING gist (
	"organization_id" WITH =,
	"academic_year" WITH =,
	"day_of_week" WITH =,
	"course_id" WITH =,
	tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
) WHERE ("is_active");
