import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';
import seed from '../src/bootstrap/seed';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

describe('seed', () => {
  it('is idempotent: running twice yields exactly the seeded counts', async () => {
    await seed(strapi);
    await seed(strapi);

    const categoryNames = ['High-End Makeup', 'Drugstore Makeup', 'Skin Care', 'Accessories'];
    for (const name of categoryNames) {
      const found = await strapi.documents('api::category.category').findMany({ filters: { name } });
      expect(found).toHaveLength(1);
    }

    const priceListNames = ['Retail', 'Wholesale', 'VIP'];
    for (const name of priceListNames) {
      const found = await strapi.documents('api::price-list.price-list').findMany({ filters: { name } });
      expect(found).toHaveLength(1);
    }

    const results = await strapi.documents('api::system-settings.system-settings').findMany();
    const settings = results[0];
    expect(settings).toBeTruthy();
    expect(Number(settings.exchangeRate)).toBeGreaterThan(0);
  });
});
