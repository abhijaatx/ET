import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { articles, stories, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { streamAnswer } from "../services/qa";
import type { AppEnv } from "../types/app";

const qaRoutes = new Hono<AppEnv>();

const questionSchema = z.object({
  question: z.string().min(2),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })
    )
    .optional()
    .default([])
});

qaRoutes.post("/briefing/:storyId/ask", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");
  const user = c.get("user");
  const body = questionSchema.parse(await c.req.json());

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  const storyArticles = await db
    .select({ id: articles.id, title: articles.title, content: articles.content })
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

  return streamSSE(c, async (stream) => {
    await streamAnswer({
      depthTier,
      articles: storyArticles,
      history: body.history,
      question: body.question,
      signal: c.req.raw.signal,
      onToken: async (token: string) => {
        await stream.writeSSE({ data: token });
      }
    });

    await stream.writeSSE({ data: "[DONE]" });
  });
});

export default qaRoutes;
