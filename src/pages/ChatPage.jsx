import { useCallback, useEffect, useState } from 'react';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { ChatSessionList } from '../components/chat/ChatSessionList.jsx';
import { ChatConversation } from '../components/chat/ChatConversation.jsx';
import { ChatContextPane } from '../components/chat/ChatContextPane.jsx';

/**
 * The assistant.
 *
 * Three panes, each answering a different question. On the left, which
 * conversation; in the middle, the conversation itself; on the right, what the
 * assistant actually did and what it cost.
 *
 * An answer can also come back offering downloads, which the middle pane renders
 * as buttons beneath it. They ride along with the reply rather than being stored
 * on the exchange, so they belong to the newest answer only: reopening the
 * conversation later replays the text without them, and asking again is what
 * brings a file back.
 *
 * The right pane exists because this assistant acts rather than only answers.
 * It creates projects and adds languages, and the difference between "it says
 * it added Korean" and "it added Korean" is one a person should not have to
 * infer from prose. A refused tool is reported as refused, since the server
 * checks permission itself on every call and the answer may well be describing
 * a refusal.
 *
 * The conversation list comes from the server. It used to be kept in this
 * browser's local storage, which meant a conversation started at a desk was
 * invisible from a laptop; now signing in anywhere shows the same list, and a
 * conversation can be named and deleted rather than only hidden locally.
 *
 * @returns {JSX.Element} The page.
 */
export function ChatPage() {
  const namespace = useNamespace();
  const ns = namespace.user_id;

  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [turns, setTurns] = useState([]);
  const [lastTurn, setLastTurn] = useState(null);
  const [pending, setPending] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Reloads the conversation list.
   *
   * Failing to load it is not worth failing the page over: somebody can still
   * ask a question, and the list arrives on the next turn.
   *
   * @returns {Promise<Array<object>>} The conversations.
   */
  const loadSessions = useCallback(async () => {
    try {
      const result = await api.listChatSessions(ns);
      const listed = result.sessions ?? [];
      setSessions(listed);
      return listed;
    } catch {
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  }, [ns]);

  /* Conversations are per namespace, so switching namespace reloads them. */
  useEffect(() => {
    setSessionId(null);
    setTurns([]);
    setLastTurn(null);
    setPending(null);
    setError(null);
    setIsLoadingSessions(true);
    loadSessions();
  }, [ns, loadSessions]);

  /**
   * Loads a conversation.
   *
   * @param {string} id Session identifier.
   * @returns {Promise<void>}
   */
  const openSession = useCallback(
    async (id) => {
      setSessionId(id);
      setPending(null);
      setLastTurn(null);
      setError(null);
      setIsLoading(true);
      try {
        const result = await api.getChatSession(ns, id);
        setTurns(result.turns ?? []);
      } catch (caught) {
        setError(caught);
        setTurns([]);
      } finally {
        setIsLoading(false);
      }
    },
    [ns],
  );

  /**
   * Sends a message, carrying the attachment when there is one.
   *
   * @param {string} message What was asked.
   * @param {File|null} file Optional locale file.
   * @returns {Promise<void>}
   */
  async function handleSend(message, file) {
    setError(null);
    setPending({ message });
    setIsSending(true);

    try {
      /*
       * Multipart only when a file is actually attached. A form with one text
       * field would work, but sending JSON for the ordinary case keeps the
       * common request the simpler of the two.
       */
      let payload;
      if (file) {
        payload = new FormData();
        payload.append('message', message);
        payload.append('file', file);
        if (sessionId !== null) payload.append('session_id', sessionId);
      } else {
        payload = { message, ...(sessionId === null ? {} : { session_id: sessionId }) };
      }

      const result = await api.sendChat(ns, payload);

      setSessionId(result.session_id);
      setLastTurn(result);
      setPending(null);

      // The answer is already here; re-reading the conversation is what picks
      // up the identifiers and the running total the server assigned. The list
      // is refreshed alongside it, because this turn either created a
      // conversation or moved one to the top.
      const [history] = await Promise.all([
        api.getChatSession(ns, result.session_id),
        loadSessions(),
      ]);
      setTurns(history.turns ?? []);
    } catch (caught) {
      setError(caught);
      setPending(null);
    } finally {
      setIsSending(false);
    }
  }

  /**
   * Starts a new conversation, leaving the old one on the server.
   *
   * @returns {void}
   */
  function handleNew() {
    setSessionId(null);
    setTurns([]);
    setLastTurn(null);
    setPending(null);
    setError(null);
  }

  /**
   * Renames a conversation.
   *
   * @param {string} id Session identifier.
   * @param {string} title New name. Empty puts it back to its opening question.
   * @returns {Promise<void>}
   */
  async function handleRename(id, title) {
    await api.renameChatSession(ns, id, title);
    await loadSessions();
  }

  /**
   * Deletes a conversation and every turn in it.
   *
   * @param {string} id Session identifier.
   * @returns {Promise<void>}
   */
  async function handleDelete(id) {
    await api.deleteChatSession(ns, id);
    if (id === sessionId) handleNew();
    await loadSessions();
  }

  const totalTokens =
    lastTurn?.total_token_usage ??
    (turns.length > 0 ? turns[turns.length - 1].total_token_usage : 0);

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: ns, to: paths.namespace(ns) },
          { label: 'Assistant' },
        ]}
      />

      <h1>Assistant</h1>
      <p className="lead">
        Ask about the projects in <span className="mono">{ns}</span>, and let it do the
        navigating. Everything it does is checked against your own permissions, so it can
        only do what you could.
      </p>

      <div className="chat">
        <ChatSessionList
          sessions={sessions}
          activeSessionId={sessionId}
          isLoading={isLoadingSessions}
          onSelect={openSession}
          onNew={handleNew}
          onRename={handleRename}
          onDelete={handleDelete}
          onSearch={(query) => api.searchChats(ns, query)}
        />

        <ChatConversation
          turns={turns}
          isLoading={isLoading}
          isSending={isSending}
          error={error}
          pending={pending}
          downloads={lastTurn?.downloads ?? []}
          onSend={handleSend}
        />

        <ChatContextPane
          namespace={namespace}
          lastTurn={lastTurn}
          totalTokens={totalTokens}
          onBackfill={() => api.backfillChatEmbeddings(ns)}
        />
      </div>
    </div>
  );
}
