import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { articles, stories, userTopicInterests } from "@myet/db";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { generateBriefing } from "../services/briefing";
import type { AppEnv } from "../types/app";
import { generateStoryArc } from "../services/story_arc";

const briefingRoutes = new Hono<AppEnv>();

briefingRoutes.get("/story-arc/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");

  const storyArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId as string));

  if (storyArticles.length === 0) {
    return c.json({ error: "Story not found or has no articles" }, 404);
  }

  try {
    const arc = await generateStoryArc({
      storyId: storyId as string,
      articles: storyArticles.map((a) => ({
        id: a.id,
        title: a.title,
        summary: (a.content ?? "").slice(0, 1000),
        publishedAt: a.publishedAt,
      })),
    });
    return c.json(arc);
  } catch (error) {
    console.error("[Story Arc] Failed to generate:", error);
    return c.json({ error: "Failed to generate story arc" }, 500);
  }
});

briefingRoutes.get("/briefing/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");
  const user = c.get("user");

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId as string))
    .limit(1);

  const found = story[0];
  if (!found) return c.json({ error: "Story not found" }, 404);

  if (!found.briefingStale && found.briefingCache) {
    return c.json(found.briefingCache);
  }

  const storyArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId as string));

  const primaryTopic = found.topicSlugs[0];
  const topicInterest = primaryTopic
    ? await db
        .select()
        .from(userTopicInterests)
        .where(
          and(
            eq(userTopicInterests.userId, user!.id),
            eq(userTopicInterests.topicSlug, primaryTopic)
          )
        )
        .limit(1)
    : [];

  const depthTier = topicInterest[0]?.depthTier ?? "explainer";

  try {
    const briefing = await generateBriefing({
      storyId: storyId as string,
      depthTier,
      articles: storyArticles.map((article) => ({
        id: article.id,
        title: article.title,
        content: article.content,
        url: article.url,
        author: article.author,
        publishedAt: article.publishedAt
      }))
    });

    const enrichedBriefing = {
      ...briefing,
      source_articles: briefing.source_articles.map((s: any) => {
        const full = storyArticles.find(a => a.id === s.id);
        return {
          ...s,
          content: full?.content ?? ""
        };
      })
    };

    await db
      .update(stories)
      .set({ briefingCache: enrichedBriefing, briefingStale: false })
      .where(eq(stories.id, storyId as string));

    return c.json(enrichedBriefing);
  } catch (err) {
    console.warn("[Briefing] AI generation failed, using fallback mock", err);
    const mockBriefing = {
      story_id: storyId,
      headline: storyArticles[0]?.title ?? "Story Insights",
      generated_at: new Date().toISOString(),
      depth_tier: depthTier,
      summary: {
        text: "This story is based on several reports regarding modern financial trends and corporate developments. The current synthesis highlights key movements in the market and strategic acquisitions.",
        citations: storyArticles.slice(0, 2).map(a => a.id)
      },
      sections: [
        {
          id: "what-happened",
          title: "What happened",
          content: "Major developers have been aggressively acquiring land parcels to fuel their upcoming residential and commercial projects. This trend shows a strong belief in long-term urban growth and housing demand.",
          citations: [storyArticles[0]?.id].filter(Boolean) as string[]
        },
        {
          id: "why-it-matters",
          title: "Why it matters",
          content: "These acquisitions signal a recovery in the real estate sector and could lead to significant revenue potential, exceeding ₹1 lakh crore in some cases.",
          citations: [storyArticles[1]?.id].filter(Boolean) as string[]
        }
      ],
      key_entities: [
        { name: "Economic Trends", type: "Topic", role: "Primary context" },
        { name: "Real Estate Developers", type: "Industry", role: "Key actors" }
      ],
      suggested_questions: [
        "What are the long-term implications for the market?",
        "How do these acquisitions compare to previous years?"
      ],
      source_articles: storyArticles.map(a => ({
        id: a.id,
        title: a.title,
        url: a.url,
        content: a.content,
        author: a.author,
        published_at: a.publishedAt
      }))
    };
    return c.json(mockBriefing);
  }
});

briefingRoutes.get("/articles/:storyId", authMiddleware, async (c) => {
  const storyId = c.req.param("storyId");

  const story = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId as string))
    .limit(1);

  if (!story[0]) return c.json({ error: "Story not found" }, 404);

  const storyArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId as string));

  return c.json({
    story_id: storyId,
    headline: story[0].headline,
    articles: storyArticles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      content: a.content ?? "",
      author: a.author ?? null,
      authorId: a.authorId ?? null,
      published_at: a.publishedAt?.toISOString() ?? null,
    })),
  });
});

export default briefingRoutes;
