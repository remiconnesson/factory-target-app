import pkg from '../package.json';

/** The app version, from package.json (inlined at build time). */
export function appVersion(): string {
  return pkg.version;
}
