/**
 * Dependency-free, in-memory fixed-window rate limit store.
 *
 * State lives in this process only: it resets on deploy/restart and is not shared between
 * instances. That is acceptable for the current single-instance Render service; move to a
 * shared store (e.g. Redis / Render Key Value) before scaling horizontally.
 */
export interface RateLimiterOptions {
  /** Max hits allowed per key within one window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Upper bound on tracked keys, to cap memory under IP-rotation floods. */
  maxKeys?: number;
  now?: () => number;
}

export interface RateLimiter {
  /** Records one hit for `key`. Returns retry-after seconds when blocked, otherwise 0. */
  hit: (key: string) => number;
  /** Drops expired buckets. */
  prune: () => void;
  size: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export const DEFAULT_MAX_KEYS = 10_000;

export const createLimiter = ({
  max,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
  now = Date.now,
}: RateLimiterOptions): RateLimiter => {
  // Map preserves insertion order; a key is re-inserted when its window restarts, so the first
  // entry is always the bucket with the oldest window start (and therefore the earliest expiry).
  const buckets = new Map<string, Bucket>();

  const prune = (): void => {
    const t = now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= t) buckets.delete(key);
    }
  };

  const makeRoom = (): void => {
    if (buckets.size < maxKeys) return;
    prune();
    // Still full: evict the oldest windows. This can only grant a fresh window to a key that
    // was already near expiry, which is preferable to unbounded memory growth.
    while (buckets.size >= maxKeys) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
  };

  const hit = (key: string): number => {
    const t = now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      if (bucket) buckets.delete(key);
      makeRoom();
      buckets.set(key, { count: 1, resetAt: t + windowMs });
      return max >= 1 ? 0 : Math.ceil(windowMs / 1000);
    }
    bucket.count += 1;
    return bucket.count > max ? Math.ceil((bucket.resetAt - t) / 1000) : 0;
  };

  return { hit, prune, size: (): number => buckets.size };
};

const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Reads FORM_RATE_LIMIT_MAX / FORM_RATE_LIMIT_WINDOW_MINUTES (defaults: 5 hits / 10 minutes). */
export const formRateLimitOptionsFromEnv = (
  env: Record<string, string | undefined> = process.env
): RateLimiterOptions => ({
  max: positiveNumber(env.FORM_RATE_LIMIT_MAX, 5),
  windowMs: positiveNumber(env.FORM_RATE_LIMIT_WINDOW_MINUTES, 10) * 60 * 1000,
});
