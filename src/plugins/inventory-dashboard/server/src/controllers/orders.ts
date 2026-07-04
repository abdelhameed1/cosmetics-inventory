import type { Core } from '@strapi/strapi';

const orders = ({ strapi }: { strapi: Core.Strapi }) => ({
  async findOne(ctx) {
    const { documentId } = ctx.params;
    ctx.body = await strapi.plugin('inventory-dashboard').service('orders').getWithTotals(documentId);
  },
  async confirm(ctx) {
    const { documentId } = ctx.params;
    ctx.body = await strapi.plugin('inventory-dashboard').service('orders').confirm(documentId);
  },
  async fifo(ctx) {
    const { variantDocumentId } = ctx.params;
    const quantity = Number(ctx.query.quantity) || 0;
    ctx.body = await strapi.plugin('inventory-dashboard').service('fifo').resolve(variantDocumentId, quantity);
  },
  async suggest(ctx) {
    ctx.body = await strapi.plugin('inventory-dashboard').service('pricing').suggest(ctx.request.body?.data ?? ctx.request.body);
  },
});

export default orders;
