import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/**
 * Provider sign in and account linking, client side.
 *
 * Three properties carry the weight here. Nothing at all renders when the
 * deployment configured no provider, which is what "the application still works
 * with no environment variables set" looks like in the interface. The callback
 * takes its single use credentials out of the address bar before doing anything
 * with them. And a provider sign in into an account with a second factor is
 * challenged, exactly as a password sign in is.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      listAuthProviders: vi.fn(),
      startOauthLogin: vi.fn(),
      startOauthLink: vi.fn(),
      completeOauthLogin: vi.fn(),
      completeOauthLink: vi.fn(),
      listOauthIdentities: vi.fn(),
      unlinkOauthProvider: vi.fn(),
      completeMfaChallenge: vi.fn(),
      login: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ projects: [] }),
      listProviders: vi.fn().mockResolvedValue({ providers: [], default_provider: 'mock' }),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken, setAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

/** Replaces window.location so a navigation can be observed rather than performed. */
let assigned;

beforeEach(() => {
  vi.clearAllMocks();
  assigned = [];
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: (url) => assigned.push(url) },
  });
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('offering provider sign in', () => {
  beforeEach(() => {
    getAuthToken.mockReturnValue(null);
  });

  it('renders nothing when the deployment configured no provider', async () => {
    api.listAuthProviders.mockResolvedValue({ providers: [] });

    renderWithProviders(<App />, { initialEntries: ['/login'] });

    await screen.findByRole('heading', { name: /welcome back/i });

    // Not a disabled button and not an empty divider. Nothing.
    expect(screen.queryByRole('button', { name: /continue with/i })).not.toBeInTheDocument();
  });

  it('renders nothing when the catalogue cannot be read', async () => {
    api.listAuthProviders.mockRejectedValue(new Error('unreachable'));

    renderWithProviders(<App />, { initialEntries: ['/login'] });

    await screen.findByRole('heading', { name: /welcome back/i });
    expect(screen.queryByRole('button', { name: /continue with/i })).not.toBeInTheDocument();
  });

  it('offers a button per configured provider', async () => {
    api.listAuthProviders.mockResolvedValue({
      providers: [
        { name: 'github', label: 'GitHub' },
        { name: 'gitlab', label: 'GitLab' },
      ],
    });

    renderWithProviders(<App />, { initialEntries: ['/login'] });

    expect(await screen.findByRole('button', { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with gitlab/i })).toBeInTheDocument();
  });

  it('hands the browser to the provider as a full page navigation', async () => {
    api.listAuthProviders.mockResolvedValue({ providers: [{ name: 'github', label: 'GitHub' }] });
    api.startOauthLogin.mockResolvedValue({
      authorize_url: 'https://github.com/login/oauth/authorize?state=abc',
      expires_in: 600,
    });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });

    await user.click(await screen.findByRole('button', { name: /continue with github/i }));

    await waitFor(() => {
      expect(assigned).toContain('https://github.com/login/oauth/authorize?state=abc');
    });
  });
});

describe('the callback', () => {
  beforeEach(() => {
    getAuthToken.mockReturnValue(null);
    api.listAuthProviders.mockResolvedValue({ providers: [] });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
  });

  it('signs in and clears the credentials out of the address bar', async () => {
    api.completeOauthLogin.mockResolvedValue({
      access_token: 'a_real_token',
      account: makeAccount(),
    });

    renderWithProviders(<App />, {
      initialEntries: ['/oauth-callback?code=the_code&state=the_state'],
    });

    await waitFor(() => {
      expect(api.completeOauthLogin).toHaveBeenCalledWith({
        state: 'the_state',
        code: 'the_code',
      });
    });

    expect(setAuthToken).toHaveBeenCalledWith('a_real_token');

    // A URL reaches history, referrers and proxy logs, so a single use
    // credential must not be left sitting in one.
    await waitFor(() => {
      expect(window.location.search).not.toContain('the_code');
    });
  });

  it('challenges for a second factor, exactly as a password sign in does', async () => {
    api.completeOauthLogin.mockResolvedValue({
      mfa_required: true,
      challenge_token: 'challenge_1',
    });
    api.completeMfaChallenge.mockResolvedValue({
      access_token: 'a_real_token',
      account: makeAccount(),
    });

    const user = userEvent.setup();
    renderWithProviders(<App />, {
      initialEntries: ['/oauth-callback?code=the_code&state=the_state'],
    });

    const field = await screen.findByLabelText(/authentication code/i);
    expect(setAuthToken).not.toHaveBeenCalled();

    await user.type(field, '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(setAuthToken).toHaveBeenCalledWith('a_real_token');
    });
  });

  it('explains what to do when the identity is not linked', async () => {
    const { ApiError } = await import('../src/lib/apiClient.js');
    api.completeOauthLogin.mockRejectedValue(
      new ApiError('That account is not linked yet.', { status: 401 }),
    );

    renderWithProviders(<App />, {
      initialEntries: ['/oauth-callback?code=the_code&state=the_state'],
    });

    expect(await screen.findByText(/not linked yet/i)).toBeInTheDocument();
    expect(screen.getByText(/connect the account from your settings/i)).toBeInTheDocument();
  });

  it('refuses a callback with no code or state', async () => {
    renderWithProviders(<App />, { initialEntries: ['/oauth-callback'] });

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(api.completeOauthLogin).not.toHaveBeenCalled();
  });

  it('reports a provider that refused', async () => {
    renderWithProviders(<App />, {
      initialEntries: ['/oauth-callback?error=access_denied'],
    });

    expect(await screen.findByText(/cancelled or refused/i)).toBeInTheDocument();
    expect(api.completeOauthLogin).not.toHaveBeenCalled();
  });
});

describe('the connected accounts page', () => {
  beforeEach(() => {
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.listAuthProviders.mockResolvedValue({ providers: [{ name: 'github', label: 'GitHub' }] });
  });

  it('says so plainly when nothing is connected', async () => {
    api.listOauthIdentities.mockResolvedValue({ identities: [] });

    renderWithProviders(<App />, { initialEntries: ['/settings/linked'] });

    expect(await screen.findByText(/nothing connected yet/i)).toBeInTheDocument();

    // The catalogue arrives from its own effect, so this waits rather than
    // querying: the empty state renders before the buttons do.
    expect(
      await screen.findByRole('button', { name: /connect github/i }),
    ).toBeInTheDocument();
  });

  it('lists a connected account without fetching a remote avatar', async () => {
    api.listOauthIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity_1',
          provider: 'github',
          provider_username: 'octocat',
          provider_email: 'octo@example.test',
          linked_at: '2026-01-01T00:00:00.000Z',
          last_login_at: null,
        },
      ],
    });

    renderWithProviders(<App />, { initialEntries: ['/settings/linked'] });

    expect(await screen.findByText('octocat', { exact: false })).toBeInTheDocument();

    /*
     * The served policy is `img-src 'self' data:`, so a github.com avatar would
     * be blocked by the browser and render as a broken image. Initials carry the
     * same recognition without a request that cannot succeed.
     */
    const images = screen.queryAllByRole('img');
    for (const image of images) {
      expect(image.getAttribute('src') ?? '').not.toMatch(/^https?:/);
    }
  });

  it('confirms before disconnecting', async () => {
    api.listOauthIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity_1',
          provider: 'github',
          provider_username: 'octocat',
          linked_at: '2026-01-01T00:00:00.000Z',
          last_login_at: null,
        },
      ],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/settings/linked'] });

    await user.click(await screen.findByRole('button', { name: /disconnect/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.unlinkOauthProvider).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
