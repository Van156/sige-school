CREATE TYPE "course_shift" AS ENUM('Mañana', 'Tarde', 'Nocturna', 'Única', 'Sabatina');--> statement-breakpoint
CREATE TYPE "jornada" AS ENUM('manana', 'tarde', 'completa');--> statement-breakpoint
CREATE TABLE "academic_period" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"academic_year" text NOT NULL,
	"order_num" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"short_name" varchar(10) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_period_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "academic_period_organizationId_year_shortName_unique" UNIQUE("organization_id","academic_year","short_name"),
	CONSTRAINT "academic_period_organizationId_year_orderNum_unique" UNIQUE("organization_id","academic_year","order_num"),
	CONSTRAINT "academic_period_order_check" CHECK ("order_num" between 1 and 4),
	CONSTRAINT "academic_period_dates_check" CHECK ("start_date" < "end_date"),
	CONSTRAINT "academic_period_year_check" CHECK ("academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "campus" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20),
	"address" varchar(200),
	"jornada" "jornada" DEFAULT 'completa'::"jornada" NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"campus_id" text NOT NULL,
	"level_id" text,
	"director_person_id" text,
	"name" varchar(50) NOT NULL,
	"academic_year" text NOT NULL,
	"shift" "course_shift" NOT NULL,
	"max_students" integer DEFAULT 40 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "course_organizationId_campusId_name_year_shift_unique" UNIQUE("organization_id","campus_id","name","academic_year","shift"),
	CONSTRAINT "course_max_students_check" CHECK ("max_students" between 1 and 60),
	CONSTRAINT "course_year_check" CHECK ("academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "grade_criterion" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"weight" numeric(5,2) NOT NULL,
	"description" varchar(300),
	"order_num" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grade_criterion_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "grade_criterion_weight_check" CHECK ("weight" > 0 and "weight" <= 100),
	CONSTRAINT "grade_criterion_order_check" CHECK ("order_num" >= 1)
);
--> statement-breakpoint
CREATE TABLE "grade_level" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"campus_id" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"order_num" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grade_level_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "grade_level_organizationId_campusId_id_unique" UNIQUE("organization_id","campus_id","id"),
	CONSTRAINT "grade_level_organizationId_campusId_name_unique" UNIQUE("organization_id","campus_id","name"),
	CONSTRAINT "grade_level_order_check" CHECK ("order_num" >= 0)
);
--> statement-breakpoint
CREATE TABLE "institution_profile" (
	"organization_id" text PRIMARY KEY,
	"nit" varchar(20),
	"address" varchar(200),
	"phone" varchar(20),
	"email" varchar(100),
	"municipality" varchar(100),
	"department" varchar(100),
	"resolution" varchar(100),
	"current_academic_year" text DEFAULT (extract(year from now())) NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institution_profile_year_check" CHECK ("current_academic_year" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_period_organizationId_active_unique" ON "academic_period" ("organization_id") WHERE "is_active";--> statement-breakpoint
CREATE UNIQUE INDEX "campus_organizationId_code_unique" ON "campus" ("organization_id","code") WHERE "code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "campus_organizationId_main_unique" ON "campus" ("organization_id") WHERE "is_main";--> statement-breakpoint
CREATE INDEX "campus_organizationId_name_idx" ON "campus" ("organization_id","name");--> statement-breakpoint
CREATE INDEX "course_organizationId_year_campusId_idx" ON "course" ("organization_id","academic_year","campus_id");--> statement-breakpoint
CREATE INDEX "grade_criterion_organizationId_orderNum_idx" ON "grade_criterion" ("organization_id","order_num");--> statement-breakpoint
CREATE INDEX "grade_level_organizationId_campusId_orderNum_idx" ON "grade_level" ("organization_id","campus_id","order_num");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_profile_nit_unique" ON "institution_profile" ("nit") WHERE "nit" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "subject_organizationId_code_unique" ON "subject" ("organization_id","code") WHERE "code" is not null;--> statement-breakpoint
CREATE INDEX "subject_organizationId_name_idx" ON "subject" ("organization_id","name");--> statement-breakpoint
ALTER TABLE "academic_period" ADD CONSTRAINT "academic_period_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campus" ADD CONSTRAINT "campus_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_campus_fk" FOREIGN KEY ("organization_id","campus_id") REFERENCES "campus"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_level_campus_fk" FOREIGN KEY ("organization_id","campus_id","level_id") REFERENCES "grade_level"("organization_id","campus_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_director_fk" FOREIGN KEY ("organization_id","director_person_id") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "grade_criterion" ADD CONSTRAINT "grade_criterion_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "grade_level" ADD CONSTRAINT "grade_level_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "grade_level" ADD CONSTRAINT "grade_level_campus_fk" FOREIGN KEY ("organization_id","campus_id") REFERENCES "campus"("organization_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "institution_profile" ADD CONSTRAINT "institution_profile_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;