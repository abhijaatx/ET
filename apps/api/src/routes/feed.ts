import { Hono } from "hono";
import { desc, eq, notInArray } from "drizzle-orm";
import { articleSignals, articles, userEntityAffinity, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { getFrame } from "../services/frame";
import { clamp } from "../utils/engagement";

const feedRoutes = new Hono();

feedRoutes.get("/feed", authMiddleware, async (c) => {
  const user = c.get("user");
  const offset = Number(c.req.query("offset") ?? 0);
  const limit = Number(c.req.query("limit") ?? 20);

  const signalCountResult = await db
    .select({ id: articleSignals.id })
    .from(articleSignals)
    .where(eq(articleSignals.userId, user.id));
  const signalCount = signalCountResult.length;

  if (signalCount < 5) {
    const latest = await db
      .select()
      .from(articles)
      .orderBy(desc(articles.publishedAt))
      .limit(limit)
      .offset(offset);

    const framed = await Promise.all(
      latest.map(async (article) => ({
        ...article,
        frame: await getFrame({
          articleId: article.id,
          summary: article.summary,
          depthTier: "explainer",
          fast: true
        })
      }))
    );

    return c.json({ articles: framed });
  }

  const topicInterests = await db
    .select()
    .from(userTopicInterests)
    .where(eq(userTopicInterests.userId, user.id));

  const entityAffinities = await db
    .select()
    .from(userEntityAffinity)
    .where(eq(userEntityAffinity.userId, user.id));

  const topicMap = new Map(
    topicInterests.map((interest) => [interest.topicSlug, interest])
  );
  const entityMap = new Map(
    entityAffinities.map((affinity) => [affinity.entityName, affinity])
  );

  const readIds = await db
    .select({ articleId: articleSignals.articleId })
    .from(articleSignals)
    .where(eq(articleSignals.userId, user.id));

  const readList = readIds.map((row) => row.articleId);

  const candidates = readList.length
    ? await db
        .select()
        .from(articles)
        .where(notInArray(articles.id, readList))
        .orderBy(desc(articles.publishedAt))
        .limit(200)
    : await db
        .select()
        .from(articles)
        .orderBy(desc(articles.publishedAt))
        .limit(200);

  const now = new Date();

  const scored = candidates.map((article) => {
    const topicScore = article.topicSlugs.reduce((sum, slug) => {
      const weight = topicMap.get(slug)?.weight ?? 0;
      return sum + weight;
    }, 0);

    const entities = (article.entities ?? []) as { name: string }[];
    const entityScore = entities.reduce((sum, entity) => {
      const weight = entityMap.get(entity.name)?.affinityScore ?? 0;
      return sum + weight;
    }, 0);

    const daysOld = article.publishedAt
      ? (now.getTime() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const recencyScore = clamp(1 - daysOld / 7, 0, 1);

    const baseScore =
      topicScore * 0.45 + entityScore * 0.2 + recencyScore * 0.2 + 0.15;

    return {
      article,
      baseScore,
      topicScore,
      entityScore,
      recencyScore
    };
  });

  const sorted = scored.sort((a, b) => b.baseScore - a.baseScore);

  const selected: typeof scored = [];
  const topStoryIds = new Set<string>();

  for (const item of sorted) {
    if (selected.length >= limit) break;
    const storyId = item.article.storyId;
    const penalty = storyId && topStoryIds.has(storyId) ? 0.2 : 1;
    const feedScore =
      item.topicScore * 0.45 +
      item.entityScore * 0.2 +
      item.recencyScore * 0.2 +
      penalty * 0.15;

    selected.push({ ...item, baseScore: feedScore });

    if (selected.length <= 5 && storyId) {
      topStoryIds.add(storyId);
    }
  }

  const depthTier = (topic: string | undefined) =>
    topic ? topicMap.get(topic)?.depthTier ?? "explainer" : "explainer";

  const result = await Promise.all(
    selected.map(async ({ article }) => ({
      ...article,
      frame: await getFrame({
        articleId: article.id,
        summary: article.summary,
        depthTier: depthTier(article.topicSlugs[0]),
        fast: true
      })
    }))
  );

  return c.json({ articles: result });
});

export default feedRoutes;
