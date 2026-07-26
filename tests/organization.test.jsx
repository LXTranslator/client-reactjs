import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      checkAvailability: vi.fn(),
      createOrganization: vi.fn(),
      getNamespace: vi.fn(),
      updateNamespace: vi.fn(),
      deleteNamespace: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken, ApiError } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

/** Namespace fixture for an organization the signed in account owns. */
const ORGANIZATION = makeNamespace({
  id: 'namespace_org',
  user_id: 'acme_corp',
  type: 'ORG',
  display_name: 'Acme Corporation',
  role: 'OWNER',
});

describe('organization creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.checkAvailability.mockResolvedValue({
      user_id_available: true,
      email_available: true,
    });
  });

  /**
   * Renders the creation page and waits for it to settle.
   *
   * @returns {Promise<object>} A user event instance.
   */
  async function openCreatePage() {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/namespaces/organizations/new'] });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /create an organization/i }),
      ).toBeInTheDocument();
    });

    return user;
  }

  it('renders the identity and profile fields', async () => {
    await openCreatePage();

    expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
  });

  it('explains that the organization email is its own', async () => {
    await openCreatePage();

    // The point of a separate address is that billing does not follow the
    // person who created the organization.
    expect(screen.getByText(/billing and account notices go here/i)).toBeInTheDocument();
  });

  it('checks the organization id against the namespace pool as it is typed', async () => {
    const user = await openCreatePage();

    await user.type(screen.getByLabelText(/organization id/i), 'acme_corp');

    await waitFor(
      () => {
        expect(api.checkAvailability).toHaveBeenCalledWith({ user_id: 'acme_corp' });
      },
      { timeout: 2000 },
    );

    expect(await screen.findByText('Available')).toBeInTheDocument();
  });

  it('reports an organization id that is already taken', async () => {
    api.checkAvailability.mockResolvedValue({ user_id_available: false });

    const user = await openCreatePage();
    await user.type(screen.getByLabelText(/organization id/i), 'taken_org');

    expect(await screen.findByText('Already taken', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('blocks submission while an identifier is known to be taken', async () => {
    api.checkAvailability.mockResolvedValue({
      user_id_available: false,
      email_available: true,
    });

    const user = await openCreatePage();
    await user.type(screen.getByLabelText(/organization id/i), 'taken_org');

    // Wait for the button itself rather than for prose that happens to
    // contain the same phrase.
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /create organization/i })).toBeDisabled();
      },
      { timeout: 2000 },
    );

    expect(api.createOrganization).not.toHaveBeenCalled();
  });

  it('does not probe the server for a locally invalid identifier', async () => {
    const user = await openCreatePage();

    // Two characters cannot be valid, so there is nothing to ask the server.
    await user.type(screen.getByLabelText(/organization id/i), 'ab');

    await new Promise((resolve) => {
      setTimeout(resolve, 700);
    });

    expect(api.checkAvailability).not.toHaveBeenCalledWith({ user_id: 'ab' });
  });

  it('reports a locally invalid identifier on submit', async () => {
    const user = await openCreatePage();

    await user.type(screen.getByLabelText(/organization id/i), 'Bad Id');
    await user.type(screen.getByLabelText(/organization email/i), 'team@acme.com');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    expect(await screen.findByText(/must be lowercase/i)).toBeInTheDocument();
    expect(api.createOrganization).not.toHaveBeenCalled();
  });

  it('requires a valid organization email', async () => {
    const user = await openCreatePage();

    await user.type(screen.getByLabelText(/organization id/i), 'acme_corp');
    await user.type(screen.getByLabelText(/organization email/i), 'not-an-address');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(api.createOrganization).not.toHaveBeenCalled();
  });

  it('creates the organization with its own contact address', async () => {
    api.createOrganization.mockResolvedValue({ namespace: ORGANIZATION });
    api.listNamespaces.mockResolvedValue({
      namespaces: [makeNamespace(), ORGANIZATION],
    });
    api.getNamespace.mockResolvedValue({
      namespace: { ...ORGANIZATION, email: 'team@acme.com' },
    });

    const user = await openCreatePage();

    await user.type(screen.getByLabelText(/organization id/i), 'acme_corp');
    await user.type(screen.getByLabelText(/organization email/i), 'team@acme.com');
    await user.type(screen.getByLabelText(/display name/i), 'Acme Corporation');
    await user.click(screen.getByRole('button', { name: /create organization/i }));

    await waitFor(() => {
      expect(api.createOrganization).toHaveBeenCalledWith({
        user_id: 'acme_corp',
        email: 'team@acme.com',
        display_name: 'Acme Corporation',
      });
    });
  });
});

