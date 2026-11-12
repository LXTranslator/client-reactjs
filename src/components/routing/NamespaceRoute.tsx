import { createContext, useContext, useMemo } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useAuth } from '../../context/AuthContext.tsx';
import { LoadingState } from '../ui/Feedback.tsx';
import { paths } from '../../lib/paths.ts';
import type { Namespace } from '../../lib/types.ts';

/** What a namespace route provides: the namespace, and the identifier the URL named. */
interface NamespaceContextValue {
  namespace: Namespace | null;
  identifier: string | undefined;
}

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

const NamespaceContext = createContext<NamespaceContextValue | null>(null);

/**
 * Guards the namespace routes and supplies the resolved namespace.
 *
 * @returns The nested route, or a loading or missing state.
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
 * @returns The namespace record.
 * @throws {Error} When used outside a namespace route.
 */
export function useNamespace(): Namespace {
  const context = useContext(NamespaceContext);
  if (context === null) {
    throw new Error('useNamespace must be used inside a NamespaceRoute.');
  }
  // The route renders its children only once the namespace has resolved.
  return context.namespace as Namespace;
}
