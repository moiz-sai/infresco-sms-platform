CREATE TABLE "developer_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"install_id" uuid DEFAULT uuidv7() NOT NULL,
	"license_json" jsonb,
	"license_sig" text,
	"logo_data" text,
	"logo_type" text,
	"footer_en" text,
	"footer_ur" text,
	"backup_primary_dir" text,
	"backup_secondary_dir" text,
	"backup_times" jsonb DEFAULT '["13:30"]'::jsonb NOT NULL,
	"backup_keep" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "installation_installId_unique" UNIQUE("install_id")
);
--> statement-breakpoint
CREATE INDEX "developer_log_created_at_index" ON "developer_log" USING btree ("created_at");--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "developer_log" FROM sms_app;
