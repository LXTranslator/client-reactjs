import type { AvailabilityState } from '../../hooks/useAvailability.ts';

/**
 * Inline availability indicator, rendered beside a field label.
 *
 * @param props Component props.
 * @param props.state Probe state.
 * @returns The indicator, or null when idle.
 */
export function AvailabilityHint({ state }: { state: AvailabilityState }) {
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
