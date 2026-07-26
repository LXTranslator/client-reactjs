import { useState } from 'react';
import { EmptyState, ErrorMessage } from '../ui/Feedback.jsx';

/**
 * The conversations pane.
 *
 * Two ways in, because they answer different questions. The list is what this
 * browser has open, which covers "the thing I was just doing". Search covers
 * "the thing we decided last month", including conversations started on another
 * machine, which the list cannot know about.
 *
 * Search results say which method the server used. When no embedding model is
 * configured it matches text, and a person searching by meaning and finding
 * nothing deserves to know that is why.
 *
 * @param {object} props Component props.
 * @param {Array<object>} props.sessions Remembered conversations.
 * @param {string|null} props.activeSessionId Conversation being read.
 * @param {Function} props.onSelect Called with a session identifier.
 * @param {Function} props.onNew Starts a new conversation.
 * @param {Function} props.onForget Removes one from this browser.
 * @param {Function} props.onSearch Runs a search, resolving to the result payload.
 * @returns {JSX.Element} The pane.
 */
export function ChatSessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onForget,
  onSearch,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

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
          <EmptyState title="No conversations yet.">
            <p className="muted">Ask something to start one.</p>
          </EmptyState>
        ) : (
          <ul className="chat__sessions">
            {sessions.map((session) => (
              <li key={session.session_id}>
                <button
                  type="button"
                  className={`chat__session${
                    session.session_id === activeSessionId ? ' chat__session--active' : ''
                  }`}
                  onClick={() => onSelect(session.session_id)}
                  aria-current={session.session_id === activeSessionId ? 'true' : undefined}
                >
                  <span className="chat__session-title">{session.title}</span>
                  <span className="chat__session-meta">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </span>
                </button>
                <button
                  type="button"
                  className="chat__session-forget"
                  onClick={() => onForget(session.session_id)}
                  aria-label={`Remove ${session.title} from this browser`}
                  title="Removes it from this browser. The server keeps the log."
                >
                  ×
                </button>
              </li>
            ))}
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
