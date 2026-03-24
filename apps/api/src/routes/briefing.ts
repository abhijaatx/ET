import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { articles, stories, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { generateBriefing } from "../services/briefing";
import type { AppEnv } from "../types/app";
import { generateStoryArc } from "../services/story_arc";

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
    articles: storyArticles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      content: a.content ?? "",
      author: a.author ?? null,
      authorId: a.authorId ?? null,
      published_at: a.publishedAt?.toISOString() ?? null,
    })),
  });
});

export default briefingRoutes;
