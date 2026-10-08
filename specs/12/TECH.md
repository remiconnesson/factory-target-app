# Issue #12: Version endpoint (tech spec)

## Context

- Next.js 16.3.8 (App Router), React 19, vitest 5, pnpm. `next.config.ts` is empty, so Cache Components
  (`cacheComponents`) is **off**.
- Conventions (`AGENTS.md`): logic goes in `lib/` as plain functions with a `*.test.ts` next to them; route
  handlers live in `app/**/route.ts`, use the standard `Request`/`Response` APIs, and stay thin.
  `./scripts/verify` (lint, typecheck, test) must pass.
- `tsconfig.json` already has `resolveJsonModule: true` and the `@/*` path alias, so `package.json` can be
  imported directly.
- Existing precedent for opting out of caching: `app/page.tsx` uses `export const dynamic = 'force-dynamic'`.
  In production that page gets `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
- Bundled Next docs (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`): GET route
  handlers aren't cached by default when Cache Components is off. A handler that touches no request data can
  still be treated as static, though, so we opt out explicitly instead of relying on the default.

## Design

### `lib/version.ts` (new)

```ts
import pkg from '../package.json';

/** The app version, from package.json. */
export function appVersion(): string {
  return pkg.version;
}
```

- Static JSON import: the bundler inlines it at build time, so the deployed function needs no filesystem
  access. Don't read the file with `fs` at runtime, because `package.json` may not be traced into the Vercel
  function bundle.
- The bundler only keeps the `version` field (tree-shaking). Even if it kept more, the endpoint only sends
  `version`, so no other package metadata reaches the response.

### `app/api/version/route.ts` (new)

```ts
import { appVersion } from '../../../lib/version';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { version: appVersion() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
```

- `dynamic = 'force-dynamic'` keeps the route out of build-time prerendering. That's the same mechanism as
  `app/page.tsx`.
- The explicit `Cache-Control: no-store` stops browser/CDN caching. Vercel's edge respects it.
- `Response.json` sets `Content-Type: application/json`.

## Files to touch

| File | Change |
| --- | --- |
| `lib/version.ts` | New: `appVersion()` |
| `lib/version.test.ts` | New: unit test for `appVersion()` |
| `app/api/version/route.test.ts` | New: tests for the route handler (status, body, headers, `dynamic`) |
| `app/api/version/route.ts` | New: `GET` handler |

Nothing else changes. Check that vitest picks up `app/**/*.test.ts`. There's no vitest config, so the default
include `**/*.{test,spec}.?(c|m)[jt]s?(x)` already matches it. If the implementer would rather keep all tests
in `lib/`, the route test can move to something like `lib/version-route.test.ts` and import the handler from
`@/app/api/version/route`.

Vitest has to resolve the `@/` alias. No vitest config exists and the current test uses a relative import, so
either use relative imports in `lib/version.ts` and the tests (`../package.json`), or add the minimal
`vitest.config.ts` alias. Relative imports are the smaller change and need no new config file.

## Data / model changes

None. No storage, env vars, or config changes. `package.json`'s `version` is the only source of truth.

## Test plan

Automated (vitest, through `./scripts/verify`):

1. `lib/version.test.ts`: `appVersion()` equals `version` from `package.json` (import it in the test; don't
   hardcode `0.1.0`), and it's a non-empty string.
2. Route test: call `GET()` and check:
   - `res.status === 200`
   - `res.headers.get('content-type')` contains `application/json`
   - `res.headers.get('cache-control')` contains `no-store`
   - `await res.json()` deep-equals `{ version: pkg.version }`
   - the module exports `dynamic === 'force-dynamic'`
3. `./scripts/verify` passes (lint, `next typegen && tsc --noEmit`, tests).

Manual / deployed (with the vercel-debug skill once the branch preview exists):

- `curl -si "$PREVIEW_URL/api/version"` gives `200`, `{"version":"0.1.0"}`, and `cache-control` includes
  `no-store`.
- Repeat the request: `x-vercel-cache` must not be `HIT`.
- Optional: run `pnpm build` locally and check that the build output lists `/api/version` as dynamic (`ƒ`), not
  static (`○`).

## Risks

- Static optimization: without `force-dynamic`, Next could prerender this data-free GET handler and serve a
  static response. The explicit segment config plus the header handle this.
- Future `cacheComponents: true`: route segment config `dynamic` isn't compatible with Cache Components. If it
  gets turned on later, this route needs to switch to a request-time signal (for example `await connection()`
  from `next/server`). Not a concern today.
- Path alias in tests: `@/` imports may not resolve in vitest without config. Use relative imports (see above).
- JSON import typing: `resolveJsonModule` is on, and a default import works with `esModuleInterop`/bundler
  resolution. If lint flags the default import, use `import { version } from '../package.json'`.
- Information disclosure: the endpoint is public and only exposes the version string, which the issue asks
  for. Low risk.
