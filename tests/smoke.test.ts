import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

describe('smoke', () => {
  it('boots and registers all core content types', () => {
    const uids = [
      'api::brand.brand',
      'api::category.category',
      'api::variant-type.variant-type',
      'api::supplier.supplier',
      'api::customer.customer',
      'api::price-list.price-list',
      'api::system-settings.system-settings',
      'api::product.product',
      'api::variant.variant',
      'api::stock-batch.stock-batch',
    ];
    for (const uid of uids) {
      expect(strapi.contentType(uid as any)).toBeTruthy();
    }
  });
});
