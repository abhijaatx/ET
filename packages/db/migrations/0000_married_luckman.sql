CREATE TABLE IF NOT EXISTS "article_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"time_spent_s" integer NOT NULL,
	"scroll_depth" real NOT NULL,
	"opened_briefing" boolean DEFAULT false NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"engagement_score" real,
	"session_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"author" text,
	"published_at" timestamp,
	"topic_slugs" text[] DEFAULT '{}' NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"story_id" uuid,
	"embedding" vector(384),
	"article_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"headline" text NOT NULL,
	"article_ids" uuid[] DEFAULT '{}' NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"top_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic_slugs" text[] DEFAULT '{}' NOT NULL,
	"briefing_cache" jsonb,
	"briefing_stale" boolean DEFAULT true NOT NULL,
	"latest_article_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_entity_affinity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"affinity_score" real DEFAULT 0 NOT NULL,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_topic_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_slug" text NOT NULL,
	"weight" real DEFAULT 0 NOT NULL,
	"depth_tier" text DEFAULT 'explainer' NOT NULL,
	"article_count" integer DEFAULT 0 NOT NULL,
	"avg_completion" real DEFAULT 0 NOT NULL,
	"last_engaged_at" timestamp,
	"decay_factor" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "article_signals" ADD CONSTRAINT "article_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "article_signals" ADD CONSTRAINT "article_signals_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "articles" ADD CONSTRAINT "articles_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_entity_affinity" ADD CONSTRAINT "user_entity_affinity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_topic_interests" ADD CONSTRAINT "user_topic_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "articles_external_id_unique" ON "articles" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_entity_unique" ON "user_entity_affinity" USING btree ("user_id","entity_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_topic_unique" ON "user_topic_interests" USING btree ("user_id","topic_slug");