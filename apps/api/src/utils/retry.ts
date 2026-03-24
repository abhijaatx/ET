export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; baseDelayMs: number } = { retries: 3, baseDelayMs: 400 }
): Promise<T> {
  let attempt = 0;
  let lastError: any;

  while (attempt < options.retries) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Handle 429 Rate Limit
      let delay = options.baseDelayMs * Math.pow(2, attempt);
      if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("rate limit") || error?.message?.includes("Quota exceeded")) {
        // AI API Rate Limit: Wait exactly 1 minute
        console.warn(`[Retry] Rate limit hit. Waiting 60s before retry...`);
        delay = 60000;
        // No jitter for fixed rate limit wait
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Add Jitter for non-rate limit errors
        const jitter = Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
      
      attempt += 1;
      console.warn(`[Retry] Attempt ${attempt} failed: ${error.message || error}.`);
    }
  }

  throw lastError;
}
