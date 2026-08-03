import type { Core } from '@strapi/strapi';
import { RESOURCES } from '../config/resources';

const EXPIRY_WINDOW_DAYS = 90;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDate(value: string): Date {
  // value is "YYYY-MM-DD"; parse at local midnight
  const [y, m, day] = value.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const overview = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getOverview() {
    const settingsRow = await strapi.documents('api::system-settings.system-settings' as any).findFirst();
    const exchangeRate = settingsRow ? Number(settingsRow.exchangeRate) : 0;

    const counts: Record<string, number> = {};
    for (const [slug, def] of Object.entries(RESOURCES)) {
      counts[slug] = await strapi.documents(def.uid as any).count({} as any);
    }

    const batches = await strapi.documents('api::stock-batch.stock-batch' as any).findMany({
      populate: { variant: true },
      pageSize: 100000,
    } as any);

    const today = startOfLocalDay(new Date());
    const soonCutoff = new Date(today);
    soonCutoff.setDate(soonCutoff.getDate() + EXPIRY_WINDOW_DAYS);

    let totalStockUnits = 0;
    let stockValueUsd = 0;
    const perVariantQty: Record<string, number> = {};
    const expired: any[] = [];
    const expiringSoon: any[] = [];

    for (const b of batches) {
      const remaining = Number(b.quantityRemaining) || 0;
      const cost = Number(b.costPriceUsd) || 0;
      totalStockUnits += remaining;
      stockValueUsd += remaining * cost;

      let isExpired = false;
      if (b.expiryDate) {
        const exp = parseLocalDate(b.expiryDate);
        const variantLabel = b.variant?.label ?? 'Variant';
        if (exp < today) {
          isExpired = true;
          expired.push({ batchId: b.documentId, variantLabel, expiryDate: b.expiryDate });
        } else if (exp <= soonCutoff) {
          expiringSoon.push({ batchId: b.documentId, variantLabel, expiryDate: b.expiryDate });
        }
      }

      // low-stock quantity excludes expired batches
      if (!isExpired && b.variant?.documentId) {
        perVariantQty[b.variant.documentId] = (perVariantQty[b.variant.documentId] ?? 0) + remaining;
      }
    }

    const variants = await strapi.documents('api::variant.variant' as any).findMany({
      pageSize: 100000,
    } as any);

    const outOfStock: any[] = [];
    const lowStock: any[] = [];
    for (const v of variants) {
      const threshold = Number(v.lowStockThreshold);
      if (!Number.isFinite(threshold) || threshold <= 0) continue;
      const qty = perVariantQty[v.documentId] ?? 0;
      if (qty >= threshold) continue;
      const entry = { variantId: v.documentId, label: v.label ?? 'Variant', quantity: qty, threshold };
      if (qty === 0) {
        outOfStock.push(entry);
      } else {
        lowStock.push(entry);
      }
    }

    return {
      counts,
      exchangeRate,
      totalStockUnits,
      stockValueUsd,
      stockValueEgp: stockValueUsd * exchangeRate,
      outOfStock,
      lowStock,
      expired,
      expiringSoon,
    };
  },
});

export default overview;
