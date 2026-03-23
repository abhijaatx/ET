import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { articleSignals, articles } from "@myet/db";
import { and, eq } from "drizzle-orm";
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
  saved: z.boolean().optional().default(false),
  liked: z.boolean().optional().default(false)
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

  const existing = await db
    .select()
    .from(articleSignals)
    .where(
      and(
        eq(articleSignals.userId, user!.id),
        eq(articleSignals.articleId, body.article_id)
      )
    )
    .limit(1);

  let finalEngagementScore = 0;

  if (existing[0]) {
    const s = existing[0];
    const newTimeSpentS = (s.timeSpentS ?? 0) + body.time_spent_s;
    const newScrollDepth = Math.max(s.scrollDepth ?? 0, body.scroll_depth);
    
    finalEngagementScore = calculateEngagementScore({
      wordCount,
      timeSpentS: newTimeSpentS,
      scrollDepth: newScrollDepth,
      openedBriefing: body.opened_briefing || s.openedBriefing,
      shared: body.shared || s.shared,
      saved: body.saved, // Use current body value for toggle
      liked: body.liked  // Use current body value for toggle
    });

    await db
      .update(articleSignals)
      .set({
        timeSpentS: newTimeSpentS,
        scrollDepth: newScrollDepth,
        openedBriefing: body.opened_briefing || s.openedBriefing,
        shared: body.shared || s.shared,
        saved: body.saved,
        liked: body.liked,
        engagementScore: finalEngagementScore,
        createdAt: new Date() // Update timestamp to reflect latest interaction
      })
      .where(eq(articleSignals.id, s.id));
  } else {
    finalEngagementScore = calculateEngagementScore({
      wordCount,
      timeSpentS: body.time_spent_s,
      scrollDepth: body.scroll_depth,
      openedBriefing: body.opened_briefing,
      shared: body.shared,
      saved: body.saved,
      liked: body.liked
    });
    await db.insert(articleSignals).values({
      userId: user!.id,
      articleId: body.article_id,
      timeSpentS: body.time_spent_s,
      scrollDepth: body.scroll_depth,
      openedBriefing: body.opened_briefing,
      shared: body.shared,
      saved: body.saved,
      liked: body.liked,
      sessionId: session!.id,
      engagementScore: finalEngagementScore
    });
  }

  await updateInterestGraphForSignal({
    userId: user!.id,
    articleId: body.article_id,
    engagementScore: finalEngagementScore
  });

  return c.json({ ok: true, engagementScore: finalEngagementScore });
});

export default signalsRoutes;
