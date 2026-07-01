import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('overview');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('overview service', () => {
  it('excludes expired batches from low-stock quantity and classifies expiry', async () => {
    const ssUid = 'api::system-settings.system-settings';
    const ssCur = await strapi.documents(ssUid as any).findFirst();
    if (ssCur) {
      await strapi.documents(ssUid as any).update({ documentId: ssCur.documentId, data: { exchangeRate: 50 } } as any);
    } else {
      await strapi.documents(ssUid as any).create({ data: { exchangeRate: 50 } } as any);
    }

    const brand = await docs('api::brand.brand').create({ data: { name: `OV-${Date.now()}` } });
    const category = await docs('api::category.category').create({ data: { name: `OVC-${Date.now()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'OV Product', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    const variant = await docs('api::variant.variant').update({
      documentId: variants[0].documentId,
      data: { lowStockThreshold: 10 },
    } as any);
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `OVS-${Date.now()}` } });

    // expired batch (should NOT count toward stock for low-stock)
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 5, quantityRemaining: 5, costPriceUsd: 2,
        purchaseDate: '2025-01-01', expiryDate: isoPlusDays(-3),
        variant: variant.documentId, supplier: supplier.documentId,
      },
    });
    // expiring-soon batch (3 units, counts toward stock)
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 3, quantityRemaining: 3, costPriceUsd: 2,
        purchaseDate: '2026-06-01', expiryDate: isoPlusDays(30),
        variant: variant.documentId, supplier: supplier.documentId,
      },
    });

    const ov = await svc().getOverview();
    expect(ov.exchangeRate).toBe(50);
    expect(ov.stockValueEgp).toBe(ov.stockValueUsd * 50);

    const low = ov.lowStock.find((r: any) => r.variantId === variant.documentId);
    expect(low).toBeTruthy();
    expect(low.quantity).toBe(3); // expired 5 excluded

    expect(ov.expired.length).toBeGreaterThanOrEqual(1);
    expect(ov.expiringSoon.length).toBeGreaterThanOrEqual(1);
  });
});
