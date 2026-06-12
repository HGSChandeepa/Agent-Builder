export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
}

export interface RetryResult<T> {
  readonly result: T;
  readonly attempts: number;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= policy.maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      return { result, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt <= policy.maxRetries) {
        const delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error("Retry failed");
}

export function mergeRetryPolicy(
  nodeConfig: Record<string, unknown>,
  upstream: RetryPolicy | undefined,
): RetryPolicy {
  const upstreamPolicy = upstream ?? { maxRetries: 0, baseDelayMs: 1000 };
  const maxRetries = Number(nodeConfig.maxRetries ?? upstreamPolicy.maxRetries);
  const baseDelayMs = Number(nodeConfig.baseDelayMs ?? upstreamPolicy.baseDelayMs);
  return { maxRetries, baseDelayMs };
}
