# Issue #4: Technical design for `GET /api/version`

## Context (from reading the code)

- Next.js `16.3.8` App Router, React 19, TypeScript strict, `resolveJsonModule: true`, path alias `@/*` -> `./*`.
- `next.config.ts` is empty, so Cache Components is **not** enabled. Route segment config such as
  `export const dynamic` is still supported in this mode (see
  `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`). `app/page.tsx`
  already uses `export const dynamic = 'force-dynamic'`.
- No `app/api/` directory and no route handlers exist yet. This will be the first one.
- Conventions (`AGENTS.md`): logic goes in `lib/` as plain functions with a `*.test.ts` next to them,
  route handlers in `app/**/route.ts` use the standard `Request` / `Response`, pages and handlers
  stay thin, and `./scripts/verify` (`pnpm lint`, `pnpm typecheck`, `pnpm test`) must pass.
- vitest has no config file. It does **not** resolve the `@/` alias (verified: importing `@/lib/greeting`
  from a test fails to resolve). It **does** handle relative JSON imports (verified:
  `import pkg from '../../package.json'` works, and `Response.json` exists in the test runtime on Node 24).
- Deployed production today: `GET /api/version` -> `404` HTML. The 404 is CDN-cached
  (`cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`). No preview exists yet for
  `factory/issue-4`.

## Design

### `lib/version.ts` (new)

```ts
import pkg from '../package.json';

/** The app version from package.json, fixed at build time. */
export function appVersion(): string {
  return pkg.version;
}
```

- Use a static JSON import. The bundler inlines the value at build time, so the value is the version of
  the build being served. That is the meaning we want, and it needs no filesystem access at runtime
  (`package.json` isn't guaranteed to be next to the function on Vercel).
- Don't use `process.env.npm_package_version`: it is only set under `npm`/`pnpm run` and isn't present
  in the Vercel function runtime.
- Use a relative import (not `@/package.json`) so vitest can resolve it.

### `app/api/version/route.ts` (new)

```ts
import { appVersion } from '../../../lib/version';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(
    { version: appVersion() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

"Not cached" is enforced in two layers:

1. Next.js: GET route handlers are not cached by default in 16.x (docs: `01-getting-started/15-route-handlers.md`,
   "Caching"). But this handler reads no request data, so it could be prerendered at build time.
   `dynamic = 'force-dynamic'` makes the intent explicit and matches `app/page.tsx`.
2. HTTP/CDN: the explicit `Cache-Control: no-store` stops the Vercel CDN, browsers, and proxies from
   storing the response.

Use a relative import of `lib/version` (instead of `@/lib/version` as in `app/page.tsx`) so that the
route module can be imported directly from vitest. The handler takes no `Request` parameter because it
doesn't use one. Next.js returns `405` for other methods automatically.

## Files to touch

| File | Change |
| --- | --- |
| `lib/version.ts` | New: `appVersion()` |
| `lib/version.test.ts` | New: unit test for `appVersion()` |
| `app/api/version/route.ts` | New: `GET` handler plus `dynamic = 'force-dynamic'` |
| `app/api/version/route.test.ts` | New: handler test (body, status, headers) |

Nothing else changes: no config, dependency, or `package.json` changes.

## Data / model changes

None. There's no persistence. The only data source is the `version` field of `package.json`, read at
build time.

## Test plan

Automated (vitest, run by `./scripts/verify`):

- `lib/version.test.ts`
  - `appVersion()` equals the `version` read independently from `package.json` at test time (e.g.
    `JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version`). Comparing
    against the parsed file means the test doesn't just hard-code `0.1.0`.
  - The result is a non-empty string.
- `app/api/version/route.test.ts` (import `{ GET, dynamic }` from `./route`)
  - `GET()` returns status `200`.
  - `content-type` header starts with `application/json`.
  - `await res.json()` deep-equals `{ version: <package.json version> }`, with no extra keys.
  - `cache-control` header is `no-store`.
  - `dynamic === 'force-dynamic'`.
- `./scripts/verify` passes (lint, `next typegen && tsc --noEmit`, tests).

Manual / deployment (after the branch is pushed and the preview is `READY`, using the vercel-debug skill):

- `curl -si "$PREVIEW_URL/api/version"` -> `200`, `{"version":"0.1.0"}`, `cache-control: no-store`.
- Repeat the request: `x-vercel-cache` is `MISS`/`BYPASS`, never `HIT`. No growing `age` header.
- `pnpm build` output lists `/api/version` as dynamic (`ƒ`), not static (`○`).
- `curl -si "$PREVIEW_URL/"` still renders the greeting.

## Risks

- Prerendering: without `force-dynamic`, a handler that touches no request data could be prerendered and
  served from the CDN, which breaks "not cached". The segment config plus the `no-store` header guard
  against this. The build output check confirms it.
- Future Cache Components: if `cacheComponents` is turned on later, `export const dynamic` becomes an
  error in route handlers and must be removed (the docs say it's removed under Cache Components). It would
  then need replacing, e.g. with `await connection()`. Out of scope now, but worth knowing.
- Import style: the relative imports differ from the `@/` style in `app/page.tsx`. They're needed because
  vitest has no alias config. Adding a `vitest.config.ts` with the alias is a possible alternative, but it
  touches config and goes beyond the issue.
- Bundle contents: a JSON import may bundle all of `package.json` into the server function. It's
  server-only, and only `version` is sent in the response, so nothing extra is exposed.
- Stale 404 at the CDN: production currently caches the `/api/version` 404. A new deployment gets fresh
  CDN cache keys, so this shouldn't persist. Check on the preview before relying on it.
- Version meaning: the value is whatever `package.json` says at build time (`0.1.0` today). Nothing bumps
  it automatically, so different deployments can report the same version.
