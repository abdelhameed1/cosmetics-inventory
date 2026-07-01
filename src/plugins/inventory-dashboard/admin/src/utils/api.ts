import { useFetchClient } from '@strapi/strapi/admin';
import { pluginId } from '../pluginId';

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
  const base = `/${pluginId}`;

  return {
    async get<T = any>(path: string, params?: Record<string, unknown>): Promise<T> {
      const res = await get(`${base}${path}`, { params });
      return res.data as T;
    },
    async post<T = any>(path: string, data?: unknown): Promise<T> {
      const res = await post(`${base}${path}`, data);
      return res.data as T;
    },
    async put<T = any>(path: string, data?: unknown): Promise<T> {
      const res = await put(`${base}${path}`, data);
      return res.data as T;
    },
    async del<T = any>(path: string): Promise<T> {
      const res = await del(`${base}${path}`);
      return res.data as T;
    },
  };
}
