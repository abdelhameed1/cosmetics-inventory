// src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts
import { FiBox, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign, FiBriefcase, FiShoppingCart } from 'react-icons/fi';
import { type IconComponent } from './navConfig';

export interface AddNewItem {
  slug: string;
  label: string;
  icon: IconComponent;
  kind: 'simple' | 'wizard';
  path: string;
}

export interface AddNewGroup {
  label: string;
  items: AddNewItem[];
}

export const ADD_NEW_GROUPS: AddNewGroup[] = [
  {
    label: 'Catalog',
    items: [
      { slug: 'products', label: 'Product', icon: FiBox, kind: 'wizard', path: '/plugins/inventory-catalog/products/new' },
      { slug: 'variant-types', label: 'Variant Type', icon: FiSliders, kind: 'simple', path: '/plugins/inventory-catalog/variant-types/new' },
      { slug: 'categories', label: 'Category', icon: FiGrid, kind: 'simple', path: '/plugins/inventory-catalog/categories/new' },
      { slug: 'brands', label: 'Brand', icon: FiTag, kind: 'simple', path: '/plugins/inventory-catalog/brands/new' },
    ],
  },
  {
    label: 'Partners & Pricing',
    items: [
      { slug: 'suppliers', label: 'Supplier', icon: FiTruck, kind: 'simple', path: '/plugins/inventory-catalog/suppliers/new' },
      { slug: 'customers', label: 'Customer', icon: FiUsers, kind: 'simple', path: '/plugins/inventory-catalog/customers/new' },
      { slug: 'price-lists', label: 'Price List', icon: FiDollarSign, kind: 'simple', path: '/plugins/inventory-catalog/price-lists/new' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { slug: 'stock-purchase', label: 'Stock Purchase', icon: FiBriefcase, kind: 'wizard', path: '/plugins/inventory-stock' },
      { slug: 'order', label: 'Order', icon: FiShoppingCart, kind: 'wizard', path: '/plugins/inventory-orders' },
    ],
  },
];
