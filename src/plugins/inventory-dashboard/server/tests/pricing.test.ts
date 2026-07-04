import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('pricing');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function setRate(rate: number) {
  const existing = await docs('api::system-settings.system-settings').findFirst();
  if (existing) {
    await docs('api::system-settings.system-settings').update({
      documentId: existing.documentId,
      data: { exchangeRate: rate },
    } as any);
  } else {
    await docs('api::system-settings.system-settings').create({ data: { exchangeRate: rate } } as any);
  }
}

async function priceListByName(name: string) {
  const [pl] = await docs('api::price-list.price-list').findMany({ filters: { name } });
  return pl;
}

describe('pricing service', () => {
  it('applies the retail margin', async () => {
    await setRate(50);
    const retail = await priceListByName('Retail'); // marginPercent 30 (seeded)
    const r = await svc().suggest({ priceListDocumentId: retail.documentId, costPriceUsd: 2, quantity: 1 });
    // egpCost = 100; retail = 100 * 1.30 = 130
    expect(r.sellPrice).toBeCloseTo(130, 2);
    expect(r.exchangeRate).toBe(50);
  });

  it('applies wholesale margin only at/above min quantity', async () => {
    await setRate(50);
    const wholesale = await priceListByName('Wholesale'); // margin 15, minQty 6
    const below = await svc().suggest({ priceListDocumentId: wholesale.documentId, costPriceUsd: 2, quantity: 3 });
    const atMin = await svc().suggest({ priceListDocumentId: wholesale.documentId, costPriceUsd: 2, quantity: 6 });
    // below min → retail (130); at min → 100 * 1.15 = 115
    expect(below.sellPrice).toBeCloseTo(130, 2);
    expect(atMin.sellPrice).toBeCloseTo(115, 2);
  });

  it('applies vip discount off the retail price', async () => {
    await setRate(50);
    const vip = await priceListByName('VIP'); // vipDiscountPercent 10
    const r = await svc().suggest({ priceListDocumentId: vip.documentId, costPriceUsd: 2, quantity: 1 });
    // retail 130; vip = 130 * 0.90 = 117
    expect(r.sellPrice).toBeCloseTo(117, 2);
  });
});
