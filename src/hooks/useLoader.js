import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data when its inputs change, and tracks whether it is busy and how it failed.
 *
 * Every page that reads from the server needs the same four things: a busy flag,
 * the failure, a way to load again after a change, and an effect that starts
 * the first load. This is that, once.
 *
 * Only the most recent load settles the result. A slow response that arrives
 * after a newer load has started, because the namespace in the URL changed or a
 * poll overlapped a save, is dropped rather than overwriting fresher data.
 *
 * A failed load keeps the data from the last one that succeeded, so a page that
 * reloads after an action does not lose what it was showing.
 *
 * @param {Function} load Resolves to the data. Starting a load is its only job.
 * @param {Array} deps Values the loader reads; a change starts a new load.
 * @returns {{data: *, isLoading: boolean, error: Error|null, reload: Function}}
 *   The latest data (undefined until the first success), whether the visible
 *   load is running, its failure, and a function that loads again. Pass
 *   `{ quiet: true }` to `reload` to refresh without showing the busy state.
 */
export function useLoader(load, deps) {
  const [state, setState] = useState({ data: undefined, error: null, isLoading: true });
  const latest = useRef(0);

  // Keyed on the caller's deps rather than on the loader itself, whose identity
  // changes on every render.
  const reload = useCallback(async ({ quiet = false } = {}) => {
    const run = ++latest.current;
    if (!quiet) setState((current) => ({ ...current, isLoading: true }));

    try {
      const data = await load();
      if (run === latest.current) setState({ data, error: null, isLoading: false });
    } catch (error) {
      if (run === latest.current) setState((current) => ({ ...current, error, isLoading: false }));
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
