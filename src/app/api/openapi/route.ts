import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const spec = buildOpenApiDocument(origin);

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
