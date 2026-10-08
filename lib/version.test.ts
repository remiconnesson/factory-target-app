import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appVersion } from './version';

const pkgVersion: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

describe('appVersion', () => {
  it('returns the version field from package.json', () => {
    expect(appVersion()).toBe(pkgVersion);
  });

  it('returns a non-empty string', () => {
    expect(typeof appVersion()).toBe('string');
    expect(appVersion().length).toBeGreaterThan(0);
  });
});
