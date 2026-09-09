import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Breadcrumbs } from '../components/layout/AppLayout.jsx';
import { OAuthProviderButtons } from '../components/account/OAuthProviderButtons.jsx';
import { Callout, EmptyState, ErrorMessage, LoadingState } from '../components/ui/Feedback.jsx';
import { api } from '../lib/apiClient.js';
import { paths } from '../lib/paths.js';

/**
 * Manages the provider accounts linked to this account.
 *
 * Provider avatars are deliberately not shown. The served content security
 * policy sets `img-src 'self' data:`, so a github.com avatar URL is blocked by
 * the browser and would render as a broken image; initials carry the same
 * recognition without a request that cannot succeed.
 *
 * @returns {JSX.Element} The page.
 */
export function LinkedAccountsPage() {
  const [identities, setIdentities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.listOauthIdentities();
      setIdentities(result.identities ?? []);
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
   * Removes one linked provider account.
   *
   * Safe unconditionally: every account here also has a password, so unlinking
   * can never leave somebody without a way in.
   *
   * @param {object} identity The identity to remove.
   * @returns {Promise<void>}
   */
  async function unlink(identity) {
    if (!window.confirm(`Disconnect ${identity.provider}? You can connect it again later.`)) {
      return;
    }

    setActionError(null);
    setNotice(null);
    try {
      await api.unlinkOauthProvider(identity.provider);
      setNotice(`${identity.provider} disconnected.`);
      await load();
    } catch (error) {
      setActionError(error);
    }
  }

  if (isLoading) {
    return (
      <div className="container narrow">
        <section className="panel">
          <LoadingState label="Loading connected accounts" />
        </section>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <Breadcrumbs
        items={[
          { label: 'Namespaces', to: paths.namespaces() },
          { label: 'Account settings', to: paths.accountSettings() },
          { label: 'Connected accounts' },
        ]}
      />

      <h1>Connected accounts</h1>
      <p className="lead">
        Connect a GitHub or GitLab account and you can sign in with it instead of your
        password.
      </p>

      <ErrorMessage error={loadError} />
      <ErrorMessage error={actionError} />
      {notice ? <Callout tone="ok">{notice}</Callout> : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Connected</h2>
          <span className="badge badge--accent">{identities.length}</span>
        </div>

        {identities.length === 0 ? (
          <EmptyState title="Nothing connected yet.">
            <p className="muted">
              Connecting an account adds a way to sign in. It does not replace your
              password, and you can disconnect it at any time.
            </p>
          </EmptyState>
        ) : (
          <ul className="keylist">
            {identities.map((identity) => (
              <li key={identity.id} className="keylist__item">
                <span className="keylist__order" aria-hidden="true">
                  {identity.provider.slice(0, 2).toUpperCase()}
                </span>
                <div className="keylist__body">
                  <span className="keylist__label">{identity.provider}</span>
                  <span className="keylist__meta">
                    {identity.provider_username ?? 'unknown account'}
                    {identity.last_login_at ? ' · used to sign in' : ' · not yet used'}
                  </span>
                </div>
                <div className="keylist__actions">
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={() => unlink(identity)}
                  >
                    Disconnect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Connect an account</h2>
        </div>

        <OAuthProviderButtons mode="LINK" onError={setActionError} />

        <p className="muted">
          Nothing listed here means this deployment has not configured a provider.
        </p>

        <div className="btn-row">
          <Link className="btn btn--ghost" to={paths.accountSettings()}>
            Back to settings
          </Link>
        </div>
      </section>
    </div>
  );
}
