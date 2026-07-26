import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from '../components/ui/Feedback.jsx';
import { paths } from '../lib/paths.js';

/**
 * Root route.
 *
 * The specification requires `/` to redirect an unauthenticated visitor to the
 * sign in page. A signed in visitor lands in a namespace instead, so the root
 * is never a dead end.
 *
 * @returns {JSX.Element} A redirect, or a placeholder while the session is checked.
 */
export function HomePage() {
  const { isAuthenticated, isLoading, landingNamespaceId } = useAuth();

  // Redirecting before the stored token has been verified would bounce a signed
  // in visitor to the login page on every reload.
  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to={paths.login()} replace />;

  // The last namespace used, falling back to the visitor's own. Landing on the
  // namespace list instead would make the common case an extra click.
  return (
    <Navigate
      to={landingNamespaceId ? paths.namespace(landingNamespaceId) : paths.namespaces()}
      replace
    />
  );
}
