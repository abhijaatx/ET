import { Queue } from "bullmq";
import { redis } from "../redis";

export const ingestQueue = new Queue("ingest", {
  connection: redis as any
});

export async function scheduleIngest() {
  await ingestQueue.add(
    "ingest",
    {},
    {
      repeat: { every: 15 * 60 * 1000 },
      jobId: "ingest-repeat"
    }
  );
}

export async function enqueueImmediateIngest() {
  await ingestQueue.add(
    "ingest",
    {},
    {
      jobId: `ingest-initial-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 }
    }
  );
}
