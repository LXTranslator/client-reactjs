import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

// The API client is mocked so routing is tested without a server.
vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      listProviders: vi.fn().mockResolvedValue({ providers: [], default_provider: 'mock' }),
      listProjects: vi.fn().mockResolvedValue({ projects: [] }),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

describe('routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when signed out', () => {
    beforeEach(() => {
      getAuthToken.mockReturnValue(null);
    });

    it('redirects the root path to sign in', async () => {
      renderWithProviders(<App />, { initialEntries: ['/'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });
    });

    it('redirects a protected route to sign in', async () => {
      renderWithProviders(<App />, { initialEntries: ['/namespaces/projects'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });
    });

    it('offers a link to registration from the sign in page', async () => {
      renderWithProviders(<App />, { initialEntries: ['/login'] });

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument();
      });
    });

    it('offers a forgot password link from the sign in page', async () => {
      renderWithProviders(<App />, { initialEntries: ['/login'] });

      // Scoped to the main landmark, because the footer carries its own
      // recovery link and an unscoped query would match both.
      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(within(main).getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
      });
    });

    it('renders the registration page', async () => {
      renderWithProviders(<App />, { initialEntries: ['/register'] });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /create your account/i }),
        ).toBeInTheDocument();
      });
    });

    it('keeps password recovery reachable', async () => {
      renderWithProviders(<App />, { initialEntries: ['/forgot-password'] });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /forgot your password/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('when signed in', () => {
    beforeEach(() => {
      getAuthToken.mockReturnValue('a_valid_token');
      api.me.mockResolvedValue({ account: makeAccount() });
      api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    });

    it('redirects the root path to the dashboard', async () => {
      renderWithProviders(<App />, { initialEntries: ['/'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /hello, jetsada/i })).toBeInTheDocument();
      });
    });

    it('keeps a signed in visitor off the sign in page', async () => {
      renderWithProviders(<App />, { initialEntries: ['/login'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /hello, jetsada/i })).toBeInTheDocument();
      });
    });

    it('renders a protected route', async () => {
      renderWithProviders(<App />, { initialEntries: ['/namespaces/projects'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^projects$/i })).toBeInTheDocument();
      });
    });

    it('renders the not found page for an unknown path', async () => {
      renderWithProviders(<App />, { initialEntries: ['/no/such/page'] });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /that page does not exist/i }),
        ).toBeInTheDocument();
      });
    });

    it('points a personal namespace away from organization settings', async () => {
      renderWithProviders(<App />, { initialEntries: ['/namespaces/settings'] });

      // Exact string, because the explanatory sentence below the heading also
      // contains the phrase and a regex would match both.
      await waitFor(() => {
        expect(screen.getByText('Personal namespace')).toBeInTheDocument();
      });
    });

    it('signs the visitor out when the stored token is rejected', async () => {
      // An expired token must land on the login page rather than a broken shell.
      const { ApiError } = await import('../src/lib/apiClient.js');
      api.me.mockRejectedValue(new ApiError('expired', { status: 401 }));

      renderWithProviders(<App />, { initialEntries: ['/namespaces'] });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });
    });
  });
});
