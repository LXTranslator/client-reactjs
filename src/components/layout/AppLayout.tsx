import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { LoadingState } from '../ui/Feedback.tsx';
import { SiteHeader } from './SiteHeader.tsx';
import { SiteFooter } from './SiteFooter.tsx';

/**
 * Shared page chrome.
 *
 * Header, main landmark and footer in one place, so every route renders the
 * same structure and the semantic landmarks are guaranteed rather than repeated
 * per page.
 *
 * Pages load on demand, so the main landmark waits for one inside a suspense
 * boundary while the header and footer stay in place.
 *
 * @returns The layout.
 */
export function AppLayout() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main_content">
        <Suspense fallback={<LoadingState label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

/** One entry in a breadcrumb trail. An entry without `to` is not a link. */
export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/**
 * Page context trail.
 *
 * @param props Component props.
 * @param props.items Trail entries; the
 *   last is rendered as plain text since it is the current page.
 * @returns The breadcrumb region.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
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
