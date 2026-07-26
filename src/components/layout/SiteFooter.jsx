import { Link } from 'react-router';

/**
 * Site footer.
 *
 * Rendered by the shared layout so the brand column and link columns are
 * defined once, matching the design system's single source of truth rule for
 * chrome.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <strong>LXTranslator</strong>
            <p>
              Translation management for software localization files, with change
              tracking built into every export.
            </p>
          </div>

          <div className="site-footer__col">
            <h4>Workspace</h4>
            <ul>
              <li>
                <Link to="/namespaces">Namespaces</Link>
              </li>
              <li>
                <Link to="/namespaces/projects">Projects</Link>
              </li>
              <li>
                <Link to="/settings">Account settings</Link>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h4>Account</h4>
            <ul>
              <li>
                <Link to="/login">Sign in</Link>
              </li>
              <li>
                <Link to="/register">Create account</Link>
              </li>
              <li>
                <Link to="/forgot-password">Forgot password</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer__base">
          <span>Copyright {year} Jetsada Wijit. All rights reserved.</span>
          <span>Proprietary. Reserved for the LXTranslator organization.</span>
        </div>
      </div>
    </footer>
  );
}
