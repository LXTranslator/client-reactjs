import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/**
 * The second factor, client side.
 *
 * The property worth protecting above all others: a correct password no longer
 * means a session. `AuthContext.login` used to read `access_token` off whatever
 * came back, so a challenge response would have called `setAuthToken(undefined)`
 * and carried on as though somebody were signed in. That failure would have been
 * silent, which is what makes it worth a test rather than a comment.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      listAuthProviders: vi.fn().mockResolvedValue({ providers: [] }),
      me: vi.fn(),
      listNamespaces: vi.fn(),
      login: vi.fn(),
      completeMfaChallenge: vi.fn(),
      getTwoFactor: vi.fn(),
      setupTwoFactor: vi.fn(),
      enableTwoFactor: vi.fn(),
      disableTwoFactor: vi.fn(),
      regenerateRecoveryCodes: vi.fn(),
      confirmPassword: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ projects: [] }),
      listProviders: vi.fn().mockResolvedValue({ providers: [], default_provider: 'mock' }),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken, setAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

describe('signing in with a second factor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue(null);
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.me.mockResolvedValue({ account: makeAccount() });
  });

  /**
   * Fills in and submits the credentials form.
   *
   * @param {object} user userEvent instance.
   * @returns {Promise<void>}
   */
  async function signIn(user) {
    await user.type(await screen.findByLabelText(/user id or email/i), 'jetsada');
    await user.type(screen.getByLabelText(/^password/i), 'Str0ngPassphrase');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
  }

  it('asks for a code instead of navigating away', async () => {
    api.login.mockResolvedValue({ mfa_required: true, challenge_token: 'challenge_1' });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });
    await signIn(user);

    await waitFor(() => {
      expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument();
    });

    // Nothing was stored, because nothing was issued.
    expect(setAuthToken).not.toHaveBeenCalled();
  });

  it('never stores an undefined token when the server withholds one', async () => {
    api.login.mockResolvedValue({ mfa_required: true, challenge_token: 'challenge_1' });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });
    await signIn(user);

    await screen.findByLabelText(/authentication code/i);

    for (const call of setAuthToken.mock.calls) {
      expect(call[0]).not.toBeUndefined();
    }
  });

  it('exchanges the code for a session', async () => {
    api.login.mockResolvedValue({ mfa_required: true, challenge_token: 'challenge_1' });
    api.completeMfaChallenge.mockResolvedValue({
      access_token: 'a_real_token',
      account: makeAccount(),
    });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });
    await signIn(user);

    const field = await screen.findByLabelText(/authentication code/i);
    await user.type(field, '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(api.completeMfaChallenge).toHaveBeenCalledWith({
        challenge_token: 'challenge_1',
        code: '123456',
      });
    });

    expect(setAuthToken).toHaveBeenCalledWith('a_real_token');
  });

  it('keeps the challenge on screen when the code is wrong', async () => {
    const { ApiError } = await import('../src/lib/apiClient.js');
    api.login.mockResolvedValue({ mfa_required: true, challenge_token: 'challenge_1' });
    api.completeMfaChallenge.mockRejectedValue(
      new ApiError('That code is not correct.', { status: 401 }),
    );

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });
    await signIn(user);

    const field = await screen.findByLabelText(/authentication code/i);
    await user.type(field, '000000');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    // A wrong code does not spend the challenge, so the step stays put rather
    // than sending somebody back to retype their password.
    await waitFor(() => {
      expect(screen.getByText(/not correct/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument();
  });

  it('refuses an obviously wrong code before calling the server', async () => {
    api.login.mockResolvedValue({ mfa_required: true, challenge_token: 'challenge_1' });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });
    await signIn(user);

    const field = await screen.findByLabelText(/authentication code/i);
    await user.type(field, '12');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByText(/six digit code/i)).toBeInTheDocument();
    });
    expect(api.completeMfaChallenge).not.toHaveBeenCalled();
  });

  it('signs in normally when no factor is enrolled', async () => {
    api.login.mockResolvedValue({ access_token: 'a_real_token', account: makeAccount() });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/login'] });
    await signIn(user);

    await waitFor(() => {
      expect(setAuthToken).toHaveBeenCalledWith('a_real_token');
    });
    expect(screen.queryByLabelText(/authentication code/i)).not.toBeInTheDocument();
  });
});

