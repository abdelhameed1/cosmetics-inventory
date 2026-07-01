import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { resolveResource } from '../config/resources';

const MAX_PAGE_SIZE = 100;

function requireDef(slug: string) {
  const def = resolveResource(slug);
  if (!def) {
    throw new errors.NotFoundError(`Unknown resource: ${slug}`);
  }
  return def;
}

const resource = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(slug: string, opts: { page?: number; pageSize?: number; search?: string }) {
    const def = requireDef(slug);
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(opts.pageSize) || 25));

    const results = await strapi.documents(def.uid as any).findMany({
      ...(def.populate ? { populate: def.populate } : {}),
      ...(opts.search ? { filters: { name: { $containsi: opts.search } } } : {}),
      page,
      pageSize,
      sort: 'createdAt:desc',
    } as any);

    const total = await strapi.documents(def.uid as any).count(
      opts.search ? ({ filters: { name: { $containsi: opts.search } } } as any) : ({} as any)
    );

    return {
      results,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  },

  async findOne(slug: string, documentId: string) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).findOne({
      documentId,
      ...(def.populate ? { populate: def.populate } : {}),
    } as any);
  },

  async create(slug: string, data: Record<string, unknown>) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).create({
      data,
      ...(def.populate ? { populate: def.populate } : {}),
    } as any);
  },

  async update(slug: string, documentId: string, data: Record<string, unknown>) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).update({
      documentId,
      data,
      ...(def.populate ? { populate: def.populate } : {}),
    } as any);
  },

  async remove(slug: string, documentId: string) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).delete({ documentId } as any);
  },
});

export default resource;
