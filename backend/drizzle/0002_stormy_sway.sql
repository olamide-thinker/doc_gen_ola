CREATE TABLE IF NOT EXISTS "field_report_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"author_id" text,
	"body" text,
	"voice_url" text,
	"transcription" text,
	"attachments" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_code" text NOT NULL,
	"task_id" uuid,
	"title" text,
	"body" text NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"author_id" text,
	"voice_url" text,
	"transcription" text,
	"attachments" jsonb,
	"request" jsonb,
	"resolution" jsonb,
	"metadata" jsonb,
	"business_id" text,
	"project_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_report_idx" ON "field_report_messages" ("report_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_author_idx" ON "field_report_messages" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_project_idx" ON "field_reports" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_task_idx" ON "field_reports" ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_author_idx" ON "field_reports" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_kind_idx" ON "field_reports" ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_report_code_per_project" ON "field_reports" ("project_id","report_code");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_report_messages" ADD CONSTRAINT "field_report_messages_report_id_field_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "field_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_report_messages" ADD CONSTRAINT "field_report_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_reports" ADD CONSTRAINT "field_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
