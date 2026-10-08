# Issue #1 — Greeting API (tech spec)

## Context (from the code)

- Next.js `16.3.8`, App Router, React 19. `next.config.ts` is empty (no `cacheComponents`).
- `lib/greeting.ts`: `greeting(hour: number)` → `'Good morning' | 'Good afternoon' | 'Good evening'`. It does no
  validation (`greeting(-5)` → morning, `greeting(99)` → evening), so validation must happen before calling it.
- `lib/greeting.test.ts`: vitest, relative imports. There is no `vitest.config.*`, so the `@/` tsconfig alias is
  not resolved in tests: test files and anything they import must use relative imports.
- `app/page.tsx` uses `export const dynamic = 'force-dynamic'`.
- No `app/api/` exists yet. Production returns 404 for `/api/greeting` today.
- Conventions (`AGENTS.md`): logic in `lib/` as plain functions with a sibling `*.test.ts`; route handlers in
  `app/**/route.ts`, thin, using standard `Request` / `Response`; `./scripts/verify` must pass.
- Next docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`): since v15, `GET`
  route handlers are dynamic by default; segment config `dynamic` is still supported.

## Design

Split into a pure lib function (all validation + result shaping, unit tested) and a thin route handler.

### `lib/greeting-api.ts` (new)

```ts
import { greeting } from './greeting';

export type GreetingApiResult =
  | { status: 200; body: { greeting: string } }
  | { status: 400; body: { error: string } };

/** Validate the `hour` query parameter and build the greeting API result. */
export function greetingApi(params: URLSearchParams): GreetingApiResult {
  const raw = params.get('hour'); // first value if repeated
  if (raw === null || raw === '') {
    return { status: 400, body: { error: 'Missing required query parameter "hour".' } };
  }
  if (!/^[0-9]+$/.test(raw)) {
    return { status: 400, body: { error: '"hour" must be an integer from 0 to 23.' } };
  }
  const hour = Number(raw);
  if (hour > 23) {
    return { status: 400, body: { error: '"hour" must be an integer from 0 to 23.' } };
  }
  return { status: 200, body: { greeting: greeting(hour) } };
}
```

Notes:
- The digit-only regex rejects `-1`, `+9`, `9.5`, `1e1`, `0x9`, whitespace, `Infinity`, etc. without relying on
  `Number()`/`parseInt` quirks (`parseInt('9abc')` = 9, `Number(' 9')` = 9, `Number('')` = 0).
- Very long digit strings (`999999999999999999999`) are > 23 and rejected by the range check.
- Use a relative import of `./greeting` so vitest resolves it.

### `app/api/greeting/route.ts` (new)

```ts
import { greetingApi } from '@/lib/greeting-api';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { status, body } = greetingApi(new URL(request.url).searchParams);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
```

- `dynamic = 'force-dynamic'` mirrors `app/page.tsx` and makes "never prerendered/cached" explicit even though
  reading `request.url` and v15+ defaults already make it dynamic.
- `Cache-Control: no-store` on every response (200 and 400) prevents browser/CDN caching. On Vercel, verify the
  header is not overwritten (Next may set `private, no-cache, no-store, max-age=0, must-revalidate` for dynamic
  routes, as seen on `/` in production; either value satisfies "not cached" as long as `no-store` is present).
- Only `GET` is exported; other methods get Next's default 405.

## Files to touch

| File                          | Change                                       |
| ----------------------------- | -------------------------------------------- |
| `lib/greeting-api.ts`         | New: validation + result builder.            |
| `lib/greeting-api.test.ts`    | New: vitest unit tests.                      |
| `app/api/greeting/route.ts`   | New: thin `GET` handler.                     |

No changes to `lib/greeting.ts`, `app/page.tsx`, config, or dependencies.

## Data / model changes

None. No storage, env vars, or new dependencies.

## Test plan

### Unit (`lib/greeting-api.test.ts`, vitest, relative imports)

Helper: `const call = (q: string) => greetingApi(new URLSearchParams(q));`

- Valid: `hour=9` → `{status:200, body:{greeting:'Good morning'}}`; `14` → afternoon; `20` → evening.
- Boundaries: `0`, `11` → morning; `12`, `17` → afternoon; `18`, `23` → evening; `09` → morning.
- Missing: `''` (no param) and `hour=` → 400, error mentions `hour` and "Missing".
- Invalid format: `abc`, `9.5`, `-1`, `+9`, `1e1`, `0x9`, `%209` (space + 9), `9abc` → 400, error mentions
  `0 to 23`.
- Out of range: `24`, `100`, `999999999999999999999` → 400, same error.
- Repeated: `hour=9&hour=20` → morning (first value).
- Every 400 result has an `error` string and no `greeting`; every 200 has a `greeting` string and no `error`.

Optional: a route-level test in `app/api/greeting/route.test.ts` that calls `GET(new Request('http://x/api/greeting?hour=9'))`
and asserts status, JSON body, and `Cache-Control: no-store`. It must import the route relatively, and the
route's `@/lib/...` import would fail under vitest without an alias config — so either use a relative import in
`route.ts` (`../../../lib/greeting-api`) or skip this test. Keeping the route thin makes the unit tests sufficient.

### Verification

- `./scripts/verify` (lint, `next typegen && tsc --noEmit`, `vitest run`) passes.
- After the branch is pushed and the preview deploys (vercel-debug skill, `$PREVIEW_URL`):
  - `curl -si "$PREVIEW_URL/api/greeting?hour=14"` → 200, `{"greeting":"Good afternoon"}`, `cache-control`
    contains `no-store`.
  - `curl -si "$PREVIEW_URL/api/greeting"` and `?hour=24`, `?hour=abc` → 400 JSON with `error`, `no-store`.
  - `curl -s "$PREVIEW_URL/"` still renders the greeting `<h1>`.

## Risks

- Vitest has no path-alias config: importing `@/…` from a tested module breaks tests. Mitigated by relative
  imports in `lib/`.
- `Cache-Control` could be rewritten by Next/Vercel; check the header on the preview deployment.
- Validation strictness (`09` accepted, `+9`/` 9` rejected, first value wins for repeated params) is a product
  choice; see open questions. Changing it later is a one-line regex/branch change plus tests.
- `next typegen` generates route types; a new `route.ts` must type-check under it (standard `Request` param is fine).
