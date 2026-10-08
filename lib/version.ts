import pkg from '../package.json';

/** The app version from package.json, fixed at build time. */
export function appVersion(): string {
  return pkg.version;
}
