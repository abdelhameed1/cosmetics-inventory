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

  it('splits out-of-stock (qty=0) from low-stock (0<qty<threshold)', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `OV2-${Date.now()}` } });
    const category = await docs('api::category.category').create({ data: { name: `OV2C-${Date.now()}` } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `OV2S-${Date.now()}` } });

    const productOut = await docs('api::product.product').create({
      data: { name: `OV2 Out ${Date.now()}`, brand: brand.documentId, category: category.documentId },
    });
    const outVariants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: productOut.documentId } },
    });
    const outVariant = await docs('api::variant.variant').update({
      documentId: outVariants[0].documentId,
      data: { lowStockThreshold: 5 },
    } as any);
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 4, quantityRemaining: 0, costPriceUsd: 2,
        purchaseDate: '2026-01-01', variant: outVariant.documentId, supplier: supplier.documentId,
      },
    });

    const productLow = await docs('api::product.product').create({
      data: { name: `OV2 Low ${Date.now()}`, brand: brand.documentId, category: category.documentId },
    });
    const lowVariants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: productLow.documentId } },
    });
    const lowVariant = await docs('api::variant.variant').update({
      documentId: lowVariants[0].documentId,
      data: { lowStockThreshold: 5 },
    } as any);
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 2, quantityRemaining: 2, costPriceUsd: 2,
        purchaseDate: '2026-01-01', variant: lowVariant.documentId, supplier: supplier.documentId,
      },
    });

    const ov = await svc().getOverview();
    expect(ov.outOfStock.find((r: any) => r.variantId === outVariant.documentId)).toBeTruthy();
    expect(ov.lowStock.find((r: any) => r.variantId === outVariant.documentId)).toBeFalsy();
    expect(ov.lowStock.find((r: any) => r.variantId === lowVariant.documentId)).toBeTruthy();
    expect(ov.outOfStock.find((r: any) => r.variantId === lowVariant.documentId)).toBeFalsy();
  });

  it('includes threshold-unset variants at qty=0 in outOfStock, and includes qty===threshold in lowStock', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `OV3-${Date.now()}` } });
    const category = await docs('api::category.category').create({ data: { name: `OV3C-${Date.now()}` } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `OV3S-${Date.now()}` } });

    // qty=0, no threshold configured — should still land in outOfStock, with threshold: null
    const productNoThreshold = await docs('api::product.product').create({
      data: { name: `OV3 NoThreshold ${Date.now()}`, brand: brand.documentId, category: category.documentId },
    });
    const noThresholdVariants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: productNoThreshold.documentId } },
    });
    const noThresholdVariant = noThresholdVariants[0];
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 3, quantityRemaining: 0, costPriceUsd: 2,
        purchaseDate: '2026-01-01', variant: noThresholdVariant.documentId, supplier: supplier.documentId,
      },
    });

    // qty === threshold — should land in lowStock, not be skipped
    const productAtThreshold = await docs('api::product.product').create({
      data: { name: `OV3 AtThreshold ${Date.now()}`, brand: brand.documentId, category: category.documentId },
    });
    const atThresholdVariants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: productAtThreshold.documentId } },
    });
    const atThresholdVariant = await docs('api::variant.variant').update({
      documentId: atThresholdVariants[0].documentId,
      data: { lowStockThreshold: 5 },
    } as any);
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 5, quantityRemaining: 5, costPriceUsd: 2,
        purchaseDate: '2026-01-01', variant: atThresholdVariant.documentId, supplier: supplier.documentId,
      },
    });

    const ov = await svc().getOverview();

    const noThresholdEntry = ov.outOfStock.find((r: any) => r.variantId === noThresholdVariant.documentId);
    expect(noThresholdEntry).toBeTruthy();
    expect(noThresholdEntry.threshold).toBeNull();

    const atThresholdEntry = ov.lowStock.find((r: any) => r.variantId === atThresholdVariant.documentId);
    expect(atThresholdEntry).toBeTruthy();
    expect(atThresholdEntry.quantity).toBe(5);
    expect(ov.outOfStock.find((r: any) => r.variantId === atThresholdVariant.documentId)).toBeFalsy();
  });
});
