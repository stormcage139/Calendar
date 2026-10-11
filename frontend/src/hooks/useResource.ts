import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

export function useResource<T>(load: (signal?: AbortSignal) => Promise<T>, initial: T) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    try {
      const result = await load(current.signal);
      if (!current.signal.aborted) setData(result);
    } catch (cause) {
      if (!current.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Load external data and cancel it on unmount.
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.current?.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  return { data, loading, error, refresh, setData };
}