describe('organization settings and deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({
      namespaces: [makeNamespace(), ORGANIZATION],
    });
    api.getNamespace.mockResolvedValue({
      namespace: {
        ...ORGANIZATION,
        email: 'team@acme.com',
        description: 'Localization team',
        website_url: null,
      },
    });
    window.sessionStorage.setItem('lxtranslator_active_namespace', 'acme_corp');
  });

  /**
   * Renders the organization settings page and waits for it to settle.
   *
   * @returns {Promise<object>} A user event instance.
   */
  async function openSettings() {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: ['/namespaces/settings'] });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /organization settings/i }),
      ).toBeInTheDocument();
    });

    // The delete panel renders only once the profile load has resolved, so wait
    // for a loaded field rather than racing it.
    await screen.findByLabelText(/organization email/i);

    return user;
  }

  it('loads the organization contact address into the form', async () => {
    await openSettings();

    await waitFor(() => {
      expect(screen.getByLabelText(/organization email/i)).toHaveValue('team@acme.com');
    });
  });

  it('saves a changed contact address', async () => {
    api.updateNamespace.mockResolvedValue({ namespace: ORGANIZATION });

    const user = await openSettings();
    const field = await screen.findByLabelText(/organization email/i);

    await user.clear(field);
    await user.type(field, 'accounts@acme.com');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(api.updateNamespace).toHaveBeenCalledWith(
        'acme_corp',
        expect.objectContaining({ email: 'accounts@acme.com' }),
      );
    });
  });

  it('rejects a malformed contact address before sending it', async () => {
    const user = await openSettings();
    const field = await screen.findByLabelText(/organization email/i);

    await user.clear(field);
    await user.type(field, 'bad-address');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(api.updateNamespace).not.toHaveBeenCalled();
  });

  describe('two step deletion', () => {
    it('opens a dialog asking for the organization id', async () => {
      const user = await openSettings();

      await user.click(screen.getByRole('button', { name: /delete this organization/i }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: /delete organization/i })).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/organization id/i)).toBeInTheDocument();
    });

    it('keeps the delete button disabled until the id matches exactly', async () => {
      const user = await openSettings();
      await user.click(screen.getByRole('button', { name: /delete this organization/i }));

      const dialog = await screen.findByRole('dialog');
      const deleteButton = within(dialog).getByRole('button', { name: /^delete$/i });

      expect(deleteButton).toBeDisabled();

      await user.type(within(dialog).getByLabelText(/organization id/i), 'wrong_name');
      expect(deleteButton).toBeDisabled();

      await user.clear(within(dialog).getByLabelText(/organization id/i));
      await user.type(within(dialog).getByLabelText(/organization id/i), 'acme_corp');
      expect(deleteButton).toBeEnabled();
    });

    it('shows a second confirmation before deleting anything', async () => {
      const user = await openSettings();
      await user.click(screen.getByRole('button', { name: /delete this organization/i }));

      const first = await screen.findByRole('dialog');
      await user.type(within(first).getByLabelText(/organization id/i), 'acme_corp');
      await user.click(within(first).getByRole('button', { name: /^delete$/i }));

      // Step two: a final yes, catching a reflexive click on step one.
      const second = await screen.findByRole('dialog');
      expect(
        within(second).getByRole('heading', { name: /are you absolutely sure/i }),
      ).toBeInTheDocument();
      expect(within(second).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(within(second).getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();

      // Nothing has been sent yet.
      expect(api.deleteNamespace).not.toHaveBeenCalled();
    });

    it('cancels from the second dialog without deleting', async () => {
      const user = await openSettings();
      await user.click(screen.getByRole('button', { name: /delete this organization/i }));

      const first = await screen.findByRole('dialog');
      await user.type(within(first).getByLabelText(/organization id/i), 'acme_corp');
      await user.click(within(first).getByRole('button', { name: /^delete$/i }));

      const second = await screen.findByRole('dialog');
      await user.click(within(second).getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(api.deleteNamespace).not.toHaveBeenCalled();
    });

    it('deletes only after the second confirmation', async () => {
      api.deleteNamespace.mockResolvedValue(null);

      const user = await openSettings();
      await user.click(screen.getByRole('button', { name: /delete this organization/i }));

      const first = await screen.findByRole('dialog');
      await user.type(within(first).getByLabelText(/organization id/i), 'acme_corp');
      await user.click(within(first).getByRole('button', { name: /^delete$/i }));

      const second = await screen.findByRole('dialog');
      await user.click(within(second).getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(api.deleteNamespace).toHaveBeenCalledWith('acme_corp', 'acme_corp');
      });
    });

    it('returns to the naming step when the server rejects the deletion', async () => {
      api.deleteNamespace.mockRejectedValue(
        new ApiError('The confirmation does not match this organization identifier.', {
          status: 400,
        }),
      );

      const user = await openSettings();
      await user.click(screen.getByRole('button', { name: /delete this organization/i }));

      const first = await screen.findByRole('dialog');
      await user.type(within(first).getByLabelText(/organization id/i), 'acme_corp');
      await user.click(within(first).getByRole('button', { name: /^delete$/i }));

      const second = await screen.findByRole('dialog');
      await user.click(within(second).getByRole('button', { name: /confirm delete/i }));

      expect(await screen.findByText(/confirmation does not match/i)).toBeInTheDocument();
    });

    it('hides deletion from a member who is not an owner', async () => {
      const asMember = { ...ORGANIZATION, role: 'MEMBER' };
      api.listNamespaces.mockResolvedValue({
        namespaces: [makeNamespace(), asMember],
      });
      api.getNamespace.mockResolvedValue({
        namespace: { ...asMember, email: 'team@acme.com' },
      });

      await openSettings();

      expect(
        await screen.findByRole('button', { name: /delete this organization/i }),
      ).toBeDisabled();
      expect(screen.getByText(/only an owner can delete/i)).toBeInTheDocument();
    });
  });
});
