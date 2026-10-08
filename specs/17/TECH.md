# Issue #17: Version endpoint (tech spec)

## Context (from reading the code)

- Next.js `16.3.8` on the App Router. `next.config.ts` is empty, so Cache Components is **off** and the
  previous caching model applies, which includes the `dynamic` route segment config.
- Per `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, Route Handlers are not
  cached by default; `GET` is cached only if you opt in (for example `dynamic = 'force-static'`).
- Conventions (`AGENTS.md`): logic goes in `lib/` as plain functions with a `*.test.ts` file next to each one
  (vitest). Pages and route handlers stay thin. Route handlers live in `app/**/route.ts` and use standard
  `Request`/`Response`.
- Existing example: `lib/greeting.ts` + `lib/greeting.test.ts`. `app/page.tsx` already uses
  `export const dynamic = 'force-dynamic'`.
- `tsconfig.json` has `resolveJsonModule: true` and the `@/*` path alias. There is **no vitest config**, so
  vitest does not resolve `@/` imports. Tests and any modules they import must use relative imports.
- There is no `app/api/` directory yet. Production currently returns a cached HTML 404 for `/api/version`.

## Design

### `lib/version.ts` (new)

```ts
import pkg from '../package.json';

/** The app version, from package.json. */
export function appVersion(): string {
  return pkg.version;
}
```

- Use a default JSON import (resolved at build time by `resolveJsonModule`) rather than reading the file with
  `fs` at runtime. On Vercel, `package.json` isn't guaranteed to be in the function's file trace, and the
  bundler inlines the import.
- Use a relative import (`../package.json`) so vitest can resolve it without an alias config.

### `app/api/version/route.ts` (new)

```ts
import { appVersion } from '@/lib/version';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { version: appVersion() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

- `dynamic = 'force-dynamic'`: since the handler reads no request data, Next would otherwise be allowed to
  treat it as static. This makes request-time rendering explicit and matches `app/page.tsx`.
- `Cache-Control: no-store`: stops browsers, proxies and the Vercel CDN from storing the response.
- `Response.json` sets `Content-Type: application/json`.
- Implementers may use a relative import here too; the `@/` alias works in Next's build but not in vitest.
  If the route test imports `route.ts` directly, the route must use `../../../lib/version` (see the test
  plan).

## Files to touch

| File | Change |
| --- | --- |
| `lib/version.ts` | New. `appVersion()` helper. |
| `lib/version.test.ts` | New. Unit test for `appVersion()`. |
| `app/api/version/route.ts` | New. Thin `GET` handler. |
| `app/api/version/route.test.ts` | New. Handler test (status, body, headers, `dynamic`). |

Nothing else changes: no config, dependency or `package.json` edits.

## Data / model changes

None. No storage and no environment variables. The only data source is the `version` field of `package.json`,
read at build time.

## Test plan

Automated (vitest, picked up by the default `**/*.test.ts` include and run by `./scripts/verify`):

1. `lib/version.test.ts`: `appVersion()` equals `version` from `../package.json` (import it in the test; do
   not hard-code `"0.1.0"`, so a version bump doesn't break the test), and it is a non-empty string.
2. `app/api/version/route.test.ts`: import `{ GET, dynamic }` from `./route`, then:
   - `const res = GET()`: `res.status === 200`
   - `res.headers.get('content-type')` contains `application/json`
   - `res.headers.get('cache-control')` contains `no-store`
   - `await res.json()` deep-equals `{ version: pkg.version }`
   - `dynamic === 'force-dynamic'`
   - Because there's no vitest alias, `route.ts` must import `lib/version` with a relative path. The
     alternative is adding a minimal `vitest.config.ts` with `resolve.alias` for `@`, which is a small
     config change (see open questions).

Manual / deployment check (after the branch is pushed and the preview is `READY`, using the `vercel-debug`
skill):

- `curl -si "$PREVIEW_URL/api/version"` returns `200`, `content-type: application/json`, a `cache-control`
  header containing `no-store`, body `{"version":"0.1.0"}`.
- Repeated requests never show `x-vercel-cache: HIT`.
- In the `next build` output, `/api/version` is listed as dynamic (`ƒ`), not static (`○`).

## Risks

- **Static prerendering / CDN caching**: if `dynamic` or the header were left out, the route could be
  prerendered and served from cache. Production already shows a cached 404 at this path. Mitigation: set both
  `force-dynamic` and `no-store`, and cover both in tests. After the first deploy, the old cached 404 should
  be invalidated by the new deployment; confirm with the curl check above.
- **Alias resolution in tests**: `@/` imports fail under vitest without config. Mitigation: use relative
  imports in modules the tests touch.
- **Bundle contents**: importing `package.json` pulls the whole file into the server bundle. Only `version`
  is returned to clients, and the file has no secrets. Acceptable.
- **Information disclosure**: making the version public is intended by the issue. The app is a demo with no
  security-sensitive versioning.
- **Future Cache Components adoption**: if `cacheComponents` is turned on later, `export const dynamic` is
  removed/unsupported in that mode (per the route segment config docs, v16.0.0), and this file will need
  updating (for example by calling `connection()` from `next/server`).
