import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { stories, userStoryFollows } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";

const storiesRoutes = new Hono<AppEnv>();

storiesRoutes.get("/stories", authMiddleware, async (c) => {
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

  if (!user || !user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    await db
      .insert(userStoryFollows)
      .values({
        userId: user.id,
        storyId: storyId
      })
      .onConflictDoNothing();

    return c.json({ success: true });
  } catch (err) {
    console.error("Story follow error:", err);
    return c.json({ error: "Failed to follow story" }, 500);
  }
});

export default storiesRoutes;
