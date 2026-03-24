import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __testing, checkRateLimit } from "./rate-limit";

describe("rate limit", () => {
  let now = 1_700_000_000_000;
  let priorNodeEnv: string | undefined;

  beforeEach(() => {
    priorNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    __testing.resetMemoryState();
    __testing.setNowProvider(() => now);
  });

  it("blocks create after threshold and resets after window", async () => {
    for (let i = 0; i < 20; i += 1) {
      const result = await checkRateLimit("1.2.3.4", "create");
      expect(result.ok).toBe(true);
    }

    const blocked = await checkRateLimit("1.2.3.4", "create");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    now += 60_000;

    const allowedAgain = await checkRateLimit("1.2.3.4", "create");
    expect(allowedAgain.ok).toBe(true);
  });

  it("tracks retrieve bucket separately from create", async () => {
    for (let i = 0; i < 20; i += 1) {
      await checkRateLimit("9.9.9.9", "create");
    }

    const createBlocked = await checkRateLimit("9.9.9.9", "create");
    expect(createBlocked.ok).toBe(false);

    const retrieveAllowed = await checkRateLimit("9.9.9.9", "retrieve");
    expect(retrieveAllowed.ok).toBe(true);
  });

  afterEach(() => {
    process.env.NODE_ENV = priorNodeEnv;
  });
});
