import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { GET } from "./[key]/route";
import { __testing as storeTesting } from "@/lib/store";
import { __testing as rateLimitTesting } from "@/lib/rate-limit";

describe("entries api", () => {
  let now = 1_700_000_000_000;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    storeTesting.resetMemoryState();
    storeTesting.setNowProvider(() => now);
    rateLimitTesting.resetMemoryState();
  });

  it("creates and retrieves text values", async () => {
    const createReq = new Request("http://localhost/api/entries", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify({ value: "hello tiny" }),
    });

    const created = await POST(createReq);
    expect(created.status).toBe(201);

    const createdBody = (await created.json()) as { key: number };

    const retrieved = await GET(new Request(`http://localhost/api/entries/${createdBody.key}`), {
      params: Promise.resolve({ key: String(createdBody.key) }),
    });

    expect(retrieved.status).toBe(200);
    const payload = (await retrieved.json()) as { type: string; value: string };
    expect(payload.type).toBe("text");
    expect(payload.value).toBe("hello tiny");
  });

  it("returns url type for valid URLs", async () => {
    const createReq = new Request("http://localhost/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "https://example.com/docs" }),
    });

    const created = await POST(createReq);
    const body = (await created.json()) as { key: number };

    const retrieved = await GET(new Request(`http://localhost/api/entries/${body.key}`), {
      params: Promise.resolve({ key: String(body.key) }),
    });

    const payload = (await retrieved.json()) as { type: string };
    expect(payload.type).toBe("url");
  });

  it("silently misses after expiry and reuses key", async () => {
    const createReq = new Request("http://localhost/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "short lived" }),
    });

    const created = await POST(createReq);
    const body = (await created.json()) as { key: number };

    now += 10 * 60 * 1000 + 1;

    const missing = await GET(new Request(`http://localhost/api/entries/${body.key}`), {
      params: Promise.resolve({ key: String(body.key) }),
    });

    expect(missing.status).toBe(404);

    const secondCreate = await POST(
      new Request("http://localhost/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "new payload" }),
      }),
    );

    const secondBody = (await secondCreate.json()) as { key: number };
    expect(secondBody.key).toBe(body.key);
  });
});
