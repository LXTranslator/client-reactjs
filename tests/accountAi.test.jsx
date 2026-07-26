import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/*
 * Namespace AI credentials.
 *
 * The two things worth proving are the ones a person could otherwise get wrong
 * silently: that a stored key is never rendered, and that the embedding model
 * is presented as optional rather than as something missing. Leaving it empty
 * is the ordinary case, and a platform that serves no embeddings at all has to
 * say so rather than offering an empty dropdown.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      listProviders: vi.fn(),
      listAccountKeys: vi.fn(),
      addAccountKey: vi.fn(),
      updateAccountKey: vi.fn(),
      removeAccountKey: vi.fn(),
      reorderAccountKeys: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

/** The catalogue as the server reports it, embedding lists included. */
const PROVIDERS = [
  {
    name: 'mock',
    label: 'Built in Mock (offline)',
    default_model: 'mock-small',
    models: ['mock-small', 'mock-large'],
    embedding_models: ['mock-embedding'],
    default_embedding_model: 'mock-embedding',
    supports_caching: false,
    requires_network: false,
  },
  {
    name: 'openrouter',
    label: 'OpenRouter',
    default_model: 'openai/gpt-4o-mini',
    models: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
    embedding_models: ['qwen/qwen3-embedding-8b', 'openai/text-embedding-3-small'],
    default_embedding_model: 'qwen/qwen3-embedding-8b',
    supports_caching: true,
    requires_network: true,
  },
  {
    name: 'anthropic',
    label: 'Anthropic Claude',
    default_model: 'claude-opus-5',
    models: ['claude-opus-5', 'claude-sonnet-5'],
    // Anthropic serves no embeddings endpoint of its own.
    embedding_models: [],
    default_embedding_model: null,
    supports_caching: true,
    requires_network: true,
  },
];

/**
 * Builds a stored credential.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Credential payload.
 */
