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
      if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("rate limit")) {
        // More aggressive delay for rate limits
        delay = Math.max(delay, 2000 * Math.pow(2, attempt));
      }

      // Add Jitter
      const jitter = Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      
      attempt += 1;
      console.warn(`[Retry] Attempt ${attempt} failed. Retrying in ${Math.round(delay + jitter)}ms...`);
    }
  }

  throw lastError;
}
