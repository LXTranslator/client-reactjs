import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/apiClient.js';
import { TextField } from '../ui/FormField.jsx';
import { Callout, EmptyState, ErrorMessage, LoadingState } from '../ui/Feedback.jsx';

/**
 * Where this account is signed in, and the tokens machines use.
 *
 * Two lists that answer different questions from the same table. The sessions
 * list answers "am I still signed in somewhere I did not mean to be", which is
 * the question somebody asks after using a borrowed laptop. The tokens list
 * answers "what can reach my account without me", which is the one they ask
 * before an audit.
 *
 * Neither list can show a credential. The server returns a digest of nothing
 * and the last four characters, which is enough to tell two apart and not
 * enough to use either.
 *
 * @returns {JSX.Element} The panel.
 */
export function SessionsPanel() {
  const { logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  /* The one moment a token exists outside the server. Held until dismissed. */
  const [issued, setIssued] = useState(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenError, setTokenError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Loads both lists.
   *
   * @returns {Promise<void>}
   */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessionResult, tokenResult] = await Promise.all([
        api.listSessions(),
        api.listApiTokens(),
      ]);
      setSessions(sessionResult.sessions ?? []);
      setTokens(tokenResult.api_tokens ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Ends one session.
   *
   * Ending the current one goes through the sign out everything else does,
   * rather than revoking the row directly. Revoking it here would end the
   * session on the server and leave this browser holding a token it does not
   * know is dead, showing a signed in interface until the next request failed.
   *
   * @param {object} session The session.
   * @returns {Promise<void>}
   */
  async function handleRevokeSession(session) {
    const question = session.current
      ? 'Sign out of this device?'
      : 'End this session? Whatever is using it will be signed out.';
    if (!window.confirm(question)) return;

    setActionError(null);

    if (session.current) {
      await logout();
      return;
    }

    try {
      await api.revokeSession(session.id);
      setNotice('That session has ended.');
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Ends every session except this one.
   *
   * @returns {Promise<void>}
   */
  async function handleRevokeOthers() {
    if (!window.confirm('Sign out of every other place? You will stay signed in here.')) return;

    setActionError(null);
    try {
      const result = await api.revokeOtherSessions();
      setNotice(
        result.revoked === 0
          ? 'There was nowhere else signed in.'
          : `Signed out of ${result.revoked} other place${result.revoked === 1 ? '' : 's'}.`,
      );
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  /**
   * Creates an API token and holds it on screen.
   *
   * @param {React.FormEvent} event Submit event.
   * @returns {Promise<void>}
   */
  async function handleCreateToken(event) {
    event.preventDefault();

    if (tokenName.trim().length === 0) {
      setTokenError('Name the token, so you can recognise it later.');
      return;
    }

    setTokenError(null);
    setActionError(null);
    setIsCreating(true);
    try {
      const result = await api.createApiToken({ name: tokenName.trim() });
      // Kept in state rather than shown in a toast: this is the only time the
      // string exists anywhere but the server's digest of it, and it must not
      // disappear because somebody looked away.
      setIssued(result);
      setTokenName('');
      await load();
    } catch (error) {
      setActionError(error);
      setTokenError(error?.fieldErrors?.name ?? null);
    } finally {
      setIsCreating(false);
    }
  }

  /**
   * Revokes an API token.
   *
   * @param {object} token The token.
   * @returns {Promise<void>}
   */
  async function handleRevokeToken(token) {
    if (!window.confirm(`Revoke "${token.name}"? Anything using it stops working.`)) return;

    setActionError(null);
    try {
      await api.revokeApiToken(token.id);
      setNotice(`"${token.name}" was revoked.`);
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  if (isLoading) {
    return (
      <section className="panel">
        <LoadingState label="Loading sessions" />
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Where you are signed in</h2>
          <span className="badge badge--accent">{sessions.length}</span>
        </div>

        <ErrorMessage error={loadError} />
        <ErrorMessage error={actionError} />
        {notice ? <Callout tone="ok">{notice}</Callout> : null}

        <p className="muted">
          One entry per sign in. Signing in on a phone, a laptop and a second browser
          profile makes three, and ending one leaves the others alone.
        </p>

        {sessions.length === 0 ? (
          <EmptyState title="No other sessions." />
        ) : (
          <div className="keylist">
            {sessions.map((session) => (
              <div className="keylist__item" key={session.id}>
                <div className="keylist__body">
                  <div className="keylist__label">
                    {session.current ? 'This device' : 'Another device'}
                    {session.current ? (
                      <span className="badge badge--ok" style={{ marginLeft: '0.4rem' }}>
                        current
                      </span>
                    ) : null}
                  </div>
                  <div className="keylist__meta mono">
                    {session.user_agent ?? 'Unknown client'}
                  </div>
                  <div className="keylist__meta">
                    {session.last_used_at
                      ? `Last used ${new Date(session.last_used_at).toLocaleString()}`
                      : `Started ${new Date(session.created_at).toLocaleString()}`}
                  </div>
                </div>

                <div className="keylist__actions">
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={() => handleRevokeSession(session)}
                  >
                    {session.current ? 'Sign out here' : 'End'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sessions.length > 1 ? (
          <button
            type="button"
            className="btn"
            style={{ marginTop: '1rem' }}
            onClick={handleRevokeOthers}
          >
            Sign out everywhere else
          </button>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>API tokens</h2>
          <span className="badge badge--accent">{tokens.length}</span>
        </div>

        <Callout tone="info" title="For scripts, not for browsers">
          A token lets a build script, a command line tool or an app use the API without a
          password. It reaches exactly what you reach and nothing more, and it keeps
          working after you sign out.
        </Callout>

        {issued !== null ? (
          <Callout tone="warn" title="Copy this now. It cannot be shown again.">
            <p className="mono" style={{ overflowWrap: 'anywhere', margin: '0 0 0.6rem' }}>
              {issued.token}
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--small"
                onClick={() => navigator.clipboard?.writeText(issued.token)}
              >
                Copy
              </button>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setIssued(null)}
              >
                Done
              </button>
            </div>
          </Callout>
        ) : null}

        {tokens.length === 0 ? (
          <EmptyState title="No API tokens.">
            <p className="muted">Create one to use the API from somewhere other than here.</p>
          </EmptyState>
        ) : (
          <div className="keylist">
            {tokens.map((token) => (
              <div className="keylist__item" key={token.id}>
                <div className="keylist__body">
                  <div className="keylist__label">
                    {token.name} <span className="mono muted">{token.masked_token}</span>
                  </div>
                  <div className="keylist__meta">
                    {token.last_used_at
                      ? `Last used ${new Date(token.last_used_at).toLocaleString()}`
                      : 'Never used'}
                    {token.expires_at
                      ? ` · expires ${new Date(token.expires_at).toLocaleDateString()}`
                      : ' · no expiry'}
                  </div>
                </div>

                <div className="keylist__actions">
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={() => handleRevokeToken(token)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleCreateToken} noValidate style={{ marginTop: '1.25rem' }}>
          <TextField
            label="Token name"
            name="token_name"
            value={tokenName}
            onChange={(event) => {
              setTokenName(event.target.value);
              setTokenError(null);
            }}
            placeholder="ci pipeline"
            hint="Required, so you can tell which one to revoke later."
            error={tokenError}
          />

          <button type="submit" className="btn btn--primary" disabled={isCreating}>
            {isCreating ? 'Creating' : 'Create token'}
          </button>
        </form>
      </section>
    </>
  );
}
