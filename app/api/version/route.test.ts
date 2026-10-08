import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { GET, dynamic } from './route';

describe('GET /api/version', () => {
  it('returns 200 with the package.json version as JSON', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ version: pkg.version });
  });

  it('forbids caching', () => {
    const res = GET();
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('is rendered per request', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
