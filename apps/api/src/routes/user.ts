import { Hono } from "hono";
import { db } from "../db";
import { 
  articleSignals, 
  userAuthorFollows, 
  userStoryFollows, 
  userTopicInterests,
  authors,
  stories,
  articles
} from "@myet/db";
import { eq, sql, desc, count } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";

const routes = new Hono<AppEnv>();

routes.get("/user/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ 
    id: user?.id,
    email: user?.email,
    name: user?.email?.split("@")[0] || "Guest"
  });
});

routes.get("/user/stats", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // 1. Basic engagement stats
    const [signalsStats] = await db
      .select({
        totalArticlesRead: count(articleSignals.id),
        totalTimeSpentS: sql<number>`COALESCE(SUM(${articleSignals.timeSpentS})::integer, 0)`,
        avgEngagement: sql<number>`COALESCE(AVG(${articleSignals.engagementScore}), 0)`
      })
      .from(articleSignals)
      .where(eq(articleSignals.userId, user.id));

    // 2. Follow counts
    const [authorFollowsCount] = await db
      .select({ count: count() })
      .from(userAuthorFollows)
      .where(eq(userAuthorFollows.userId, user.id));

    const [storyFollowsCount] = await db
      .select({ count: count() })
      .from(userStoryFollows)
      .where(eq(userStoryFollows.userId, user.id));

    // 3. Topic Distribution
    const topics = await db
      .select({
        name: userTopicInterests.topicSlug,
        weight: userTopicInterests.weight
      })
      .from(userTopicInterests)
      .where(eq(userTopicInterests.userId, user.id))
      .orderBy(desc(userTopicInterests.weight))
      .limit(5);

    // 4. Followed Authors (Detailed)
    const followedAuthors = await db
      .select({
        id: authors.id,
        name: authors.name,
        handle: authors.handle,
        avatarUrl: authors.avatarUrl
      })
      .from(authors)
      .innerJoin(userAuthorFollows, eq(authors.id, userAuthorFollows.authorId))
      .where(eq(userAuthorFollows.userId, user.id))
      .limit(10);

    // 5. Followed Stories (Detailed)
    const followedStories = await db
      .select({
        id: stories.id,
        headline: stories.headline,
        articleCount: stories.articleCount
      })
      .from(stories)
      .innerJoin(userStoryFollows, eq(stories.id, userStoryFollows.storyId))
      .where(eq(userStoryFollows.userId, user.id))
      .limit(5);

    // 6. Mock Subscription & Daily Engagement (for chart)
    const dailyEngagement = [
      { day: "Mon", score: 45 },
      { day: "Tue", score: 52 },
      { day: "Wed", score: 38 },
      { day: "Thu", score: 65 },
      { day: "Fri", score: 48 },
      { day: "Sat", score: 70 },
      { day: "Sun", score: 55 },
    ];

    return c.json({
      user: {
        email: user.email,
        name: user.email.split("@")[0],
        subscription: {
          plan: "Premium Plus",
          status: "Active",
          nextBilling: "2024-04-23"
        }
      },
      stats: {
        articlesRead: signalsStats?.totalArticlesRead || 0,
        timeSpentMins: Math.round((signalsStats?.totalTimeSpentS || 0) / 60),
        engagementScore: Math.round((signalsStats?.avgEngagement || 0) * 100),
        authorsFollowed: authorFollowsCount?.count || 0,
        storiesFollowed: storyFollowsCount?.count || 0
      },
      topics,
      followedAuthors,
      followedStories,
      dailyEngagement
    });
  } catch (err) {
    console.error("Stats fetch error:", err);
    return c.json({ error: "Failed to fetch user stats" }, 500);
  }
});

// GET Reading History
routes.get("/user/articles", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

  const history = await db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      author: articles.author,
      publishedAt: articles.publishedAt,
      readAt: articleSignals.createdAt,
      timeSpent: articleSignals.timeSpentS
    })
    .from(articleSignals)
    .innerJoin(articles, eq(articleSignals.articleId, articles.id))
    .where(eq(articleSignals.userId, user.id))
    .orderBy(desc(articleSignals.createdAt))
    .limit(50);

  return c.json({ history });
});

// GET Focus Time Analytics
routes.get("/user/focus", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

  const focusData = await db
    .select({
      date: sql<string>`DATE(${articleSignals.createdAt})`,
      totalSeconds: sql<number>`SUM(${articleSignals.timeSpentS})::integer`
    })
    .from(articleSignals)
    .where(eq(articleSignals.userId, user.id))
    .groupBy(sql`DATE(${articleSignals.createdAt})`)
    .orderBy(desc(sql`DATE(${articleSignals.createdAt})`))
    .limit(30);

  return c.json({ focusData });
});

// GET All Followed Authors
routes.get("/user/authors", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

  const followed = await db
    .select({
      id: authors.id,
      name: authors.name,
      handle: authors.handle,
      avatarUrl: authors.avatarUrl,
      bio: authors.bio,
      followersCount: authors.followersCount
    })
    .from(authors)
    .innerJoin(userAuthorFollows, eq(authors.id, userAuthorFollows.authorId))
    .where(eq(userAuthorFollows.userId, user.id))
    .orderBy(desc(userAuthorFollows.createdAt));

  return c.json({ authors: followed });
});

// GET All Followed Stories
routes.get("/user/stories", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

  const followed = await db
    .select({
      id: stories.id,
      headline: stories.headline,
      articleCount: stories.articleCount,
      latestArticleAt: stories.latestArticleAt
    })
    .from(stories)
    .innerJoin(userStoryFollows, eq(stories.id, userStoryFollows.storyId))
    .where(eq(userStoryFollows.userId, user.id))
    .orderBy(desc(userStoryFollows.createdAt));

  return c.json({ stories: followed });
});

export default routes;
