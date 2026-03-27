import { Hono } from "hono";
import type { AppEnv } from "../types/app";
import { getLatestBroadcast } from "../services/broadcast_cache";
import { generateGoogleSpeech } from "../services/google_voice";

const routes = new Hono<AppEnv>();

routes.get("/broadcast/generate", async (c) => {
  console.log("[Broadcast] Fetching latest scenes...");
  try {
    const scenes = await getLatestBroadcast();
    return c.json({ scenes });
  } catch (err) {
    console.error("[Broadcast] Fetch error:", err);
    return c.json({ error: "Failed to fetch broadcast" }, 500);
  }
});

const handleTts = async (c: any) => {
  const text =
    c.req.method === "POST"
      ? ((await c.req.json().catch(() => null)) as { text?: string } | null)?.text
      : c.req.query("text");

  if (!text) return c.json({ error: "No text provided" }, 400);

  console.log(`[TTS] Processing request (${c.req.method}) for text length: ${text.length}`);

  try {
    const stream = await generateGoogleSpeech(text);
    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": "inline",
    };

    return c.body(stream, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("[TTS] Stream error:", err);
    return c.json({ error: "TTS Failed", message: err.message }, 500);
  }
};

routes.get("/broadcast/tts", handleTts);
routes.post("/broadcast/tts", handleTts);

export default routes;
