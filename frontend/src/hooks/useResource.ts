import { useCallback, useEffect, useState } from "react";

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

/**
 * Loads data for a screen. `key` must change whenever the request changes (filters, page, IDs).
 * While a new request runs the previous data stays available, so tables keep their frame instead of flashing.
 */
export function useResource<T>(key: string, load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}#${attempt}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null }>({ key: "", data: null, error: null });

  useEffect(() => {
    let active = true;
    load().then(
      (data) => { if (active) setResult({ key: requestKey, data, error: null }); },
      (error: unknown) => { if (active) setResult((previous) => ({ key: requestKey, data: previous.data, error: message(error) })); },
    );
    return () => { active = false; };
    // `key` describes everything `load` reads, so it is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  // Applies a local change after a successful save without refetching.
  const update = useCallback((change: (data: T) => T) => {
    setResult((previous) => (previous.data === null ? previous : { ...previous, data: change(previous.data) }));
  }, []);

  const settled = result.key === requestKey;
  return { data: result.data, error: settled ? result.error : null, loading: !settled, reload, update };
}
