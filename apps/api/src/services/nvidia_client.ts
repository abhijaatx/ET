import OpenAI from "openai";
import { env } from "../env";
import { redis } from "../redis";
import { withRetry } from "../utils/retry";

export const nvidia = new OpenAI({
  apiKey: env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const MODEL = "google/gemma-2-27b-it";

export function hasUsableNvidiaKey() {
  const key = env.NVIDIA_API_KEY.trim().toLowerCase();
  return Boolean(key && !["dev-placeholder", "placeholder", "changeme"].includes(key));
}

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

// ============================================================
// GROQ QUEUE: Shared across API and worker containers through Redis.
// The free/low-cost Groq tier is token-per-minute constrained, so a
// process-local queue is not enough once Docker Compose runs multiple
// Node processes.
// ============================================================
let groqQueue: Promise<any> = Promise.resolve();
let lastGroqFallbackCallTime = 0;
let groqPauseUntil = 0;
const GROQ_MIN_INTERVAL_MS = readIntervalMs(env.GROQ_MIN_INTERVAL_MS, 25000);
const GROQ_COOLDOWN_MS = readIntervalMs(env.GROQ_COOLDOWN_MS, 120000);
const GROQ_SLOT_KEY = "ai:groq:next_at";
const GROQ_COOLDOWN_KEY = "ai:groq:cooldown_until";

const CLAIM_AI_SLOT_SCRIPT = `
local key = KEYS[1]
local interval = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local next_at = tonumber(redis.call("GET", key) or "0")
local wait = 0
if next_at > now then
  wait = next_at - now
end
redis.call("SET", key, now + wait + interval, "PX", ttl)
return wait
`;

function readIntervalMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function sleepWithHeartbeat(durationMs: number, onHeartbeat?: () => Promise<void>) {
  if (durationMs <= 0) return;

  let done = false;
  const heartbeatInterval = onHeartbeat
    ? setInterval(async () => {
        if (!done) await onHeartbeat();
      }, 15000)
    : null;

  try {
    await new Promise(resolve => setTimeout(resolve, durationMs));
  } finally {
    done = true;
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  }
}

async function waitForGroqCooldown(onHeartbeat?: () => Promise<void>) {
  let sharedPauseUntil = 0;
  try {
    sharedPauseUntil = Number(await redis.get(GROQ_COOLDOWN_KEY) ?? "0");
  } catch (error: any) {
    console.warn(`[AI-Groq] Shared cooldown check failed: ${error?.message ?? error}`);
  }

  const waitTime = Math.max(groqPauseUntil, sharedPauseUntil) - Date.now();
  if (waitTime > 0) {
    console.warn(`[AI-Groq] Cooldown active. Waiting ${Math.ceil(waitTime / 1000)}s...`);
    await sleepWithHeartbeat(waitTime, onHeartbeat);
  }
}

async function acquireSharedGroqSlot(onHeartbeat?: () => Promise<void>) {
  if (GROQ_MIN_INTERVAL_MS <= 0) return;

  try {
    const ttlMs = Math.max(GROQ_MIN_INTERVAL_MS * 8, 60000);
    const waitResult = await redis.eval(
      CLAIM_AI_SLOT_SCRIPT,
      1,
      GROQ_SLOT_KEY,
      String(GROQ_MIN_INTERVAL_MS),
      String(ttlMs)
    );
    const waitTime = Math.max(0, Number(waitResult) || 0);
    if (waitTime > 0) {
      console.log(`[AI-Groq] Shared throttle waiting ${Math.ceil(waitTime / 1000)}s...`);
      await sleepWithHeartbeat(waitTime, onHeartbeat);
    }
    return;
  } catch (error: any) {
    console.warn(`[AI-Groq] Redis throttle unavailable; using process-local delay: ${error?.message ?? error}`);
  }

  const timeSinceLast = Date.now() - lastGroqFallbackCallTime;
  if (timeSinceLast < GROQ_MIN_INTERVAL_MS) {
    await sleepWithHeartbeat(GROQ_MIN_INTERVAL_MS - timeSinceLast, onHeartbeat);
  }
  lastGroqFallbackCallTime = Date.now();
}

async function markGroqRateLimited() {
  groqPauseUntil = Date.now() + GROQ_COOLDOWN_MS;
  try {
    await redis.set(
      GROQ_COOLDOWN_KEY,
      String(groqPauseUntil),
      "PX",
      String(GROQ_COOLDOWN_MS + 60000)
    );
  } catch (error: any) {
    console.warn(`[AI-Groq] Failed to write shared cooldown: ${error?.message ?? error}`);
  }
}

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

/**
 * Groq AI queue shared by every container through Redis. Use for all Groq
 * completions, including background jobs and user-triggered streams.
 */
export async function callGroqProvider<T>(fn: () => Promise<T>, onHeartbeat?: () => Promise<void>): Promise<T> {
  const currentLink = groqQueue;

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
        await waitForGroqCooldown(onHeartbeat);
        await acquireSharedGroqSlot(onHeartbeat);

        try {
          return await fn();
        } catch (error: any) {
          if (error?.status === 429) {
            console.warn(`[AI-Groq] 429 received. Suspending Groq calls for ${Math.ceil(GROQ_COOLDOWN_MS / 1000)}s...`);
            await markGroqRateLimited();
          }
          throw error;
        }
      }, { retries: 5, baseDelayMs: 2000 });
    } catch (e) {
      throw e;
    }
  })();

  groqQueue = nextLink.catch(() => {});
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
