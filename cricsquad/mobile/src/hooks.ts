import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

/**
 * Data loading with the pull-to-refresh states every list screen needs.
 * `refreshing` drives the RefreshControl; `loading` only covers the first load
 * so a refresh never blanks the list out.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      try {
        setData(await load());
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not reach CricSquad. Pull down to try again.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
      // `load` is intentionally excluded — callers pass an inline closure, and
      // the explicit deps array below is what should drive a reload.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    deps,
  );

  useEffect(() => {
    void run('initial');
  }, [run]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: useCallback(() => run('refresh'), [run]),
    setData,
  };
}

/** Debounce a search box so typing does not fire a request per keystroke. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
