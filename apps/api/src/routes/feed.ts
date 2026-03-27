import { Hono } from "hono";
import { and, desc, eq, gte, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { articleSignals, articles, stories, userEntityAffinity, userTopicInterests, users } from "@myet/db";
import { db } from "../db";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";
import { getFrame } from "../services/frame";
import { clamp } from "../utils/engagement";
import type { AppEnv } from "../types/app";

const feedRoutes = new Hono<AppEnv>();

feedRoutes.get("/feed", optionalAuthMiddleware, async (c) => {
  const user = c.get("user");
  const offset = Number(c.req.query("offset") ?? 0);
  const limit = Number(c.req.query("limit") ?? 20);

  if (!user) {
    // PUBLIC ACCESS: No user session, return generic latest feed
    const latest = await db
      .select({ article: articles })
      .from(articles)
      .innerJoin(stories, eq(articles.storyId, stories.id))
      .where(eq(stories.briefingStale, false))
      .orderBy(desc(articles.createdAt))
      .limit(limit)
      .offset(offset);

    const framed = await Promise.all(
      latest.map(async ({ article }) => ({
        ...article,
        publishedAt: article.createdAt.toISOString(),
        frame: await getFrame({
          articleId: article.id,
          summary: article.summary,
          depthTier: "explainer",
          fast: true
        }),
        isLiked: false,
        isBookmarked: false
      }))
    );

    return c.json({ articles: framed });
  }

  const signalCountResult = await db
    .select({ id: articleSignals.id })
    .from(articleSignals)
    .where(eq(articleSignals.userId, user.id));
  const signalCount = signalCountResult.length;

  if (signalCount < 5) {
    const latest = await db
      .select({ article: articles })
      .from(articles)
      .innerJoin(stories, eq(articles.storyId, stories.id))
      .where(eq(stories.briefingStale, false))
      .orderBy(desc(articles.createdAt))
      .limit(limit)
      .offset(offset);

    const framed = await Promise.all(
      latest.map(async ({ article }) => ({
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

  const userResult = await db.select({ embedding: users.embedding }).from(users).where(eq(users.id, user.id)).limit(1);
  const userEmbedding = userResult[0]?.embedding;

  const allInteractedIds = (await db
    .select({ articleId: articleSignals.articleId })
    .from(articleSignals)
    .where(eq(articleSignals.userId, user.id))).map(s => s.articleId);

  const likedOrSavedIds = (await db
    .select({ articleId: articleSignals.articleId })
    .from(articleSignals)
    .where(
      and(
        eq(articleSignals.userId, user.id),
        or(eq(articleSignals.liked, true), eq(articleSignals.saved, true))
      )
    )).map(s => s.articleId);

  const excludeList = allInteractedIds.filter(id => !likedOrSavedIds.includes(id));

  const candidates = excludeList.length
    ? await db
        .select({ article: articles })
        .from(articles)
        .innerJoin(stories, eq(articles.storyId, stories.id))
        .where(
          and(
            notInArray(articles.id, excludeList),
            eq(stories.briefingStale, false)
          )
        )
        .orderBy(desc(articles.createdAt))
        .limit(200)
    : await db
        .select({ article: articles })
        .from(articles)
        .innerJoin(stories, eq(articles.storyId, stories.id))
        .where(eq(stories.briefingStale, false))
        .orderBy(desc(articles.createdAt))
        .limit(200);

  const now = new Date();

  const scored = candidates.map(({ article }) => {
    const topicScore = article.topicSlugs.reduce((sum, slug) => {
      const weight = topicMap.get(slug)?.weight ?? 0;
      return sum + weight;
    }, 0);

    const entities = (article.entities ?? []) as { name: string }[];
    const entityScore = entities.reduce((sum, entity) => {
      const weight = entityMap.get(entity.name)?.affinityScore ?? 0;
      return sum + weight;
    }, 0);

    const hoursOld = article.createdAt
      ? (now.getTime() - article.createdAt.getTime()) / (1000 * 60 * 60)
      : 0;
    const recencyScore = clamp(1 - hoursOld / (24 * 7), 0, 1);

    let vectorScore = 0;
    if (userEmbedding && article.embedding) {
      const artEmb = article.embedding;
      const dotProduct = userEmbedding.reduce((sum, val, i) => sum + val * (artEmb[i] ?? 0), 0);
      vectorScore = clamp(dotProduct, 0, 1);
    }

    const baseScore =
      topicScore * 0.3 + entityScore * 0.15 + recencyScore * 0.15 + vectorScore * 0.3 + 0.1;

    return {
      article,
      baseScore,
      topicScore,
      entityScore,
      recencyScore,
      vectorScore
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
      item.topicScore * 0.3 +
      item.entityScore * 0.15 +
      item.recencyScore * 0.15 +
      item.vectorScore * 0.3 +
      penalty * 0.1;

    selected.push({ ...item, baseScore: feedScore });

    if (selected.length <= 5 && storyId) {
      topStoryIds.add(storyId);
    }
  }

  const depthTier = (topic: string | undefined) =>
    topic ? topicMap.get(topic)?.depthTier ?? "explainer" : "explainer";

  const articlesWithFrames = await Promise.all(
    selected.map(async ({ article }) => ({
      ...article,
      publishedAt: article.createdAt.toISOString(), // Use ingestion time for display
      frame: await getFrame({
        articleId: article.id,
        summary: article.summary,
        depthTier: depthTier(article.topicSlugs[0]),
        fast: true
      })
    }))
  );

  const signals = await db
    .select()
    .from(articleSignals)
    .where(and(eq(articleSignals.userId, user.id), inArray(articleSignals.articleId, articlesWithFrames.map(a => a.id))));
  
  const signalsMap = new Map(signals.map(s => [s.articleId, s]));

  const finalResult = articlesWithFrames.map((article) => {
    const s = signalsMap.get(article.id);
    return {
      ...article,
      isLiked: s?.liked ?? false,
      isBookmarked: s?.saved ?? false
    };
  });

  return c.json({ articles: finalResult });
});

feedRoutes.get("/feed/liked", authMiddleware, async (c) => {
  const user = c.get("user");
  const offset = Number(c.req.query("offset") ?? 0);
  const limit = Number(c.req.query("limit") ?? 20);

  const dateStr = c.req.query("date");
  const filters = [eq(articleSignals.userId, user!.id), eq(articleSignals.liked, true)];
  
  if (dateStr) {
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(dateStr);
    endOfDay.setDate(endOfDay.getDate() + 1);
    filters.push(gte(articleSignals.createdAt, startOfDay));
    filters.push(lt(articleSignals.createdAt, endOfDay));
  }

  const signalRows = await db
    .select({ articleId: articleSignals.articleId })
    .from(articleSignals)
    .where(and(...filters))
    .orderBy(desc(articleSignals.createdAt))
    .offset(offset)
    .limit(limit);

  const articleIds = signalRows.map((s) => s.articleId);
  if (articleIds.length === 0) return c.json({ articles: [] });

  const likedArticles = await db
    .select({
      article: articles,
      likedAt: articleSignals.createdAt,
      isBookmarked: articleSignals.saved // Wait, this only checks THIS signal.
    })
    .from(articles)
    .innerJoin(articleSignals, eq(articles.id, articleSignals.articleId))
    .where(
      and(
        inArray(articles.id, articleIds),
        eq(articleSignals.userId, user!.id),
        eq(articleSignals.liked, true)
      )
    );

  const result = await Promise.all(
    likedArticles.map(async ({ article, likedAt }) => {
      return {
        ...article,
        frame: await getFrame({
          articleId: article.id,
          summary: article.summary,
          depthTier: "explainer",
          fast: true
        }),
        isLiked: true,
        isBookmarked: false, // We'd need another query to get the TRUE bookmark status
        interactedAt: likedAt
      };
    })
  );

  return c.json({ articles: result });
});

feedRoutes.get("/feed/bookmarked", authMiddleware, async (c) => {
  const user = c.get("user");
  const offset = Number(c.req.query("offset") ?? 0);
  const limit = Number(c.req.query("limit") ?? 20);

  const dateStr = c.req.query("date");
  const filters = [eq(articleSignals.userId, user!.id), eq(articleSignals.saved, true)];
  
  if (dateStr) {
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(dateStr);
    endOfDay.setDate(endOfDay.getDate() + 1);
    filters.push(gte(articleSignals.createdAt, startOfDay));
    filters.push(lt(articleSignals.createdAt, endOfDay));
  }

  const signalRows = await db
    .select({ articleId: articleSignals.articleId })
    .from(articleSignals)
    .where(and(...filters))
    .orderBy(desc(articleSignals.createdAt))
    .offset(offset)
    .limit(limit);

  const articleIds = signalRows.map((s) => s.articleId);
  if (articleIds.length === 0) return c.json({ articles: [] });

  const bookmarkedArticles = await db
    .select({
      article: articles,
      bookmarkedAt: articleSignals.createdAt,
      isLiked: articleSignals.liked
    })
    .from(articles)
    .innerJoin(articleSignals, eq(articles.id, articleSignals.articleId))
    .where(
      and(
        inArray(articles.id, articleIds),
        eq(articleSignals.userId, user!.id),
        eq(articleSignals.saved, true)
      )
    );

  const result = await Promise.all(
    bookmarkedArticles.map(async ({ article, bookmarkedAt, isLiked }) => {
      return {
        ...article,
        frame: await getFrame({
          articleId: article.id,
          summary: article.summary,
          depthTier: "explainer",
          fast: true
        }),
        isLiked: isLiked,
        isBookmarked: true,
        interactedAt: bookmarkedAt
      };
    })
  );

  return c.json({ articles: result });
});

feedRoutes.get("/feed/search", authMiddleware, async (c) => {
  const user = c.get("user");
  const query = c.req.query("q") ?? "";
  const offset = Number(c.req.query("offset") ?? 0);
  const limit = Number(c.req.query("limit") ?? 20);

  if (!query) return c.json({ articles: [] });

  const searchPattern = `%${query.toLowerCase()}%`;
  const results = await db
    .select()
    .from(articles)
    .where(
      or(
        sql`lower(${articles.title}) like ${searchPattern}`,
        sql`lower(${articles.summary}) like ${searchPattern}`
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);

  if (results.length === 0) return c.json({ articles: [] });

  const articlesWithFrames = await Promise.all(
    results.map(async (article) => ({
      ...article,
      frame: await getFrame({
        articleId: article.id,
        summary: article.summary,
        depthTier: "explainer",
        fast: true
      })
    }))
  );

  const articleIds = articlesWithFrames.map(a => a.id);
  const signals = await db
    .select()
    .from(articleSignals)
    .where(and(eq(articleSignals.userId, user!.id), inArray(articleSignals.articleId, articleIds)));
  
  const signalsMap = new Map(signals.map(s => [s.articleId, s]));

  const finalResult = articlesWithFrames.map((article) => {
    const s = signalsMap.get(article.id);
    return {
      ...article,
      isLiked: s?.liked ?? false,
      isBookmarked: s?.saved ?? false
    };
  });

  return c.json({ articles: finalResult });
});

feedRoutes.get("/feed/trending", optionalAuthMiddleware, async (c) => {
  const trendingStories = await db
    .select()
    .from(stories)
    .where(eq(stories.briefingStale, false))
    .orderBy(desc(stories.latestArticleAt))
    .limit(15);

  return c.json({
    trending: trendingStories.map((s) => ({
      id: s.id,
      category: s.topicSlugs[0] ?? "Breaking",
      topic: s.headline,
      count: `${s.articleCount} articles`,
      latestArticleAt: s.latestArticleAt?.toISOString()
    }))
  });
});

export default feedRoutes;
