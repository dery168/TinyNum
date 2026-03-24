import { NextResponse } from "next/server";
import { markMissingKeyReusable, readByKey } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

type Params = {
  params: Promise<{ key: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(ip, "retrieve");

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

  const resolvedParams = await params;
  const key = Number(resolvedParams.key);

  if (!Number.isInteger(key) || key <= 0) {
    return new NextResponse(null, { status: 404 });
  }

  const entry = await readByKey(key);

  if (!entry) {
    await markMissingKeyReusable(key);
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(entry, {
    status: 200,
    headers: {
      "X-RateLimit-Remaining": String(limit.remaining),
    },
  });
}
