import { useApi, type SchemaMeta } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useSchema(resource?: string) {
  const api = useApi();
  const { data: schema, error, status, reload } = useAsyncResource<SchemaMeta | null>(
    () => (resource ? api.get<SchemaMeta>(`/resources/${resource}/schema`) : Promise.resolve(null)),
    [resource]
  );

  return { schema, loading: status === 'loading', error, reload };
}
