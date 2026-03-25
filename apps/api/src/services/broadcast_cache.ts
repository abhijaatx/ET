import { db } from "../db";
import { articles, stories } from "@myet/db";
import { and, desc, isNotNull, not, eq, inArray, sql } from "drizzle-orm";

export async function getLatestBroadcast() {
  console.log("[Broadcast] Constructing non-stop feed from processed stories...");
  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // 1. Fetch ALL stories from today that have briefings
    const todayStories = await db
      .select({
        id: stories.id,
        headline: stories.headline,
        briefing: stories.briefingCache,
        articleIds: stories.articleIds,
        latestArticleAt: stories.latestArticleAt
      })
      .from(stories)
      .where(
        and(
          isNotNull(stories.briefingCache),
          sql`${stories.latestArticleAt} >= ${todayMidnight}`
        )
      )
      .orderBy(desc(stories.latestArticleAt));

    // Fallback if no stories today yet
    let pool = todayStories;
    if (pool.length === 0) {
      console.log("[Broadcast] No stories today, falling back to all-time top processed");
      pool = await db
        .select({
          id: stories.id,
          headline: stories.headline,
          briefing: stories.briefingCache,
          articleIds: stories.articleIds,
          latestArticleAt: stories.latestArticleAt
        })
        .from(stories)
        .where(isNotNull(stories.briefingCache))
        .orderBy(desc(stories.latestArticleAt))
        .limit(100);
    }

    if (pool.length === 0) return [];

    // 2. Map images efficiently
    const allArticleIds = pool.flatMap(s => s.articleIds).filter(Boolean);
    const storyArticles = await db
      .select({
        id: articles.id,
        imageUrl: articles.imageUrl,
        storyId: articles.storyId
      })
      .from(articles)
      .where(
        and(
          inArray(articles.id, allArticleIds.slice(0, 200)),
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

    // 3. Map Stories to Scenes directly (No Groq synthesis required)
    const scenes = pool.map((s, index) => {
      const imageUrl = storyToImageMap.get(s.id) || "https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg";
      const briefing: any = s.briefing;
      
      const narration = briefing.executive_summary || "Analyzing latest developments...";
      const sectionTitles = (briefing.sections || []).map((sec: any) => sec.title.replace(/-/g, " ")).slice(0, 2);
      
      // Heuristic duration based on narration length (words / 150wpm * 60s)
      const wordCount = narration.split(/\s+/).length;
      const duration = Math.max(8, Math.round((wordCount / 140) * 60));

      return {
        id: s.id,
        duration: duration,
        narration: narration,
        visualType: index === 0 ? "breaking_news" : (index % 3 === 0 ? "tech_focus" : "market_update"),
        overlayTitle: s.headline,
        overlayBullets: sectionTitles.length > 0 ? sectionTitles : ["In-depth Analysis", "Market Impact"],
        imageUrl: imageUrl
      };
    }).filter(scene => scene.narration.length > 50); // Filter out empty or placeholder briefings

    console.log(`[Broadcast] Generated ${scenes.length} scenes directly from DB.`);
    return scenes;
  } catch (err) {
    console.error("[Broadcast] Direct mapping error:", err);
    return [];
  }
}

// Keep export for compatibility but it's no longer used for the main engine
export async function refreshGlobalBroadcast() {
  return await getLatestBroadcast();
}
