# Issue #17: Version endpoint (product spec)

## Summary

Add a small public HTTP endpoint that reports which version of the app is running. Developers, operators and
the software factory's own end-to-end checks can use it to confirm which build a deployment is serving.

## Current behavior

- `GET /api/version` does not exist. Today production (`https://factory-target-app.vercel.zone/api/version`)
  returns `HTTP 404` with the default HTML 404 page, served from the edge cache (`x-vercel-cache: HIT`).
- The app has no `app/api/` routes yet.

## Desired behavior

`GET /api/version` returns:

- Status `200`
- `Content-Type: application/json`
- Body: `{ "version": "<version>" }`, where `<version>` is exactly the `version` field of the app's
  `package.json` (currently `"0.1.0"`). Example:

  ```json
  { "version": "0.1.0" }
  ```

- The response is not cached. Every request reaches the app, and the response tells browsers, proxies and the
  Vercel CDN not to store it (`Cache-Control` includes `no-store`).

## Acceptance criteria

1. `GET /api/version` responds `200` with a JSON body whose only key is `version`.
2. The `version` value is the same string as `version` in `package.json`. Bumping `package.json` and
   redeploying changes the value with no other code edits.
3. The response has a `Cache-Control` header containing `no-store`, and Vercel does not serve it from the edge
   cache (`x-vercel-cache` is never `HIT` for this path).
4. The route is rendered at request time, not prerendered as a static file at build time.
5. An automated vitest test covers the endpoint (status, JSON body matching `package.json`, and the no-cache
   header).
6. `./scripts/verify` (lint, type-check, tests) passes.

## Out of scope

- Other HTTP methods on `/api/version` (`POST`, `PUT`, etc.). Next.js answers these with its default `405`.
- Build metadata beyond the version: git commit SHA, build time, environment name, deployment ID.
- Authentication, rate limiting or CORS configuration.
- Showing the version anywhere in the UI.
- A general health-check endpoint.
- Changing how `package.json` versions are bumped or released.
