import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { RESOURCES } from '../config/resources';

const svc = (strapi: Core.Strapi) => strapi.plugin('inventory-dashboard').service('resource');
const meta = (strapi: Core.Strapi) => strapi.plugin('inventory-dashboard').service('metadata');

const resource = ({ strapi }: { strapi: Core.Strapi }) => ({
  list(ctx) {
    ctx.body = { resources: Object.keys(RESOURCES) };
  },

  schema(ctx) {
    const { resource: slug } = ctx.params;
    ctx.body = meta(strapi).getSchema(slug);
  },

  async find(ctx) {
    const { resource: slug } = ctx.params;
    const { page, pageSize, search } = ctx.query;
    ctx.body = await svc(strapi).find(slug, { page, pageSize, search });
  },

  async findOne(ctx) {
    const { resource: slug, documentId } = ctx.params;
    const record = await svc(strapi).findOne(slug, documentId);
    if (!record) throw new errors.NotFoundError('Record not found');
    ctx.body = record;
  },

  async create(ctx) {
    const { resource: slug } = ctx.params;
    const data = ctx.request.body?.data ?? ctx.request.body;
    ctx.body = await svc(strapi).create(slug, data);
  },

  async update(ctx) {
    const { resource: slug, documentId } = ctx.params;
    const data = ctx.request.body?.data ?? ctx.request.body;
    ctx.body = await svc(strapi).update(slug, documentId, data);
  },

  async remove(ctx) {
    const { resource: slug, documentId } = ctx.params;
    ctx.body = await svc(strapi).remove(slug, documentId);
  },
});

export default resource;
