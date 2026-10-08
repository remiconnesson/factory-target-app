import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { GET, dynamic } from './route';

describe('GET /api/version', () => {
  it('returns 200 with exactly the package.json version', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: pkg.version });
  });

  it('is JSON and not cacheable', () => {
    const res = GET();
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('is rendered at request time', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
