import { Outlet } from 'react-router';
import { SiteHeader } from './SiteHeader.jsx';
import { SiteFooter } from './SiteFooter.jsx';

/**
 * Shared page chrome.
 *
 * Header, main landmark and footer in one place, so every route renders the
 * same structure and the semantic landmarks are guaranteed rather than repeated
 * per page.
 *
 * @returns {JSX.Element} The layout.
 */
export function AppLayout() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main_content">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Page context trail.
 *
 * @param {object} props Component props.
 * @param {Array<{label: string, to?: string}>} props.items Trail entries; the
 *   last is rendered as plain text since it is the current page.
 * @returns {JSX.Element} The breadcrumb region.
 */
export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}_${index}`}>
            {isLast || !item.to ? (
              <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
            ) : (
              <a href={item.to}>{item.label}</a>
            )}
            {isLast ? null : (
              <span className="sep" aria-hidden="true">
                {' '}
                /{' '}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
