import { db } from "../db";
import { articles, globalBroadcasts } from "@myet/db";
import { and, desc, isNotNull, not, eq } from "drizzle-orm";
import { groqCompletion } from "./anthropic";

export async function refreshGlobalBroadcast() {
  console.log("[Broadcast] Refreshing global cache...");
  try {
    const topArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        imageUrl: articles.imageUrl
      })
      .from(articles)
      .where(
        and(
          isNotNull(articles.imageUrl),
          not(eq(articles.imageUrl, ""))
        )
      )
      .orderBy(desc(articles.createdAt))
      .limit(8);

    if (topArticles.length === 0) return;

    const prompt = `
      You are an AI News Producer for The Economic Times. 
      Synthesize these top stories into a cohesive 90-second news broadcast script.
      Return a JSON array of "scenes". Each scene must have:
      - duration: number (seconds)
      - narration: string (the text to be read)
      - visualType: string (one of: "breaking_news", "market_update", "world_map", "tech_focus", "conclusion")
      - overlayTitle: string (short title for the overlay)
      - overlayBullets: string[] (2-3 key points)
      - imageUrl: string (PICK the most relevant imageUrl from the articles provided below)
      
      Total duration should be between 60 and 120 seconds.
      Articles with their Images:
      ${topArticles.map(a => `- [IMAGE: ${a.imageUrl}] ${a.title}: ${a.summary ?? ""}`).join("\n")}
      
      Output ONLY the raw JSON array. No markdown code blocks.
    `;

    const scriptJson = await groqCompletion(
      "You are a professional broadcast producer. Output valid JSON array only. No preamble.",
      prompt
    );

    const scenes = JSON.parse(scriptJson);
    
    // Save to DB (Always overwrite or keep 1 latest)
    await db.transaction(async (tx) => {
      // Clear old broadcasts (optional, but keep it clean)
      await tx.delete(globalBroadcasts);
      await tx.insert(globalBroadcasts).values({
        scenes: scenes,
        createdAt: new Date()
      });
    });

    console.log(`[Broadcast] Cache refreshed successfully with ${scenes.length} scenes`);
    return scenes;
  } catch (err) {
    console.error("[Broadcast] Refresh error:", err);
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

  // If no cache at all, we have to wait (first time only)
  return await refreshGlobalBroadcast();
}
