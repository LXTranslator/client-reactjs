/**
 * Inline availability indicator, rendered beside a field label.
 *
 * @param {object} props Component props.
 * @param {'checking'|'free'|'taken'|null} props.state Probe state.
 * @returns {JSX.Element|null} The indicator, or null when idle.
 */
export function AvailabilityHint({ state }) {
  if (state === null) return null;

  const config = {
    checking: { className: 'availability--checking', text: 'Checking…' },
    free: { className: 'availability--free', text: 'Available' },
    taken: { className: 'availability--taken', text: 'Already taken' },
  }[state];

  if (config === undefined) return null;

  return (
    <span className={`availability ${config.className}`} role="status">
      {config.text}
    </span>
  );
}
