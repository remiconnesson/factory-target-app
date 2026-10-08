import pkg from '../package.json';

/** The app version, from package.json. */
export function appVersion(): string {
  return pkg.version;
}
