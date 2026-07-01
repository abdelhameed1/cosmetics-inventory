import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('resource');

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('resource service', () => {
  it('throws NotFound for an unknown slug', async () => {
    await expect(svc().find('not-a-resource', {})).rejects.toThrow(/unknown resource/i);
  });

  it('creates, finds, and removes a brand by slug', async () => {
    const created = await svc().create('brands', { name: `RS-${Date.now()}` });
    expect(created.documentId).toBeTruthy();

    const one = await svc().findOne('brands', created.documentId);
    expect(one.documentId).toBe(created.documentId);

    const page = await svc().find('brands', { page: 1, pageSize: 5 });
    expect(Array.isArray(page.results)).toBe(true);
    expect(page.pagination.pageSize).toBeLessThanOrEqual(100);

    await svc().remove('brands', created.documentId);
    const gone = await svc().findOne('brands', created.documentId);
    expect(gone).toBeNull();
  });

  it('caps pageSize at 100', async () => {
    const page = await svc().find('brands', { page: 1, pageSize: 9999 });
    expect(page.pagination.pageSize).toBe(100);
  });
});
