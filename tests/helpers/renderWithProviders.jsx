import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../../src/context/AuthContext.jsx';

/**
 * Renders a tree inside the router and session providers.
 *
 * `MemoryRouter` is used rather than `BrowserRouter` so a test can start at any
 * path and assert on navigation without touching the jsdom history object.
 *
 * @param {React.ReactNode} ui Element under test.
 * @param {object} [options] Render options.
 * @param {string[]} [options.initialEntries] Starting history entries.
 * @returns {object} Testing library render result.
 */
export function renderWithProviders(ui, { initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * A signed in account fixture.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Account payload.
 */
export function makeAccount(overrides = {}) {
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
 * @param {object} [overrides] Field overrides.
 * @returns {object} Namespace payload.
 */
export function makeNamespace(overrides = {}) {
  return {
    id: 'namespace_1',
    user_id: 'jetsada',
    type: 'USER',
    display_name: 'Jetsada Wijit',
    role: 'OWNER',
    ...overrides,
  };
}
