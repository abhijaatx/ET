import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { userEntityAffinity, userTopicInterests } from "@myet/db";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../types/app";
import { z } from "zod";

const interestsRoutes = new Hono<AppEnv>();

const topicSchema = z.object({
  topicSlug: z.string(),
  weight: z.number().min(0).max(1).optional().default(0.5)
});

const entitySchema = z.object({
  entityId: z.string(),
  affinityScore: z.number().min(0).max(10).optional().default(5)
});

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

interestsRoutes.post("/interests/topic", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = topicSchema.parse(await c.req.json());

  await db.insert(userTopicInterests).values({
    userId: user!.id,
    topicSlug: body.topicSlug,
    weight: body.weight,
    lastEngagedAt: new Date()
  }).onConflictDoUpdate({
    target: [userTopicInterests.userId, userTopicInterests.topicSlug],
    set: { weight: body.weight, lastEngagedAt: new Date() }
  });

  return c.json({ success: true });
});

interestsRoutes.delete("/interests/topic/:slug", authMiddleware, async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");

  if (!user?.id || !slug) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  await db.delete(userTopicInterests).where(
    and(
      eq(userTopicInterests.userId, user.id),
      eq(userTopicInterests.topicSlug, slug)
    )
  );

  return c.json({ success: true });
});

interestsRoutes.post("/interests/entity", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = entitySchema.parse(await c.req.json());

  await db.insert(userEntityAffinity).values({
    userId: user!.id,
    entityName: body.entityId,
    entityType: "organization", // default
    affinityScore: body.affinityScore,
    lastSeenAt: new Date()
  }).onConflictDoUpdate({
    target: [userEntityAffinity.userId, userEntityAffinity.entityName],
    set: { affinityScore: body.affinityScore, lastSeenAt: new Date() }
  });

  return c.json({ success: true });
});

interestsRoutes.delete("/interests/entity/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  if (!user?.id || !id) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  await db.delete(userEntityAffinity).where(
    and(
      eq(userEntityAffinity.userId, user.id),
      eq(userEntityAffinity.entityName, id)
    )
  );

  return c.json({ success: true });
});

export default interestsRoutes;
