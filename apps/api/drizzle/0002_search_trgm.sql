CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_search_text_trgm" ON "person" USING gin ("search_text" gin_trgm_ops);
