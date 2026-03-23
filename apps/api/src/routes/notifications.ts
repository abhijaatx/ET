import { Hono } from "hono";
import { db } from "../db";
import { articles, authors, userAuthorFollows, userStoryFollows, stories } from "@myet/db";
import { eq, desc, inArray, or, and, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
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

    const results = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        source: articles.source,
        author: articles.author,
        authorId: articles.authorId,
        publishedAt: articles.publishedAt,
        topicSlugs: articles.topicSlugs,
        storyId: articles.storyId,
        image: sql<string>`null`, // Placeholder for image logic if needed
        frame: sql<string>`'Update'` // Label for notifications
      })
      .from(articles)
      .where(or(...conditions))
      .orderBy(desc(articles.publishedAt))
      .limit(limit)
      .offset(offset);

    // Group by author or story for metadata?
    // For now, just return as a flat list like Liked/Bookmarks

    return c.json({ articles: results });
  } catch (err) {
    console.error("Notifications error:", err);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

export default routes;
