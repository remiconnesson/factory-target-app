# Issue #10: Version endpoint

## Summary

Add a public, read-only HTTP endpoint that reports the version of the running app. The version comes from the
`version` field in `package.json`, which is `0.1.0` today. Operators and the software factory can use it to
confirm which build a deployment is serving.

## Current behavior

`GET /api/version` returns the Next.js `404` HTML page in production (checked on 2026-10-08 against
`https://factory-target-app.vercel.zone/api/version`). The app has no `app/api/` routes yet.

## User-facing behavior

- `GET /api/version` responds with status `200`, `Content-Type: application/json`, and this body:

  ```json
  { "version": "0.1.0" }
  ```

  `"0.1.0"` is whatever `package.json` `version` holds when the app is built.
- The response is not cached: it carries `Cache-Control: no-store` (or a stricter equivalent), and neither the
  browser, the Vercel CDN nor the Next.js data cache serves a stale copy. When a deployment with a bumped
  version goes live, the next request shows the new version.
- The endpoint needs no authentication, query parameters or request body.

## Acceptance criteria

1. `GET /api/version` returns `200` with a JSON body that has exactly one key, `version`.
2. `version` is a string equal to the `version` field of the repository's `package.json`.
3. The response's `Content-Type` starts with `application/json`.
4. The response's `Cache-Control` header contains `no-store`. On a Vercel deployment, two requests in a row
   never return `x-vercel-cache: HIT`.
5. If `package.json` `version` changes, the endpoint reflects it with no other code change. The tests read the
   expected value from `package.json`, not from a hard-coded `"0.1.0"`.
6. At least one vitest test covers this behavior, and `./scripts/verify` (lint, type-check, tests) passes.

## Out of scope

- Other build metadata: git SHA, build time, Vercel deployment id, environment name.
- Methods other than `GET`. Next.js already answers unsupported methods with `405`.
- UI changes, such as showing the version on the home page.
- Changing how or when the version in `package.json` gets bumped (release process).
- Authentication, rate limiting, CORS policy changes.
