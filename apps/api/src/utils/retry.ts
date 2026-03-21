export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; baseDelayMs: number } = { retries: 3, baseDelayMs: 400 }
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < options.retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = options.baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  throw lastError;
}
