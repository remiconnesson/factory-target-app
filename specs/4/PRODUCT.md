# Issue #4: Version endpoint (`GET /api/version`)

## Summary

Add a small JSON endpoint that reports which version of the app is running, so people and tools (including the
software factory's end-to-end check) can confirm which build a deployment is serving.

## Current behavior

- The app has no API routes. Today `GET /api/version` on production (`main` @ `34ddfe6`) returns
  `404` with the Next.js HTML "This page could not be found." page. The CDN also caches that 404
  (`x-vercel-cache: HIT`, `age: 9030`).
- `package.json` declares `"version": "0.1.0"`.

## Desired behavior

`GET /api/version` returns:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{"version":"0.1.0"}
```

- `version` is the `version` field from the app's `package.json` in the build being served. It is
  always a string.
- The response body has exactly one key, `version`.
- The response is not cached anywhere: not by the Next.js server/data cache, not by the Vercel CDN, and
  not by browsers or proxies. Every request reaches the function and returns the current build's value.
- No authentication, query parameters, or request body. The endpoint works the same for every caller.

## Acceptance criteria

1. `GET /api/version` responds `200` with a JSON body `{ "version": "<package.json version>" }`
   (currently `{"version":"0.1.0"}`) and a `Content-Type` of `application/json`.
2. The response includes `Cache-Control: no-store`.
3. On a Vercel deployment, repeated requests are never served from the CDN cache: `x-vercel-cache` is
   never `HIT`, and the response has no `age` header that keeps growing.
4. Changing `version` in `package.json` and redeploying changes the value the endpoint returns, with no
   other code change.
5. An automated vitest test covers the endpoint's body and its no-cache header, and `./scripts/verify`
   (lint, type-check, tests) passes.
6. Existing behavior is unchanged: the home page `/` still renders its greeting.

## Out of scope

- Other build metadata: git commit SHA, build time, environment name, Next.js/Node versions.
- Changing or automating the value of `version` in `package.json` (release or bump tooling).
- Methods other than `GET`. Next.js already answers unsupported methods with `405`, and this issue
  doesn't define any other method.
- Authentication, rate limiting, CORS policy changes.
- Showing the version anywhere in the UI.
- A general API framework, shared response helpers, or health-check endpoints.
