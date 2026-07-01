import type { Core } from '@strapi/strapi';
import seed from './bootstrap/seed';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seed(strapi);
  },
};
