import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { userEntityAffinity, userTopicInterests } from "@myet/db";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types/app";

const interestsRoutes = new Hono<AppEnv>();

interestsRoutes.get("/interests", authMiddleware, async (c) => {
  const user = c.get("user");
  const topics = await db
    .select()
    .from(userTopicInterests)
    .where(eq(userTopicInterests.userId, user!.id));

  const entities = await db
    .select()
    .from(userEntityAffinity)
    .where(eq(userEntityAffinity.userId, user!.id));

  return c.json({ topics, entities });
});

export default interestsRoutes;
