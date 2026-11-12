/**
 * Feedback primitives: callouts, loading and empty states.
 *
 * Every message a user sees about success, failure or absence goes through one
 * of these, so tone and placement stay consistent across the application.
 */

import type { ReactNode } from 'react';
import type { FileStatus } from '../../lib/types.ts';

/** A callout's visual tone. */
export type CalloutTone = 'info' | 'ok' | 'warn' | 'danger';

/** Icon glyph per callout tone. */
const CALLOUT_ICONS: Record<CalloutTone, string> = {
  info: 'i',
  ok: '✓',
  warn: '!',
  danger: '×',
};

/**
 * An inline message.
 *
 * Error and warning callouts carry `role="alert"` so assistive technology
 * announces them when they appear; informational ones do not, since
 * interrupting for a hint is noise.
 *
 * @param props Component props.
 * @param props.tone Visual tone.
 * @param props.title Optional heading.
 * @param props.children Message body.
 * @returns The callout.
 */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const isUrgent = tone === 'danger' || tone === 'warn';

  return (
    <div className={`callout callout--${tone}`} role={isUrgent ? 'alert' : undefined}>
      <span className="callout__icon" aria-hidden="true">
        {CALLOUT_ICONS[tone]}
      </span>
      <div className="callout__body">
        {title ? <strong>{title}</strong> : null}
        {title ? <br /> : null}
        {children}
      </div>
    </div>
  );
}

/**
 * A busy indicator with an accessible label.
 *
 * @param props Component props.
 * @param props.label Text shown beside the spinner.
 * @returns The indicator.
 */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> <span>{label}</span>
    </div>
  );
}

/**
 * Shown when a collection is empty.
 *
 * @param props Component props.
 * @param props.title Headline.
 * @param props.children Supporting content or an action.
 * @returns The empty state.
 */
export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 600, color: 'var(--ink-500)' }}>{title}</p>
      {children}
    </div>
  );
}

/**
 * Anything with a message to show. An `ApiError` adds its field errors; a plain
 * `Error` raised by a form's own check has none.
 */
export interface ErrorLike {
  message: string;
  fieldErrors?: Record<string, string> | null;
}

/**
 * Renders an API error, expanding field level detail when present.
 *
 * @param props Component props.
 * @param props.error The error, or null to render nothing.
 * @returns The callout, or null.
 */
export function ErrorMessage({ error }: { error: ErrorLike | null | undefined }) {
  if (!error) return null;

  const fieldErrors = typeof error.fieldErrors === 'object' ? error.fieldErrors : {};
  const entries = Object.entries(fieldErrors ?? {});

  return (
    <Callout tone="danger">
      {error.message}
      {entries.length > 0 ? (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
          {entries.map(([field, message]) => (
            <li key={field}>
              <code>{field}</code>: {message}
            </li>
          ))}
        </ul>
      ) : null}
    </Callout>
  );
}

/**
 * A file processing status badge.
 *
 * @param props Component props.
 * @param props.status One of PENDING, PROCESSING, READY, FAILED.
 * @returns The badge.
 */
export function StatusBadge({ status }: { status: FileStatus }) {
  const tone =
    status === 'READY'
      ? 'badge--ok'
      : status === 'FAILED'
        ? 'badge--danger'
        : status === 'PROCESSING'
          ? 'badge--accent'
          : '';

  return <span className={`badge ${tone}`}>{status}</span>;
}
