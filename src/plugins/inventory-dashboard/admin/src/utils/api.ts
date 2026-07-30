import { useFetchClient } from '@strapi/strapi/admin';
import { pluginId } from '../pluginId';
import { useLoadingTracker } from '../loading/LoadingProvider';

export interface FieldMeta {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  hidden: boolean;
  min?: number;
  max?: number;
  values?: string[];
  relation?: { resource: string | null; kind: string; mainField: string };
}

export interface SchemaMeta {
  resource: string;
  uid: string;
  fields: FieldMeta[];
}

export function useApi() {
  const { get, post, put, del } = useFetchClient();
  const { begin, end } = useLoadingTracker();
  const base = `/${pluginId}`;

  async function run<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    begin();
    try {
      const res = await fn();
      return res.data;
    } finally {
      end();
    }
  }

  return {
    get: <T = any>(path: string, params?: Record<string, unknown>) =>
      run<T>(() => get(`${base}${path}`, { params })),
    post: <T = any>(path: string, data?: unknown) =>
      run<T>(() => post(`${base}${path}`, data)),
    put: <T = any>(path: string, data?: unknown) =>
      run<T>(() => put(`${base}${path}`, data)),
    del: <T = any>(path: string) =>
      run<T>(() => del(`${base}${path}`)),
  };
}
