# TinyNumber

TinyNum is a Next.js app that lets users store public text or URLs and retrieve them later using a small integer key.

- Data is public.
- Data expires after 10 minutes.
- Expired keys are reused (smallest available key first).

## Features

- Create entry API: stores text/URL and returns an integer key.
- Retrieve entry API: returns entry by key if still valid.
- Automatic URL detection (`text` vs `url`).
- 10-minute TTL (600 seconds).
- Silent missing behavior for expired/missing keys (`404`).
- Per-IP rate limiting.
- Swagger UI docs.
- Automated tests with Vitest.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Upstash Redis / Vercel KV (with local memory fallback when env vars are missing)
- Vitest

## Project Structure

- `src/app/page.tsx`: Main UI (Create + Retrieve)
- `src/app/api/entries/route.ts`: Create endpoint (`POST /api/entries`)
- `src/app/api/entries/[key]/route.ts`: Retrieve endpoint (`GET /api/entries/{key}`)
- `src/app/api/openapi/route.ts`: OpenAPI JSON
- `src/app/api/docs/route.ts`: Swagger UI HTML
- `src/app/docs/page.tsx`: Docs page
- `src/lib/store.ts`: Key allocator, expiry, KV/memory logic
- `src/lib/rate-limit.ts`: Per-IP rate limit logic
- `src/lib/openapi.ts`: OpenAPI spec builder

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm

## Environment Variables

Create `.env.local` in project root.

Required for Redis/KV mode:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

If these are not set, the app runs with in-memory fallback (good for local dev, not for production).

## Install

```bash
npm install
```

If your PowerShell policy blocks npm scripts, use:

```powershell
cmd /c npm.cmd install
```

## Run Locally

```bash
npm run dev
```

PowerShell-safe variant:

```powershell
cmd /c npm.cmd run dev
```

Open:

- App: `http://localhost:3000/`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/api/openapi`

## Build and Test

Run tests:

```bash
npm test
```

Run production build:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

## API Quick Reference

### 1) Create Entry

`POST /api/entries`

Request body:

```json
{
  "value": "Hello world"
}
```

Success (`201`):

```json
{
  "key": 1
}
```

Validation / error examples:

- `400` if payload invalid or `value` is empty.
- `400` if value exceeds 10,000 chars.
- `429` if rate limit exceeded.

### 2) Retrieve Entry

`GET /api/entries/{key}`

Success (`200`):

```json
{
  "type": "text",
  "value": "Hello world",
  "expiresInMs": 534123
}
```

For URL entries:

```json
{
  "type": "url",
  "value": "https://example.com",
  "expiresInMs": 512000
}
```

Missing/expired:

- `404` (silent missing behavior)

Rate limit:

- `429` with `Retry-After` header

## Current Limits

- Max input length: 10,000 chars
- Create rate limit: 20 requests/IP per 60 seconds
- Retrieve rate limit: 90 requests/IP per 60 seconds

## Behavior Notes

- Only store public information.
- Entries expire after 10 minutes and are not recoverable after expiry.
- Key allocator reuses the smallest available positive integer.

## Swagger Docs

- UI: `/docs`
- JSON: `/api/openapi`

## Troubleshooting

### Create returns key, retrieve returns 404

- Ensure the same server instance is handling both requests.
- If using KV/Redis, verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are correct.
- Restart dev server after changing `.env.local`.

### PowerShell blocks npm/npx scripts

Use `cmd /c npm.cmd ...` as shown above.

## License

Internal project / POC.
