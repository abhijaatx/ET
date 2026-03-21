import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { articles, stories, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { generateBriefing } from "../services/briefing";
import type { AppEnv } from "../types/app";

const briefingRoutes = new Hono<AppEnv>();

briefingRoutes.get("/briefing/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");
  const user = c.get("user");

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  if (!found.briefingStale && found.briefingCache) {
    return c.json(found.briefingCache);
  }

  const storyArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId));

  const primaryTopic = found.topicSlugs[0];
  const topicInterest = primaryTopic
    ? await db
        .select()
        .from(userTopicInterests)
        .where(
          and(
            eq(userTopicInterests.userId, user.id),
            eq(userTopicInterests.topicSlug, primaryTopic)
          )
        )
        .limit(1)
    : [];

  const depthTier = topicInterest[0]?.depthTier ?? "explainer";

  const briefing = await generateBriefing({
    storyId,
    depthTier,
    articles: storyArticles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      url: article.url,
      author: article.author,
      publishedAt: article.publishedAt
    }))
  });

  await db
    .update(stories)
    .set({ briefingCache: briefing, briefingStale: false })
    .where(eq(stories.id, storyId));

  return c.json(briefing);
});

export default briefingRoutes;
