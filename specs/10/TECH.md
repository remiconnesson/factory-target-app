# Issue #10: Version endpoint, technical design

## Context (from the code)

- Next.js `16.3.8` App Router, React 19, TypeScript strict, vitest 5, pnpm. `next.config.ts` is empty, so
  Cache Components is not enabled.
- Conventions (`AGENTS.md`): logic lives in `lib/` as plain functions, with a `*.test.ts` file next to each one.
  Pages and route handlers stay thin. Route handlers are `app/**/route.ts` files that use the standard
  `Request` / `Response` APIs. `./scripts/verify` runs `pnpm lint`, `pnpm typecheck`
  (`next typegen && tsc --noEmit`) and `pnpm test` (`vitest run`).
- Existing pattern: `lib/greeting.ts` with `lib/greeting.test.ts`. `app/page.tsx` uses
  `export const dynamic = 'force-dynamic'`.
- `tsconfig.json` has `resolveJsonModule: true` and the alias `@/*` -> `./*`. The repo has no vitest config
  file.
- Bundled docs (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`): GET Route
  Handlers are not cached by default. Caching is opt-in, for example with `dynamic = 'force-static'`.

## Design

### `lib/version.ts` (new)

```ts
import pkg from '../package.json';

/** The app version, from package.json. */
export function appVersion(): string {
  return pkg.version;
}
```

- A static JSON import inlines the value at build time. The function bundle then needs no filesystem read at
  runtime, and the value is stable within a deployment. A new deployment with a bumped version picks up the new
  value.
- Don't use `process.env.npm_package_version`. It is only set when the app runs through an npm/pnpm script and
  is not set in the Vercel function runtime.
- Don't read the file with `fs` at runtime. That needs `outputFileTracingIncludes` and path handling for no
  benefit.
- Use a relative import (`../package.json`). It also resolves in vitest, which has no alias configured.

### `app/api/version/route.ts` (new)

```ts
import { appVersion } from '../../../lib/version'; // or '@/lib/version', see Risks

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(
    { version: appVersion() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

- "Not cached" is enforced at two layers. `dynamic = 'force-dynamic'` keeps Next from prerendering the handler
  at build time (it reads no request data, so it could otherwise qualify as static). `Cache-Control: no-store`
  stops browser and CDN caching. Today's `/` already returns
  `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` on production. Setting the header
  explicitly makes the contract testable without a deployment.
- `Response.json` sets `Content-Type: application/json`.

## Files to touch

| File | Change |
| --- | --- |
| `lib/version.ts` | New: `appVersion()` |
| `lib/version.test.ts` | New: unit test |
| `app/api/version/route.ts` | New: GET handler |
| `app/api/version/route.test.ts` | New: handler test (status, body, headers) |

The change needs no other files, data, model, schema or config changes, and no new dependencies.

## Test plan

1. `lib/version.test.ts`: `appVersion()` returns a non-empty string equal to `package.json` `version`. Read the
   expected value by importing `../package.json` in the test, not by hard-coding `0.1.0`.
2. `app/api/version/route.test.ts`: call `await GET()` directly and assert:
   - `res.status === 200`
   - `res.headers.get('content-type')` starts with `application/json`
   - `res.headers.get('cache-control')` contains `no-store`
   - `await res.json()` deep-equals `{ version: pkg.version }`
   - Optionally: `dynamic === 'force-dynamic'` is exported.
3. `./scripts/verify` passes.
4. Manual/deployment check after the branch is pushed (vercel-debug skill):
   `curl -si "$PREVIEW_URL/api/version"` returns `200`, the JSON body, `cache-control` containing `no-store`,
   and `x-vercel-cache` that is not `HIT` on repeated requests.

## Risks

- vitest and the `@/` alias: with no vitest config, `@/lib/version` may not resolve in `route.test.ts`.
  Mitigation: use relative imports in `route.ts`, or add a minimal `vitest.config.ts` alias. The relative import
  keeps the change smaller.
- Type-checking the `package.json` import: `resolveJsonModule` is on, so `pkg.version` is typed as `string`.
  `next typegen` also validates the route's exports. Export only `GET` and `dynamic`.
- Bundling `package.json`: the whole file is inlined into the server bundle. It contains no secrets (it is
  public in the repo), and only `version` is exposed in the response.
- Version semantics: the endpoint reports the version at build time. If someone edits `package.json` without
  redeploying, the endpoint doesn't change. This is expected.
- Information disclosure: exposing the app version publicly is low risk for this app, and the issue explicitly
  asks for it.
