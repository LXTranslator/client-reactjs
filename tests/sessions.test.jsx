import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/*
 * Sessions and API tokens.
 *
 * Two properties matter more than the lists themselves.
 *
 * Signing out has to reach the server. Dropping the token locally only makes
 * this browser forget it; on a borrowed machine that is the difference between
 * signing out and appearing to.
 *
 * A created token is shown exactly once, so the interface has to hold it until
 * it is dismissed rather than flash it. There is no endpoint that could show it
 * again.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      logout: vi.fn(),
      listSessions: vi.fn(),
      revokeSession: vi.fn(),
      revokeOtherSessions: vi.fn(),
      listApiTokens: vi.fn(),
      createApiToken: vi.fn(),
      revokeApiToken: vi.fn(),
      listUsage: vi.fn(),
      getUsageSummary: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken, setAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

const SETTINGS_PATH = '/settings';

/**
 * Builds a session as the server reports it.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Session payload.
 */
function makeSession(overrides = {}) {
  return {
    id: 'session_1',
    kind: 'SESSION',
    name: null,
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    masked_token: null,
    last_used_at: '2026-07-27T09:00:00.000Z',
    expires_at: '2026-07-27T10:00:00.000Z',
    created_at: '2026-07-27T09:00:00.000Z',
    current: true,
    ...overrides,
  };
}

/**
 * Builds an API token as the server reports it.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Token payload.
 */
function makeToken(overrides = {}) {
  return {
    id: 'token_1',
    kind: 'API',
    name: 'ci pipeline',
    user_agent: null,
    masked_token: '****a91f',
    last_used_at: null,
    expires_at: null,
    created_at: '2026-07-27T09:00:00.000Z',
    ...overrides,
  };
}

