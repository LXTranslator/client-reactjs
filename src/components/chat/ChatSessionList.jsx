import { useState } from 'react';
import { EmptyState, ErrorMessage } from '../ui/Feedback.jsx';

/**
 * The conversations pane.
 *
 * The list comes from the server, so it is the same list on every machine a
 * person signs in from. It used to be kept in this browser's local storage,
 * which meant a conversation started at a desk was invisible from a laptop and
 * findable only by searching for something said inside it.
 *
 * Search still sits above the list, because the two answer different questions.
 * The list covers "the thing I was just doing"; search covers "the thing we
 * decided last month". Search results say which method the server used: with no
 * embedding model configured it matches text, and a person searching by meaning
 * and finding nothing deserves to know that is why.
 *
 * A conversation arrives already named, after the question that opened it.
 * Renaming replaces that; deleting removes the conversation and its turns from
 * the server, which is a different act from the old "forget this locally" and
 * is asked about before it happens.
 *
 * @param {object} props Component props.
 * @param {Array<object>} props.sessions Conversations, most recent first.
 * @param {string|null} props.activeSessionId Conversation being read.
 * @param {boolean} [props.isLoading] Whether the list is still arriving.
 * @param {Function} props.onSelect Called with a session identifier.
 * @param {Function} props.onNew Starts a new conversation.
 * @param {Function} props.onRename Called with an identifier and a new title.
 * @param {Function} props.onDelete Called with an identifier.
 * @param {Function} props.onSearch Runs a search, resolving to the result payload.
 * @returns {JSX.Element} The pane.
 */
export function ChatSessionList({
  sessions,
  activeSessionId,
  isLoading = false,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onSearch,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  /* Which conversation is being renamed, and to what. */
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');

  /**
   * Runs a search against past conversations.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleSearch(event) {
    event.preventDefault();
    if (query.trim().length === 0) return;

    setError(null);
    setIsSearching(true);
    try {
      setResults(await onSearch(query.trim()));
    } catch (caught) {
      setError(caught);
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  /**
   * Opens the rename field on one conversation.
   *
   * @param {object} session The conversation.
   * @returns {void}
   */
  function startRenaming(session) {
    setEditingId(session.id);
    setDraftTitle(session.title ?? '');
    setError(null);
  }

  /**
   * Saves a new name.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleRename(event) {
    event.preventDefault();
    const id = editingId;

    setEditingId(null);
    try {
      await onRename(id, draftTitle);
    } catch (caught) {
      setError(caught);
    }
  }

  /**
   * Deletes a conversation, after asking.
   *
   * This removes the conversation and every turn in it from the server, unlike
   * the local "forget" it replaces, so it is worth one confirmation.
   *
   * @param {object} session The conversation.
   * @returns {Promise<void>}
   */
  async function handleDelete(session) {
    const name = session.title || 'this conversation';
    if (!window.confirm(`Delete ${name}? Every message in it goes too.`)) return;

    setError(null);
    try {
      await onDelete(session.id);
    } catch (caught) {
      setError(caught);
    }
  }

  return (
    <aside className="chat__pane chat__pane--sessions" aria-label="Conversations">
      <div className="chat__pane-header">
        <h2>Conversations</h2>
        <button type="button" className="btn btn--small btn--primary" onClick={onNew}>
          New
        </button>
      </div>

      <form onSubmit={handleSearch} className="chat__search" noValidate>
        <label className="visually-hidden" htmlFor="chat_search">
          Search past conversations
        </label>
        <input
          id="chat_search"
          className="field__control"
          type="search"
          value={query}
          placeholder="Search past conversations"
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length === 0) setResults(null);
          }}
        />
        <button type="submit" className="btn btn--small" disabled={isSearching}>
          {isSearching ? '…' : 'Find'}
        </button>
      </form>

      <ErrorMessage error={error} />

      {results === null ? (
        sessions.length === 0 ? (
          <EmptyState title={isLoading ? 'Loading conversations.' : 'No conversations yet.'}>
            {isLoading ? null : <p className="muted">Ask something to start one.</p>}
          </EmptyState>
        ) : (
          <ul className="chat__sessions">
            {sessions.map((session) =>
              session.id === editingId ? (
                <li key={session.id}>
                  <form className="chat__rename" onSubmit={handleRename} noValidate>
                    <label className="visually-hidden" htmlFor={`rename_${session.id}`}>
                      Conversation name
                    </label>
                    <input
                      id={`rename_${session.id}`}
                      className="field__control"
                      value={draftTitle}
                      maxLength={120}
                      autoFocus
                      placeholder="Name this conversation"
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button type="submit" className="btn btn--small btn--primary">
                      Save
                    </button>
                  </form>
                </li>
              ) : (
                <li key={session.id}>
                  <button
                    type="button"
                    className={`chat__session${
                      session.id === activeSessionId ? ' chat__session--active' : ''
                    }`}
                    onClick={() => onSelect(session.id)}
                    aria-current={session.id === activeSessionId ? 'true' : undefined}
                  >
                    <span className="chat__session-title">
                      {session.title || 'Untitled conversation'}
                    </span>
                    <span className="chat__session-meta">
                      {session.last_message_at
                        ? new Date(session.last_message_at).toLocaleDateString()
                        : new Date(session.created_at).toLocaleDateString()}
                      {session.turn_count > 0 ? ` · ${session.turn_count} turns` : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="chat__session-action"
                    onClick={() => startRenaming(session)}
                    aria-label={`Rename ${session.title || 'this conversation'}`}
                    title="Rename this conversation"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="chat__session-forget"
                    onClick={() => handleDelete(session)}
                    aria-label={`Delete ${session.title || 'this conversation'}`}
                    title="Deletes the conversation and every message in it."
                  >
                    ×
                  </button>
                </li>
              ),
            )}
          </ul>
        )
      ) : (
        <div className="chat__results">
          <div className="chat__results-header">
            <span className="badge badge--accent">
              {results.method === 'EMBEDDING' ? 'by meaning' : 'by text'}
            </span>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setResults(null);
                setQuery('');
              }}
            >
              Clear
            </button>
          </div>

          {results.matches.length === 0 ? (
            <EmptyState title="Nothing matched.">
              {results.method === 'TEXT' ? (
                <p className="muted">
                  This search matched words rather than meaning, because no embedding model
                  is configured for this namespace.
                </p>
              ) : null}
            </EmptyState>
          ) : (
            <ul className="chat__sessions">
              {results.matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    className="chat__session"
                    onClick={() => onSelect(match.session_id)}
                  >
                    <span className="chat__session-title">{match.user_prompt}</span>
                    <span className="chat__session-meta">
                      {new Date(match.created_at).toLocaleDateString()}
                      {typeof match.score === 'number' ? ` · ${match.score.toFixed(2)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
