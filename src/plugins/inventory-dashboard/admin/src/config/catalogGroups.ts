export interface CatalogItem {
  slug: string;
  label: string;
}

export interface CatalogGroup {
  label: string;
  items: CatalogItem[];
}

export const CATALOG_GROUPS: CatalogGroup[] = [
  {
    label: 'Catalog',
    items: [
      { slug: 'products', label: 'Products' },
      { slug: 'variants', label: 'Variants' },
      { slug: 'variant-types', label: 'Variant Types' },
      { slug: 'categories', label: 'Categories' },
      { slug: 'brands', label: 'Brands' },
    ],
  },
  {
    label: 'Partners & Pricing',
    items: [
      { slug: 'suppliers', label: 'Suppliers' },
      { slug: 'customers', label: 'Customers' },
      { slug: 'price-lists', label: 'Price Lists' },
    ],
  },
];
