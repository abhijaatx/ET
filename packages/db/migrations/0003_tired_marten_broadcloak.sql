ALTER TABLE "articles" ADD COLUMN "vernacular_cache" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "articles_created_at_idx" ON "articles" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stories_latest_article_idx" ON "stories" USING btree ("latest_article_at");