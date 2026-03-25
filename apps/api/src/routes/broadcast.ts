import { Hono } from "hono";
import { db } from "../db";
import { articles, stories } from "@myet/db";
import { and, desc, eq, isNotNull, not } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";
import { groqCompletion } from "../services/anthropic";

const routes = new Hono<AppEnv>();

routes.get("/broadcast/generate", authMiddleware, async (c) => {
  console.log("[Broadcast] Generation request received");
  try {
    // 1. Fetch top articles with images from recently ingested content
    const topArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        source: articles.source,
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
      - imageUrl: string (PICK the most relevant imageUrl from the articles provided below)
      
      Total duration should be between 60 and 120 seconds.
      Articles with their Images:
      ${topArticles.map(a => `- [IMAGE: ${a.imageUrl}] ${a.title}: ${a.summary ?? ""}`).join("\n")}
      
      Output ONLY the raw JSON array. No markdown code blocks.
    `;

    console.log("[Broadcast] Requesting script from Groq (Llama 3.1)...");
    const scriptJson = await groqCompletion(
      "You are a professional broadcast producer. Output valid JSON array only. No preamble.",
      prompt
    );

    const scenes = JSON.parse(scriptJson);
    console.log(`[Broadcast] Generated ${scenes.length} scenes`);
    return c.json({ scenes });
  } catch (err) {
    console.error("[Broadcast] Generation error:", err);
    return c.json({ error: "Failed to generate broadcast" }, 500);
  }
});

export default routes;
