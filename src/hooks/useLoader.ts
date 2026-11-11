import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/** Options for a reload. */
export interface ReloadOptions {
  /** Refresh without showing the busy state. */
  quiet?: boolean;
}

/** What {@link useLoader} hands a page. */
export interface LoaderState<T> {
  /** The latest data, undefined until the first success. */
  data: T | undefined;
  /** Whether the visible load is running. */
  isLoading: boolean;
  /** The latest load's failure. */
  error: Error | null;
  /** Loads again. */
  reload: (options?: ReloadOptions) => Promise<void>;
}

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
 * @param load Resolves to the data. Starting a load is its only job.
 * @param deps Values the loader reads; a change starts a new load.
 *   The latest data (undefined until the first success), whether the visible
 *   load is running, its failure, and a function that loads again. Pass
 *   `{ quiet: true }` to `reload` to refresh without showing the busy state.
 */
export function useLoader<T>(load: () => Promise<T>, deps: DependencyList): LoaderState<T> {
  const [state, setState] = useState<Omit<LoaderState<T>, 'reload'>>({
    data: undefined,
    error: null,
    isLoading: true,
  });
  const latest = useRef(0);

  // Keyed on the caller's deps rather than on the loader itself, whose identity
  // changes on every render.
  const reload = useCallback(async ({ quiet = false }: ReloadOptions = {}) => {
    const run = ++latest.current;
    if (!quiet) setState((current) => ({ ...current, isLoading: true }));

    try {
      const data = await load();
      if (run === latest.current) setState({ data, error: null, isLoading: false });
    } catch (error) {
      if (run === latest.current) {
        setState((current) => ({ ...current, error: error as Error, isLoading: false }));
      }
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
