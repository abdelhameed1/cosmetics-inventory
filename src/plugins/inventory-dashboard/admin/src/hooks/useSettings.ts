import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useSettings() {
  const api = useApi();
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateUpdatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ exchangeRate: number; exchangeRateUpdatedAt: string | null }>('/settings')
      .then((d) => { setExchangeRate(d.exchangeRate); setUpdatedAt(d.exchangeRateUpdatedAt); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (rate: number) => {
    const d = await api.put<{ exchangeRate: number; exchangeRateUpdatedAt: string }>('/settings', {
      exchangeRate: rate,
    });
    setExchangeRate(d.exchangeRate);
    setUpdatedAt(d.exchangeRateUpdatedAt);
    return d;
  }, []);

  return { exchangeRate, exchangeRateUpdatedAt, loading, error, save };
}
