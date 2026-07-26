import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Namespace dashboard.
 *
 * Shows the signed in account, every namespace it can act in, and a summary of
 * the active one. Organization creation lives on its own page, since it needs
 * availability checking and a profile section of its own.
 *
 * @returns {JSX.Element} The page.
 */
export function NamespacesPage() {
  const { account, namespaces, activeNamespace, selectNamespace } = useAuth();

  return (
    <div className="container">
      <section className="hero">
        <span className="eyebrow">Dashboard</span>
        <h1>Hello, {account?.display_name || account?.user_id}</h1>
        <p className="lead">
          A namespace owns projects. Yours is personal; an organization namespace adds
          members, roles and its own contact address.
        </p>
        <div className="btn-row">
          <Link className="btn btn--primary" to="/namespaces/projects">
            Go to projects
          </Link>
          <Link className="btn" to="/namespaces/organizations/new">
            Create organization
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Your namespaces</h2>
          <span className="badge badge--accent">{namespaces.length} total</span>
        </div>

        <div className="card-grid">
          {namespaces.map((namespace) => {
            const isActive = namespace.user_id === activeNamespace?.user_id;
            return (
              <button
                key={namespace.id}
                type="button"
                className="card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: isActive ? 'var(--accent)' : undefined,
                }}
                onClick={() => selectNamespace(namespace.user_id)}
                aria-pressed={isActive}
              >
                <span className="card__icon" aria-hidden="true">
                  {namespace.type === 'ORG' ? 'ORG' : 'YOU'}
                </span>
                <p className="card__title">{namespace.display_name || namespace.user_id}</p>
                <p className="card__desc mono">{namespace.user_id}</p>
                <div className="chip-row" style={{ marginTop: '0.65rem' }}>
                  <span className="badge">{namespace.role}</span>
                  {isActive ? <span className="badge badge--ok">Active</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {activeNamespace ? (
        <section className="panel">
          <div className="panel__header">
            <h2>{activeNamespace.display_name || activeNamespace.user_id}</h2>
            <span className="badge badge--accent">{activeNamespace.type}</span>
          </div>

          <div className="deflist">
            <div className="deflist__row">
              <span className="deflist__term">Namespace id</span>
              <span className="mono">{activeNamespace.user_id}</span>
            </div>
            <div className="deflist__row">
              <span className="deflist__term">Type</span>
              <span>{activeNamespace.type === 'ORG' ? 'Organization' : 'Personal'}</span>
            </div>
            <div className="deflist__row">
              <span className="deflist__term">Your role</span>
              <span>{activeNamespace.role}</span>
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: '1.1rem' }}>
            <Link className="btn" to="/namespaces/projects">
              Projects
            </Link>
            {activeNamespace.type === 'ORG' ? (
              <>
                <Link className="btn" to="/namespaces/settings">
                  Organization settings
                </Link>
                <Link className="btn" to="/namespaces/settings/members">
                  Members
                </Link>
              </>
            ) : (
              <Link className="btn" to="/settings">
                Account settings
              </Link>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
