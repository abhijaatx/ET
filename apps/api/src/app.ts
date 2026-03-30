import { Hono } from "hono";
import { cors } from "hono/cors";
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
import broadcastRoutes from "./routes/broadcast";
import type { AppEnv } from "./types/app";

// Pure Hono app — no workers, no BullMQ, no node-server.
// Works in both local (index.ts adds workers) and Vercel (api/index.ts) contexts.
const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
  })
);

app.onError((err, c) => {
  console.error("Global API Error:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});

app.get("/", (c) => c.text("The Economic Times - AI Briefing API is running."));
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
app.route("/api", broadcastRoutes);

export default app;
