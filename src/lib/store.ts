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

function cleanupExpiredMemory() {
  const current = now();

  for (const [key, entry] of entries) {
    if (entry.expiresAt <= current) {
      entries.delete(key);
      freeKeys.add(key);
    }
  }
}

export async function allocateKeyAndSave(value: string) {
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

export async function readByKey(key: number): Promise<ReadResult | null> {
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

export async function markMissingKeyReusable(key: number): Promise<void> {
  cleanupExpiredMemory();

  if (key > 0 && key <= maxIssuedKey && !entries.has(key)) {
    freeKeys.add(key);
  }
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
};
