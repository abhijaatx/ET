import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { articles, stories, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";
import { generateBriefing } from "../services/briefing";
import type { AppEnv } from "../types/app";
import { generateStoryArc } from "../services/story_arc";
import { deepScrapeArticle } from "../services/scraper";
import { generateVernacularBriefing, generateVernacularStoryArc, translateArticle } from "../services/vernacular";

const briefingRoutes = new Hono<AppEnv>();

briefingRoutes.get("/story-arc/:storyId", optionalAuthMiddleware, async (c) => {
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

briefingRoutes.get("/briefing/:storyId", optionalAuthMiddleware, async (c) => {
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

briefingRoutes.get("/briefing/:storyId/vernacular/:lang", optionalAuthMiddleware, async (c) => {
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
    console.error(`[Vernacular] Error generating briefing ${lang}:`, error);
    return c.json({ error: "Failed to generate vernacular briefing." }, 500);
  }
});

briefingRoutes.get("/story-arc/:storyId/vernacular/:lang", optionalAuthMiddleware, async (c) => {
  const storyId = c.req.param("storyId");
  const lang = c.req.param("lang");

  if (!storyId || !lang) {
    return c.json({ error: "Missing required parameters: storyId, lang" }, 400);
  }

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  const cache = (found.vernacularCache as Record<string, any>) || {};
  const cacheKey = `story_arc_${lang}`;
  if (cache[cacheKey]) {
    return c.json(cache[cacheKey]);
  }

  if (!found.storyArcCache) {
    return c.json({ error: "Story arc not found to translate." }, 404);
  }

  try {
    const vernacularArc = await generateVernacularStoryArc({
      storyId,
      lang,
      englishArc: found.storyArcCache
    });

    const newCache = { ...cache, [cacheKey]: vernacularArc };
    await db
      .update(stories)
      .set({ vernacularCache: newCache })
      .where(eq(stories.id, storyId));

    return c.json(vernacularArc);
  } catch (error: any) {
    console.error(`[Vernacular] Error generating story arc ${lang}:`, error);
    return c.json({ error: "Failed to generate vernacular story arc." }, 500);
  }
});

briefingRoutes.get("/articles/:storyId", optionalAuthMiddleware, async (c) => {
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
        if (deep && deep.content && deep.content.length > content.length) {
          content = deep.content;
          // Periodically update the DB in the background
          db.update(articles).set({ content: deep.content }).where(eq(articles.id, a.id)).execute().catch(() => {});
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

briefingRoutes.get("/articles/:articleId/vernacular/:lang", optionalAuthMiddleware, async (c) => {
  const articleId = c.req.param("articleId");
  const lang = c.req.param("lang");

  if (!articleId || !lang) {
    return c.json({ error: "Missing required parameters: articleId, lang" }, 400);
  }

  const articleResult = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  const found = articleResult[0];
  if (!found) return c.json({ error: "Article not found" }, 404);

  const cache = (found.vernacularCache as Record<string, any>) || {};
  if (cache[lang]) {
    return c.json(cache[lang]);
  }

  try {
    const translated = await translateArticle({
      lang,
      title: found.title,
      content: found.content
    });

    const newCache = { ...cache, [lang]: translated };
    await db
      .update(articles)
      .set({ vernacularCache: newCache })
      .where(eq(articles.id, articleId));

    return c.json(translated);
  } catch (error: any) {
    console.error(`[Vernacular] Error translating article ${articleId} to ${lang}:`, error);
    return c.json({ error: "Failed to translate article." }, 500);
  }
});

export default briefingRoutes;
