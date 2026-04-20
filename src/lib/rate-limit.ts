export type RateLimitAction = "create" | "retrieve";

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  max: number;
  windowSeconds: number;
};

const BUCKETS: Record<RateLimitAction, Bucket> = {
  create: {
    max: 20,
    windowSeconds: 60,
  },
  retrieve: {
    max: 90,
    windowSeconds: 60,
  },
};

let nowProvider: () => number = () => Date.now();
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function now() {
  return nowProvider();
}

function keyFor(ip: string, action: RateLimitAction) {
  return `tinynum:rl:${action}:${ip}`;
}

function checkMemory(ip: string, action: RateLimitAction): RateLimitResult {
  const bucket = BUCKETS[action];
  const key = keyFor(ip, action);
  const existing = memoryBuckets.get(key);
  const current = now();

  if (!existing || existing.resetAt <= current) {
    memoryBuckets.set(key, {
      count: 1,
      resetAt: current + bucket.windowSeconds * 1000,
    });

    return {
      ok: true,
      remaining: bucket.max - 1,
      retryAfterSeconds: bucket.windowSeconds,
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, bucket.max - existing.count);

  return {
    ok: existing.count <= bucket.max,
    remaining,
    retryAfterSeconds: Math.max(0, Math.ceil((existing.resetAt - current) / 1000)),
  };
}

export async function checkRateLimit(ip: string, action: RateLimitAction): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "test") {
    return {
      ok: true,
      remaining: Number.MAX_SAFE_INTEGER,
      retryAfterSeconds: 0,
    };
  }

  return checkMemory(ip, action);
}

export const __testing = {
  resetMemoryState() {
    memoryBuckets.clear();
    nowProvider = () => Date.now();
  },
  setNowProvider(fn: () => number) {
    nowProvider = fn;
  },
};
