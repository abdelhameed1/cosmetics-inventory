// src/plugins/inventory-dashboard/admin/src/hooks/useAsyncResource.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncResource<T> {
  data: T | null;
  setData: (data: T | null) => void;
  error: unknown;
  status: AsyncStatus;
  isInitialLoading: boolean;
  reload: () => void;
}

export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [hasSettled, setHasSettled] = useState(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);
    fetcher()
      .then((d) => {
        if (requestIdRef.current !== requestId) return;
        setData(d);
        setStatus('success');
        setHasSettled(true);
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        setError(e);
        setStatus('error');
        setHasSettled(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  return {
    data,
    setData,
    error,
    status,
    isInitialLoading: status === 'loading' && !hasSettled,
    reload,
  };
}
