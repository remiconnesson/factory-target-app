import { version } from '../package.json';

/** The app version, from package.json. */
export function appVersion(): string {
  return version;
}
