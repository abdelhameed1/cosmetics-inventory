import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

const docs = (uid: string) => strapi.documents(uid as any);

async function makeBrandCategory() {
  const brand = await docs('api::brand.brand').create({ data: { name: `B-${Date.now()}-${Math.random()}` } });
  const category = await docs('api::category.category').create({ data: { name: `C-${Date.now()}-${Math.random()}` } });
  return { brand, category };
}

describe('Product → auto default variant', () => {
  it('creates exactly one default variant when a product is created with none', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Foundation', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    expect(variants).toHaveLength(1);
    expect(variants[0].isDefault).toBe(true);
  });
});

describe('Variant → non-default variant must have a type', () => {
  it('rejects creating a non-default variant without a variantType', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Lipstick', brand: brand.documentId, category: category.documentId },
    });
    await expect(
      docs('api::variant.variant').create({
        data: { label: 'Shade 220', isDefault: false, product: product.documentId },
      })
    ).rejects.toThrow(/non-default variant must have a variant type/i);
  });

  it('allows a non-default variant that has a variantType', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Lipstick 2', brand: brand.documentId, category: category.documentId },
    });
    const vt = await docs('api::variant-type.variant-type').create({ data: { name: `Shade-${Math.random()}` } });
    const variant = await docs('api::variant.variant').create({
      data: { label: 'Shade 300', isDefault: false, product: product.documentId, variantType: vt.documentId },
    });
    expect(variant.documentId).toBeTruthy();
  });
});

describe('Variant → guard on update (merged state)', () => {
  it('rejects flipping a default variant to non-default without a type', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'FlipGuard', brand: brand.documentId, category: category.documentId },
    });
    // product afterCreate created a default variant with no variantType
    const [def] = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    await expect(
      docs('api::variant.variant').update({
        documentId: def.documentId,
        data: { isDefault: false } as any,
      })
    ).rejects.toThrow(/non-default variant must have a variant type/i);
  });

  it('allows updating a scalar field on a typed non-default variant', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'UpdOk', brand: brand.documentId, category: category.documentId },
    });
    const vt = await docs('api::variant-type.variant-type').create({ data: { name: `Shade-${Math.random()}` } });
    const variant = await docs('api::variant.variant').create({
      data: { label: 'V', isDefault: false, product: product.documentId, variantType: vt.documentId },
    });
    const updated = await docs('api::variant.variant').update({
      documentId: variant.documentId,
      data: { label: 'V2' } as any,
    });
    expect(updated.label).toBe('V2');
  });
});

describe('Stock Batch → seed remaining quantity', () => {
  it('seeds quantityRemaining from quantityPurchased when omitted', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Serum', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `S-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 50,
        costPriceUsd: 3.5,
        purchaseDate: '2026-07-01',
        variant: variants[0].documentId,
        supplier: supplier.documentId,
      },
    });
    expect(batch.quantityRemaining).toBe(50);
  });
});

describe('Deletion guards', () => {
  it('blocks deleting a brand that has products', async () => {
    const { brand, category } = await makeBrandCategory();
    await docs('api::product.product').create({
      data: { name: 'Guarded', brand: brand.documentId, category: category.documentId },
    });
    await expect(
      docs('api::brand.brand').delete({ documentId: brand.documentId })
    ).rejects.toThrow(/cannot delete this brand/i);
  });
});
