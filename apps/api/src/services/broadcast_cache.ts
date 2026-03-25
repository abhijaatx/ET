import { db } from "../db";
import { articles, stories, globalBroadcasts } from "@myet/db";
import { and, desc, isNotNull, not, eq, inArray, sql } from "drizzle-orm";
import { groqCompletion } from "./anthropic";

export async function refreshGlobalBroadcast() {
  console.log("[Broadcast] Refreshing global cache with deep intelligence...");
  try {
    // 1. Fetch top stories that have an AI-generated briefing, focused on TODAY
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    let topStories = await db
      .select({
        id: stories.id,
        headline: stories.headline,
        briefing: stories.briefingCache,
        articleIds: stories.articleIds
      })
      .from(stories)
      .where(
        and(
          isNotNull(stories.briefingCache),
          sql`${stories.latestArticleAt} >= ${todayMidnight}`
        )
      )
      .orderBy(desc(stories.latestArticleAt))
      .limit(15);

    // Fallback if no stories today yet
    if (topStories.length < 3) {
      console.log("[Broadcast] Low volume today, falling back to last 24h");
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      topStories = await db
        .select({
          id: stories.id,
          headline: stories.headline,
          briefing: stories.briefingCache,
          articleIds: stories.articleIds
        })
        .from(stories)
        .where(
          and(
            isNotNull(stories.briefingCache),
            sql`${stories.latestArticleAt} >= ${last24h}`
          )
        )
        .orderBy(desc(stories.latestArticleAt))
        .limit(15);
    }

    if (topStories.length === 0) {
      console.warn("[Broadcast] No stories with briefings found.");
      return;
    }

    // 2. Map image URLs for these stories (taking the first article's image)
    const allStoryArticleIds = topStories.flatMap(s => s.articleIds).filter(Boolean);
    const storyArticles = await db
      .select({
        id: articles.id,
        imageUrl: articles.imageUrl,
        storyId: articles.storyId
      })
      .from(articles)
      .where(
        and(
          inArray(articles.id, allStoryArticleIds.slice(0, 50)), // Safety limit
          isNotNull(articles.imageUrl),
          not(eq(articles.imageUrl, ""))
        )
      );

    const storyToImageMap = new Map<string, string>();
    for (const art of storyArticles) {
      if (art.storyId && !storyToImageMap.has(art.storyId)) {
        storyToImageMap.set(art.storyId, art.imageUrl!);
      }
    }

    // 3. Prepare the enriched data for Groq
    const enrichedItems = topStories.map(s => {
      const imageUrl = storyToImageMap.get(s.id);
      // Intelligence brief is usually a string in briefingCache or an object
      let intelligenceText = typeof s.briefing === 'string' ? s.briefing : JSON.stringify(s.briefing);
      
      // Truncate to save tokens (Groq 8B limit is tight)
      if (intelligenceText.length > 1000) {
        intelligenceText = intelligenceText.substring(0, 1000) + "...";
      }

      return {
        headline: s.headline,
        intelligence: intelligenceText,
        imageUrl: imageUrl || ""
      };
    }).filter(item => item.imageUrl);

    if (enrichedItems.length === 0) {
      console.warn("[Broadcast] No items with images found after enrichment.");
      return;
    }

    const prompt = `
      You are a Lead AI News Producer for The Economic Times. 
      Synthesize these top stories into a COMPREHENSIVE 2-minute global news broadcast.
      
      CRITICAL: Go beyond simple headlines. Use the provided "Intelligence Briefs" to give deep insights, data points, and context for each story.
      
      Return a JSON array of "scenes". Each scene must have:
      - duration: number (seconds) - Make it reasonably long if the narration is detailed (e.g. 10-20s per scene).
      - narration: string (the professional script to be read. Must be detailed and insightful, using the intelligence data.)
      - visualType: string (one of: "breaking_news", "market_update", "world_map", "tech_focus", "conclusion")
      - overlayTitle: string (short title for the overlay)
      - overlayBullets: string[] (2-3 key points derived from the intelligence brief)
      - imageUrl: string (ASSIGN the specific imageUrl provided for this story in the list below)
      
      Articles Data (Headlines + Intelligence Briefs + Image):
      ${enrichedItems.map(a => `
      - STORY: ${a.headline}
      - IMAGE: ${a.imageUrl}
      - INTELLIGENCE: ${a.intelligence}
      `).join("\n\n")}
      
      Output ONLY the raw JSON array. No markdown code blocks.
    `;

    console.log("[Broadcast] Requesting enriched script from Groq...");
    const scriptJson = await groqCompletion(
      "You are a professional broadcast producer. Output valid JSON array only. No preamble.",
      prompt
    );

    const scenes = JSON.parse(scriptJson);
    
    // Save to DB
    await db.transaction(async (tx) => {
      await tx.delete(globalBroadcasts);
      await tx.insert(globalBroadcasts).values({
        scenes: scenes,
        createdAt: new Date()
      });
    });

    console.log(`[Broadcast] Enriched cache refreshed successfully with ${scenes.length} detailed scenes`);
    return scenes;
  } catch (err) {
    console.error("[Broadcast] Enrichment error:", err);
    throw err;
  }
}

export async function getLatestBroadcast() {
  const latest = await db
    .select()
    .from(globalBroadcasts)
    .orderBy(desc(globalBroadcasts.createdAt))
    .limit(1);

  if (latest.length > 0) {
    const data = latest[0];
    const ageMs = Date.now() - (data?.createdAt?.getTime() || 0);
    
    // If cache is older than 20 mins, trigger a background refresh
    if (ageMs > 20 * 60 * 1000) {
      console.log("[Broadcast] Cache stale. Triggering background refresh.");
      refreshGlobalBroadcast().catch(e => console.error("BG Refresh failed", e));
    }
    
    return data?.scenes;
  }

  return await refreshGlobalBroadcast();
}
