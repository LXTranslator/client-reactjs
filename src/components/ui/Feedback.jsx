/**
 * Feedback primitives: callouts, loading and empty states.
 *
 * Every message a user sees about success, failure or absence goes through one
 * of these, so tone and placement stay consistent across the application.
 */

/** Icon glyph per callout tone. */
const CALLOUT_ICONS = {
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
 * @param {object} props Component props.
 * @param {'info'|'ok'|'warn'|'danger'} [props.tone] Visual tone.
 * @param {string} [props.title] Optional heading.
 * @param {React.ReactNode} props.children Message body.
 * @returns {JSX.Element} The callout.
 */
export function Callout({ tone = 'info', title, children }) {
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
 * @param {object} props Component props.
 * @param {string} [props.label] Text shown beside the spinner.
 * @returns {JSX.Element} The indicator.
 */
export function LoadingState({ label = 'Loading' }) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> <span>{label}</span>
    </div>
  );
}

/**
 * Shown when a collection is empty.
 *
 * @param {object} props Component props.
 * @param {string} props.title Headline.
 * @param {React.ReactNode} [props.children] Supporting content or an action.
 * @returns {JSX.Element} The empty state.
 */
export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 600, color: 'var(--ink-500)' }}>{title}</p>
      {children}
    </div>
  );
}

/**
 * Renders an API error, expanding field level detail when present.
 *
 * @param {object} props Component props.
 * @param {Error|null} props.error The error, or null to render nothing.
 * @returns {JSX.Element|null} The callout, or null.
 */
export function ErrorMessage({ error }) {
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
 * @param {object} props Component props.
 * @param {string} props.status One of PENDING, PROCESSING, READY, FAILED.
 * @returns {JSX.Element} The badge.
 */
export function StatusBadge({ status }) {
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
