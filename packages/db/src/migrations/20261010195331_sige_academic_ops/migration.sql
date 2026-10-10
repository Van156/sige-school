CREATE TYPE "attendance_status" AS ENUM('presente', 'ausente', 'justificado', 'excusado');--> statement-breakpoint
CREATE TYPE "final_grade_status" AS ENUM('ganada', 'perdida', 'no evaluado');--> statement-breakpoint
CREATE TYPE "observation_type" AS ENUM('positiva', 'negativa', 'seguimiento', 'convivencia');--> statement-breakpoint
CREATE TABLE "attendance_record" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"offering_id" text NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"observation" text,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_record_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "attendance_record_studentId_offeringId_date_unique" UNIQUE("student_id","offering_id","date"),
	CONSTRAINT "attendance_record_weekday_check" CHECK (extract(isodow from "date") between 1 and 6),
	CONSTRAINT "attendance_record_observation_check" CHECK (char_length("observation") <= 300)
);
--> statement-breakpoint
CREATE TABLE "final_grade" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"offering_id" text NOT NULL,
	"period_id" text NOT NULL,
	"final_score" numeric(3,2) NOT NULL,
	"status" "final_grade_status" NOT NULL,
	"observation" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_grade_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "final_grade_studentId_offeringId_periodId_unique" UNIQUE("student_id","offering_id","period_id"),
	CONSTRAINT "final_grade_final_score_check" CHECK ("final_score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "grade_record" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"offering_id" text NOT NULL,
	"period_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"score" numeric(3,2) NOT NULL,
	"observation" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grade_record_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "grade_record_studentId_offeringId_periodId_criterionId_unique" UNIQUE("student_id","offering_id","period_id","criterion_id"),
	CONSTRAINT "grade_record_score_check" CHECK ("score" between 1 and 5),
	CONSTRAINT "grade_record_observation_check" CHECK (char_length("observation") <= 500)
);
--> statement-breakpoint
CREATE TABLE "observation" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"author_person_id" text NOT NULL,
	"type" "observation_type" NOT NULL,
	"category" text,
	"description" text NOT NULL,
	"commitments" text,
	"observed_at" timestamp with time zone NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp with time zone,
	"notified_by" text,
	"requires_notification" boolean GENERATED ALWAYS AS ("type" in ('negativa', 'convivencia')) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observation_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "observation_notified_check" CHECK ("notified" = ("notified_at" is not null)),
	CONSTRAINT "observation_description_check" CHECK (char_length("description") <= 2000),
	CONSTRAINT "observation_commitments_check" CHECK (char_length("commitments") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "period_lock" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"offering_id" text NOT NULL,
	"period_id" text NOT NULL,
	"locked" boolean NOT NULL,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	CONSTRAINT "period_lock_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "period_lock_offeringId_periodId_unique" UNIQUE("offering_id","period_id")
);
--> statement-breakpoint
CREATE INDEX "attendance_record_organizationId_offeringId_date_idx" ON "attendance_record" ("organization_id","offering_id","date");--> statement-breakpoint
CREATE INDEX "attendance_record_organizationId_studentId_date_idx" ON "attendance_record" ("organization_id","student_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "final_grade_organizationId_offeringId_periodId_idx" ON "final_grade" ("organization_id","offering_id","period_id");--> statement-breakpoint
CREATE INDEX "final_grade_organizationId_studentId_idx" ON "final_grade" ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX "grade_record_organizationId_offeringId_periodId_idx" ON "grade_record" ("organization_id","offering_id","period_id");--> statement-breakpoint
CREATE INDEX "grade_record_organizationId_studentId_periodId_idx" ON "grade_record" ("organization_id","student_id","period_id");--> statement-breakpoint
CREATE INDEX "grade_record_organizationId_criterionId_idx" ON "grade_record" ("organization_id","criterion_id");--> statement-breakpoint
CREATE INDEX "observation_organizationId_studentId_observedAt_idx" ON "observation" ("organization_id","student_id","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "observation_organizationId_observedAt_idx" ON "observation" ("organization_id","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "observation_organizationId_authorPersonId_idx" ON "observation" ("organization_id","author_person_id");--> statement-breakpoint
CREATE INDEX "observation_organizationId_pendingNotification_idx" ON "observation" ("organization_id","observed_at" DESC NULLS LAST) WHERE "requires_notification" and not "notified";--> statement-breakpoint
CREATE INDEX "period_lock_organizationId_periodId_idx" ON "period_lock" ("organization_id","period_id");--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_student_fk" FOREIGN KEY ("organization_id","student_id") REFERENCES "student"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_offering_fk" FOREIGN KEY ("organization_id","offering_id") REFERENCES "offering"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_recorded_by_fk" FOREIGN KEY ("organization_id","recorded_by") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_student_fk" FOREIGN KEY ("organization_id","student_id") REFERENCES "student"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_offering_fk" FOREIGN KEY ("organization_id","offering_id") REFERENCES "offering"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_period_fk" FOREIGN KEY ("organization_id","period_id") REFERENCES "academic_period"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_student_fk" FOREIGN KEY ("organization_id","student_id") REFERENCES "student"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_offering_fk" FOREIGN KEY ("organization_id","offering_id") REFERENCES "offering"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_period_fk" FOREIGN KEY ("organization_id","period_id") REFERENCES "academic_period"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_criterion_fk" FOREIGN KEY ("organization_id","criterion_id") REFERENCES "grade_criterion"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_created_by_fk" FOREIGN KEY ("organization_id","created_by") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_record" ADD CONSTRAINT "grade_record_updated_by_fk" FOREIGN KEY ("organization_id","updated_by") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "observation" ADD CONSTRAINT "observation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "observation" ADD CONSTRAINT "observation_student_fk" FOREIGN KEY ("organization_id","student_id") REFERENCES "student"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "observation" ADD CONSTRAINT "observation_author_fk" FOREIGN KEY ("organization_id","author_person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "observation" ADD CONSTRAINT "observation_notified_by_fk" FOREIGN KEY ("organization_id","notified_by") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "period_lock" ADD CONSTRAINT "period_lock_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "period_lock" ADD CONSTRAINT "period_lock_offering_fk" FOREIGN KEY ("organization_id","offering_id") REFERENCES "offering"("organization_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "period_lock" ADD CONSTRAINT "period_lock_period_fk" FOREIGN KEY ("organization_id","period_id") REFERENCES "academic_period"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "period_lock" ADD CONSTRAINT "period_lock_locked_by_fk" FOREIGN KEY ("organization_id","locked_by") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;