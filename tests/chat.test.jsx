import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, makeAccount, makeNamespace } from './helpers/renderWithProviders.jsx';

/*
 * The assistant.
 *
 * This page differs from every other one here in that the thing on screen acts
 * on real data. So the tests care less about the message bubbles and more about
 * whether a person can tell what actually happened: a refused tool must read as
 * refused, a namespace switch must be visible, and an answer must never be
 * rendered as markup.
 */

vi.mock('../src/lib/apiClient.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      listNamespaces: vi.fn(),
      sendChat: vi.fn(),
      getChatSession: vi.fn(),
      searchChats: vi.fn(),
      backfillChatEmbeddings: vi.fn(),
    },
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
});

const { api, getAuthToken } = await import('../src/lib/apiClient.js');
const { App } = await import('../src/App.jsx');

const CHAT_PATH = '/jetsada/chat';

/**
 * Builds an assistant response.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Response payload.
 */
function makeAnswer(overrides = {}) {
  return {
    session_id: '11111111-1111-4111-8111-111111111111',
    answer: 'You have two projects.',
    namespace: 'jetsada',
    tool_calls: [{ name: 'list_projects', ok: true }],
    steps: 2,
    stopped_by_tool: false,
    token_usage: 812,
    total_token_usage: 812,
    ...overrides,
  };
}

/**
 * Builds a stored turn as the history endpoint returns it.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Turn payload.
 */
