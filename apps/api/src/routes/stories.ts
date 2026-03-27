import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { stories, userStoryFollows } from "@myet/db";
import { db } from "../db";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";

const storiesRoutes = new Hono<AppEnv>();

storiesRoutes.get("/stories", optionalAuthMiddleware, async (c) => {
  const list = await db
    .select()
    .from(stories)
    .orderBy(desc(stories.latestArticleAt))
    .limit(50);

  return c.json({ stories: list });
});

storiesRoutes.post("/stories/:id/follow", authMiddleware, async (c) => {
  const storyId = c.req.param("id");
  const user = c.get("user");

  if (!user?.id || !storyId) {
    return c.json({ error: "Unauthorized or missing ID" }, 401);
  }

  try {
    await db
      .insert(userStoryFollows)
      .values({
        userId: user.id as string,
        storyId: storyId as string
      })
      .onConflictDoNothing();

    return c.json({ success: true });
  } catch (err) {
    console.error("Story follow error:", err);
    return c.json({ error: "Failed to follow story" }, 500);
  }
});

storiesRoutes.delete("/stories/:id/unfollow", authMiddleware, async (c) => {
  const storyId = c.req.param("id");
  const user = c.get("user");

  if (!user?.id || !storyId) {
    return c.json({ error: "Unauthorized or missing ID" }, 401);
  }

  try {
    await db
      .delete(userStoryFollows)
      .where(
        and(
          eq(userStoryFollows.userId, user.id as string),
          eq(userStoryFollows.storyId, storyId as string)
        )
      );

    return c.json({ success: true });
  } catch (err) {
    console.error("Story unfollow error:", err);
    return c.json({ error: "Failed to unfollow story" }, 500);
  }
});

storiesRoutes.get("/stories/followed", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user || !user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const followed = await db
    .select({
      id: stories.id,
      headline: stories.headline,
      latestArticleAt: stories.latestArticleAt,
      articleCount: stories.articleCount
    })
    .from(userStoryFollows)
    .innerJoin(stories, eq(userStoryFollows.storyId, stories.id))
    .where(eq(userStoryFollows.userId, user.id))
    .orderBy(desc(stories.latestArticleAt));

  return c.json({ stories: followed });
});

export default storiesRoutes;
