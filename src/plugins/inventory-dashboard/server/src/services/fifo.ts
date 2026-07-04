import type { Core } from '@strapi/strapi';

export interface FifoSegment {
  batchDocumentId: string;
  costPriceUsd: number;
  quantityFromBatch: number;
  purchaseDate: string;
  expiryDate: string | null;
}

const fifo = ({ strapi }: { strapi: Core.Strapi }) => ({
  async resolve(variantDocumentId: string, quantity: number): Promise<{ segments: FifoSegment[]; shortfall: number }> {
    const batches = await strapi.documents('api::stock-batch.stock-batch' as any).findMany({
      filters: {
        variant: { documentId: variantDocumentId },
        quantityRemaining: { $gt: 0 },
      },
      sort: ['purchaseDate:asc', 'createdAt:asc'],
      pageSize: 1000,
    } as any);

    let remaining = Math.max(0, Number(quantity) || 0);
    const segments: FifoSegment[] = [];

    for (const b of batches) {
      if (remaining <= 0) break;
      const available = Number(b.quantityRemaining);
      const take = Math.min(remaining, available);
      segments.push({
        batchDocumentId: b.documentId,
        costPriceUsd: Number(b.costPriceUsd),
        quantityFromBatch: take,
        purchaseDate: b.purchaseDate,
        expiryDate: b.expiryDate ?? null,
      });
      remaining -= take;
    }

    return { segments, shortfall: remaining };
  },
});

export default fifo;
