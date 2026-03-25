import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { articles, stories, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { generateBriefing } from "../services/briefing";
import type { AppEnv } from "../types/app";
import { generateStoryArc } from "../services/story_arc";
import { deepScrapeArticle } from "../services/scraper";
import { generateVernacularBriefing } from "../services/vernacular";

const briefingRoutes = new Hono<AppEnv>();

briefingRoutes.get("/story-arc/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId as string))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  if (found.storyArcCache) {
    return c.json(found.storyArcCache);
  }

  return c.json({ error: "Story arc not yet generated. Please check back in a moment." }, 202);
});

briefingRoutes.get("/briefing/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId as string))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  if (found.briefingCache) {
    return c.json(found.briefingCache);
  }

  return c.json({ error: "Briefing not yet generated. Please check back in a moment." }, 202);
});

briefingRoutes.get("/briefing/:storyId/vernacular/:lang", authMiddleware, async (c) => {
  const storyIdRaw = c.req.param("storyId");
  const langRaw = c.req.param("lang");

  if (!storyIdRaw || !langRaw) {
    return c.json({ error: "Missing required parameters: storyId, lang" }, 400);
  }

  const storyId = storyIdRaw;
  const lang = langRaw;

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  const cache = (found.vernacularCache as Record<string, any>) || {};
  if (cache[lang]) {
    return c.json(cache[lang]);
  }

  if (!found.briefingCache) {
    return c.json({ error: "English briefing not found to translate." }, 404);
  }

  try {
    const vernacular = await generateVernacularBriefing({
      storyId,
      lang,
      englishBriefing: found.briefingCache
    });

    const newCache = { ...cache, [lang]: vernacular };
    await db
      .update(stories)
      .set({ vernacularCache: newCache })
      .where(eq(stories.id, storyId));

    return c.json(vernacular);
  } catch (error: any) {
    console.error(`[Vernacular] Error generating ${lang}:`, error);
    return c.json({ error: "Failed to generate vernacular briefing." }, 500);
  }
});

briefingRoutes.get("/articles/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId as string))
    .limit(1);

  if (!story[0]) return c.json({ error: "Story not found" }, 404);

  const storyArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId as string));

  return c.json({
    story_id: storyId,
    headline: story[0].headline,
    articles: await Promise.all(storyArticles.map(async (a) => {
      let content = a.content ?? "";
      
      // If content is missing or just a snippet (same as title or < 300 chars), try on-demand deep scrape
      if (!content || content.length < 300 || content === a.title) {
        const deep = await deepScrapeArticle(a.url, a.source);
        if (deep && deep.length > content.length) {
          content = deep;
          // Periodically update the DB in the background
          db.update(articles).set({ content: deep }).where(eq(articles.id, a.id)).execute().catch(() => {});
        }
      }

      return {
        id: a.id,
        title: a.title,
        url: a.url,
        content: content,
        author: a.author ?? null,
        authorId: a.authorId ?? null,
        published_at: a.publishedAt?.toISOString() ?? null,
      };
    })),
  });
});

export default briefingRoutes;
