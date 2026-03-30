import { Queue } from "bullmq";
import { redis } from "../redis";

export const ingestQueue = new Queue("ingest", {
  connection: redis as any,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
  }
});

/**
 * Schedules the recurring ingest job.
 * Cleans up any existing repeat jobs first to prevent stale schedules
 * from persisting across server restarts.
 */
export async function scheduleIngest() {
  // Remove any stale repeat jobs so the schedule is always fresh
  const repeatableJobs = await ingestQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await ingestQueue.removeRepeatableByKey(job.key);
  }

  // Re-add the repeat job cleanly
  await ingestQueue.add(
    "ingest",
    {},
    {
      repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
      jobId: "ingest-repeat"
    }
  );

  console.log("[Ingest] Scheduled recurring ingest every 15 minutes.");
}

export async function enqueueImmediateIngest() {
  await ingestQueue.add(
    "ingest",
    {},
    {
      jobId: `ingest-boot-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 }
    }
  );
  console.log("[Ingest] Immediate ingest job enqueued.");
}

/**
 * Watchdog: checks every 5 minutes if ingest has been idle for too long
 * (e.g. because a job stalled or the worker crashed) and re-queues if so.
 */
export function startIngestWatchdog() {
  const IDLE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

  setInterval(async () => {
    try {
      const [active, waiting, delayed] = await Promise.all([
        ingestQueue.getActiveCount(),
        ingestQueue.getWaitingCount(),
        ingestQueue.getDelayedCount(),
      ]);

      // If nothing is active, waiting, or delayed — the scheduler may have died
      if (active === 0 && waiting === 0 && delayed === 0) {
        const completed = await ingestQueue.getJobs(["completed"], 0, 0);
        const lastJob = completed[0];
        const lastFinishedAt = lastJob?.finishedOn ?? 0;
        const idleMs = Date.now() - lastFinishedAt;

        if (idleMs > IDLE_THRESHOLD_MS) {
          console.warn(`[Ingest Watchdog] Ingest has been idle for ${Math.round(idleMs / 60000)}min. Re-queuing...`);
          await enqueueImmediateIngest();
        }
      }
    } catch (err) {
      console.error("[Ingest Watchdog] Error:", err);
    }
  }, 5 * 60 * 1000); // check every 5 minutes

  console.log("[Ingest] Watchdog started.");
}
