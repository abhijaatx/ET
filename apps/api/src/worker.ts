import { clearScheduledIngest, enqueueImmediateIngest, scheduleIngest, startIngestWatchdog } from "./queues/ingest";
import "./workers/ingest";
import "./workers/story-ai";

const enabled = (value: string | undefined) => value !== "false";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

if (enabled(process.env.INGEST_SCHEDULE_ENABLED)) {
  scheduleIngest().catch((err: unknown) => {
    console.error("Failed to schedule ingest", err);
  });
} else {
  clearScheduledIngest().catch((err: unknown) => {
    console.error("Failed to clear scheduled ingest", err);
  });
}

if (enabled(process.env.INGEST_BOOT_ENABLED)) {
  enqueueImmediateIngest("boot").catch((err: unknown) => {
    console.error("Failed to enqueue initial ingest", err);
  });
}

if (enabled(process.env.INGEST_WATCHDOG_ENABLED)) {
  startIngestWatchdog();
}

console.log("Worker listening for ingest and story AI jobs.");
