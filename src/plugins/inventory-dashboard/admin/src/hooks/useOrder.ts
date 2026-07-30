import { useCallback } from 'react';
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useOrder(documentId?: string) {
  const api = useApi();
  const { data: order, setData, status, reload } = useAsyncResource<any>(
    () => (documentId ? api.get(`/orders/${documentId}`) : Promise.resolve(null)),
    [documentId]
  );

  const confirm = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/confirm`);
    setData(updated);
    return updated;
  }, [documentId]);

  const cancel = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/cancel`);
    setData(updated);
    return updated;
  }, [documentId]);

  return { order, loading: status === 'loading' && Boolean(documentId), reload, confirm, cancel };
}
