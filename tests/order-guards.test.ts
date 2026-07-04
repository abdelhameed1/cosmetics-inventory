import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function makeDraftOrderWithLine() {
  const customer = await docs('api::customer.customer').create({ data: { name: `GC-${Math.random()}` } });
  const order = await docs('api::order.order').create({
    data: { orderDate: '2026-07-01', status: 'draft', discountAmount: 0, customer: customer.documentId },
  });
  const line = await docs('api::order-line.order-line').create({
    data: { quantitySold: 1, sellPrice: 100, order: order.documentId },
  });
  return { order, line };
}

async function makeConfirmedOrderWithLine() {
  const customer = await docs('api::customer.customer').create({ data: { name: `GC-${Math.random()}` } });
  const order = await docs('api::order.order').create({
    data: { orderDate: '2026-07-01', status: 'confirmed', discountAmount: 0, customer: customer.documentId },
  });
  const line = await docs('api::order-line.order-line').create({
    data: { quantitySold: 1, sellPrice: 100, order: order.documentId },
  });
  return { order, line };
}

describe('Order guard: generic writes cannot bypass confirm()', () => {
  it('rejects a direct generic status write on a draft order', async () => {
    const { order } = await makeDraftOrderWithLine();
    await expect(
      docs('api::order.order').update({ documentId: order.documentId, data: { status: 'confirmed' } as any })
    ).rejects.toThrow(/status cannot be set directly/i);
  });

  it('allows a generic non-status field edit on a draft order', async () => {
    const { order } = await makeDraftOrderWithLine();
    const updated = await docs('api::order.order').update({
      documentId: order.documentId,
      data: { discountAmount: 5 } as any,
    });
    expect(Number(updated.discountAmount)).toBe(5);
  });

  it('rejects any generic field edit on an already-confirmed order', async () => {
    const { order } = await makeConfirmedOrderWithLine();
    await expect(
      docs('api::order.order').update({ documentId: order.documentId, data: { discountAmount: 5 } as any })
    ).rejects.toThrow(/already confirmed/i);
  });

  it('rejects deleting a confirmed order', async () => {
    const { order } = await makeConfirmedOrderWithLine();
    await expect(docs('api::order.order').delete({ documentId: order.documentId })).rejects.toThrow(/cannot delete/i);
  });

  it('allows deleting a draft order', async () => {
    const { order } = await makeDraftOrderWithLine();
    await expect(docs('api::order.order').delete({ documentId: order.documentId })).resolves.toBeTruthy();
  });
});

describe('Order-line guard: cannot edit or delete lines once the parent order is confirmed', () => {
  it('allows editing a line while the parent order is still draft', async () => {
    const { line } = await makeDraftOrderWithLine();
    const updated = await docs('api::order-line.order-line').update({
      documentId: line.documentId,
      data: { quantitySold: 2 } as any,
    });
    expect(updated.quantitySold).toBe(2);
  });

  it('rejects editing a line once the parent order is confirmed', async () => {
    const { line } = await makeConfirmedOrderWithLine();
    await expect(
      docs('api::order-line.order-line').update({ documentId: line.documentId, data: { quantitySold: 2 } as any })
    ).rejects.toThrow(/already confirmed/i);
  });

  it('rejects deleting a line once the parent order is confirmed', async () => {
    const { line } = await makeConfirmedOrderWithLine();
    await expect(docs('api::order-line.order-line').delete({ documentId: line.documentId })).rejects.toThrow(/already confirmed/i);
  });
});
