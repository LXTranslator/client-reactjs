import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient.js';

/**
 * Debounced availability check for a namespace identifier or email address.
 *
 * Used by both the registration form and the organization creation form, since
 * a namespace identifier is drawn from one pool: a personal user id and an
 * organization id can collide with each other, so both are checked the same
 * way.
 *
 * The probe only fires once the value is locally valid, which keeps it from
 * running on every keystroke of a half typed address, and it is debounced so a
 * fast typist produces one request rather than twenty.
 *
 * @param {object} params Hook parameters.
 * @param {'user_id'|'email'} params.field Which identifier to check.
 * @param {string} params.value Current field value.
 * @param {Function} params.validate Local validator; a non null return skips the probe.
 * @param {number} [params.delayMs] Debounce delay.
 * @returns {'checking'|'free'|'taken'|null} Probe state, or null when idle.
 */
export function useAvailability({ field, value, validate, delayMs = 400 }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    const candidate = String(value ?? '').trim();

    // Nothing to ask the server about until the value could plausibly be valid.
    if (validate(candidate) !== null) {
      setState(null);
      return undefined;
    }

    setState('checking');
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const normalized = field === 'email' ? candidate.toLowerCase() : candidate;
        const result = await api.checkAvailability({ [field]: normalized });
        if (cancelled) return;

        const isFree =
          field === 'email' ? result.email_available : result.user_id_available;
        setState(isFree ? 'free' : 'taken');
      } catch {
        // A failed probe must never block the form. The server decides on
        // submit, so an unavailable check simply shows nothing.
        if (!cancelled) setState(null);
      }
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [field, value, validate, delayMs]);

  return state;
}
