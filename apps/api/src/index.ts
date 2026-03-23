import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { env } from "./env";
import authRoutes from "./routes/auth";
import feedRoutes from "./routes/feed";
import signalsRoutes from "./routes/signals";
import storiesRoutes from "./routes/stories";
import briefingRoutes from "./routes/briefing";
import qaRoutes from "./routes/qa";
import interestsRoutes from "./routes/interests";
import authorRoutes from "./routes/authors";
import notificationsRoutes from "./routes/notifications";
import userRoutes from "./routes/user";
import { enqueueImmediateIngest, scheduleIngest } from "./queues/ingest";
import "./workers/ingest";
import type { AppEnv } from "./types/app";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
  })
);

app.onError((err, c) => {
  console.error("Global API Error:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

app.get("/", (c) => c.text("The Economic Times - AI Briefing API is running. Visit /health for status."));
app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api", feedRoutes);
app.route("/api", signalsRoutes);
app.route("/api", storiesRoutes);
app.route("/api", briefingRoutes);
app.route("/api", qaRoutes);
app.route("/api", interestsRoutes);
app.route("/api", authorRoutes);
app.route("/api", notificationsRoutes);
app.route("/api", userRoutes);

/*
scheduleIngest().catch((err: unknown) => {
  console.error("Failed to schedule ingest", err);
});
enqueueImmediateIngest().catch((err: unknown) => {
  console.error("Failed to enqueue initial ingest", err);
});
*/

serve({
  fetch: app.fetch,
  port: Number(env.PORT)
});

console.log(`API listening on ${env.PORT}`);
