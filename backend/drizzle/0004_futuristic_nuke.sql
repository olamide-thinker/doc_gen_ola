DROP INDEX IF EXISTS "unique_project_member";--> statement-breakpoint
ALTER TABLE "project_members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_members" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "kind" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "display_name" text;