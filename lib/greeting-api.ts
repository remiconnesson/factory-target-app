import { greeting } from './greeting';

export type GreetingApiResult =
  | { status: 200; body: { greeting: string } }
  | { status: 400; body: { error: string } };

export const MISSING_HOUR_ERROR = 'Missing required query parameter "hour".';
export const INVALID_HOUR_ERROR = '"hour" must be an integer from 0 to 23.';

/** Validate the `hour` query parameter and build the greeting API result. */
export function greetingApi(params: URLSearchParams): GreetingApiResult {
  const raw = params.get('hour'); // first value if repeated
  if (raw === null || raw === '') {
    return { status: 400, body: { error: MISSING_HOUR_ERROR } };
  }
  // Digits only: rejects signs, decimals, exponents, hex, whitespace, etc.
  if (!/^[0-9]+$/.test(raw)) {
    return { status: 400, body: { error: INVALID_HOUR_ERROR } };
  }
  const hour = Number(raw);
  if (hour > 23) {
    return { status: 400, body: { error: INVALID_HOUR_ERROR } };
  }
  return { status: 200, body: { greeting: greeting(hour) } };
}
