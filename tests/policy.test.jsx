import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/**
 * The public policy pages.
 *
 * Two properties are worth holding. They must render in both session states,
 * because somebody has to be able to read the terms before deciding to register
 * under them. And they must not collide with a namespace: a bare `/policy`
 * would occupy the first path segment, which belongs to accounts.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      listAuthProviders: vi.fn().mockResolvedValue({ providers: [] }),
      me: vi.fn(),
      listNamespaces: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ projects: [] }),
      listProviders: vi.fn().mockResolvedValue({ providers: [], default_provider: 'mock' }),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');
const { paths, isReservedSegment, RESERVED_SEGMENTS } = await import('../src/lib/paths.js');

describe('policy pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when signed out', () => {
    beforeEach(() => {
      getAuthToken.mockReturnValue(null);
    });

    it('renders the privacy policy', async () => {
      renderWithProviders(<App />, { initialEntries: ['/privacy-policy'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /privacy policy/i, level: 1 })).toBeInTheDocument();
      });
    });

    it('renders the terms of service', async () => {
      renderWithProviders(<App />, { initialEntries: ['/terms-of-service'] });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /terms of service/i, level: 1 }),
        ).toBeInTheDocument();
      });
    });

    it('says plainly that it is not legal advice', async () => {
      renderWithProviders(<App />, { initialEntries: ['/privacy-policy'] });

      await waitFor(() => {
        expect(screen.getByText(/not legal advice/i)).toBeInTheDocument();
      });
    });

    it('warns that source text reaches a third party AI platform', async () => {
      renderWithProviders(<App />, { initialEntries: ['/privacy-policy'] });

      // The one place customer content leaves the deployment. A privacy policy
      // that omitted it would be wrong rather than merely thin.
      await waitFor(() => {
        expect(screen.getByText(/leaves this deployment/i)).toBeInTheDocument();
      });
    });
  });

  describe('when signed in', () => {
    beforeEach(() => {
      getAuthToken.mockReturnValue('a_valid_token');
      api.me.mockResolvedValue({ account: makeAccount() });
      api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    });

    it('still renders, rather than redirecting to the dashboard', async () => {
      renderWithProviders(<App />, { initialEntries: ['/terms-of-service'] });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /terms of service/i, level: 1 }),
        ).toBeInTheDocument();
      });
    });

    it('links each policy to the other', async () => {
      renderWithProviders(<App />, { initialEntries: ['/privacy-policy'] });

      const main = await screen.findByRole('main');

      // Scoped to main: the footer carries both links too, so an unscoped
      // query matches twice. This is the documented flake in repository.md.
      await waitFor(() => {
        expect(
          within(main).getByRole('link', { name: /terms of service/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('the addresses themselves', () => {
    it('are built through the path helpers rather than inline', () => {
      expect(paths.privacyPolicy()).toBe('/privacy-policy');
      expect(paths.termsOfService()).toBe('/terms-of-service');
    });

    it('cannot collide with a namespace, so nothing new is reserved', () => {
      /*
       * The reason these addresses are hyphenated. A user id may not contain a
       * hyphen, so no account can ever shadow them, and neither list had to
       * grow. A bare `/policy` would have needed adding here and to the
       * server's reservedIdentifiers.js, and would have orphaned any account
       * already called `policy`.
       */
      for (const path of [paths.privacyPolicy(), paths.termsOfService()]) {
        const segment = path.replace(/^\//, '');
        expect(segment).toContain('-');
        expect(isReservedSegment(segment)).toBe(false);
      }

      expect(RESERVED_SEGMENTS).toEqual([
        'api',
        'assets',
        'login',
        'namespaces',
        'organizations',
        'register',
        'settings',
      ]);
    });
  });

  describe('the footer', () => {
    beforeEach(() => {
      getAuthToken.mockReturnValue(null);
    });

    it('offers both policies from every page', async () => {
      renderWithProviders(<App />, { initialEntries: ['/login'] });

      const footer = await screen.findByRole('contentinfo');

      expect(within(footer).getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
        'href',
        '/privacy-policy',
      );
      expect(within(footer).getByRole('link', { name: /terms of service/i })).toHaveAttribute(
        'href',
        '/terms-of-service',
      );
    });
  });
});
