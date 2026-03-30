import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { articles, stories } from "@myet/db";
import { db } from "../db";
import { redis } from "../redis";
import { embedText } from "../services/embeddings";
import { fetchAllArticles, RawArticle } from "../services/news";
import { tagAndSummarize } from "../services/tagging";
import { enqueueStoryAI } from "../queues/story-ai";
import { deepScrapeArticle } from "../services/scraper";

async function processArticle(raw: RawArticle, heartbeat?: () => Promise<void>) {
  try {
    // 0. QUICK DEDUPLICATION: Check if we already have this article by externalId
    // Moving this to the very start of the worker to avoid scraping/AI calls for existing articles
    const existing = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.externalId, raw.externalId))
      .limit(1);

    if (existing.length > 0) return false; // Already processed

    // 1. Deep scrape for full content and potential image if missing/short
    let fullContent = raw.content;
    let currentImageUrl = raw.imageUrl;

    if (!fullContent || fullContent.length < 500 || !currentImageUrl) {
      console.log(`[ingest] Enriching article: ${raw.title}`);
      const enriched = await deepScrapeArticle(raw.url, raw.source);
      if (enriched) {
        if (enriched.content.length > (fullContent?.length || 0)) {
          fullContent = enriched.content;
        }
        if (!currentImageUrl && enriched.imageUrl) {
          currentImageUrl = enriched.imageUrl;
        }
      }
    }

    // Final Quality Check: Ensure we have sufficient content
    if (!fullContent || fullContent.length < 300) {
      return false;
    }

    // 2. Embedding with fallback (Xenova model might fail to download in some envs)
    let embedding: number[] = new Array(384).fill(0);
    try {
      const embedPromise = embedText(`${raw.title}\n${fullContent}`);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
      embedding = await Promise.race([embedPromise, timeoutPromise]) as number[];
    } catch (e) {
      console.warn(`[ingest] Embedding failed or timed out for ${raw.title}. Using zero-vector fallback.`);
    }

    if (heartbeat) await heartbeat(); // Refresh lock after potentially slow scraping/embedding

    const embeddingVector = sql`${`[${embedding.join(",")}]`}::vector`;

    const nearest = (await db.execute(
      sql`SELECT story_id FROM articles WHERE embedding <=> ${embeddingVector} < 0.18 ORDER BY embedding <=> ${embeddingVector} LIMIT 1`
    )) as { rows: { story_id: string | null }[] };

    let storyId: string | null = null;
    const nearestRow = nearest.rows[0];
    if (nearestRow?.story_id) {
      storyId = String(nearestRow.story_id);
    }

    // 3. Combined AI tagging and headline generation to save on AI requests
    const res = await tagAndSummarize({ title: raw.title, content: fullContent }, heartbeat);

    await db.transaction(async (tx) => {
      let finalStoryId = storyId;
      if (!finalStoryId) {
        const insertedStory = await tx
          .insert(stories)
          .values({
            headline: res.headline || raw.title,
            articleIds: [],
            articleCount: 0,
            topEntities: res.entities,
            topicSlugs: res.topicSlugs,
            latestArticleAt: new Date(),
            briefingStale: true
          })
          .returning({ id: stories.id });

        finalStoryId = insertedStory[0]?.id ?? null;
      }

      const insertedArticle = await tx
        .insert(articles)
        .values({
          externalId: raw.externalId,
          title: raw.title,
          content: fullContent,
          summary: res.summary,
          url: raw.url,
          imageUrl: currentImageUrl,
          source: raw.source,
          author: raw.author,
          publishedAt: raw.publishedAt,
          topicSlugs: res.topicSlugs,
          entities: res.entities,
          storyId: finalStoryId,
          embedding,
          articleType: res.articleType
        })
        .returning({ id: articles.id });

      const articleId = insertedArticle[0]?.id ?? null;
      console.log(`[ingest] ${raw.title}`);

      if (finalStoryId && articleId) {
        const story = await tx
          .select({
            articleIds: stories.articleIds,
            articleCount: stories.articleCount
          })
          .from(stories)
          .where(eq(stories.id, finalStoryId))
          .limit(1);

        const existingStory = story[0];
        const updatedIds = existingStory?.articleIds
          ? [...existingStory.articleIds, articleId]
          : [articleId];
        const updatedCount = (existingStory?.articleCount ?? 0) + 1;

        await tx
          .update(stories)
          .set({
            articleIds: updatedIds,
            articleCount: updatedCount,
            latestArticleAt: new Date(),
            briefingStale: true
          })
          .where(eq(stories.id, finalStoryId));

        await enqueueStoryAI(finalStoryId);
      }
    });

    return true; // Success
  } catch (error: any) {
    console.error(`[ingest] Failed to process article ${raw.title}:`, error.message);
    return false;
  }
}

export const ingestWorker = new Worker(
  "ingest",
  async (job) => {
    const rawArticles = await fetchAllArticles();
    console.log(`[ingest] Fetched ${rawArticles.length} raw articles. Process starting...`);

    let processedCount = 0;
    const CONCURRENCY = 5;

    const onHeartbeat = async () => {
      await job.updateProgress(1); // Small heartbeat to refresh lock
    };

    for (let i = 0; i < rawArticles.length; i += CONCURRENCY) {
      const batch = rawArticles.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(article => processArticle(article, onHeartbeat)));
      
      processedCount += results.filter(r => r).length;
      
      // Update job progress to let BullMQ know the worker is still active.
      await job.updateProgress(Math.ceil((i / rawArticles.length) * 100));
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[ingest] Batch complete. Ingested ${processedCount} new articles.`);

    // Refresh the global broadcast after ingestion to keep it "Ready" and fast.
    try {
      const { refreshGlobalBroadcast } = await import("../services/broadcast_cache");
      await refreshGlobalBroadcast();
    } catch (e) {
      console.error("[ingest] Failed to refresh global broadcast", e);
    }
  },
  {
    connection: redis as any,
    // CRITICAL: Increased lockDuration to allow jobs to survive long AI throttles/backlogs
    lockDuration: 3600000, // 1 hour (allow for long AI queues)
    stalledInterval: 60000, // Check for stalls every minute
  }
);

ingestWorker.on("failed", (job, err) => {
  console.error("Ingest job failed", job?.id, err);
});
