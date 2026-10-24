-- Roles are cluster-wide, so this must be safe to run in every database (sms_dev, sms_test, prod).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sms_app') THEN
    CREATE ROLE sms_app LOGIN;
  END IF;
END
$$;
--> statement-breakpoint
CREATE VIEW "attendance_effective" AS
  SELECT DISTINCT ON (enrollment_id, date) *
  FROM "attendance_event"
  ORDER BY enrollment_id, date, hlc DESC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO sms_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sms_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sms_app;
--> statement-breakpoint
-- Future tables get grants automatically. A NEW append-only table must add its own REVOKE in its migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sms_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sms_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log", "attendance_event", "ledger_entry", "receipt", "cash_close" FROM sms_app;
