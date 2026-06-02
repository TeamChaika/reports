// Simple in-memory fixed-window rate limiter.
// Sufficient for a single-process deployment (Timeweb App Platform backend).
// For multi-instance scaling, swap the backing store for Redis.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Fixed window of `windowMs`, up to `max` requests per key.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= max) return false

  bucket.count += 1
  return true
}

// Opportunistic cleanup so the map does not grow unbounded.
const CLEANUP_EVERY_MS = 5 * 60_000
let lastCleanup = Date.now()

export function maybeCleanup(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_EVERY_MS) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key)
  }
}
