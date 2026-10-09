CREATE TYPE "classroom_type" AS ENUM('aula', 'laboratorio', 'auditorio', 'cancha');--> statement-breakpoint
CREATE TYPE "teacher_assignment_status" AS ENUM('activo', 'inactivo', 'temporal');--> statement-breakpoint
CREATE TYPE "time_block_shift" AS ENUM('Mañana', 'Tarde', 'Nocturna', 'Única');--> statement-breakpoint
CREATE TABLE "classroom" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"campus_id" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(20) NOT NULL,
	"capacity" integer DEFAULT 40 NOT NULL,
	"floor" integer DEFAULT 1 NOT NULL,
	"building" varchar(50),
	"classroom_type" "classroom_type" DEFAULT 'aula'::"classroom_type" NOT NULL,
	"resources" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "classroom_capacity_check" CHECK ("capacity" between 10 and 100),
	CONSTRAINT "classroom_floor_check" CHECK ("floor" >= 1),
	CONSTRAINT "classroom_resources_check" CHECK ("resources" is null or jsonb_typeof("resources") = 'object')
);
--> statement-breakpoint
CREATE TABLE "offering" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"course_id" text NOT NULL,
	"teacher_person_id" text,
	"hours_per_week" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offering_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "offering_organizationId_id_courseId_unique" UNIQUE("organization_id","id","course_id"),
	CONSTRAINT "offering_organizationId_subjectId_courseId_unique" UNIQUE("organization_id","subject_id","course_id"),
	CONSTRAINT "offering_hours_check" CHECK ("hours_per_week" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "schedule_slot" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"offering_id" text NOT NULL,
	"course_id" text NOT NULL,
	"teacher_person_id" text,
	"classroom_id" text NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"academic_year" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_slot_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "schedule_slot_day_check" CHECK ("day_of_week" between 0 and 4),
	CONSTRAINT "schedule_slot_times_check" CHECK ("start_time" < "end_time"),
	CONSTRAINT "schedule_slot_year_check" CHECK ("academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "teacher_assignment" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"offering_id" text NOT NULL CONSTRAINT "teacher_assignment_offeringId_unique" UNIQUE,
	"teacher_person_id" text NOT NULL,
	"academic_year" text NOT NULL,
	"assignment_date" date NOT NULL,
	"status" "teacher_assignment_status" DEFAULT 'activo'::"teacher_assignment_status" NOT NULL,
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_assignment_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "teacher_assignment_year_check" CHECK ("academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "time_block" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"campus_id" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_break" boolean DEFAULT false NOT NULL,
	"order_num" integer NOT NULL,
	"shift" "time_block_shift" NOT NULL,
	"academic_year" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_block_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "time_block_times_check" CHECK ("start_time" < "end_time"),
	CONSTRAINT "time_block_order_check" CHECK ("order_num" >= 1),
	CONSTRAINT "time_block_year_check" CHECK ("academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_organizationId_campusId_code_unique" ON "classroom" ("organization_id","campus_id",lower("code"));--> statement-breakpoint
CREATE INDEX "classroom_organizationId_campusId_idx" ON "classroom" ("organization_id","campus_id");--> statement-breakpoint
CREATE INDEX "offering_organizationId_courseId_idx" ON "offering" ("organization_id","course_id");--> statement-breakpoint
CREATE INDEX "offering_organizationId_teacherPersonId_idx" ON "offering" ("organization_id","teacher_person_id");--> statement-breakpoint
CREATE INDEX "schedule_slot_organizationId_offeringId_idx" ON "schedule_slot" ("organization_id","offering_id");--> statement-breakpoint
CREATE INDEX "schedule_slot_organizationId_classroomId_dayOfWeek_idx" ON "schedule_slot" ("organization_id","classroom_id","day_of_week");--> statement-breakpoint
CREATE INDEX "teacher_assignment_organizationId_teacherPersonId_status_idx" ON "teacher_assignment" ("organization_id","teacher_person_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "time_block_organizationId_campusId_name_year_shift_unique" ON "time_block" ("organization_id","campus_id",lower("name"),"academic_year","shift");--> statement-breakpoint
CREATE INDEX "time_block_organizationId_campusId_year_shift_orderNum_idx" ON "time_block" ("organization_id","campus_id","academic_year","shift","order_num");--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "classroom" ADD CONSTRAINT "classroom_campus_fk" FOREIGN KEY ("organization_id","campus_id") REFERENCES "campus"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offering" ADD CONSTRAINT "offering_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "offering" ADD CONSTRAINT "offering_subject_fk" FOREIGN KEY ("organization_id","subject_id") REFERENCES "subject"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offering" ADD CONSTRAINT "offering_course_fk" FOREIGN KEY ("organization_id","course_id") REFERENCES "course"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offering" ADD CONSTRAINT "offering_teacher_fk" FOREIGN KEY ("organization_id","teacher_person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_offering_course_fk" FOREIGN KEY ("organization_id","offering_id","course_id") REFERENCES "offering"("organization_id","id","course_id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_classroom_fk" FOREIGN KEY ("organization_id","classroom_id") REFERENCES "classroom"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_course_fk" FOREIGN KEY ("organization_id","course_id") REFERENCES "course"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_teacher_fk" FOREIGN KEY ("organization_id","teacher_person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_offering_fk" FOREIGN KEY ("organization_id","offering_id") REFERENCES "offering"("organization_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "teacher_assignment" ADD CONSTRAINT "teacher_assignment_teacher_fk" FOREIGN KEY ("organization_id","teacher_person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_block" ADD CONSTRAINT "time_block_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_block" ADD CONSTRAINT "time_block_campus_fk" FOREIGN KEY ("organization_id","campus_id") REFERENCES "campus"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
-- Hand-written (Drizzle cannot declare GiST exclusion constraints). D1: no two active-year slots
-- may overlap on the same day for the same classroom, teacher (when set) or course.
-- The interval is half-open [start, end): Postgres has no `timerange`, so the time of day is
-- anchored on a fixed date and compared as `tsrange` ('[)' is its default). `date + time` is
-- IMMUTABLE, keeps full time precision and needs no custom function. The classroom exclusion also
-- subsumes the spec's unique (classroom_id, day_of_week, start_time, academic_year): the
-- start < end CHECK makes every range non-empty, so equal starts always overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_classroom_overlap_excl" EXCLUDE USING gist (
	"organization_id" WITH =,
	"academic_year" WITH =,
	"day_of_week" WITH =,
	"classroom_id" WITH =,
	tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
);--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_teacher_overlap_excl" EXCLUDE USING gist (
	"organization_id" WITH =,
	"academic_year" WITH =,
	"day_of_week" WITH =,
	"teacher_person_id" WITH =,
	tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
) WHERE ("teacher_person_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "schedule_slot" ADD CONSTRAINT "schedule_slot_course_overlap_excl" EXCLUDE USING gist (
	"organization_id" WITH =,
	"academic_year" WITH =,
	"day_of_week" WITH =,
	"course_id" WITH =,
	tsrange(date '2000-01-01' + "start_time", date '2000-01-01' + "end_time") WITH &&
);