describe('sessions and API tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.listSessions.mockResolvedValue({ sessions: [makeSession()] });
    api.listApiTokens.mockResolvedValue({ api_tokens: [] });
    api.logout.mockResolvedValue(null);
    api.listUsage.mockResolvedValue({ usage: [] });
    api.getUsageSummary.mockResolvedValue({
      window_days: 7,
      total_requests: 0,
      failed_requests: 0,
      by_credential: [],
    });
  });

  /**
   * Opens account settings and waits for the panel.
   *
   * @returns {Promise<object>} A user event instance.
   */
  async function openSettings() {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: [SETTINGS_PATH] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /where you are signed in/i })).toBeInTheDocument();
    });

    return user;
  }

  describe('signing out', () => {
    it('tells the server rather than only forgetting the token', async () => {
      // The whole point. A local forget leaves the token working everywhere
      // else it reached.
      const user = await openSettings();

      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      await user.click(screen.getByRole('button', { name: /sign out here/i }));

      await waitFor(() => expect(api.logout).toHaveBeenCalled());
      expect(setAuthToken).toHaveBeenCalledWith(null);
      // Not a direct revoke: that would end the session on the server and
      // leave this browser holding a token it does not know is dead.
      expect(api.revokeSession).not.toHaveBeenCalled();
      confirm.mockRestore();
    });

    it('still signs out here when the server call fails', async () => {
      // Somebody who pressed sign out must end up signed out of this browser
      // whatever the network did.
      api.logout.mockRejectedValue(new Error('Offline.'));

      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const user = await openSettings();
      await user.click(screen.getByRole('button', { name: /sign out here/i }));

      await waitFor(() => expect(setAuthToken).toHaveBeenCalledWith(null));
      confirm.mockRestore();
    });
  });

  describe('the session list', () => {
    it('marks which entry is this device', async () => {
      api.listSessions.mockResolvedValue({
        sessions: [
          makeSession(),
          makeSession({
            id: 'session_2',
            user_agent: 'LXTranslator/1.0 (iPhone)',
            current: false,
          }),
        ],
      });

      await openSettings();

      expect(screen.getByText('current')).toBeInTheDocument();
      expect(screen.getByText('LXTranslator/1.0 (iPhone)')).toBeInTheDocument();
    });

    it('ends another device after confirming', async () => {
      api.listSessions.mockResolvedValue({
        sessions: [makeSession(), makeSession({ id: 'session_2', current: false })],
      });
      api.revokeSession.mockResolvedValue(null);

      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const user = await openSettings();

      await user.click(screen.getAllByRole('button', { name: /^end$/i })[0]);
      expect(api.revokeSession).not.toHaveBeenCalled();

      confirm.mockReturnValue(true);
      await user.click(screen.getAllByRole('button', { name: /^end$/i })[0]);

      await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith('session_2'));
      confirm.mockRestore();
    });

    it('offers to sign out everywhere else only when there is an else', async () => {
      await openSettings();
      expect(
        screen.queryByRole('button', { name: /sign out everywhere else/i }),
      ).not.toBeInTheDocument();
    });

    it('signs out everywhere else and says how many', async () => {
      api.listSessions.mockResolvedValue({
        sessions: [makeSession(), makeSession({ id: 'session_2', current: false })],
      });
      api.revokeOtherSessions.mockResolvedValue({ revoked: 3 });

      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const user = await openSettings();

      await user.click(screen.getByRole('button', { name: /sign out everywhere else/i }));

      await waitFor(() => expect(api.revokeOtherSessions).toHaveBeenCalled());
      expect(await screen.findByText(/signed out of 3 other places/i)).toBeInTheDocument();
      confirm.mockRestore();
    });
  });

  describe('API tokens', () => {
    it('holds a created token on screen, since it is shown only once', async () => {
      api.createApiToken.mockResolvedValue({
        api_token: makeToken(),
        token: 'lxt_averyrealtokenvalue',
        warning: 'Copy this token now. It cannot be shown again.',
      });

      const user = await openSettings();

      await user.type(screen.getByLabelText(/token name/i), 'ci pipeline');
      await user.click(screen.getByRole('button', { name: /create token/i }));

      await waitFor(() => {
        expect(api.createApiToken).toHaveBeenCalledWith({ name: 'ci pipeline' });
      });

      expect(await screen.findByText('lxt_averyrealtokenvalue')).toBeInTheDocument();
      expect(screen.getByText(/cannot be shown again/i)).toBeInTheDocument();

      // It stays until dismissed rather than vanishing on the next render.
      await user.click(screen.getByRole('button', { name: /^done$/i }));
      expect(screen.queryByText('lxt_averyrealtokenvalue')).not.toBeInTheDocument();
    });

    it('will not create one without a name', async () => {
      const user = await openSettings();

      await user.click(screen.getByRole('button', { name: /create token/i }));

      expect(await screen.findByText(/name the token/i)).toBeInTheDocument();
      expect(api.createApiToken).not.toHaveBeenCalled();
    });

    it('identifies a stored token without showing it', async () => {
      api.listApiTokens.mockResolvedValue({ api_tokens: [makeToken()] });

      await openSettings();

      expect(screen.getByText('****a91f')).toBeInTheDocument();
      expect(screen.getByText(/no expiry/i)).toBeInTheDocument();
    });

    it('revokes a token after confirming', async () => {
      api.listApiTokens.mockResolvedValue({ api_tokens: [makeToken()] });
      api.revokeApiToken.mockResolvedValue(null);

      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const user = await openSettings();

      await user.click(screen.getByRole('button', { name: /revoke/i }));

      await waitFor(() => expect(api.revokeApiToken).toHaveBeenCalledWith('token_1'));
      confirm.mockRestore();
    });

    it('says what a token is for, so it is not mistaken for a password', async () => {
      await openSettings();
      expect(screen.getByText(/for scripts, not for browsers/i)).toBeInTheDocument();
    });
});

  describe('recent activity', () => {
    /*
     * The log sits under the credentials because the question it answers is the
     * one the lists above provoke: "there is a token here I do not remember,
     * what has it been doing".
     */

    it('shows what a request was, and what came back', async () => {
      api.listUsage.mockResolvedValue({
        usage: [
          {
            id: 1,
            session_id: 'token_1',
            credential_kind: 'API',
            method: 'POST',
            path: '/api/v1/projects/12/files',
            status_code: 202,
            duration_ms: 43,
            created_at: '2026-07-27T09:14:00.000Z',
          },
        ],
      });
      api.listApiTokens.mockResolvedValue({ api_tokens: [makeToken()] });

      await openSettings();

      const log = await screen.findByRole('table', { name: /recent requests/i });
      expect(within(log).getByText('POST /api/v1/projects/12/files')).toBeInTheDocument();
      expect(within(log).getByText('202')).toBeInTheDocument();
      // Named by its credential rather than by a bare identifier.
      expect(within(log).getAllByText('ci pipeline').length).toBeGreaterThan(0);
    });

    it('says a credential is gone rather than showing a bare identifier', async () => {
      // The record outlives the credential on purpose, so a row whose token was
      // revoked and purged still has to read as something.
      api.listUsage.mockResolvedValue({
        usage: [
          {
            id: 1,
            session_id: 'long_gone',
            credential_kind: 'API',
            method: 'GET',
            path: '/api/v1/auth/me',
            status_code: 200,
            duration_ms: 5,
            created_at: '2026-07-27T09:14:00.000Z',
          },
        ],
      });

      await openSettings();

      expect(await screen.findByText('Removed credential')).toBeInTheDocument();
    });

    it('summarises by credential, so an unfamiliar one is visible', async () => {
      api.listApiTokens.mockResolvedValue({ api_tokens: [makeToken()] });
      api.getUsageSummary.mockResolvedValue({
        window_days: 7,
        total_requests: 120,
        failed_requests: 0,
        by_credential: [
          { session_id: 'token_1', credential_kind: 'API', requests: 120, failed: 0 },
        ],
      });

      await openSettings();

      expect(await screen.findByText(/120 requests in the last 7 days/i)).toBeInTheDocument();
    });

    it('points out a run of failures rather than leaving it in the list', async () => {
      api.getUsageSummary.mockResolvedValue({
        window_days: 7,
        total_requests: 100,
        failed_requests: 40,
        by_credential: [],
      });

      await openSettings();

      expect(await screen.findByText(/some requests failed/i)).toBeInTheDocument();
      expect(screen.getByText(/40 of 100/)).toBeInTheDocument();
    });

    it('narrows the list to one credential and back', async () => {
      api.getUsageSummary.mockResolvedValue({
        window_days: 7,
        total_requests: 5,
        failed_requests: 0,
        by_credential: [
          { session_id: 'token_1', credential_kind: 'API', requests: 5, failed: 0 },
        ],
      });

      const user = await openSettings();

      await user.click(await screen.findByRole('button', { name: /only this/i }));

      await waitFor(() => {
        expect(api.listUsage).toHaveBeenCalledWith(
          expect.objectContaining({ sessionId: 'token_1' }),
        );
      });

      await user.click(await screen.findByRole('button', { name: /show all/i }));

      await waitFor(() => {
        const last = api.listUsage.mock.calls.at(-1)[0];
        expect(last.sessionId).toBeUndefined();
      });
    });

    it('says plainly that nothing sent is kept', async () => {
      await openSettings();
      expect(
        await screen.findByText(/no message bodies, no search terms, no addresses/i),
      ).toBeInTheDocument();
    });
  });
});
