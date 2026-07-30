import { useCallback } from 'react';
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

interface SettingsData {
  exchangeRate: number;
  exchangeRateUpdatedAt: string | null;
}

export function useSettings() {
  const api = useApi();
  const { data, setData, error } = useAsyncResource<SettingsData>(
    () => api.get<SettingsData>('/settings'),
    []
  );

  const save = useCallback(async (rate: number) => {
    const d = await api.put<{ exchangeRate: number; exchangeRateUpdatedAt: string }>('/settings', {
      exchangeRate: rate,
    });
    setData(d);
    return d;
  }, []);

  return {
    exchangeRate: data?.exchangeRate ?? null,
    exchangeRateUpdatedAt: data?.exchangeRateUpdatedAt ?? null,
    error,
    save,
  };
}
