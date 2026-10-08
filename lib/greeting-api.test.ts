import { describe, expect, it } from 'vitest';
import { greetingApi } from './greeting-api';

const call = (q: string) => greetingApi(new URLSearchParams(q));

const ok = (text: string) => ({ status: 200, body: { greeting: text } });

describe('greetingApi', () => {
  it('returns the greeting for valid hours', () => {
    expect(call('hour=9')).toEqual(ok('Good morning'));
    expect(call('hour=14')).toEqual(ok('Good afternoon'));
    expect(call('hour=20')).toEqual(ok('Good evening'));
  });

  it('handles boundaries', () => {
    expect(call('hour=0')).toEqual(ok('Good morning'));
    expect(call('hour=11')).toEqual(ok('Good morning'));
    expect(call('hour=12')).toEqual(ok('Good afternoon'));
    expect(call('hour=17')).toEqual(ok('Good afternoon'));
    expect(call('hour=18')).toEqual(ok('Good evening'));
    expect(call('hour=23')).toEqual(ok('Good evening'));
  });

  it('accepts leading zeros', () => {
    expect(call('hour=09')).toEqual(ok('Good morning'));
  });

  it('uses the first value when hour is repeated', () => {
    expect(call('hour=9&hour=20')).toEqual(ok('Good morning'));
  });

  it.each(['', 'hour='])('reports a missing hour for %j', (q) => {
    const result = call(q);
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: expect.stringContaining('Missing') });
    expect(result.body).toEqual({ error: expect.stringContaining('"hour"') });
  });

  it.each([
    'hour=abc',
    'hour=9.5',
    'hour=-1',
    'hour=%2B9',
    'hour=1e1',
    'hour=0x9',
    'hour=%209',
    'hour=9abc',
    'hour=9.0',
    'hour=Infinity',
    'hour=24',
    'hour=99',
    'hour=100',
    'hour=999999999999999999999',
  ])('rejects invalid value %j', (q) => {
    const result = call(q);
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: expect.stringContaining('"hour"') });
    expect(result.body).toEqual({ error: expect.stringContaining('0 to 23') });
    expect(result.body).not.toEqual({ error: expect.stringContaining('Missing') });
  });
});
