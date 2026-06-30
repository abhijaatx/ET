import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { env } from "../env";

const pool = new Pool({ connectionString: env.DATABASE_URL });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compatibilitySql = `
CREATE TABLE IF NOT EXISTS "authors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "handle" text NOT NULL,
  "bio" text,
  "avatar_url" text,
  "followers_count" integer DEFAULT 0 NOT NULL,
  "genres" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "authors_name_unique" UNIQUE("name"),
  CONSTRAINT "authors_handle_unique" UNIQUE("handle")
);

CREATE TABLE IF NOT EXISTS "global_broadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_author_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_story_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "story_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "article_signals" ADD COLUMN IF NOT EXISTS "liked" boolean DEFAULT false NOT NULL;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "author_id" uuid;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "vernacular_cache" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "story_arc_cache" jsonb;
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "story_arc_stale" boolean DEFAULT true NOT NULL;
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "vernacular_cache" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "embedding" vector(384);

DO $$ BEGIN
  ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_author_follows" ADD CONSTRAINT "user_author_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_author_follows" ADD CONSTRAINT "user_author_follows_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_story_follows" ADD CONSTRAINT "user_story_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_story_follows" ADD CONSTRAINT "user_story_follows_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_author_unique" ON "user_author_follows" USING btree ("user_id","author_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_story_unique" ON "user_story_follows" USING btree ("user_id","story_id");
CREATE INDEX IF NOT EXISTS "articles_created_at_idx" ON "articles" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "stories_latest_article_idx" ON "stories" USING btree ("latest_article_at");
`;

async function run() {
  const migrationPath = path.resolve(
    __dirname,
    "../../../../packages/db/migrations/0000_init.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");
  await pool.query(sql);
  await pool.query(compatibilitySql);
  await pool.end();
  console.log("Migrations applied");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
