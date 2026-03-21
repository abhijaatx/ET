import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { withRetry } from "../utils/retry";

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY
});

export async function callAnthropic<T>(fn: () => Promise<T>) {
  return withRetry(fn, { retries: 3, baseDelayMs: 500 });
}
