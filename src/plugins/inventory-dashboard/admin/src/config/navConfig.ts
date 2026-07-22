// src/plugins/inventory-dashboard/admin/src/config/navConfig.ts
import { type IconType } from 'react-icons';
import {
  FiHome, FiBriefcase, FiShoppingCart,
  FiBox, FiLayers, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign,
} from 'react-icons/fi';

export type IconComponent = IconType;

export interface NavLink {
  to: string;
  label: string;
  icon: IconComponent;
}

export interface CatalogItem {
  slug: string;
  label: string;
  icon: IconComponent;
}

export interface CatalogGroup {
  label: string;
  items: CatalogItem[];
}

export const TOP_LINKS: NavLink[] = [
  { to: '/plugins/inventory-dashboard', label: 'Overview', icon: FiHome },
  { to: '/plugins/inventory-stock', label: 'Stock Purchase', icon: FiBriefcase },
  { to: '/plugins/inventory-orders', label: 'New Order', icon: FiShoppingCart },
];

export const CATALOG_GROUPS: CatalogGroup[] = [
  {
    label: 'Catalog',
    items: [
      { slug: 'products', label: 'Products', icon: FiBox },
      { slug: 'variants', label: 'Variants', icon: FiLayers },
      { slug: 'variant-types', label: 'Variant Types', icon: FiSliders },
      { slug: 'categories', label: 'Categories', icon: FiGrid },
      { slug: 'brands', label: 'Brands', icon: FiTag },
    ],
  },
  {
    label: 'Partners & Pricing',
    items: [
      { slug: 'suppliers', label: 'Suppliers', icon: FiTruck },
      { slug: 'customers', label: 'Customers', icon: FiUsers },
      { slug: 'price-lists', label: 'Price Lists', icon: FiDollarSign },
    ],
  },
];
