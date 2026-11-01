CREATE TABLE "backup_run" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"file_path" text,
	"file_bytes" bigint,
	"secondary_copied" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "backup_run_created_at_index" ON "backup_run" USING btree ("created_at");--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "backup_run" FROM sms_app;
