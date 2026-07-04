import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('orders');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('orders.confirm', () => {
  it('decrements batch quantity, snapshots cost, and locks the order', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `CB-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `CC-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Confirm P', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `CS-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customer = await docs('api::customer.customer').create({ data: { name: `CCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });

    const result = await svc().confirm(order.documentId);
    expect(result.status).toBe('confirmed');

    const updatedBatch = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(updatedBatch.quantityRemaining).toBe(7); // 10 - 3

    const line = result.lines[0];
    expect(Number(line.costPriceUsdSnapshot)).toBe(4);
  });

  it('rejects confirming when a batch lacks enough remaining quantity', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `CB2-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `CC2-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Confirm P2', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `CS2-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 2, quantityRemaining: 2, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customer = await docs('api::customer.customer').create({ data: { name: `CCust2-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 5, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });

    await expect(svc().confirm(order.documentId)).rejects.toThrow(/insufficient/i);
  });

  it('rejects exactly one of two concurrent confirms that would jointly oversell a shared batch', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `CB3-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `CC3-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Confirm P3', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `CS3-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customerA = await docs('api::customer.customer').create({ data: { name: `CCustA-${Math.random()}` } });
    const customerB = await docs('api::customer.customer').create({ data: { name: `CCustB-${Math.random()}` } });
    const orderA = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customerA.documentId } });
    const orderB = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customerB.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 6, sellPrice: 250, order: orderA.documentId, stockBatch: batch.documentId },
    });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 6, sellPrice: 250, order: orderB.documentId, stockBatch: batch.documentId },
    });

    const results = await Promise.allSettled([svc().confirm(orderA.documentId), svc().confirm(orderB.documentId)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const updatedBatch = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(updatedBatch.quantityRemaining).toBe(4); // exactly one 6-unit sale actually consumed
  });
});
