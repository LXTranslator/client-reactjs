import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { paths } from '../lib/paths.js';

/**
 * Namespace dashboard.
 *
 * Every namespace the account can act in, each linking to its own path. There
 * is no active namespace to display here: a namespace is somewhere you go
 * (`/orgA`) rather than a mode the interface is in, so this page's whole job is
 * to be the fork in the road.
 *
 * Organization creation lives on its own page, since it needs availability
 * checking and a profile section of its own.
 *
 * @returns {JSX.Element} The page.
 */
export function NamespacesPage() {
  const { account, namespaces, selectNamespace } = useAuth();

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
          {account?.user_id ? (
            <Link className="btn btn--primary" to={paths.namespace(account.user_id)}>
              Go to your namespace
            </Link>
          ) : null}
          <Link className="btn" to={paths.newOrganization()}>
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
          {namespaces.map((namespace) => (
            <Link
              key={namespace.id}
              className="card"
              to={paths.namespace(namespace.user_id)}
              // Following the link is also a choice of where to land next time.
              onClick={() => selectNamespace(namespace.user_id)}
            >
              <span className="card__icon" aria-hidden="true">
                {namespace.type === 'ORG' ? 'ORG' : 'YOU'}
              </span>
              <p className="card__title">{namespace.display_name || namespace.user_id}</p>
              <p className="card__desc mono">/{namespace.user_id}</p>
              <div className="chip-row" style={{ marginTop: '0.65rem' }}>
                <span className="badge">{namespace.role}</span>
                <span className="badge badge--accent">{namespace.type}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
