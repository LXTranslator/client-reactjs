import { useCallback, useEffect, useState } from 'react';
import { useNamespace } from '../components/routing/NamespaceRoute.jsx';
import { paths } from '../lib/paths.js';
import { api } from '../lib/apiClient.js';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { ChatSessionList } from '../components/chat/ChatSessionList.jsx';
import { ChatConversation } from '../components/chat/ChatConversation.jsx';
import { ChatContextPane } from '../components/chat/ChatContextPane.jsx';
import { forgetSession, readSessions, rememberSession } from '../lib/chatSessions.js';

/**
 * The assistant.
 *
 * Three panes, each answering a different question. On the left, which
 * conversation; in the middle, the conversation itself; on the right, what the
 * assistant actually did and what it cost.
 *
 * The right pane exists because this assistant acts rather than only answers.
 * It creates projects and adds languages, and the difference between "it says
 * it added Korean" and "it added Korean" is one a person should not have to
 * infer from prose. A refused tool is reported as refused, since the server
 * checks permission itself on every call and the answer may well be describing
 * a refusal.
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
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  /* The remembered list is per namespace, so switching namespace resets it. */
  useEffect(() => {
    setSessions(readSessions(ns));
    setSessionId(null);
    setTurns([]);
    setLastTurn(null);
    setPending(null);
    setError(null);
  }, [ns]);

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
      setSessions(rememberSession(ns, { session_id: result.session_id, title: message }));

      // The answer is already here; re-reading the conversation is what picks
      // up the identifiers and the running total the server assigned.
      const history = await api.getChatSession(ns, result.session_id);
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
   * Removes a conversation from this browser.
   *
   * @param {string} id Session identifier.
   * @returns {void}
   */
  function handleForget(id) {
    setSessions(forgetSession(ns, id));
    if (id === sessionId) handleNew();
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
          onSelect={openSession}
          onNew={handleNew}
          onForget={handleForget}
          onSearch={(query) => api.searchChats(ns, query)}
        />

        <ChatConversation
          turns={turns}
          isLoading={isLoading}
          isSending={isSending}
          error={error}
          pending={pending}
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
