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

console.log("Worker listening for ingest and story AI jobs.");
