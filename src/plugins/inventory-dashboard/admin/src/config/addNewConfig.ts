// src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts
import { FiBox, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign, FiBriefcase, FiShoppingCart } from 'react-icons/fi';
import { type IconComponent } from './navConfig';

export interface AddNewItem {
  slug: string;
  label: string;
  icon: IconComponent;
  kind: 'simple' | 'wizard';
}

export interface AddNewGroup {
  label: string;
  items: AddNewItem[];
}

export const ADD_NEW_GROUPS: AddNewGroup[] = [
  {
    label: 'Catalog',
    items: [
      { slug: 'products', label: 'Product', icon: FiBox, kind: 'wizard' },
      { slug: 'variant-types', label: 'Variant Type', icon: FiSliders, kind: 'simple' },
      { slug: 'categories', label: 'Category', icon: FiGrid, kind: 'simple' },
      { slug: 'brands', label: 'Brand', icon: FiTag, kind: 'simple' },
    ],
  },
  {
    label: 'Partners & Pricing',
    items: [
      { slug: 'suppliers', label: 'Supplier', icon: FiTruck, kind: 'simple' },
      { slug: 'customers', label: 'Customer', icon: FiUsers, kind: 'simple' },
      { slug: 'price-lists', label: 'Price List', icon: FiDollarSign, kind: 'simple' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { slug: 'stock-purchase', label: 'Stock Purchase', icon: FiBriefcase, kind: 'wizard' },
      { slug: 'order', label: 'Order', icon: FiShoppingCart, kind: 'wizard' },
    ],
  },
];
