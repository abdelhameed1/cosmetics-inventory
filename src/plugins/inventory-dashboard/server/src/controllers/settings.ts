import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const UID = 'api::system-settings.system-settings';

const settings = ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(ctx) {
    const row = await strapi.documents(UID as any).findFirst();
    ctx.body = {
      exchangeRate: row ? Number(row.exchangeRate) : null,
      exchangeRateUpdatedAt: row?.exchangeRateUpdatedAt ?? null,
    };
  },

  async update(ctx) {
    const body = ctx.request.body?.data ?? ctx.request.body;
    const rate = Number(body?.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new errors.ValidationError('exchangeRate must be a positive number');
    }
    const data = { exchangeRate: rate, exchangeRateUpdatedAt: new Date().toISOString() };
    const current = await strapi.documents(UID as any).findFirst();
    const updated = current
      ? await strapi.documents(UID as any).update({ documentId: current.documentId, data } as any)
      : await strapi.documents(UID as any).create({ data } as any);
    ctx.body = {
      exchangeRate: Number(updated.exchangeRate),
      exchangeRateUpdatedAt: updated.exchangeRateUpdatedAt,
    };
  },
});

export default settings;
