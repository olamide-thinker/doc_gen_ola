CREATE TABLE IF NOT EXISTS "inventory_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"position" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_cat_business_idx" ON "inventory_categories" ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_inv_cat_name_per_business" ON "inventory_categories" ("business_id","name");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