describe('the two factor settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
  });

  it('shows the factor as off, and offers setup', async () => {
    api.getTwoFactor.mockResolvedValue({
      enabled: false,
      enrolled: false,
      confirmed_at: null,
      recovery_codes_remaining: 0,
    });

    renderWithProviders(<App />, { initialEntries: ['/settings/two_factor'] });

    expect(await screen.findByRole('button', { name: /set up/i })).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('renders a scannable code and the secret, once', async () => {
    api.getTwoFactor.mockResolvedValue({
      enabled: false,
      enrolled: false,
      confirmed_at: null,
      recovery_codes_remaining: 0,
    });
    api.confirmPassword.mockResolvedValue({ token: 'settings_token', expires_in: 600 });
    api.setupTwoFactor.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri:
        'otpauth://totp/LXTranslator:jetsada?secret=JBSWY3DPEHPK3PXP&issuer=LXTranslator',
    });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/settings/two_factor'] });

    await user.type(await screen.findByLabelText(/confirm your password/i), 'Str0ngPassphrase');
    await user.click(screen.getByRole('button', { name: /set up/i }));

    // The QR is an inline SVG, not an image the content security policy would
    // block, and the secret is shown beside it for manual entry.
    expect(await screen.findByRole('img', { name: /two factor setup code/i })).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(screen.getByText(/cannot be shown again/i)).toBeInTheDocument();
  });

  it('shows the recovery codes once the factor is confirmed', async () => {
    api.getTwoFactor
      .mockResolvedValueOnce({
        enabled: false,
        enrolled: false,
        confirmed_at: null,
        recovery_codes_remaining: 0,
      })
      .mockResolvedValue({
        enabled: true,
        enrolled: true,
        confirmed_at: '2026-01-01T00:00:00.000Z',
        recovery_codes_remaining: 10,
      });
    api.confirmPassword.mockResolvedValue({ token: 'settings_token', expires_in: 600 });
    api.setupTwoFactor.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/LXTranslator:jetsada?secret=JBSWY3DPEHPK3PXP',
    });
    api.enableTwoFactor.mockResolvedValue({
      enabled: true,
      recovery_codes: ['ABCD-EFGH-JKMN-PQRS-TVWX', 'WXYZ-2345-6789-ABCD-EFGH'],
    });

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/settings/two_factor'] });

    await user.type(await screen.findByLabelText(/confirm your password/i), 'Str0ngPassphrase');
    await user.click(screen.getByRole('button', { name: /set up/i }));

    await user.type(await screen.findByLabelText(/code from your app/i), '123456');
    await user.type(screen.getByLabelText(/confirm your password/i), 'Str0ngPassphrase');
    await user.click(screen.getByRole('button', { name: /turn on/i }));

    await waitFor(() => {
      expect(screen.getByText('ABCD-EFGH-JKMN-PQRS-TVWX')).toBeInTheDocument();
    });
    expect(screen.getByText(/store these now/i)).toBeInTheDocument();
  });

  it('confirms before turning the factor off', async () => {
    api.getTwoFactor.mockResolvedValue({
      enabled: true,
      enrolled: true,
      confirmed_at: '2026-01-01T00:00:00.000Z',
      recovery_codes_remaining: 7,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/settings/two_factor'] });

    await user.click(await screen.findByRole('button', { name: /turn off/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.disableTwoFactor).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('reports how many recovery codes are left', async () => {
    api.getTwoFactor.mockResolvedValue({
      enabled: true,
      enrolled: true,
      confirmed_at: '2026-01-01T00:00:00.000Z',
      recovery_codes_remaining: 3,
    });

    renderWithProviders(<App />, { initialEntries: ['/settings/two_factor'] });

    expect(await screen.findByText(/3 recovery codes remaining/i)).toBeInTheDocument();
  });
});
