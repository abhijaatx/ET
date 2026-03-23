CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS "stories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "headline" text NOT NULL,
  "article_ids" uuid[] NOT NULL DEFAULT '{}',
  "article_count" integer NOT NULL DEFAULT 0,
  "top_entities" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "topic_slugs" text[] NOT NULL DEFAULT '{}',
  "briefing_cache" jsonb,
  "briefing_stale" boolean NOT NULL DEFAULT true,
  "latest_article_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_id" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "summary" text NOT NULL,
  "url" text NOT NULL,
  "image_url" text,
  "source" text NOT NULL,
  "author" text,
  "published_at" timestamp,
  "topic_slugs" text[] NOT NULL DEFAULT '{}',
  "entities" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "story_id" uuid REFERENCES "stories"("id"),
  "embedding" vector(384),
  "article_type" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_topic_interests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "topic_slug" text NOT NULL,
  "weight" real NOT NULL DEFAULT 0,
  "depth_tier" text NOT NULL DEFAULT 'explainer',
  "article_count" integer NOT NULL DEFAULT 0,
  "avg_completion" real NOT NULL DEFAULT 0,
  "last_engaged_at" timestamp,
  "decay_factor" real NOT NULL DEFAULT 1,
  UNIQUE("user_id", "topic_slug")
);

CREATE TABLE IF NOT EXISTS "user_entity_affinity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "entity_name" text NOT NULL,
  "entity_type" text NOT NULL,
  "affinity_score" real NOT NULL DEFAULT 0,
  "mention_count" integer NOT NULL DEFAULT 0,
  "last_seen_at" timestamp,
  UNIQUE("user_id", "entity_name")
);

CREATE TABLE IF NOT EXISTS "article_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "article_id" uuid NOT NULL REFERENCES "articles"("id"),
  "time_spent_s" integer NOT NULL,
  "scroll_depth" real NOT NULL,
  "opened_briefing" boolean NOT NULL DEFAULT false,
  "shared" boolean NOT NULL DEFAULT false,
  "saved" boolean NOT NULL DEFAULT false,
  "engagement_score" real,
  "session_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION compute_engagement_score() RETURNS trigger AS $$
DECLARE
  wc integer;
  est_read_time_s numeric;
  ratio numeric;
  base numeric;
  multiplier numeric;
BEGIN
  SELECT COALESCE(array_length(regexp_split_to_array(COALESCE(a.content, ''), '\\s+'), 1), 0)
    INTO wc
    FROM articles a
    WHERE a.id = NEW.article_id;

  est_read_time_s = (wc / 3.5) * 60;
  IF est_read_time_s <= 0 THEN
    ratio = 0;
  ELSE
    ratio = LEAST(GREATEST(NEW.time_spent_s / est_read_time_s, 0), 1.5);
  END IF;

  base = ratio * COALESCE(NEW.scroll_depth, 0);
  multiplier = CASE
    WHEN NEW.opened_briefing THEN 1.5
    WHEN NEW.shared OR NEW.saved THEN 2.0
    ELSE 1.0
  END;

  NEW.engagement_score = LEAST(GREATEST(base * multiplier, 0), 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS article_signals_engagement_trigger ON article_signals;
CREATE TRIGGER article_signals_engagement_trigger
  BEFORE INSERT ON article_signals
  FOR EACH ROW EXECUTE FUNCTION compute_engagement_score();
