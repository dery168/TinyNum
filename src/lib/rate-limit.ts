import { Redis } from "@upstash/redis";

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

const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;
const isRedisEnabled = Boolean(redisUrl && redisToken) && process.env.NODE_ENV !== "test";

const redis = isRedisEnabled
  ? new Redis({
      url: redisUrl as string,
      token: redisToken as string,
    })
  : null;

let nowProvider: () => number = () => Date.now();
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function now() {
  return nowProvider();
}

function keyFor(ip: string, action: RateLimitAction) {
  return `tinynum:rl:${action}:${ip}`;
}

async function checkRedis(ip: string, action: RateLimitAction): Promise<RateLimitResult> {
  const bucket = BUCKETS[action];
  const key = keyFor(ip, action);

  const script = `
    local key = KEYS[1]
    local max = tonumber(ARGV[1])
    local windowSec = tonumber(ARGV[2])

    local current = redis.call('INCR', key)
    if current == 1 then
      redis.call('EXPIRE', key, windowSec)
    end

    local ttl = redis.call('TTL', key)
    if current > max then
      return {0, 0, ttl}
    end

    return {1, max - current, ttl}
  `;

  const rawResult = await redis!.eval(script, [key], [bucket.max, bucket.windowSeconds]);
  const result = (rawResult as number[]).map((value) => Number(value));

  return {
    ok: result[0] === 1,
    remaining: Math.max(0, result[1]),
    retryAfterSeconds: Math.max(0, result[2] ?? bucket.windowSeconds),
  };
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

  if (redis) {
    return checkRedis(ip, action);
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
