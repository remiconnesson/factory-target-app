import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { appVersion } from './version';

describe('appVersion', () => {
  it('returns the version from package.json', () => {
    expect(typeof appVersion()).toBe('string');
    expect(appVersion()).not.toBe('');
    expect(appVersion()).toBe(pkg.version);
  });
});
