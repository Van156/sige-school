CREATE TYPE "enrollment_status" AS ENUM('activa', 'cancelada', 'retirada');--> statement-breakpoint
CREATE TYPE "guardian_relationship" AS ENUM('Acudiente', 'Padre', 'Madre', 'Tío/a', 'Abuelo/a', 'Hermano/a', 'Otro');--> statement-breakpoint
CREATE TYPE "student_status" AS ENUM('activo', 'retirado', 'graduado');--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"offering_id" text NOT NULL,
	"academic_year" text NOT NULL,
	"enrollment_date" date DEFAULT current_date NOT NULL,
	"status" "enrollment_status" DEFAULT 'activa'::"enrollment_status" NOT NULL,
	"final_score" numeric(3,2),
	"status_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "enrollment_organizationId_studentId_offeringId_year_unique" UNIQUE("organization_id","student_id","offering_id","academic_year"),
	CONSTRAINT "enrollment_final_score_check" CHECK ("final_score" between 1 and 5),
	CONSTRAINT "enrollment_status_note_check" CHECK (char_length("status_note") <= 500),
	CONSTRAINT "enrollment_year_check" CHECK ("academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"person_id" text NOT NULL CONSTRAINT "student_personId_unique" UNIQUE,
	"campus_id" text NOT NULL,
	"course_id" text,
	"neighborhood" varchar(100),
	"stratum" smallint,
	"blood_type" varchar(5),
	"eps" varchar(100),
	"guardian_name" varchar(150),
	"guardian_phone" varchar(30),
	"guardian_email" varchar(100),
	"enrolled_year" text NOT NULL,
	"status" "student_status" DEFAULT 'activo'::"student_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "student_stratum_check" CHECK ("stratum" between 1 and 6),
	CONSTRAINT "student_enrolled_year_check" CHECK ("enrolled_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "student_guardian" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"guardian_person_id" text NOT NULL,
	"relationship" "guardian_relationship" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_guardian_guardianPersonId_studentId_unique" UNIQUE("guardian_person_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_organizationId_campusId_id_unique" UNIQUE("organization_id","campus_id","id");--> statement-breakpoint
CREATE INDEX "enrollment_organizationId_offeringId_idx" ON "enrollment" ("organization_id","offering_id");--> statement-breakpoint
CREATE INDEX "enrollment_organizationId_studentId_year_idx" ON "enrollment" ("organization_id","student_id","academic_year");--> statement-breakpoint
CREATE INDEX "student_organizationId_status_idx" ON "student" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "student_organizationId_courseId_idx" ON "student" ("organization_id","course_id");--> statement-breakpoint
CREATE INDEX "student_organizationId_campusId_idx" ON "student" ("organization_id","campus_id");--> statement-breakpoint
CREATE INDEX "student_guardian_organizationId_studentId_idx" ON "student_guardian" ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX "student_guardian_organizationId_guardianPersonId_idx" ON "student_guardian" ("organization_id","guardian_person_id");--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_fk" FOREIGN KEY ("organization_id","student_id") REFERENCES "student"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_offering_fk" FOREIGN KEY ("organization_id","offering_id") REFERENCES "offering"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_person_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_campus_fk" FOREIGN KEY ("organization_id","campus_id") REFERENCES "campus"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_course_campus_fk" FOREIGN KEY ("organization_id","campus_id","course_id") REFERENCES "course"("organization_id","campus_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_student_fk" FOREIGN KEY ("organization_id","student_id") REFERENCES "student"("organization_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_guardian_fk" FOREIGN KEY ("organization_id","guardian_person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;