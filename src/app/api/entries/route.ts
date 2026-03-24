import { NextResponse } from "next/server";
import { allocateKeyAndSave } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

type CreateBody = {
  value?: string;
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(ip, "create");

  if (!limit.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again soon." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      },
    );
  }

  let body: CreateBody;

  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const rawValue = (body.value ?? "").trim();

  if (!rawValue) {
    return NextResponse.json({ error: "Value is required." }, { status: 400 });
  }

  if (rawValue.length > 10000) {
    return NextResponse.json({ error: "Value exceeds 10,000 characters." }, { status: 400 });
  }

  const { key } = await allocateKeyAndSave(rawValue);

  return NextResponse.json(
    { key },
    {
      status: 201,
      headers: {
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    },
  );
}
