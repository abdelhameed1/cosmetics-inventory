import { useCallback, useEffect, useState } from 'react';
import { useApi, type SchemaMeta } from '../utils/api';

export function useSchema(resource?: string) {
  const api = useApi();
  const [schema, setSchema] = useState<SchemaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    if (!resource) return;
    setLoading(true);
    api
      .get<SchemaMeta>(`/resources/${resource}/schema`)
      .then(setSchema)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => { reload(); }, [reload]);

  return { schema, loading, error, reload };
}
