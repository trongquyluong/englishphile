import "server-only";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const globalForRateLimit = globalThis as unknown as {
  englishphileRateLimit?: Map<string, RateLimitBucket>;
};

const buckets = globalForRateLimit.englishphileRateLimit ?? new Map<string, RateLimitBucket>();

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.englishphileRateLimit = buckets;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}
