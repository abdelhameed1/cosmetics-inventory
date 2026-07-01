import type { Core } from '@strapi/strapi';

const CATEGORIES = ['High-End Makeup', 'Drugstore Makeup', 'Skin Care', 'Accessories'];

const PRICE_LISTS = [
  { name: 'Retail', type: 'retail', marginPercent: 30 },
  { name: 'Wholesale', type: 'wholesale', marginPercent: 15, wholesaleMinQty: 6 },
  { name: 'VIP', type: 'vip', vipDiscountPercent: 10 },
];

export default async function seed(strapi: Core.Strapi): Promise<void> {
  for (const name of CATEGORIES) {
    const existing = await strapi.documents('api::category.category').findMany({ filters: { name } });
    if (existing.length === 0) {
      await strapi.documents('api::category.category').create({ data: { name } });
    }
  }

  for (const pl of PRICE_LISTS) {
    const existing = await strapi.documents('api::price-list.price-list').findMany({ filters: { name: pl.name } });
    if (existing.length === 0) {
      await strapi.documents('api::price-list.price-list').create({ data: pl as any });
    }
  }

  const results = await strapi.documents('api::system-settings.system-settings').findMany();
  const settings = results[0];
  if (!settings) {
    await strapi.documents('api::system-settings.system-settings').create({
      data: { exchangeRate: 1, exchangeRateUpdatedAt: new Date().toISOString() },
    });
  }
}
