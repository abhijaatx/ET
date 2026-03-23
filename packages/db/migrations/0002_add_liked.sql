ALTER TABLE "article_signals" ADD COLUMN "liked" boolean NOT NULL DEFAULT false;

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
    WHEN NEW.shared OR NEW.saved OR NEW.liked THEN 2.0
    ELSE 1.0
  END;

  NEW.engagement_score = LEAST(GREATEST(base * multiplier, 0), 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
