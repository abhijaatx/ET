import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { articleSignals, articles } from "@myet/db";
import { eq } from "drizzle-orm";
import { calculateEngagementScore } from "../utils/engagement";
import { updateInterestGraphForSignal } from "../services/interest";
import type { AppEnv } from "../types/app";

const signalsRoutes = new Hono<AppEnv>();

const signalSchema = z.object({
  article_id: z.string().uuid(),
  time_spent_s: z.number().int().nonnegative(),
  scroll_depth: z.number().min(0).max(1),
  opened_briefing: z.boolean().optional().default(false),
  shared: z.boolean().optional().default(false),
  saved: z.boolean().optional().default(false)
});

signalsRoutes.post("/signals", authMiddleware, async (c) => {
  const user = c.get("user");
  const session = c.get("session");
  const body = signalSchema.parse(await c.req.json());

  const article = await db
    .select({ content: articles.content })
    .from(articles)
    .where(eq(articles.id, body.article_id))
    .limit(1);

  const content = article[0]?.content ?? "";
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  const engagementScore = calculateEngagementScore({
    wordCount,
    timeSpentS: body.time_spent_s,
    scrollDepth: body.scroll_depth,
    openedBriefing: body.opened_briefing,
    shared: body.shared,
    saved: body.saved
  });

  await db.insert(articleSignals).values({
    userId: user.id,
    articleId: body.article_id,
    timeSpentS: body.time_spent_s,
    scrollDepth: body.scroll_depth,
    openedBriefing: body.opened_briefing,
    shared: body.shared,
    saved: body.saved,
    sessionId: session.id,
    engagementScore
  });

  await updateInterestGraphForSignal({
    userId: user.id,
    articleId: body.article_id,
    engagementScore
  });

  return c.json({ ok: true, engagementScore });
});

export default signalsRoutes;
