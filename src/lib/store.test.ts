import { beforeEach, describe, expect, it } from "vitest";
import { __testing, allocateKeyAndSave, markMissingKeyReusable, readByKey } from "./store";

describe("store allocator", () => {
  let now = 1_700_000_000_000;

  beforeEach(() => {
    __testing.resetMemoryState();
    __testing.setNowProvider(() => now);
  });

  it("reuses the smallest available key after expiry", async () => {
    const first = await allocateKeyAndSave("alpha");
    const second = await allocateKeyAndSave("beta");

    expect(first.key).toBe(1);
    expect(second.key).toBe(2);

    now += 10 * 60 * 1000 + 1;

    const next = await allocateKeyAndSave("gamma");
    expect(next.key).toBe(1);
  });

  it("marks missing keys reusable idempotently", async () => {
    const created = await allocateKeyAndSave("hello");

    now += 10 * 60 * 1000 + 1;
    expect(await readByKey(created.key)).toBeNull();

    await markMissingKeyReusable(created.key);
    await markMissingKeyReusable(created.key);

    const reused = await allocateKeyAndSave("next");
    expect(reused.key).toBe(1);
  });

  it("keeps key allocation unique under parallel create calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => allocateKeyAndSave(`value-${i}`)),
    );

    const keys = results.map((result) => result.key);
    const unique = new Set(keys);

    expect(unique.size).toBe(50);
    expect(Math.min(...keys)).toBe(1);
    expect(Math.max(...keys)).toBe(50);
  });

  it("parses object payload returned by KV client", () => {
    const parsed = __testing.parseRedisEntry({
      type: "text",
      value: "hello from kv",
      expiresAt: 1_700_000_000_000,
    });

    expect(parsed).toEqual({
      type: "text",
      value: "hello from kv",
      expiresAt: 1_700_000_000_000,
    });
  });
});
