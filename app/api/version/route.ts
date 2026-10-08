import { appVersion } from '../../../lib/version';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(
    { version: appVersion() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
