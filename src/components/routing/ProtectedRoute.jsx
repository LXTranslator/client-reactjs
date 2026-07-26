import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState } from '../ui/Feedback.jsx';

/**
 * Route guard for authenticated pages.
 *
 * This is a convenience, not a security control. It decides what to render; it
 * does not decide what data is reachable. Every protected resource is
 * authorised by the server on every request, so bypassing this guard in the
 * browser yields empty pages rather than somebody else's data.
 *
 * @returns {JSX.Element} The nested route, or a redirect to sign in.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Waiting on the stored token to be verified. Redirecting now would bounce a
  // signed in visitor to the login page on every reload.
  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // The intended destination is carried along so sign in can return there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * Route guard for pages that only make sense when signed out.
 *
 * Keeps a signed in visitor off the login and registration pages.
 *
 * @returns {JSX.Element} The nested route, or a redirect to the dashboard.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/namespaces" replace />;

  return <Outlet />;
}
