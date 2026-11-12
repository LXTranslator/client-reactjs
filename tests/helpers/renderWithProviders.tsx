import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../src/context/AuthContext.tsx';
import type { Account, Namespace } from '../../src/lib/types.ts';

/**
 * Renders a tree inside the router and session providers.
 *
 * `MemoryRouter` is used rather than `BrowserRouter` so a test can start at any
 * path and assert on navigation without touching the jsdom history object.
 *
 * @param ui Element under test.
 * @param options Render options.
 * @param options.initialEntries Starting history entries.
 * @returns Testing library render result.
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * A signed in account fixture.
 *
 * @param overrides Field overrides.
 * @returns Account payload.
 */
export function makeAccount(overrides: Partial<Account> = {}) {
  return {
    id: 'account_1',
    user_id: 'jetsada',
    email: 'jetsada@example.test',
    type: 'USER',
    display_name: 'Jetsada Wijit',
    description: null,
    website_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A namespace summary fixture.
 *
 * @param overrides Field overrides.
 * @returns Namespace payload.
 */
export function makeNamespace(overrides: Partial<Namespace> = {}): Namespace {
  return {
    id: 'namespace_1',
    user_id: 'jetsada',
    type: 'USER',
    display_name: 'Jetsada Wijit',
    role: 'OWNER',
    ...overrides,
  };
}
