import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useOverview() {
  const api = useApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    setLoading(true);
    api.get('/overview').then(setData).catch(setError).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
