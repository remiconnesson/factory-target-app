import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { GET, dynamic } from './route';

describe('GET /api/version', () => {
  it('responds 200 with JSON', () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns only the package.json version', async () => {
    const res = GET();
    expect(await res.json()).toEqual({ version: pkg.version });
  });

  it('is not cacheable', () => {
    const res = GET();
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('is rendered at request time', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
