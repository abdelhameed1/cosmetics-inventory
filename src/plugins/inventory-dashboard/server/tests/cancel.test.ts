import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('orders');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function seedBatch(namePrefix: string) {
  const brand = await docs('api::brand.brand').create({ data: { name: `${namePrefix}B-${Math.random()}` } });
  const category = await docs('api::category.category').create({ data: { name: `${namePrefix}C-${Math.random()}` } });
  const product = await docs('api::product.product').create({
    data: { name: `${namePrefix} P`, brand: brand.documentId, category: category.documentId },
  });
  const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
  const supplier = await docs('api::supplier.supplier').create({ data: { name: `${namePrefix}S-${Math.random()}` } });
  const batch = await docs('api::stock-batch.stock-batch').create({
    data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
  });
  return { batch };
}

describe('orders.cancel', () => {
  it('cancels a draft order without touching any batch quantity', async () => {
    const { batch } = await seedBatch('CancelDraft');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelDraftCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const unchangedBatch = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(unchangedBatch.quantityRemaining).toBe(10);
  });

  it('cancels a confirmed order and restores the batch quantity it consumed', async () => {
    const { batch } = await seedBatch('CancelConfirmed');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelConfCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);

    const decremented = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(decremented.quantityRemaining).toBe(7); // 10 - 3

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const restored = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(restored.quantityRemaining).toBe(10);
  });

  it('cancels a partially-paid order, restores stock, and leaves its payment untouched', async () => {
    const { batch } = await seedBatch('CancelPartial');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelPartCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 2, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId); // finalTotal = 200
    const payment = await docs('api::payment.payment').create({
      data: { amount: 50, paymentDate: '2026-07-02', order: order.documentId },
    });
    const beforeCancel = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(beforeCancel.status).toBe('partially_paid');

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const restored = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(restored.quantityRemaining).toBe(10);

    const survivingPayment = await docs('api::payment.payment').findOne({ documentId: payment.documentId });
    expect(survivingPayment).toBeTruthy();
    expect(Number(survivingPayment.amount)).toBe(50);
  });

  it('rejects cancelling a fully paid order', async () => {
    const { batch } = await seedBatch('CancelPaid');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelPaidCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 1, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);
    await docs('api::payment.payment').create({ data: { amount: 100, paymentDate: '2026-07-02', order: order.documentId } });

    await expect(svc().cancel(order.documentId)).rejects.toThrow(/paid/i);
  });

  it('rejects cancelling an order that is already cancelled', async () => {
    const { batch } = await seedBatch('CancelTwice');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelTwiceCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 1, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);
    await svc().cancel(order.documentId);

    await expect(svc().cancel(order.documentId)).rejects.toThrow(/cancel/i);
  });

  it('stays cancelled even after a payment on it is later deleted (regression: statusFromPayments guard)', async () => {
    const { batch } = await seedBatch('CancelRegression');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelRegCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 2, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);
    const payment = await docs('api::payment.payment').create({
      data: { amount: 50, paymentDate: '2026-07-02', order: order.documentId },
    });
    await svc().cancel(order.documentId);

    await docs('api::payment.payment').delete({ documentId: payment.documentId });

    const reloaded = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(reloaded.status).toBe('cancelled');
  });

  it('rejects exactly one of two concurrent cancels on the same order (no double stock restoration)', async () => {
    const { batch } = await seedBatch('CancelConcurrent');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelConcCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);

    const results = await Promise.allSettled([svc().cancel(order.documentId), svc().cancel(order.documentId)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const restored = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(restored.quantityRemaining).toBe(10); // NOT 13 — restored exactly once, not twice
  });

  it('aggregates quantity correctly when two lines reference the same batch', async () => {
    const { batch } = await seedBatch('CancelSameBatch');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelSameBatchCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 2, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);

    const decremented = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(decremented.quantityRemaining).toBe(5); // 10 - 2 - 3

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const restored = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(restored.quantityRemaining).toBe(10); // both lines' quantities restored to the one batch
  });
});
