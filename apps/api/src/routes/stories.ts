import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { stories } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

const storiesRoutes = new Hono();

storiesRoutes.get("/stories", authMiddleware, async (c) => {
  const list = await db
    .select()
    .from(stories)
    .orderBy(desc(stories.latestArticleAt))
    .limit(50);

  return c.json({ stories: list });
});

export default storiesRoutes;
