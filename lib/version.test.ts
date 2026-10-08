import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { appVersion } from './version';

describe('appVersion', () => {
  it('returns the version from package.json', () => {
    expect(appVersion()).toBe(pkg.version);
  });

  it('is a non-empty string', () => {
    expect(typeof appVersion()).toBe('string');
    expect(appVersion().length).toBeGreaterThan(0);
  });
});
