# Issue #1 — Greeting API (product spec)

## Summary

Add a JSON endpoint, `GET /api/greeting?hour=<0-23>`, that returns the same greeting the home page shows for a
given hour ("Good morning" / "Good afternoon" / "Good evening"). Invalid input gets a clear 400 error.

## Current behavior

- The home page (`/`) renders `greeting(<current UTC hour>)` in an `<h1>`.
- `GET /api/greeting` does not exist: production (`main`, deployment `dpl_HGLu5z5a88jmQiGgXormPBh5a5WW`) returns
  `404` with the default Next.js HTML 404 page.

## Behavior

### Success

`GET /api/greeting?hour=H`, where `H` is a whole number from 0 to 23:

- Status `200`, `Content-Type: application/json`.
- Body: `{ "greeting": "<text>" }`, where the text is the result of the existing `greeting()` function:

  | hour    | greeting         |
  | ------- | ---------------- |
  | 0–11    | `Good morning`   |
  | 12–17   | `Good afternoon` |
  | 18–23   | `Good evening`   |

Example: `GET /api/greeting?hour=14` → `200 {"greeting":"Good afternoon"}`.

### Errors

Status `400`, `Content-Type: application/json`, body `{ "error": "<message>" }`. The message says what is wrong:

| Case                                                              | Example query           | Error message                                   |
| ----------------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
| `hour` missing                                                    | (none)                  | `Missing required query parameter "hour".`      |
| `hour` present but empty                                          | `?hour=`                | `Missing required query parameter "hour".`      |
| `hour` is not a whole number (letters, decimals, signs, spaces…) | `?hour=abc`, `?hour=9.5`, `?hour=-1`, `?hour=1e1` | `"hour" must be an integer from 0 to 23.` |
| `hour` is an integer outside 0–23                                 | `?hour=24`, `?hour=99`  | `"hour" must be an integer from 0 to 23.`       |

Exact wording may be adjusted during implementation, but each message must name the `hour` parameter and, for
invalid values, state the allowed range 0–23. Missing and invalid must produce distinguishable messages.

Accepted format: one or more ASCII digits only (`^[0-9]+$`) whose value is 0–23. So `9` and `09` are valid;
`+9`, ` 9`, `9.0`, `0x9`, `1e1` are not.

If `hour` is repeated (`?hour=9&hour=20`), the first value is used.

### Caching

Neither success nor error responses may be cached: every response carries `Cache-Control: no-store`, and the
route is always executed at request time (never prerendered at build).

## Acceptance criteria

1. `GET /api/greeting?hour=9` → `200`, body `{"greeting":"Good morning"}`.
2. `GET /api/greeting?hour=14` → `200`, body `{"greeting":"Good afternoon"}`.
3. `GET /api/greeting?hour=20` → `200`, body `{"greeting":"Good evening"}`.
4. Boundaries: `hour=0` and `hour=11` → morning; `12` and `17` → afternoon; `18` and `23` → evening.
5. `GET /api/greeting` (no `hour`) → `400` with an `error` saying `hour` is missing.
6. `hour=` (empty), `abc`, `9.5`, `-1`, `+9`, `1e1`, ` 9`, `24`, `100` → each `400` with an `error` saying `hour`
   must be an integer from 0 to 23 (empty → "missing" message).
7. All responses above (200 and 400) include `Cache-Control: no-store` and are JSON.
8. Unit tests cover the validation cases above and pass in `./scripts/verify` (lint, type-check, tests).
9. The home page `/` is unchanged.

## Out of scope

- Using the current time when `hour` is omitted (omitted is an error, per the issue).
- Time zones, locales, translations, or new greeting texts; changing `greeting()` itself.
- Methods other than `GET` (Next.js default `405` handling applies).
- Authentication, rate limiting, CORS configuration.
- UI changes, documentation site, OpenAPI schema.
