CREATE TYPE "document_type" AS ENUM('TI', 'CC', 'RC', 'CE', 'Pasaporte');--> statement-breakpoint
CREATE TYPE "gender" AS ENUM('M', 'F', 'Otro');--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"document_type" "document_type" DEFAULT 'CC'::"document_type" NOT NULL,
	"document_number" text NOT NULL,
	"birth_date" date,
	"gender" "gender",
	"phone" text,
	"address" text,
	"country" text DEFAULT 'Colombia',
	"department" text,
	"municipality" text,
	"has_real_email" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_key" UNIQUE("username");--> statement-breakpoint
CREATE UNIQUE INDEX "person_userId_unique" ON "person" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_organizationId_documentNumber_unique" ON "person" ("organization_id","document_number");--> statement-breakpoint
CREATE INDEX "person_organizationId_names_idx" ON "person" ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "person_organizationId_isActive_idx" ON "person" ("organization_id","is_active");--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT;