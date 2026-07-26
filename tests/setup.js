import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Test environment setup.
 *
 * Unmounts every rendered tree and clears session storage between tests, so one
 * test cannot leave a session behind that changes what the next one renders.
 */

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});
