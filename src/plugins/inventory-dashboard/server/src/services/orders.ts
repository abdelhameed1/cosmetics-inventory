import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { computeTotals, isBelowCost } from '../utils/order-totals';

const ORDER = 'api::order.order';
const LINE = 'api::order-line.order-line';
const BATCH = 'api::stock-batch.stock-batch';
const SETTINGS = 'api::system-settings.system-settings';

const orders = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getWithTotals(documentId: string) {
    const order = await strapi.documents(ORDER as any).findOne({
      documentId,
      populate: {
        customer: true,
        priceList: true,
        payments: true,
        lines: { populate: { stockBatch: true } },
      },
    } as any);
    if (!order) throw new errors.NotFoundError('Order not found');

    const settings = await strapi.documents(SETTINGS as any).findFirst();
    const exchangeRate = settings ? Number(settings.exchangeRate) : 0;

    const lines = (order.lines ?? []).map((l: any) => {
      const costSnapshot = Number(l.costPriceUsdSnapshot ?? l.stockBatch?.costPriceUsd ?? 0);
      return { ...l, belowCost: isBelowCost(Number(l.sellPrice), costSnapshot, exchangeRate) };
    });

    const totals = computeTotals(
      lines.map((l: any) => ({
        sellPrice: Number(l.sellPrice),
        quantitySold: Number(l.quantitySold),
        costPriceUsdSnapshot: l.costPriceUsdSnapshot ?? l.stockBatch?.costPriceUsd ?? 0,
      })),
      Number(order.discountAmount) || 0,
      exchangeRate,
      (order.payments ?? []).map((p: any) => ({ amount: Number(p.amount) }))
    );

    return { ...order, lines, totals, exchangeRate };
  },

  async confirm(documentId: string) {
    const order = await strapi.documents(ORDER as any).findOne({
      documentId,
      populate: { lines: { populate: { stockBatch: true } } },
    } as any);
    if (!order) throw new errors.NotFoundError('Order not found');
    if (order.status !== 'draft') {
      throw new errors.ApplicationError('Order is already confirmed and cannot be re-confirmed.');
    }

    const lines = order.lines ?? [];
    if (lines.length === 0) {
      throw new errors.ApplicationError('Cannot confirm an order with no lines.');
    }

    // aggregate quantity per batch
    const perBatch = new Map<string, { batchId: number; remaining: number; qty: number }>();
    for (const line of lines) {
      if (!line.stockBatch) {
        throw new errors.ApplicationError('Every order line must have a stock batch before confirming.');
      }
      const key = line.stockBatch.documentId;
      const entry = perBatch.get(key) ?? {
        batchId: line.stockBatch.id,
        remaining: Number(line.stockBatch.quantityRemaining),
        qty: 0,
      };
      entry.qty += Number(line.quantitySold);
      perBatch.set(key, entry);
    }

    // fast-fail on the common case (no concurrent activity) before mutating anything
    for (const [batchDocId, { remaining, qty }] of perBatch) {
      if (qty > remaining) {
        throw new errors.ApplicationError(
          `Insufficient stock on batch ${batchDocId}: need ${qty}, have ${remaining}.`
        );
      }
    }

    // Mutate atomically: each decrement is itself a conditional UPDATE (guards
    // against a concurrent confirm winning the same batch), and the whole set
    // is wrapped in one transaction so a losing race rolls back any batches
    // already decremented instead of leaving a half-confirmed order.
    const batchMeta = strapi.db.metadata.get(BATCH);
    const quantityRemainingColumn = (batchMeta.attributes as any).quantityRemaining?.columnName ?? 'quantityRemaining';

    await strapi.db.transaction(async () => {
      for (const [batchDocId, { batchId, qty }] of perBatch) {
        const affected = await strapi.db
          .queryBuilder(BATCH)
          .where({ id: batchId, quantityRemaining: { $gte: qty } })
          .decrement(quantityRemainingColumn, qty)
          .execute();
        if (!affected) {
          throw new errors.ApplicationError(
            `Insufficient stock on batch ${batchDocId}: stock changed before this order could be confirmed.`
          );
        }
      }

      for (const line of lines) {
        await strapi.documents(LINE as any).update({
          documentId: line.documentId,
          data: { costPriceUsdSnapshot: Number(line.stockBatch.costPriceUsd) },
        } as any);
      }

      await strapi.documents(ORDER as any).update({
        documentId,
        data: { status: 'confirmed', __trusted: true },
      } as any);
    });

    return this.getWithTotals(documentId);
  },
});

export default orders;
