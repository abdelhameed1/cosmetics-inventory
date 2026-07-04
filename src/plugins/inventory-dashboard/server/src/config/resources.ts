export interface ResourceDef {
  uid: string;
  populate?: string[];
}

export const RESOURCES: Record<string, ResourceDef> = {
  brands: { uid: 'api::brand.brand' },
  categories: { uid: 'api::category.category' },
  'variant-types': { uid: 'api::variant-type.variant-type' },
  suppliers: { uid: 'api::supplier.supplier' },
  customers: { uid: 'api::customer.customer', populate: ['priceList'] },
  'price-lists': { uid: 'api::price-list.price-list' },
  products: {
    uid: 'api::product.product',
    populate: ['brand', 'category', 'variants', 'relatedProducts'],
  },
  variants: { uid: 'api::variant.variant', populate: ['product', 'variantType', 'batches'] },
  'stock-batches': { uid: 'api::stock-batch.stock-batch', populate: ['variant', 'supplier'] },
  orders: { uid: 'api::order.order', populate: ['customer', 'priceList', 'lines', 'payments'] },
  'order-lines': { uid: 'api::order-line.order-line', populate: ['order', 'stockBatch'] },
  payments: { uid: 'api::payment.payment', populate: ['order'] },
};

export function resolveResource(slug: string): ResourceDef | null {
  return RESOURCES[slug] ?? null;
}
