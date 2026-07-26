import { Link } from 'react-router';

/**
 * Fallback for an unmatched route.
 *
 * @returns {JSX.Element} The page.
 */
export function NotFoundPage() {
  return (
    <div className="container narrow">
      <section className="hero">
        <span className="eyebrow">Error 404</span>
        <h1>That page does not exist</h1>
        <p className="lead">
          The address may be mistyped, or the resource may have been removed.
        </p>
        <div className="btn-row">
          <Link className="btn btn--primary" to="/namespaces">
            Go to your dashboard
          </Link>
          <Link className="btn" to="/namespaces/projects">
            Browse projects
          </Link>
        </div>
      </section>
    </div>
  );
}
