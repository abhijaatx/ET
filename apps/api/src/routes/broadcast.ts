import { Hono } from "hono";
import { db } from "../db";
import { articles, stories } from "@myet/db";
import { and, desc, isNotNull, not, eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";
import { getLatestBroadcast } from "../services/broadcast_cache";

const routes = new Hono<AppEnv>();

routes.get("/broadcast/generate", authMiddleware, async (c) => {
  console.log("[Broadcast] Fetching latest scenes...");
  try {
    const scenes = await getLatestBroadcast();
    return c.json({ scenes });
  } catch (err) {
    console.error("[Broadcast] Fetch error:", err);
    return c.json({ error: "Failed to fetch broadcast" }, 500);
  }
});

export default routes;
