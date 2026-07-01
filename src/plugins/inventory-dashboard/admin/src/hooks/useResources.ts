import { useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useResources() {
  const api = useApi();
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ resources: string[] }>('/resources')
      .then((d) => active && setResources(d.resources))
      .catch((e) => active && setError(e))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return { resources, loading, error };
}