function makeTurn(overrides = {}) {
  return {
    id: 1,
    session_id: '11111111-1111-4111-8111-111111111111',
    account_id: 'namespace_1',
    user_id: 'account_1',
    user_prompt: 'How many projects do I have?',
    ai_answer: 'You have two projects.',
    token_usage: 812,
    total_token_usage: 812,
    has_embedding: false,
    embedding_model: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('the assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.getChatSession.mockResolvedValue({ session_id: 'x', turn_count: 0, turns: [] });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  /**
   * Opens the page and waits for the composer.
   *
   * @returns {Promise<object>} A user event instance.
   */
  async function openChat() {
    const user = userEvent.setup();
    renderWithProviders(<App />, { initialEntries: [CHAT_PATH] });

    await waitFor(() => {
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
    });

    return user;
  }

  describe('the three panes', () => {
    it('renders conversations, the conversation and the context', async () => {
      await openChat();

      expect(screen.getByRole('complementary', { name: 'Conversations' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Conversation' })).toBeInTheDocument();
      expect(
        screen.getByRole('complementary', { name: 'Assistant context' }),
      ).toBeInTheDocument();
    });

    it('says what the assistant can do before anything is asked', async () => {
      await openChat();
      expect(screen.getByText(/ask the assistant something/i)).toBeInTheDocument();
    });
  });

  describe('sending a message', () => {
    it('sends JSON when nothing is attached, and starts a session', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());
      api.getChatSession.mockResolvedValue({
        session_id: '11111111-1111-4111-8111-111111111111',
        turn_count: 1,
        turns: [makeTurn()],
      });

      await user.type(screen.getByLabelText('Message'), 'How many projects do I have?');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(api.sendChat).toHaveBeenCalledWith('jetsada', {
          message: 'How many projects do I have?',
        });
      });

      expect(await screen.findByText('You have two projects.')).toBeInTheDocument();
    });

    it('continues the session it started', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());
      api.getChatSession.mockResolvedValue({
        session_id: '11111111-1111-4111-8111-111111111111',
        turn_count: 1,
        turns: [makeTurn()],
      });

      await user.type(screen.getByLabelText('Message'), 'First');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(1));

      await user.type(screen.getByLabelText('Message'), 'Second');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(api.sendChat).toHaveBeenLastCalledWith('jetsada', {
          message: 'Second',
          session_id: '11111111-1111-4111-8111-111111111111',
        });
      });
    });

    it('sends multipart when a file is attached', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer({ answer: 'Created it.' }));

      const file = new File([JSON.stringify({ hello: 'Hello' })], 'en_us.json', {
        type: 'application/json',
      });

      await user.upload(screen.getByLabelText(/attach a file/i), file);
      await user.type(screen.getByLabelText('Message'), 'Make a project from this');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(api.sendChat).toHaveBeenCalledWith('jetsada', expect.any(FormData));
      });

      const sent = api.sendChat.mock.calls[0][1];
      expect(sent.get('message')).toBe('Make a project from this');
      expect(sent.get('file')).toBe(file);
    });

    it('refuses an attachment that fails the upload checks', async () => {
      // The file input carries `accept`, so the browser filters by extension
      // before the handler ever runs. An empty .json file gets past that and is
      // caught by the same validator an ordinary upload uses.
      const user = await openChat();
      const file = new File([], 'empty.json', { type: 'application/json' });

      await user.upload(screen.getByLabelText(/attach a file/i), file);

      expect(await screen.findByRole('alert')).toHaveTextContent(/that file is empty/i);
      expect(screen.queryByText('empty.json')).not.toBeInTheDocument();
    });

    it('will not send an empty message', async () => {
      await openChat();
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    });

    it('renders a failure without losing what was typed on screen', async () => {
      const user = await openChat();
      api.sendChat.mockRejectedValue(
        Object.assign(new Error('The assistant is unavailable right now.'), { status: 503 }),
      );

      await user.type(screen.getByLabelText('Message'), 'Anything');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText(/unavailable right now/i)).toBeInTheDocument();
    });

    it('renders an answer as text rather than as markup', async () => {
      // An answer can quote a project name or a locale string, both written by
      // users, so this is the ordinary case rather than an attack case.
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer({ answer: 'Found <img src=x> in a name.' }));
      api.getChatSession.mockResolvedValue({
        session_id: '11111111-1111-4111-8111-111111111111',
        turn_count: 1,
        turns: [makeTurn({ ai_answer: 'Found <img src=x> in a name.' })],
      });

      await user.type(screen.getByLabelText('Message'), 'Check names');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText('Found <img src=x> in a name.')).toBeInTheDocument();
      expect(document.querySelector('.chat__message-body img')).toBeNull();
    });
  });

  describe('the context pane', () => {
    /**
     * Sends one message and returns the context pane.
     *
     * @param {object} answer Response the server gives.
     * @returns {Promise<HTMLElement>} The pane.
     */
    async function sendAndRead(answer) {
      const user = await openChat();
      api.sendChat.mockResolvedValue(answer);

      await user.type(screen.getByLabelText('Message'), 'Do something');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(api.sendChat).toHaveBeenCalled());
      return screen.getByRole('complementary', { name: 'Assistant context' });
    }

    it('names what the assistant did, in plain words', async () => {
      const pane = await sendAndRead(
        makeAnswer({ tool_calls: [{ name: 'add_languages', ok: true }] }),
      );

      expect(await within(pane).findByText('Added languages')).toBeInTheDocument();
      expect(within(pane).getByText('done')).toBeInTheDocument();
    });

    it('reports a refused tool as refused, with the reason', async () => {
      // The answer above may be describing a refusal, and a person should not
      // have to infer that from prose.
      const pane = await sendAndRead(
        makeAnswer({
          answer: 'I could not create that project.',
          tool_calls: [
            { name: 'create_project', ok: false, error: 'This action requires the ADMIN role.' },
          ],
        }),
      );

      expect(await within(pane).findByText('refused')).toBeInTheDocument();
      expect(within(pane).getByText(/requires the ADMIN role/i)).toBeInTheDocument();
    });

    it('says when the assistant answered without acting', async () => {
      const pane = await sendAndRead(makeAnswer({ tool_calls: [], steps: 1 }));
      expect(await within(pane).findByText(/without acting/i)).toBeInTheDocument();
    });

    it('shows a namespace switch, since the page path no longer describes it', async () => {
      const pane = await sendAndRead(
        makeAnswer({
          namespace: 'acme_corp',
          tool_calls: [{ name: 'switch_namespace', ok: true }],
        }),
      );

      expect(await within(pane).findByText('switched')).toBeInTheDocument();
      expect(within(pane).getByText(/proved your membership/i)).toBeInTheDocument();
    });

    it('reports the steps taken and the tokens spent', async () => {
      const pane = await sendAndRead(makeAnswer({ steps: 3, token_usage: 1200 }));
      expect(await within(pane).findByText(/3 steps, 1,200 tokens/)).toBeInTheDocument();
    });

    it('says nothing was embedded when no model is configured', async () => {
      const user = await openChat();
      api.backfillChatEmbeddings.mockResolvedValue({
        embedded: 0,
        failed: 0,
        remaining: 12,
        model: null,
        configured: false,
      });

      await user.click(screen.getByRole('button', { name: /embed past conversations/i }));

      // Matched on the body rather than the title, which the callout repeats.
      expect(await screen.findByText(/only search by meaning is/i)).toBeInTheDocument();
      expect(screen.getByText(/nothing was embedded because/i)).toBeInTheDocument();
    });

    it('reports what a backfill embedded and what is left', async () => {
      const user = await openChat();
      api.backfillChatEmbeddings.mockResolvedValue({
        embedded: 50,
        failed: 0,
        remaining: 118,
        model: 'qwen/qwen3-embedding-8b',
        configured: true,
      });

      await user.click(screen.getByRole('button', { name: /embed past conversations/i }));

      expect(await screen.findByText(/embedded 50\. 118 still waiting/i)).toBeInTheDocument();
    });
  });

  describe('conversations', () => {
    it('remembers a conversation once it has one', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());

      await user.type(screen.getByLabelText('Message'), 'Remember me');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      expect(await within(list).findByText('Remember me')).toBeInTheDocument();
    });

    it('starts a new conversation without a session identifier', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());

      await user.type(screen.getByLabelText('Message'), 'First');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole('button', { name: 'New' }));
      await user.type(screen.getByLabelText('Message'), 'Fresh start');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(api.sendChat).toHaveBeenLastCalledWith('jetsada', { message: 'Fresh start' });
      });
    });

    it('searches past conversations and says how it matched', async () => {
      const user = await openChat();
      api.searchChats.mockResolvedValue({
        method: 'TEXT',
        match_count: 1,
        matches: [makeTurn({ user_prompt: 'the Thai deadline' })],
      });

      await user.type(screen.getByLabelText(/search past conversations/i), 'Thai');
      await user.click(screen.getByRole('button', { name: 'Find' }));

      await waitFor(() => {
        expect(api.searchChats).toHaveBeenCalledWith('jetsada', 'Thai');
      });
      expect(await screen.findByText('by text')).toBeInTheDocument();
      expect(screen.getByText('the Thai deadline')).toBeInTheDocument();
    });

    it('explains an empty text search, since meaning was not available', async () => {
      const user = await openChat();
      api.searchChats.mockResolvedValue({ method: 'TEXT', match_count: 0, matches: [] });

      await user.type(screen.getByLabelText(/search past conversations/i), 'nothing');
      await user.click(screen.getByRole('button', { name: 'Find' }));

      expect(await screen.findByText(/matched words rather than meaning/i)).toBeInTheDocument();
    });

    it('opens a conversation from the list', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());

      await user.type(screen.getByLabelText('Message'), 'Open me later');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      await user.click(await within(list).findByText('Open me later'));

      await waitFor(() => {
        expect(api.getChatSession).toHaveBeenCalledWith(
          'jetsada',
          '11111111-1111-4111-8111-111111111111',
        );
      });
    });

    it('forgets a conversation locally without deleting the log', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());

      await user.type(screen.getByLabelText('Message'), 'Forget me');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      await within(list).findByText('Forget me');
      await user.click(within(list).getByRole('button', { name: /remove forget me/i }));

      await waitFor(() => {
        expect(within(list).queryByText('Forget me')).not.toBeInTheDocument();
      });
      expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    });
  });
});
