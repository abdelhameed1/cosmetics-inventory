import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useResources() {
  const api = useApi();
  const { data, error, status } = useAsyncResource<string[]>(
    () => api.get<{ resources: string[] }>('/resources').then((d) => d.resources),
    []
  );

  return { resources: data ?? [], loading: status === 'loading', error };
}
