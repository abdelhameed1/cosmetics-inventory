import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useOrder(documentId?: string) {
  const api = useApi();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(documentId));

  const reload = useCallback(() => {
    if (!documentId) return;
    setLoading(true);
    api.get(`/orders/${documentId}`).then(setOrder).finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => { reload(); }, [reload]);

  const confirm = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/confirm`);
    setOrder(updated);
    return updated;
  }, [documentId]);

  const cancel = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/cancel`);
    setOrder(updated);
    return updated;
  }, [documentId]);

  return { order, loading, reload, confirm, cancel };
}
