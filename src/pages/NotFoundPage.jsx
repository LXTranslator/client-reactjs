import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { paths } from '../lib/paths.js';

/**
 * Fallback for an unmatched route.
 *
 * @returns {JSX.Element} The page.
 */
export function NotFoundPage() {
  const { account } = useAuth();

  return (
    <div className="container narrow">
      <section className="hero">
        <span className="eyebrow">Error 404</span>
        <h1>That page does not exist</h1>
        <p className="lead">
          The address may be mistyped, or the resource may have been removed.
        </p>
        <div className="btn-row">
          <Link className="btn btn--primary" to={paths.namespaces()}>
            Go to your dashboard
          </Link>
          {account?.user_id ? (
            <Link className="btn" to={paths.namespace(account.user_id)}>
              Your namespace
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
