import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { articles, stories } from "@myet/db";
import { db } from "../db";
import { redis } from "../redis";
import { generateBriefing } from "../services/briefing";
import { generateStoryArc } from "../services/story_arc";

export const storyAIWorker = new Worker(
  "story-ai",
  async (job) => {
    const { storyId } = job.data;
    console.log(`[Story AI] Processing story ${storyId}`);

    const storyArticles = await db
      .select()
      .from(articles)
      .where(eq(articles.storyId, storyId));

    if (storyArticles.length === 0) {
      console.warn(`[Story AI] No articles found for story ${storyId}`);
      return;
    }

    try {
      // Create a heartbeat thunk that BullMQ understands
      const onHeartbeat = async () => {
        await job.updateProgress(10); // Ping to refresh lock
      };

      // 1. Generate Briefing
      console.log(`[Story AI] Generating briefing for ${storyId}...`);
      const briefing = await generateBriefing({
        storyId,
        depthTier: "explainer", // Default for background generation
        articles: storyArticles.map((article) => ({
          id: article.id,
          title: article.title,
          content: article.content,
          url: article.url,
          author: article.author,
          publishedAt: article.publishedAt
        }))
      }, onHeartbeat);

      // Enriched briefing with full content for frontend
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

      // 2. Generate Story Arc
      console.log(`[Story AI] Generating story arc for ${storyId}...`);
      const arc = await generateStoryArc({
        storyId,
        articles: storyArticles.map((a) => ({
          id: a.id,
          title: a.title,
          summary: (a.content ?? "").slice(0, 1000),
          publishedAt: a.publishedAt,
        })),
      }, onHeartbeat);

      // 3. Update Stories Table
      await db
        .update(stories)
        .set({
          briefingCache: enrichedBriefing,
          briefingStale: false,
          storyArcCache: arc,
          storyArcStale: false
        })
        .where(eq(stories.id, storyId));

      console.log(`[Story AI] Successfully updated story ${storyId}`);
    } catch (error) {
      console.error(`[Story AI] Failed to process story ${storyId}:`, error);
      throw error;
    }
  },
  {
    connection: redis as any,
    concurrency: 2, // Limit parallel AI calls
    lockDuration: 3600000, // 1 hour (allow for long AI queues)
    stalledInterval: 60000, // 1 minute
  }
);

storyAIWorker.on("failed", (job, err) => {
  console.error(`[Story AI] Job ${job?.id} failed:`, err);
});
