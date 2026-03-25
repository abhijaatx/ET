import { Hono } from "hono";
import { db } from "../db";
import { articles, stories } from "@myet/db";
import { desc, eq } from "drizzle-orm";
import { googleCompletion } from "../services/google";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";

const routes = new Hono<AppEnv>();

routes.get("/broadcast/generate", authMiddleware, async (c) => {
  console.log("[Broadcast] Generation request received");
  try {
    // 1. Fetch top articles with images from non-stale stories
    const topArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        source: articles.source,
        imageUrl: articles.imageUrl
      })
      .from(articles)
      .innerJoin(stories, eq(articles.storyId, stories.id))
      .where(eq(stories.briefingStale, false))
      .orderBy(desc(articles.createdAt))
      .limit(5);

    console.log(`[Broadcast] Found ${topArticles.length} recent articles with images`);

    if (topArticles.length === 0) {
      return c.json({ scenes: [] });
    }

    // 2. Generate broadcast script
    const prompt = `
      You are an AI News Producer for The Economic Times. 
      Synthesize these top stories into a cohesive 90-second news broadcast script.
      Return a JSON array of "scenes". Each scene must have:
      - duration: number (seconds)
      - narration: string (the text to be read)
      - visualType: string (one of: "breaking_news", "market_update", "world_map", "tech_focus", "conclusion")
      - overlayTitle: string (short title for the overlay)
      - overlayBullets: string[] (2-3 key points)
      
      Total duration should be between 60 and 120 seconds.
      Articles:
      ${topArticles.map(a => `- ${a.title}: ${a.summary ?? ""}`).join("\n")}
      Output ONLY the raw JSON array. No markdown code blocks.
    `;

    console.log("[Broadcast] Requesting script from Gemini...");
    const rawScript = await googleCompletion(
      "You are a professional broadcast producer. Output valid JSON only. Do not use markdown blocks.",
      prompt
    );

    // Resilience: Clean markdown code blocks if present
    let scriptJson = rawScript;
    if (scriptJson.includes("```json")) {
       const parts = scriptJson.split("```json");
       if (parts.length > 1) {
         scriptJson = parts[1].split("```")[0].trim();
       }
    } else if (scriptJson.includes("```")) {
       const parts = scriptJson.split("```");
       if (parts.length > 1) {
         scriptJson = parts[1].split("```")[0].trim();
       }
    }

    const scenes = JSON.parse(scriptJson);
    console.log(`[Broadcast] Generated ${scenes.length} scenes`);
    return c.json({ scenes });
  } catch (err) {
    console.error("[Broadcast] Generation error:", err);
    return c.json({ error: "Failed to generate broadcast" }, 500);
  }
});

export default routes;