function makeKey(overrides = {}) {
  return {
    id: 'key_1',
    account_id: 'namespace_1',
    provider: 'openrouter',
    chat_model: 'openai/gpt-4o-mini',
    embedding_model: null,
    label: 'primary',
    masked_key: '****7890',
    priority_order: 1,
    is_active: true,
    last_used_at: null,
    last_error_at: null,
    last_error_reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const AI_PATH = '/jetsada/settings/ai';

describe('namespace AI settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.listProviders.mockResolvedValue({ providers: PROVIDERS });
    api.listAccountKeys.mockResolvedValue({ keys: [] });
  });

  /**
   * Opens the page and waits for it to settle.
   *
   * @param {string[]} [entries] Initial history entries.
   * @returns {Promise<object>} A user event instance.
   */
  async function openPage(entries = [AI_PATH]) {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: entries });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /credential chain/i })).toBeInTheDocument();
    });

    return user;
  }

  describe('the chain', () => {
    it('says the assistant still works with nothing configured', async () => {
      await openPage();
      expect(screen.getByText(/no credentials configured/i)).toBeInTheDocument();
      expect(screen.getByText(/built in offline provider/i)).toBeInTheDocument();
    });

    it('shows a credential by its platform, models and mask', async () => {
      api.listAccountKeys.mockResolvedValue({
        keys: [makeKey({ embedding_model: 'qwen/qwen3-embedding-8b' })],
      });

      await openPage();

      expect(screen.getByText('****7890')).toBeInTheDocument();
      expect(screen.getByText('openrouter')).toBeInTheDocument();
      expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByText('qwen/qwen3-embedding-8b')).toBeInTheDocument();
    });

    it('renders no stored key anywhere on the page', async () => {
      // There is no endpoint that returns one, and there must be no view that
      // would render one if a future endpoint slipped.
      api.listAccountKeys.mockResolvedValue({
        keys: [makeKey({ api_key: 'sk_live_should_never_render' })],
      });

      await openPage();
      expect(document.body.textContent).not.toContain('sk_live_should_never_render');
    });

    it('explains the organization to personal fallback inside an organization', async () => {
      api.listNamespaces.mockResolvedValue({
        namespaces: [
          makeNamespace(),
          makeNamespace({ id: 'ns_org', user_id: 'acme_corp', type: 'ORG', role: 'OWNER' }),
        ],
      });

      await openPage(['/acme_corp/settings/ai']);

      expect(screen.getByText(/falls back to their own personal credentials/i)).toBeInTheDocument();
    });

    it('reorders the chain, which is the order the server walks', async () => {
      api.listAccountKeys.mockResolvedValue({
        keys: [makeKey(), makeKey({ id: 'key_2', label: 'secondary', priority_order: 2 })],
      });

      const user = await openPage();
      await user.click(screen.getByRole('button', { name: /move secondary up/i }));

      await waitFor(() => {
        expect(api.reorderAccountKeys).toHaveBeenCalledWith('jetsada', ['key_2', 'key_1']);
      });
    });

    it('names the platforms the account can actually pay for', async () => {
      // One chain, but a project only ever draws on the part of it matching its
      // own platform. Which platforms are covered is the question a person
      // arrives with, so it is answered without reading every row.
      api.listAccountKeys.mockResolvedValue({
        keys: [
          makeKey(),
          makeKey({ id: 'key_2', provider: 'anthropic', chat_model: 'claude-opus-5' }),
        ],
      });

      await openPage();

      const covered = screen.getByText(/platforms covered/i);
      expect(within(covered).getByText('OpenRouter')).toBeInTheDocument();
      expect(within(covered).getByText('Anthropic Claude')).toBeInTheDocument();
      expect(within(covered).queryByText('Built in Mock (offline)')).not.toBeInTheDocument();
    });

    it('counts a disabled credential as covering nothing', async () => {
      api.listAccountKeys.mockResolvedValue({ keys: [makeKey({ is_active: false })] });

      await openPage();

      expect(screen.getByText(/every credential here is disabled/i)).toBeInTheDocument();
    });

    it('disables a credential without removing it', async () => {
      api.listAccountKeys.mockResolvedValue({ keys: [makeKey()] });

      const user = await openPage();
      await user.click(screen.getByRole('button', { name: /disable/i }));

      await waitFor(() => {
        expect(api.updateAccountKey).toHaveBeenCalledWith('jetsada', 'key_1', {
          is_active: false,
        });
      });
    });

    it('removes a credential after a confirmation', async () => {
      api.listAccountKeys.mockResolvedValue({ keys: [makeKey()] });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const user = await openPage();
      await user.click(screen.getByRole('button', { name: /remove/i }));

      await waitFor(() => {
        expect(api.removeAccountKey).toHaveBeenCalledWith('jetsada', 'key_1');
      });
    });

    it('keeps the credential when the confirmation is declined', async () => {
      api.listAccountKeys.mockResolvedValue({ keys: [makeKey()] });
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      const user = await openPage();
      await user.click(screen.getByRole('button', { name: /remove/i }));

      expect(api.removeAccountKey).not.toHaveBeenCalled();
    });
  });

  describe('the embedding model', () => {
    it('offers none as the first option, since leaving it unset is ordinary', async () => {
      await openPage();

      const select = screen.getByLabelText(/embedding model/i);
      expect(select).toHaveValue('');
      expect(
        within(select).getByRole('option', { name: /none, search matches text/i }),
      ).toBeInTheDocument();
    });

    it('lists the models the chosen platform serves', async () => {
      const user = await openPage();
      await user.selectOptions(screen.getByLabelText(/platform/i), 'openrouter');

      const select = screen.getByLabelText(/embedding model/i);
      expect(
        within(select).getByRole('option', { name: 'qwen/qwen3-embedding-8b' }),
      ).toBeInTheDocument();
      expect(
        within(select).getByRole('option', { name: 'openai/text-embedding-3-small' }),
      ).toBeInTheDocument();
    });

    it('says why a platform serving no embeddings offers nothing', async () => {
      const user = await openPage();
      await user.selectOptions(screen.getByLabelText(/platform/i), 'anthropic');

      expect(screen.getByLabelText(/embedding model/i)).toBeDisabled();
      expect(screen.getByText(/serves no embeddings/i)).toBeInTheDocument();
    });

    it('says the assistant works without one', async () => {
      api.listAccountKeys.mockResolvedValue({ keys: [makeKey({ embedding_model: null })] });

      await openPage();

      expect(screen.getByText(/no embedding model configured/i)).toBeInTheDocument();
      expect(screen.getByText(/matches text rather than meaning/i)).toBeInTheDocument();
    });

    it('stays quiet once a credential names one', async () => {
      api.listAccountKeys.mockResolvedValue({
        keys: [makeKey({ embedding_model: 'qwen/qwen3-embedding-8b' })],
      });

      await openPage();
      expect(screen.queryByText(/no embedding model configured/i)).not.toBeInTheDocument();
    });
  });

  describe('adding one', () => {
    it('sends the platform, chat model and key', async () => {
      const user = await openPage();

      await user.selectOptions(screen.getByLabelText(/platform/i), 'openrouter');
      await user.type(screen.getByLabelText(/api key/i), 'or_secret_key_1234');
      await user.type(screen.getByLabelText(/^label/i), 'primary');
      await user.click(screen.getByRole('button', { name: /add credential/i }));

      await waitFor(() => {
        expect(api.addAccountKey).toHaveBeenCalledWith('jetsada', {
          provider: 'openrouter',
          chat_model: 'openai/gpt-4o-mini',
          api_key: 'or_secret_key_1234',
          label: 'primary',
        });
      });
    });

    it('omits the embedding model entirely when none is chosen', async () => {
      const user = await openPage();

      await user.type(screen.getByLabelText(/api key/i), 'mock_secret_key_1234');
      await user.click(screen.getByRole('button', { name: /add credential/i }));

      await waitFor(() => {
        expect(api.addAccountKey).toHaveBeenCalledWith(
          'jetsada',
          expect.not.objectContaining({ embedding_model: expect.anything() }),
        );
      });
    });

    it('sends the embedding model when one is chosen', async () => {
      const user = await openPage();

      await user.selectOptions(screen.getByLabelText(/platform/i), 'openrouter');
      await user.selectOptions(
        screen.getByLabelText(/embedding model/i),
        'qwen/qwen3-embedding-8b',
      );
      await user.type(screen.getByLabelText(/api key/i), 'or_secret_key_1234');
      await user.click(screen.getByRole('button', { name: /add credential/i }));

      await waitFor(() => {
        expect(api.addAccountKey).toHaveBeenCalledWith(
          'jetsada',
          expect.objectContaining({ embedding_model: 'qwen/qwen3-embedding-8b' }),
        );
      });
    });

    it('resets both models when the platform changes', async () => {
      // Keeping the previous model would name something the new platform does
      // not offer, which the server would then refuse.
      const user = await openPage();

      await user.selectOptions(screen.getByLabelText(/platform/i), 'openrouter');
      await user.selectOptions(
        screen.getByLabelText(/embedding model/i),
        'qwen/qwen3-embedding-8b',
      );
      await user.selectOptions(screen.getByLabelText(/platform/i), 'anthropic');

      expect(screen.getByLabelText(/chat model/i)).toHaveValue('claude-opus-5');
      expect(screen.getByLabelText(/embedding model/i)).toHaveValue('');
    });

    it('refuses a key that is obviously too short before sending it', async () => {
      const user = await openPage();

      await user.type(screen.getByLabelText(/api key/i), 'short');
      await user.click(screen.getByRole('button', { name: /add credential/i }));

      expect(api.addAccountKey).not.toHaveBeenCalled();
    });

    it('maps a server field rejection back onto the field', async () => {
      const user = await openPage();
      api.addAccountKey.mockRejectedValue(
        Object.assign(new Error('The submitted data failed validation.'), {
          status: 422,
          fieldErrors: { embedding_model: 'That model is not offered.' },
        }),
      );

      await user.type(screen.getByLabelText(/api key/i), 'mock_secret_key_1234');
      await user.click(screen.getByRole('button', { name: /add credential/i }));

      expect(await screen.findByText('That model is not offered.')).toBeInTheDocument();
    });
  });

  describe('who may see it', () => {
    it('explains a refusal rather than showing an empty chain', async () => {
      // A member gets 403 rather than an empty list, and an empty list would
      // read as "nothing is configured", which is a different and wrong story.
      api.listAccountKeys.mockRejectedValue(
        Object.assign(new Error('This action requires the ADMIN role.'), { status: 403 }),
      );

      renderWithProviders(<App />, { initialEntries: [AI_PATH] });

      expect(
        await screen.findByText(/owners and administrators only/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no credentials configured/i)).not.toBeInTheDocument();
    });
  });
});
