// Local dev entry point: imports the shared Hono app and adds workers + BullMQ ingestion
import { serve } from "@hono/node-server";
import { env } from "./env";
import app from "./app";
import { enqueueImmediateIngest, scheduleIngest, startIngestWatchdog } from "./queues/ingest";
import "./workers/ingest";
import "./workers/story-ai";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

scheduleIngest().catch((err: unknown) => {
  console.error("Failed to schedule ingest", err);
});
enqueueImmediateIngest().catch((err: unknown) => {
  console.error("Failed to enqueue initial ingest", err);
});
startIngestWatchdog();

serve({
  fetch: app.fetch,
  port: Number(env.PORT)
});

console.log(`API listening on ${env.PORT}`);
