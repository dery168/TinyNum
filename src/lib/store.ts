import { Redis } from "@upstash/redis";

export type EntryType = "text" | "url";

type StoredEntry = {
  type: EntryType;
  value: string;
  expiresAt: number;
};

type ReadResult = {
  type: EntryType;
  value: string;
  expiresInMs: number;
};

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ENTRY_TTL_SECONDS = 600;

const COUNTER_KEY = "tinynum:key-counter";
const FREE_KEY_ZSET = "tinynum:free-keys";
const ACTIVE_KEY_ZSET = "tinynum:active-keys";
const ENTRY_PREFIX = "tinynum:entry:";

const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;
const isRedisEnabled = Boolean(redisUrl && redisToken) && process.env.NODE_ENV !== "test";

const redis = isRedisEnabled
  ? new Redis({
      url: redisUrl as string,
      token: redisToken as string,
    })
  : null;

const entries = new Map<number, StoredEntry>();
const freeKeys = new Set<number>();
let maxIssuedKey = 0;
let nowProvider: () => number = () => Date.now();

function now() {
  return nowProvider();
}

function asType(value: string): EntryType {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? "url" : "text";
  } catch {
    return "text";
  }
}

function parseRedisEntry(value: unknown): StoredEntry | null {
  if (!value) {
    return null;
  }

  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as StoredEntry;
          } catch {
            return null;
          }
        })()
      : (value as StoredEntry);

  if (!parsed || typeof parsed.value !== "string" || typeof parsed.expiresAt !== "number") {
    return null;
  }

  if (parsed.type !== "text" && parsed.type !== "url") {
    return null;
  }

  return parsed;
}

function entryKey(key: number) {
  return `${ENTRY_PREFIX}${key}`;
}

function cleanupExpiredMemory() {
  const current = now();

  for (const [key, entry] of entries) {
    if (entry.expiresAt <= current) {
      entries.delete(key);
      freeKeys.add(key);
    }
  }
}

async function allocateKeyAndSaveRedis(value: string) {
  const payload: StoredEntry = {
    type: asType(value),
    value,
    expiresAt: now() + TEN_MINUTES_MS,
  };

  const script = `
    local counterKey = KEYS[1]
    local freeKeySet = KEYS[2]
    local activeKeySet = KEYS[3]
    local entryPrefix = KEYS[4]
    local nowMs = tonumber(ARGV[1])
    local ttlSec = tonumber(ARGV[2])
    local entryJson = ARGV[3]

    while true do
      local expired = redis.call('ZRANGEBYSCORE', activeKeySet, '-inf', nowMs, 'LIMIT', 0, 1)
      if #expired == 0 then
        break
      end

      local expiredKey = expired[1]
      redis.call('ZREM', activeKeySet, expiredKey)
      redis.call('DEL', entryPrefix .. expiredKey)
      redis.call('ZADD', freeKeySet, tonumber(expiredKey), expiredKey)
    end

    local reused = redis.call('ZRANGE', freeKeySet, 0, 0)
    local key
    if #reused > 0 then
      key = reused[1]
      redis.call('ZREM', freeKeySet, key)
    else
      key = tostring(redis.call('INCR', counterKey))
    end

    redis.call('SET', entryPrefix .. key, entryJson, 'EX', ttlSec)
    redis.call('ZADD', activeKeySet, nowMs + (ttlSec * 1000), key)
    return key
  `;

  const rawKey = await redis!.eval(script, [COUNTER_KEY, FREE_KEY_ZSET, ACTIVE_KEY_ZSET, ENTRY_PREFIX], [
    String(now()),
    String(ENTRY_TTL_SECONDS),
    JSON.stringify(payload),
  ]);

  return { key: Number(rawKey) };
}

function allocateKeyAndSaveMemory(value: string) {
  cleanupExpiredMemory();

  const sortedFree = [...freeKeys].sort((a, b) => a - b);
  const key = sortedFree.length > 0 ? sortedFree[0] : maxIssuedKey + 1;

  freeKeys.delete(key);
  maxIssuedKey = Math.max(maxIssuedKey, key);

  entries.set(key, {
    type: asType(value),
    value,
    expiresAt: now() + TEN_MINUTES_MS,
  });

  return { key };
}

async function readByKeyRedis(key: number): Promise<ReadResult | null> {
  const raw = await redis!.get(entryKey(key));
  const entry = parseRedisEntry(raw);

  if (!entry) {
    return null;
  }

  return {
    type: entry.type,
    value: entry.value,
    expiresInMs: Math.max(0, entry.expiresAt - now()),
  };
}

function readByKeyMemory(key: number): ReadResult | null {
  cleanupExpiredMemory();
  const entry = entries.get(key);

  if (!entry) {
    return null;
  }

  return {
    type: entry.type,
    value: entry.value,
    expiresInMs: Math.max(0, entry.expiresAt - now()),
  };
}

async function markMissingKeyReusableRedis(key: number): Promise<void> {
  const script = `
    local counterKey = KEYS[1]
    local freeKeySet = KEYS[2]
    local activeKeySet = KEYS[3]
    local entryPrefix = KEYS[4]
    local key = ARGV[1]
    local entryKey = entryPrefix .. key

    if redis.call('EXISTS', entryKey) == 1 then
      return 0
    end

    local currentMax = tonumber(redis.call('GET', counterKey) or '0')
    if tonumber(key) <= 0 or tonumber(key) > currentMax then
      return 0
    end

    redis.call('ZREM', activeKeySet, key)
    redis.call('ZADD', freeKeySet, tonumber(key), key)
    return 1
  `;

  await redis!.eval(script, [COUNTER_KEY, FREE_KEY_ZSET, ACTIVE_KEY_ZSET, ENTRY_PREFIX], [String(key)]);
}

function markMissingKeyReusableMemory(key: number): void {
  cleanupExpiredMemory();

  if (key > 0 && key <= maxIssuedKey && !entries.has(key)) {
    freeKeys.add(key);
  }
}

export async function allocateKeyAndSave(value: string) {
  if (redis) {
    return allocateKeyAndSaveRedis(value);
  }

  return allocateKeyAndSaveMemory(value);
}

export async function readByKey(key: number) {
  if (redis) {
    return readByKeyRedis(key);
  }

  return readByKeyMemory(key);
}

export async function markMissingKeyReusable(key: number): Promise<void> {
  if (redis) {
    await markMissingKeyReusableRedis(key);
    return;
  }

  markMissingKeyReusableMemory(key);
}

export const __testing = {
  resetMemoryState() {
    entries.clear();
    freeKeys.clear();
    maxIssuedKey = 0;
    nowProvider = () => Date.now();
  },
  setNowProvider(fn: () => number) {
    nowProvider = fn;
  },
  parseRedisEntry,
};
