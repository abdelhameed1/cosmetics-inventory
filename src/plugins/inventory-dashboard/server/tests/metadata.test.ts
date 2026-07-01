import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('metadata');

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('metadata service', () => {
  it('marks name required+unique on brands and hides system fields', () => {
    const schema = svc().getSchema('brands');
    const name = schema.fields.find((f: any) => f.name === 'name');
    expect(name.required).toBe(true);
    expect(name.unique).toBe(true);
    const created = schema.fields.find((f: any) => f.name === 'createdAt');
    expect(created?.hidden ?? true).toBe(true);
  });

  it('exposes enum values for price-list type', () => {
    const schema = svc().getSchema('price-lists');
    const type = schema.fields.find((f: any) => f.name === 'type');
    expect(type.type).toBe('enumeration');
    expect(type.values).toEqual(expect.arrayContaining(['retail', 'wholesale', 'vip']));
  });

  it('describes the variant→product relation with its target resource slug', () => {
    const schema = svc().getSchema('variants');
    const product = schema.fields.find((f: any) => f.name === 'product');
    expect(product.type).toBe('relation');
    expect(product.relation.resource).toBe('products');
    expect(product.relation.kind).toBe('manyToOne');
  });
});
