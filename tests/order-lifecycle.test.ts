import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function seedConfirmedOrder(sellPrice: number, qty: number) {
  const customer = await docs('api::customer.customer').create({ data: { name: `OC-${Math.random()}` } });
  const order = await docs('api::order.order').create({
    data: { orderDate: '2026-07-01', status: 'confirmed', discountAmount: 0, customer: customer.documentId },
  });
  await docs('api::order-line.order-line').create({
    data: { quantitySold: qty, sellPrice, order: order.documentId },
  });
  return order;
}

describe('Payment → order status', () => {
  it('moves a confirmed order to partially_paid then paid', async () => {
    const order = await seedConfirmedOrder(100, 1); // finalTotal = 100
    await docs('api::payment.payment').create({
      data: { amount: 40, paymentDate: '2026-07-02', order: order.documentId },
    });
    let reloaded = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(reloaded.status).toBe('partially_paid');

    await docs('api::payment.payment').create({
      data: { amount: 60, paymentDate: '2026-07-03', order: order.documentId },
    });
    reloaded = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(reloaded.status).toBe('paid');
  });
});

describe('Stock Batch deletion guard', () => {
  it('blocks deleting a batch referenced by an order line', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `GB-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `GC-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Guarded P', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `GS-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, costPriceUsd: 2, purchaseDate: '2026-06-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customer = await docs('api::customer.customer').create({ data: { name: `GCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 1, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });

    await expect(
      docs('api::stock-batch.stock-batch').delete({ documentId: batch.documentId })
    ).rejects.toThrow(/cannot delete this stock batch/i);
  });
});
