// Simple in-memory sliding-window rate limiter, suitable for a single-process
// deployment such as an on-site event server. Keyed by an arbitrary string
// (e.g. `team:<id>:security-event`).

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

// Periodic cleanup to avoid unbounded memory growth over a long event day.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > 10 * 60 * 1000) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();
