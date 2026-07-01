import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const settings = () => strapi.plugin('inventory-dashboard').controller('settings') as any;

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('settings controller', () => {
  it('get returns a numeric exchangeRate from the seeded single type', async () => {
    const ctx: any = {};
    await settings().get(ctx);
    expect(Number.isFinite(ctx.body.exchangeRate)).toBe(true);
    expect(ctx.body.exchangeRate).toBeGreaterThan(0);
  });

  it('update sets a new positive rate and stamps exchangeRateUpdatedAt', async () => {
    const ctx: any = { request: { body: { exchangeRate: 3.5 } } };
    await settings().update(ctx);
    expect(ctx.body.exchangeRate).toBe(3.5);
    expect(ctx.body.exchangeRateUpdatedAt).toBeTruthy();

    const ctx2: any = {};
    await settings().get(ctx2);
    expect(ctx2.body.exchangeRate).toBe(3.5);
  });

  it('update rejects a non-positive rate with a validation error', async () => {
    const ctx: any = { request: { body: { exchangeRate: 0 } } };
    await expect(settings().update(ctx)).rejects.toThrow(/positive/i);
    const ctxNeg: any = { request: { body: { exchangeRate: -5 } } };
    await expect(settings().update(ctxNeg)).rejects.toThrow(/positive/i);
  });
});
