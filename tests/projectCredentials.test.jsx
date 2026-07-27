import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/*
 * A project holds no credentials.
 *
 * The property worth proving is a negative one: this page must not offer any
 * way to enter a key, because there is no longer an endpoint that would store
 * it. What it offers instead is the truth about the account chain — whether the
 * platform the project names can actually be paid for — and a way to get to the
 * page that manages it.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      listProviders: vi.fn(),
      getProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
      listAccountKeys: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

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
    name: 'openai',
    label: 'OpenAI',
    default_model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    embedding_models: ['text-embedding-3-small'],
    default_embedding_model: 'text-embedding-3-small',
    supports_caching: true,
    requires_network: true,
  },
  {
    name: 'anthropic',
    label: 'Anthropic Claude',
    default_model: 'claude-opus-5',
    models: ['claude-opus-5', 'claude-sonnet-5'],
    embedding_models: [],
    default_embedding_model: null,
    supports_caching: true,
    requires_network: true,
  },
];

/**
 * Builds a project as the server reports it.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Project payload.
 */
function makeProject(overrides = {}) {
  return {
    id: 1,
    name: 'website',
    description: 'Marketing copy.',
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Builds an account credential.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Credential payload.
 */
function makeKey(overrides = {}) {
  return {
    id: 'key_1',
    account_id: 'namespace_1',
    provider: 'openai',
    chat_model: 'gpt-4o-mini',
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

const SETTINGS_PATH = '/jetsada/project/1/settings';

describe('project settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.listProviders.mockResolvedValue({ providers: PROVIDERS });
    api.getProject.mockResolvedValue({ project: makeProject() });
    api.listAccountKeys.mockResolvedValue({ keys: [makeKey()] });
  });

  /**
   * Opens the settings page and waits for it to settle.
   *
   * @returns {Promise<void>}
   */
  async function openPage() {
    renderWithProviders(<App />, { initialEntries: [SETTINGS_PATH] });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /project settings/i })).toBeInTheDocument();
    });
  }

  it('offers no way to enter a key', async () => {
    await openPage();

    // No field, and no submit that would post one. The server endpoint is gone,
    // so a form here could only produce a 404 and a confused person.
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add key/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
  });

  it('says where the credential actually comes from', async () => {
    await openPage();

    expect(screen.getByText(/keys belong to the account, not to this project/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage ai settings/i })).toHaveAttribute(
      'href',
      '/jetsada/settings/ai',
    );
  });

  it('confirms the account can pay for the platform the project names', async () => {
    await openPage();
    expect(screen.getByText(/one key on this account can pay for this platform/i)).toBeInTheDocument();
  });

  it('warns when the account has no key for that platform', async () => {
    // A key for another vendor is not a fallback; it is a different bill, and
    // the page has to say so rather than counting it.
    api.listAccountKeys.mockResolvedValue({ keys: [makeKey({ provider: 'anthropic' })] });

    await openPage();

    expect(screen.getByText(/no openai key on this account/i)).toBeInTheDocument();
  });

  it('ignores a disabled key when counting what can pay', async () => {
    api.listAccountKeys.mockResolvedValue({ keys: [makeKey({ is_active: false })] });

    await openPage();

    expect(screen.getByText(/no openai key on this account/i)).toBeInTheDocument();
  });

  it('warns that the offline platform translates nothing', async () => {
    // Not "no key needed", which reads like a convenience. It hands back the
    // English text with a locale marker in front of it and still reports the
    // file as finished, which is the failure somebody has to be told about.
    api.getProject.mockResolvedValue({
      project: makeProject({ ai_provider: 'mock', ai_model: 'mock-small' }),
    });
    api.listAccountKeys.mockResolvedValue({ keys: [] });

    await openPage();

    expect(screen.getByText(/this platform translates nothing/i)).toBeInTheDocument();
    expect(screen.getByText(/hands back the English text/i)).toBeInTheDocument();
  });

  it('still renders when the credential list is refused', async () => {
    // A plain member of an organization is refused the list, reading included.
    // The rest of the page is theirs to see, so the refusal cannot fail it.
    api.listAccountKeys.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );

    await openPage();

    expect(screen.getByRole('heading', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage ai settings/i })).toBeInTheDocument();
  });
});
