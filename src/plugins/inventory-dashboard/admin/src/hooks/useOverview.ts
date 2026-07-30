import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useOverview() {
  const api = useApi();
  const { data, error, isInitialLoading, reload } = useAsyncResource<any>(
    () => api.get('/overview'),
    []
  );

  return { data, error, isInitialLoading, reload };
}
