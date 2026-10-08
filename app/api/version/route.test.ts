import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dynamic, GET } from './route';

const pkgVersion: string = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
).version;

describe('GET /api/version', () => {
  it('responds 200 with JSON content type', () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
  });

  it('returns exactly { version } from package.json', async () => {
    const body = await GET().json();
    expect(body).toStrictEqual({ version: pkgVersion });
  });

  it('is not cacheable', () => {
    expect(GET().headers.get('cache-control')).toBe('no-store');
  });

  it('opts out of prerendering', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
