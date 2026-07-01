import type { Core } from '@strapi/strapi';

const overview = ({ strapi }: { strapi: Core.Strapi }) => ({
  async index(ctx) {
    ctx.body = await strapi.plugin('inventory-dashboard').service('overview').getOverview();
  },
});

export default overview;
