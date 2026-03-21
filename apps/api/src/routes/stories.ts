import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { stories } from "@myet/db";
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

export default storiesRoutes;
