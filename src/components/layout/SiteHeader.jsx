import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Sticky glass header.
 *
 * The design system describes header and footer as runtime injected partials
 * for a static site. In a React application the equivalent single source of
 * truth is a component rendered by the shared layout, which is what this is:
 * navigation is defined once and every page stays in step.
 */

/** Primary navigation, shown only to a signed in visitor. */
const NAV_ITEMS = [
  { to: '/namespaces', label: 'Namespaces' },
  { to: '/namespaces/projects', label: 'Projects' },
  { to: '/settings', label: 'Account' },
];

/**
 * Renders the site header.
 *
 * @returns {JSX.Element} The header.
 */
export function SiteHeader() {
  const { isAuthenticated, account, namespaces, activeNamespaceId, selectNamespace, logout } =
    useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close the mobile panel on navigation, otherwise it stays open over the new
  // page after a link is followed.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  /**
   * Signs out and returns to the login page.
   *
   * @returns {void}
   */
  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="site-header">
      <div className="container">
        <nav className="nav" aria-label="Primary">
          <Link className="nav__brand" to={isAuthenticated ? '/namespaces' : '/'}>
            <span className="nav__mark" aria-hidden="true">
              LX
            </span>
            <span>LXTranslator</span>
          </Link>

          {isAuthenticated ? (
            <>
              <button
                type="button"
                className="nav__toggle"
                aria-expanded={isMenuOpen}
                aria-controls="primary_navigation"
                onClick={() => setIsMenuOpen((open) => !open)}
              >
                <span className="visually-hidden">
                  {isMenuOpen ? 'Close navigation' : 'Open navigation'}
                </span>
                <span aria-hidden="true">{isMenuOpen ? '✕' : '≡'}</span>
              </button>

              <ul
                className={`nav__links${isMenuOpen ? ' is-open' : ''}`}
                id="primary_navigation"
              >
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/namespaces'}
                      className={({ isActive }) =>
                        `nav__link${isActive ? ' is-active' : ''}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}

                <li className="nav__spacer nav__identity">
                  {namespaces.length > 1 ? (
                    <>
                      <label className="visually-hidden" htmlFor="namespace_switcher">
                        Active namespace
                      </label>
                      <select
                        id="namespace_switcher"
                        className="field__control"
                        style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                        value={activeNamespaceId ?? ''}
                        onChange={(event) => selectNamespace(event.target.value)}
                      >
                        {namespaces.map((namespace) => (
                          <option key={namespace.id} value={namespace.user_id}>
                            {namespace.display_name ?? namespace.user_id}
                            {namespace.type === 'ORG' ? ' (org)' : ''}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span className="nav__identity-name">{account?.user_id}</span>
                  )}

                  <button type="button" className="btn btn--small" onClick={handleLogout}>
                    Sign out
                  </button>
                </li>
              </ul>
            </>
          ) : (
            <ul className="nav__links" id="primary_navigation">
              <li className="nav__spacer">
                <NavLink to="/login" className="nav__link">
                  Sign in
                </NavLink>
              </li>
              <li>
                <Link to="/register" className="btn btn--primary btn--small">
                  Create account
                </Link>
              </li>
            </ul>
          )}
        </nav>
      </div>
    </header>
  );
}
