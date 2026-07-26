import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
      listChatSessions: vi.fn(),
      getChatSession: vi.fn(),
      renameChatSession: vi.fn(),
      deleteChatSession: vi.fn(),
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

/**
 * Builds a conversation as the list endpoint returns it.
 *
 * @param {object} [overrides] Field overrides.
 * @returns {object} Session payload.
 */
function makeSession(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    account_id: 'namespace_1',
    user_id: 'account_1',
    title: 'How many projects do I have?',
    turn_count: 1,
    total_token_usage: 812,
    last_message_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('the assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue('a_valid_token');
    api.me.mockResolvedValue({ account: makeAccount() });
    api.listNamespaces.mockResolvedValue({ namespaces: [makeNamespace()] });
    api.listChatSessions.mockResolvedValue({ sessions: [] });
    api.getChatSession.mockResolvedValue({ session_id: 'x', turn_count: 0, turns: [] });
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

    it('attaches a file dropped anywhere on the conversation pane', async () => {
      // People arrive at a chat holding a file. Making them find a button
      // first is the kind of friction that sends them back to the project
      // page to upload it there instead.
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer({ answer: 'Created it.' }));

      const file = new File([JSON.stringify({ hello: 'Hello' })], 'dropped.json', {
        type: 'application/json',
      });

      const pane = screen.getByRole('region', { name: 'Conversation' });
      fireEvent.drop(pane, { dataTransfer: { files: [file] } });

      expect(await within(pane).findByText('dropped.json')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Message'), 'Use this one');
      await user.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => {
        expect(api.sendChat).toHaveBeenCalledWith('jetsada', expect.any(FormData));
      });
      expect(api.sendChat.mock.calls[0][1].get('file')).toBe(file);
    });

    it('announces the drop target while a file is over the pane', async () => {
      await openChat();
      const pane = screen.getByRole('region', { name: 'Conversation' });

      fireEvent.dragEnter(pane, { dataTransfer: { types: ['Files'] } });
      expect(await screen.findByText(/drop a json locale file/i)).toBeInTheDocument();

      fireEvent.dragLeave(pane);
      await waitFor(() => {
        expect(screen.queryByText(/drop a json locale file/i)).not.toBeInTheDocument();
      });
    });

    it('checks a dropped file exactly as it checks a chosen one', async () => {
      await openChat();
      const pane = screen.getByRole('region', { name: 'Conversation' });
      const file = new File([], 'empty.json', { type: 'application/json' });

      fireEvent.drop(pane, { dataTransfer: { files: [file] } });

      expect(await screen.findByRole('alert')).toHaveTextContent(/that file is empty/i);
      expect(screen.queryByText('empty.json')).not.toBeInTheDocument();
    });

    it('takes the first of several dropped files and says so', async () => {
      // One attachment per turn. Silently dropping the rest would be worse
      // than saying which one was taken.
      await openChat();
      const pane = screen.getByRole('region', { name: 'Conversation' });

      const first = new File([JSON.stringify({ a: 'A' })], 'first.json', {
        type: 'application/json',
      });
      const second = new File([JSON.stringify({ b: 'B' })], 'second.json', {
        type: 'application/json',
      });

      fireEvent.drop(pane, { dataTransfer: { files: [first, second] } });

      expect(await within(pane).findByText('first.json')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/one file per message/i);
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

    it('names an upload into an existing project', async () => {
      const pane = await sendAndRead(
        makeAnswer({
          answer: 'Uploaded en_us.json into minecraft.',
          tool_calls: [{ name: 'upload_file', ok: true }],
        }),
      );

      expect(await within(pane).findByText('Uploaded a file')).toBeInTheDocument();
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
    it('lists the conversations the server holds, not this browser', async () => {
      // The list used to live in local storage, so a conversation started on
      // another machine was invisible. It comes from the server now.
      api.listChatSessions.mockResolvedValue({
        sessions: [
          makeSession({ title: 'Started on my laptop' }),
          makeSession({ id: 'other', title: 'Started at my desk' }),
        ],
      });

      await openChat();

      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      expect(await within(list).findByText('Started on my laptop')).toBeInTheDocument();
      expect(within(list).getByText('Started at my desk')).toBeInTheDocument();
    });

    it('shows a conversation named by the server after the first turn', async () => {
      const user = await openChat();
      api.sendChat.mockResolvedValue(makeAnswer());
      // The turn creates the conversation, so the reload after it is what
      // brings back the title the server derived.
      api.listChatSessions.mockResolvedValue({
        sessions: [makeSession({ title: 'Remember me' })],
      });

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
      api.listChatSessions.mockResolvedValue({
        sessions: [makeSession({ title: 'Open me later' })],
      });

      const user = await openChat();

      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      await user.click(await within(list).findByText('Open me later'));

      await waitFor(() => {
        expect(api.getChatSession).toHaveBeenCalledWith(
          'jetsada',
          '11111111-1111-4111-8111-111111111111',
        );
      });
    });

    it('renames a conversation', async () => {
      api.listChatSessions.mockResolvedValue({
        sessions: [makeSession({ title: 'How many projects do I have?' })],
      });
      api.renameChatSession.mockResolvedValue({ session: makeSession({ title: 'Thai rollout' }) });

      const user = await openChat();
      const list = await screen.findByRole('complementary', { name: 'Conversations' });

      await user.click(await within(list).findByRole('button', { name: /^rename /i }));

      const field = within(list).getByLabelText('Conversation name');
      await user.clear(field);
      await user.type(field, 'Thai rollout');
      await user.click(within(list).getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(api.renameChatSession).toHaveBeenCalledWith(
          'jetsada',
          '11111111-1111-4111-8111-111111111111',
          'Thai rollout',
        );
      });
    });

    it('deletes a conversation only after it is confirmed', async () => {
      api.listChatSessions.mockResolvedValue({
        sessions: [makeSession({ title: 'Delete me' })],
      });
      api.deleteChatSession.mockResolvedValue(undefined);

      const user = await openChat();
      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      await within(list).findByText('Delete me');

      // Refused first. This removes the conversation and every message in it
      // from the server, so a stray click must not be enough.
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await user.click(within(list).getByRole('button', { name: /^delete delete me$/i }));
      expect(api.deleteChatSession).not.toHaveBeenCalled();

      confirm.mockReturnValue(true);
      await user.click(within(list).getByRole('button', { name: /^delete delete me$/i }));

      await waitFor(() => {
        expect(api.deleteChatSession).toHaveBeenCalledWith(
          'jetsada',
          '11111111-1111-4111-8111-111111111111',
        );
      });

      confirm.mockRestore();
    });

    it('names an unnamed conversation in the list rather than showing a blank', async () => {
      api.listChatSessions.mockResolvedValue({ sessions: [makeSession({ title: null })] });

      await openChat();

      const list = await screen.findByRole('complementary', { name: 'Conversations' });
      expect(await within(list).findByText('Untitled conversation')).toBeInTheDocument();
    });
  });
});
