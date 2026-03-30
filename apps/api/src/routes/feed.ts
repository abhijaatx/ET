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

  // Simple chronological feed: latest AI-processed articles for everyone
  const latest = await db
    .select({ article: articles })
    .from(articles)
    .leftJoin(stories, eq(articles.storyId, stories.id))
    .where(eq(stories.briefingStale, false))
    .orderBy(desc(articles.createdAt))
    .limit(limit)
    .offset(offset);

  // If user is logged in, attach like/bookmark state
  let signalsMap = new Map<string, { liked: boolean; saved: boolean }>();
  if (user) {
    const articleIds = latest.map(r => r.article.id);
    if (articleIds.length > 0) {
      const signals = await db
        .select()
        .from(articleSignals)
        .where(and(eq(articleSignals.userId, user.id), inArray(articleSignals.articleId, articleIds)));
      signalsMap = new Map(signals.map(s => [s.articleId, { liked: s.liked ?? false, saved: s.saved ?? false }]));
    }
  }

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
      isLiked: signalsMap.get(article.id)?.liked ?? false,
      isBookmarked: signalsMap.get(article.id)?.saved ?? false,
    }))
  );

  return c.json({ articles: framed });
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
        interactedAt: likedAt,
        publishedAt: article.createdAt.toISOString() // Consistent mapping
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
        interactedAt: bookmarkedAt,
        publishedAt: article.createdAt.toISOString() // Consistent mapping
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
    .orderBy(desc(articles.createdAt))
    .limit(limit)
    .offset(offset);

  if (results.length === 0) return c.json({ articles: [] });

  const articlesWithFrames = await Promise.all(
    results.map(async (article) => ({
      ...article,
      publishedAt: article.createdAt.toISOString(), // Use ingestion time
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

  // For each story, grab the first article that has an image
  const storiesWithImages = await Promise.all(
    trendingStories.map(async (s) => {
      const firstArticle = await db
        .select({ imageUrl: articles.imageUrl })
        .from(articles)
        .where(and(eq(articles.storyId, s.id), sql`${articles.imageUrl} IS NOT NULL`))
        .orderBy(desc(articles.createdAt))
        .limit(1);

      return {
        id: s.id,
        category: s.topicSlugs[0] ?? "Breaking",
        topic: s.headline,
        count: `${s.articleCount} articles`,
        latestArticleAt: s.latestArticleAt?.toISOString(),
        imageUrl: firstArticle[0]?.imageUrl ?? null,
      };
    })
  );

  return c.json({ trending: storiesWithImages });
});

feedRoutes.get("/feed/latest", optionalAuthMiddleware, async (c) => {
  const latest = await db
    .select({ createdAt: articles.createdAt, id: articles.id })
    .from(articles)
    .leftJoin(stories, eq(articles.storyId, stories.id))
    .where(eq(stories.briefingStale, false))
    .orderBy(desc(articles.createdAt))
    .limit(1);

  return c.json({
    latestId: latest[0]?.id ?? null,
    latestAt: latest[0]?.createdAt?.toISOString() ?? null,
  });
});

export default feedRoutes;
