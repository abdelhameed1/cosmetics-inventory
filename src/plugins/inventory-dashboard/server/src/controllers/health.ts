import type { Core } from '@strapi/strapi';

const health = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = { ok: true };
  },
});

export default health;
