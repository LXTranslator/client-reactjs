import type { Mock } from 'vitest';

/**
 * A module or object whose functions `vi.mock` replaced with mocks.
 *
 * Each function becomes a loosely typed `Mock`, so a test can hand it whatever
 * fixture the case needs without restating the full payload type. A class keeps
 * its own type, because a test constructs it rather than stubbing it, and a
 * nested object such as `api` is mapped the same way one level down.
 */
export type Mocked<T> = {
  [K in keyof T]: T[K] extends abstract new (...args: never[]) => unknown
    ? T[K]
    : T[K] extends (...args: never[]) => unknown
      ? Mock
      : T[K] extends object
        ? Mocked<T[K]>
        : T[K];
};

/**
 * Views an imported module through the mocks `vi.mock` put in its place.
 *
 * Only a type changes; the value is the module the test already imported.
 *
 * @param value The imported module.
 * @returns The same module, typed as mocked.
 */
export function asMocked<T>(value: T): Mocked<T> {
  return value as unknown as Mocked<T>;
}
