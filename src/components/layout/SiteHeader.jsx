import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { paths } from '../../lib/paths.js';

/**
 * Sticky glass header.
 *
 * The design system describes header and footer as runtime injected partials
 * for a static site. In a React application the equivalent single source of
 * truth is a component rendered by the shared layout, which is what this is:
 * navigation is defined once and every page stays in step.
 */

/**
 * Primary navigation, shown only to a signed in visitor.
 *
 * Built per render rather than declared once, because the middle entry points
 * into whichever namespace the current route acts in.
 *
 * @param {string|null} namespaceId Namespace the current route acts in.
 * @returns {Array<{to: string, label: string}>} Navigation items.
 */
function navItems(namespaceId) {
  return [
    { to: paths.namespaces(), label: 'Namespaces' },
    ...(namespaceId ? [{ to: paths.namespace(namespaceId), label: namespaceId }] : []),
    { to: paths.accountSettings(), label: 'Account' },
  ];
}

/**
 * Renders the site header.
 *
 * @returns {JSX.Element} The header.
 */
export function SiteHeader() {
  const { isAuthenticated, account, namespaces, selectNamespace, logout } = useAuth();
  // Read from the path, so the switcher and the navigation follow the address
  // bar rather than a second copy of the same state.
  const { namespace: routeNamespaceId } = useParams();
  const currentNamespaceId = routeNamespaceId ?? account?.user_id ?? null;
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
          <Link className="nav__brand" to={paths.home()}>
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
                {navItems(currentNamespaceId).map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end
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
                        value={currentNamespaceId ?? ''}
                        onChange={(event) => {
                          // Remember the choice, then navigate: the URL is what
                          // decides which namespace a page acts on.
                          selectNamespace(event.target.value);
                          navigate(paths.namespace(event.target.value));
                        }}
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
