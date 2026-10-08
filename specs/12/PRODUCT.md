# Issue #12: Version endpoint (product spec)

## Summary

Add a small HTTP endpoint that reports the version of the running app, so people and tooling (including the
software factory's end-to-end checks) can see which version is deployed.

## Current behavior

- `GET /api/version` does not exist. In production (`https://factory-target-app.vercel.zone/api/version`) it
  returns the standard Next.js HTML 404 page, and Vercel's edge serves it from cache (`x-vercel-cache: HIT`).
- The app has no route handlers (`app/**/route.ts`) yet. The only route is the home page.

## User-facing behavior

`GET /api/version` returns:

- Status `200 OK`
- `Content-Type: application/json`
- Body: `{ "version": "<version>" }`, where `<version>` is the `version` field of the app's `package.json`
  (currently `0.1.0`, so `{"version":"0.1.0"}`).
- Not cached. Every request is served fresh by the app. No browser, CDN, or Next.js cache keeps the response,
  so a deploy with a new `package.json` version shows up on the next request.

## Acceptance criteria

1. `GET /api/version` returns `200` with a JSON body that has exactly one key, `version`, whose string value
   equals `package.json`'s `version` field.
2. The response has `Content-Type: application/json`.
3. The response sends a `Cache-Control` header that forbids caching (it includes `no-store`), and the route is
   rendered per request, not prerendered at build time.
4. On a Vercel deployment the response is not served from the edge cache (`x-vercel-cache` is never `HIT` on
   repeated requests).
5. An automated vitest test covers the version value and the no-cache header, and `./scripts/verify` passes.
6. If `package.json`'s `version` changes, the endpoint reports the new value without any other code change.

## Out of scope

- Other version metadata: git SHA, build time, Next.js or Node version, deployment ID, environment name.
- Methods other than `GET`. `HEAD` and `OPTIONS` follow Next.js defaults; `POST` and others aren't defined.
- Authentication, rate limiting, CORS changes.
- Showing the version anywhere in the UI.
- Changing how the version is bumped or released.
