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
import { enqueueImmediateIngest, scheduleIngest } from "./queues/ingest";
import "./workers/ingest";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
    credentials: true
  })
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api", feedRoutes);
app.route("/api", signalsRoutes);
app.route("/api", storiesRoutes);
app.route("/api", briefingRoutes);
app.route("/api", qaRoutes);
app.route("/api", interestsRoutes);

scheduleIngest().catch((err) => {
  console.error("Failed to schedule ingest", err);
});
enqueueImmediateIngest().catch((err) => {
  console.error("Failed to enqueue initial ingest", err);
});

serve({
  fetch: app.fetch,
  port: Number(env.PORT)
});

console.log(`API listening on ${env.PORT}`);
