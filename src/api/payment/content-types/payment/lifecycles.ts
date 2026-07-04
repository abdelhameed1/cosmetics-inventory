import { computeTotals, statusFromPayments } from '../../../../utils/order-totals';

async function recomputeOrderStatus(orderEntityId: number | undefined, orderDocumentId?: string) {
  if (!orderEntityId && !orderDocumentId) return;

  const order = orderDocumentId
    ? await strapi.documents('api::order.order').findOne({
        documentId: orderDocumentId,
        populate: { lines: true, payments: true },
      })
    : await strapi.db.query('api::order.order').findOne({
        where: { id: orderEntityId },
        populate: { lines: true, payments: true },
      });

  if (!order) return;

  const totals = computeTotals(
    (order.lines ?? []).map((l: any) => ({
      sellPrice: Number(l.sellPrice),
      quantitySold: Number(l.quantitySold),
      costPriceUsdSnapshot: l.costPriceUsdSnapshot,
    })),
    Number(order.discountAmount) || 0,
    1, // exchangeRate irrelevant to status (only totalPaid vs finalTotal)
    (order.payments ?? []).map((p: any) => ({ amount: Number(p.amount) }))
  );

  const nextStatus = statusFromPayments(totals.totalPaid, totals.finalTotal, order.status);
  if (nextStatus !== order.status) {
    await strapi.documents('api::order.order').update({
      documentId: order.documentId,
      data: { status: nextStatus } as any,
    });
  }
}

async function orderRefFromEvent(event: any): Promise<{ documentId?: string }> {
  // resolve the linked order's documentId from the payment row
  const id = event.result?.id ?? event.params?.where?.id;
  if (!id) return {};
  const payment = await strapi.db.query('api::payment.payment').findOne({
    where: { id },
    populate: { order: true },
  });
  return { documentId: payment?.order?.documentId };
}

export default {
  async afterCreate(event) {
    const { documentId } = await orderRefFromEvent(event);
    await recomputeOrderStatus(undefined, documentId);
  },
  async afterUpdate(event) {
    const { documentId } = await orderRefFromEvent(event);
    await recomputeOrderStatus(undefined, documentId);
  },
  async beforeDelete(event) {
    // capture order link before the row is gone
    const id = event.params?.where?.id;
    if (id) {
      const payment = await strapi.db.query('api::payment.payment').findOne({
        where: { id }, populate: { order: true },
      });
      (event.state ||= {}).orderDocumentId = payment?.order?.documentId;
    }
  },
  async afterDelete(event) {
    await recomputeOrderStatus(undefined, event.state?.orderDocumentId);
  },
};
