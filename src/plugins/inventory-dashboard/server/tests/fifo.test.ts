import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('fifo');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('fifo service', () => {
  it('splits a quantity across batches oldest-first', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `FB-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `FC-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'FIFO P', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const variant = variants[0];
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `FS-${Math.random()}` } });

    await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 6, quantityRemaining: 6, costPriceUsd: 2, purchaseDate: '2026-01-01', variant: variant.documentId, supplier: supplier.documentId },
    });
    await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 3, purchaseDate: '2026-03-01', variant: variant.documentId, supplier: supplier.documentId },
    });

    const { segments, shortfall } = await svc().resolve(variant.documentId, 8);
    expect(shortfall).toBe(0);
    expect(segments).toHaveLength(2);
    expect(segments[0].quantityFromBatch).toBe(6); // oldest fully consumed
    expect(segments[0].costPriceUsd).toBe(2);
    expect(segments[1].quantityFromBatch).toBe(2); // remainder from newer batch
    expect(segments[1].costPriceUsd).toBe(3);
  });

  it('reports a shortfall when stock is insufficient', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `FB2-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `FC2-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'FIFO P2', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `FS2-${Math.random()}` } });
    await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 2, quantityRemaining: 2, costPriceUsd: 1, purchaseDate: '2026-02-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const { segments, shortfall } = await svc().resolve(variants[0].documentId, 5);
    expect(segments).toHaveLength(1);
    expect(shortfall).toBe(3);
  });
});
