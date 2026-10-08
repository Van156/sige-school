CREATE TYPE "import_kind" AS ENUM('users', 'students');--> statement-breakpoint
CREATE TYPE "import_status" AS ENUM('running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "import_job" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"kind" "import_kind" NOT NULL,
	"status" "import_status" DEFAULT 'running'::"import_status" NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"imported" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]' NOT NULL,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_job_counters_check" CHECK ("total" >= 0 and "processed" >= 0 and "imported" >= 0 and "skipped" >= 0),
	CONSTRAINT "import_job_errors_check" CHECK (jsonb_typeof("errors") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "import_job_organizationId_kind_running_unique" ON "import_job" ("organization_id","kind") WHERE "status" = 'running';--> statement-breakpoint
CREATE INDEX "import_job_organizationId_createdAt_idx" ON "import_job" ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_creator_fk" FOREIGN KEY ("organization_id","created_by") REFERENCES "person"("organization_id","id") ON DELETE RESTRICT;