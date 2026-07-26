import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from '../components/ui/Feedback.jsx';

/**
 * Root route.
 *
 * The specification requires `/` to redirect an unauthenticated visitor to the
 * sign in page. A signed in visitor goes to their dashboard instead, so the
 * root is never a dead end.
 *
 * @returns {JSX.Element} A redirect, or a placeholder while the session is checked.
 */
export function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirecting before the stored token has been verified would bounce a signed
  // in visitor to the login page on every reload.
  if (isLoading) {
    return (
      <div className="container">
        <LoadingState label="Checking your session" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/namespaces' : '/login'} replace />;
}
