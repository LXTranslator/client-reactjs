import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLoader } from '../src/hooks/useLoader.js';

/**
 * A promise whose settlement the test controls.
 *
 * @returns {{promise: Promise, resolve: Function, reject: Function}} The handles.
 */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('useLoader', () => {
  it('loads on mount and reports the data', async () => {
    const { result } = renderHook(() => useLoader(async () => ['a'], []));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(['a']);
    expect(result.current.error).toBeNull();
  });

  it('drops a slow response that a newer load has overtaken', async () => {
    // The namespace in the URL changes while the first request is in flight;
    // the first answer must not overwrite the second.
    const slow = deferred();
    const fast = deferred();
    const responses = { first: slow.promise, second: fast.promise };

    const { result, rerender } = renderHook(({ key }) => useLoader(() => responses[key], [key]), {
      initialProps: { key: 'first' },
    });
    rerender({ key: 'second' });

    await act(async () => fast.resolve('second'));
    await act(async () => slow.resolve('first'));

    expect(result.current.data).toBe('second');
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the last good data when a reload fails', async () => {
    const load = vi.fn().mockResolvedValueOnce('kept').mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => useLoader(load, []));
    await waitFor(() => expect(result.current.data).toBe('kept'));

    await act(async () => result.current.reload());

    expect(result.current.data).toBe('kept');
    expect(result.current.error).toEqual(new Error('down'));
  });

  it('refreshes quietly without showing the busy state', async () => {
    const next = deferred();
    const load = vi.fn().mockResolvedValueOnce(1).mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => useLoader(load, []));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => {
      result.current.reload({ quiet: true });
    });
    expect(result.current.isLoading).toBe(false);

    await act(async () => next.resolve(2));
    expect(result.current.data).toBe(2);
  });
});
