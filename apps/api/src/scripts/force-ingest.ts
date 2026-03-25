import { eq, sql } from "drizzle-orm";
import { articles, stories } from "@myet/db";
import { db } from "../db";
import { embedText } from "../services/embeddings";
import { fetchAllArticles } from "../services/news";
import { tagArticle } from "../services/tagging";
import { callGroq, groqCompletion } from "../services/anthropic";
import { deepScrapeArticle } from "../services/scraper";
import { enqueueStoryAI } from "../queues/story-ai";

async function generateHeadline(title: string, summary: string) {
  try {
    return await callGroq(async () => {
      return await groqCompletion(
        "Generate a canonical headline for this story.",
        `Title: ${title}\nSummary: ${summary}\nReturn ONLY a concise canonical headline, with no extra text or quotation marks.`
      );
    });
  } catch (e) {
    return title;
  }
}

async function forceIngest() {
  console.log("[Force Ingest] Starting script execution...");
  console.log("[Force Ingest] Process PID:", process.pid);
  console.log("[Force Ingest] Fetching articles...");
  const allRawArticles = await fetchAllArticles();
  console.log("[Force Ingest] Fetched all articles successfully.");
  const uniqueArticlesMap = new Map();
  allRawArticles.forEach(a => uniqueArticlesMap.set(a.externalId, a));
  const rawArticles = Array.from(uniqueArticlesMap.values());
  
  console.log(`[Force Ingest] Fetched ${allRawArticles.length} articles, ${rawArticles.length} unique.`);

  let count = 0;
  const batchSize = 2; // Reduced for safety
  
  for (let i = 0; i < rawArticles.length; i += batchSize) {
    const batch = rawArticles.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (raw) => {
      try {
        const existing = await db
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.externalId, raw.externalId))
          .limit(1);

        if (existing.length > 0) return;

        console.log(`[Force Ingest] Processing: ${raw.title}`);
        
        let actualContent = raw.content;
        let currentImageUrl = raw.imageUrl;

        if (!actualContent || actualContent.length < 500 || !currentImageUrl) {
          console.log(`[Force Ingest] Enriching: ${raw.title}`);
          const enriched = await deepScrapeArticle(raw.url, raw.source);
          if (enriched) {
            if (enriched.content.length > (actualContent?.length || 0)) {
              actualContent = enriched.content;
            }
            if (!currentImageUrl && enriched.imageUrl) {
              currentImageUrl = enriched.imageUrl;
              console.log(`[Force Ingest] Found image for: ${raw.title}`);
            }
          }
        }

        // Final Quality Check: Ensure we have content and an image
        if (!actualContent || actualContent.length < 300 || !currentImageUrl) {
          console.log(`[Force Ingest] Skipping (Incomplete): ${raw.title}`);
          return;
        }

        const embedding = await embedText(`${raw.title}\n${actualContent}`);
        const embeddingVector = sql`${`[${embedding.join(",")}]`}::vector`;

        const nearest = (await db.execute(
          sql`SELECT story_id FROM articles WHERE embedding <=> ${embeddingVector} < 0.18 ORDER BY embedding <=> ${embeddingVector} LIMIT 1`
        )) as { rows: { story_id: string | null }[] };

        let storyId: string | null = null;
        const nearestRow = nearest.rows[0];
        if (nearestRow?.story_id) {
          storyId = String(nearestRow.story_id);
        }

        const tag = await tagArticle({ title: raw.title, content: actualContent, initialCategory: raw.category });
        console.log(`[Force Ingest] Tagged "${raw.title}" -> ${tag.topicSlugs.join(", ")}`);
        const headline = storyId ? null : await generateHeadline(raw.title, tag.summary);

        await db.transaction(async (tx) => {
          let finalStoryId = storyId;
          if (!finalStoryId) {
            const insertedStory = await tx
              .insert(stories)
              .values({
                headline: headline ?? raw.title,
                articleIds: [],
                articleCount: 0,
                topEntities: tag.entities,
                topicSlugs: tag.topicSlugs,
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
              content: actualContent,
              summary: tag.summary,
              url: raw.url,
              imageUrl: currentImageUrl,
              source: raw.source,
              author: raw.author,
              publishedAt: raw.publishedAt,
              topicSlugs: tag.topicSlugs,
              entities: tag.entities,
              storyId: finalStoryId,
              embedding,
              articleType: tag.articleType
            })
            .returning({ id: articles.id });

          const articleId = insertedArticle[0]?.id ?? null;
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
            const updatedIds = existingStory?.articleIds ? [...existingStory.articleIds, articleId] : [articleId];
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

            // Trigger background AI processing
            await enqueueStoryAI(finalStoryId);
          }
        });

        count++;
      } catch (err) {
        console.error(`[Force Ingest] Error processing ${raw.title}:`, err);
      }
    }));
    
    if (count % 50 === 0) {
      console.log(`[Force Ingest] Progress: ${count} articles processed...`);
    }
    // Batch delay to respect TPM/RPM
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`[Force Ingest] Completed. Added ${count} new articles.`);
  process.exit(0);
}

forceIngest();
