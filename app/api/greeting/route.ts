// Relative import (not `@/lib/...`) so route.test.ts can load this module under vitest, which has no alias config.
import { greetingApi } from '../../../lib/greeting-api';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const { status, body } = greetingApi(new URL(request.url).searchParams);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
