import { Hono } from "hono";
import { db } from "../db";
import { articles, userAuthorFollows, userStoryFollows, articleSignals } from "@myet/db";
import { eq, desc, inArray, or, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { getFrame } from "../services/frame";
import type { AppEnv } from "../types/app";

const routes = new Hono<AppEnv>();

routes.get("/notifications", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const offset = Number(c.req.query("offset") || 0);
  const limit = Number(c.req.query("limit") || 20);

  try {
    // 1. Get IDs of followed authors
    const followedAuthors = await db
      .select({ authorId: userAuthorFollows.authorId })
      .from(userAuthorFollows)
      .where(eq(userAuthorFollows.userId, user.id));
    
    const authorIds = followedAuthors.map(f => f.authorId);

    // 2. Get IDs of followed stories
    const followedStories = await db
      .select({ storyId: userStoryFollows.storyId })
      .from(userStoryFollows)
      .where(eq(userStoryFollows.userId, user.id));
    
    const storyIds = followedStories.map(f => f.storyId);

    if (authorIds.length === 0 && storyIds.length === 0) {
      return c.json({ articles: [] });
    }

    // 3. Fetch articles from followed authors or stories
    const conditions = [];
    if (authorIds.length > 0) {
      conditions.push(inArray(articles.authorId, authorIds));
    }
    if (storyIds.length > 0) {
      conditions.push(inArray(articles.storyId, storyIds));
    }

    const rawResults = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        content: articles.content,
        source: articles.source,
        author: articles.author,
        authorId: articles.authorId,
        createdAt: articles.createdAt,
        topicSlugs: articles.topicSlugs,
        storyId: articles.storyId,
        url: articles.url,
        isLiked: articleSignals.liked,
        isBookmarked: articleSignals.saved
      })
      .from(articles)
      .leftJoin(articleSignals, and(eq(articles.id, articleSignals.articleId), eq(articleSignals.userId, user.id)))
      .where(or(...conditions))
      .orderBy(desc(articles.createdAt))
      .limit(limit)
      .offset(offset);

    const framed = await Promise.all(
      rawResults.map(async (article) => ({
        ...article,
        publishedAt: article.createdAt.toISOString(),
        isLiked: article.isLiked ?? false,
        isBookmarked: article.isBookmarked ?? false,
        frame: await getFrame({
          articleId: article.id,
          summary: article.summary,
          depthTier: "explainer",
          fast: true
        })
      }))
    );

    return c.json({ articles: framed });
  } catch (err) {
    console.error("Notifications error:", err);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

export default routes;
