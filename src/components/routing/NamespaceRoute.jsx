import { createContext, useContext, useMemo } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState } from '../ui/Feedback.jsx';
import { paths } from '../../lib/paths.js';

/**
 * Resolves the namespace named in the URL, once, for every route beneath it.
 *
 * A namespace occupies the first path segment, so `/orgA/settings` acts on the
 * organization `orgA`. Resolving it here rather than in each page mirrors how
 * the server does it: one place decides, and no page repeats the lookup or
 * disagrees about the answer.
 *
 * Matching against the accessible list is presentation, not authorization. A
 * namespace the visitor cannot reach is absent from that list and renders as
 * missing, which spares the pages a round of requests they would be refused.
 * The server authorises every request regardless of what happens here.
 */

const NamespaceContext = createContext(null);

/**
 * Guards the namespace routes and supplies the resolved namespace.
 *
 * @returns {JSX.Element} The nested route, or a loading or missing state.
 */
export function NamespaceRoute() {
  const { namespace: identifier } = useParams();
  const { namespaces, isLoading } = useAuth();

  const namespace = useMemo(
    () => namespaces.find((entry) => entry.user_id === identifier) ?? null,
    [namespaces, identifier],
  );

  const value = useMemo(() => ({ namespace, identifier }), [namespace, identifier]);

  // An empty list means the session is still resolving rather than that the
  // namespace is missing. Reporting it missing during that window would flash
  // an error on every reload.
  if (isLoading || namespaces.length === 0) {
    return (
      <div className="container">
        <LoadingState label="Loading namespace" />
      </div>
    );
  }

  if (namespace === null) {
    return (
      <div className="container narrow">
        <section className="hero">
          <span className="eyebrow">Error 404</span>
          <h1>Namespace not found</h1>
          <p className="lead">
            <span className="mono">{identifier}</span> does not exist, or you are not a
            member of it.
          </p>
          <div className="btn-row">
            <Link className="btn btn--primary" to={paths.namespaces()}>
              Your namespaces
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <NamespaceContext.Provider value={value}>
      <Outlet />
    </NamespaceContext.Provider>
  );
}

/**
 * Reads the namespace the current route acts in.
 *
 * Only valid beneath {@link NamespaceRoute}, which is what guarantees the
 * result is never null and lets a page use it without a guard of its own.
 *
 * @returns {object} The namespace record.
 * @throws {Error} When used outside a namespace route.
 */
export function useNamespace() {
  const context = useContext(NamespaceContext);
  if (context === null) {
    throw new Error('useNamespace must be used inside a NamespaceRoute.');
  }
  return context.namespace;
}
