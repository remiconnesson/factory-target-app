import { describe, expect, it } from 'vitest';
import { GET } from './route';

const get = (query: string) => GET(new Request(`http://localhost/api/greeting${query}`));

describe('GET /api/greeting', () => {
  it('returns 200 JSON with no-store', async () => {
    const res = get('?hour=14');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ greeting: 'Good afternoon' });
  });

  it.each(['', '?hour=', '?hour=abc', '?hour=24'])('returns 400 JSON with no-store for %j', async (query) => {
    const res = get(query);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body).not.toHaveProperty('greeting');
  });
});
