import OpenAI from "openai";
import { env } from "../env";
import { withRetry } from "../utils/retry";

export const nvidia = new OpenAI({
  apiKey: env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const MODEL = "google/gemma-2-27b-it";

// ============================================================
// BACKGROUND QUEUE: Sequential, strict serialization for background
// workers (ingestion, story-ai). Prevents rate limit bursts.
// ============================================================
let executionQueue: Promise<any> = Promise.resolve();
let lastCallTime = 0;
let pauseUntil = 0;
const MIN_INTERVAL_MS = 4000; // 4s between background requests (~15 RPM)

// ============================================================
// USER-FACING QUEUE: A lighter-weight queue for interactive/user-
// triggered requests (translations, search, briefing asks).
// Uses a shorter interval so user doesn't wait behind ingestion.
// ============================================================
let userQueue: Promise<any> = Promise.resolve();
let lastUserCallTime = 0;
const USER_MIN_INTERVAL_MS = 2000; // 2s between user-facing requests

/**
 * Background AI queue: strict sequential, 4s gap, heartbeat support.
 * Use for ingestion, story-ai, and other background workers.
 */
export async function callNvidia<T>(fn: () => Promise<T>, onHeartbeat?: () => Promise<void>): Promise<T> {
  const currentLink = executionQueue;
  
  const nextLink = (async () => {
    let isWaiting = true;
    const heartbeatInterval = onHeartbeat 
      ? setInterval(async () => { if (isWaiting) await onHeartbeat(); }, 15000) 
      : null;

    try {
      await currentLink;
      isWaiting = false;
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      return await withRetry(async () => {
        const now = Date.now();
        
        if (now < pauseUntil) {
          const waitTime = pauseUntil - now;
          console.warn(`[AI-Global] Cooldown active. Waiting ${Math.ceil(waitTime / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const timeSinceLast = Date.now() - lastCallTime;
        if (timeSinceLast < MIN_INTERVAL_MS) {
          const waitTime = MIN_INTERVAL_MS - timeSinceLast;
          console.log(`[AI-Global] Sequential queue throttling for ${Math.round(waitTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        lastCallTime = Date.now();
        
        try {
          return await fn();
        } catch (error: any) {
          if (error?.status === 429) {
            console.warn(`[AI-Global] NVIDIA 429 received. Suspending queue for 2 mins...`);
            pauseUntil = Date.now() + 120 * 1000;
          }
          throw error;
        }
      }, { retries: 5, baseDelayMs: 2000 });
    } catch (e) {
      throw e;
    }
  })();

  executionQueue = nextLink.catch(() => {});
  return nextLink;
}

/**
 * User-facing AI queue: lighter throttle, no heartbeat needed.
 * Use for user-triggered requests: translations, vernacular, search.
 * Runs on a separate lane so it's never blocked by background ingestion.
 */
export async function callNvidiaFast<T>(fn: () => Promise<T>): Promise<T> {
  const currentLink = userQueue;

  const nextLink = (async () => {
    try {
      await currentLink;

      return await withRetry(async () => {
        const now = Date.now();

        // Still respect global 429 cooldowns
        if (now < pauseUntil) {
          const waitTime = pauseUntil - now;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const timeSinceLast = Date.now() - lastUserCallTime;
        if (timeSinceLast < USER_MIN_INTERVAL_MS) {
          await new Promise(resolve => setTimeout(resolve, USER_MIN_INTERVAL_MS - timeSinceLast));
        }

        lastUserCallTime = Date.now();

        try {
          return await fn();
        } catch (error: any) {
          if (error?.status === 429) {
            console.warn(`[AI-User] NVIDIA 429 received. Suspending for 2 mins...`);
            pauseUntil = Date.now() + 120 * 1000;
          }
          throw error;
        }
      }, { retries: 3, baseDelayMs: 1000 });
    } catch (e) {
      throw e;
    }
  })();

  userQueue = nextLink.catch(() => {});
  return nextLink;
}

export function setPause(durationMs: number) {
  pauseUntil = Date.now() + durationMs;
}

/**
 * Robust JSON extraction helper for NVIDIA models returned text alongside JSON.
 */
export function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1).trim();
  }
  
  return text.replace(/```json\n?|```\n?/g, "").trim();
}
