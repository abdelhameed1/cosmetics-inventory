// src/plugins/inventory-dashboard/admin/src/config/navConfig.ts
import { type IconType } from 'react-icons';
import {
  FiHome, FiBriefcase, FiShoppingCart, FiList,
  FiBox, FiLayers, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign,
} from 'react-icons/fi';

export type IconComponent = IconType;

export interface NavLink {
  to: string;
  labelId: string;
  icon: IconComponent;
  exact?: boolean;
}

export interface CatalogItem {
  slug: string;
  labelId: string;
  icon: IconComponent;
}

export interface CatalogGroup {
  labelId: string;
  items: CatalogItem[];
}

export const TOP_LINKS: NavLink[] = [
  { to: '/plugins/inventory-dashboard', labelId: 'nav.overview', icon: FiHome, exact: true },
  { to: '/plugins/inventory-dashboard/orders', labelId: 'nav.orders', icon: FiList },
  // Hidden for now — still reachable via the "Add new" picker. Re-enable by uncommenting.
  // { to: '/plugins/inventory-stock', labelId: 'nav.stockPurchase', icon: FiBriefcase },
  // { to: '/plugins/inventory-orders', labelId: 'nav.newOrder', icon: FiShoppingCart },
];

export const CATALOG_GROUPS: CatalogGroup[] = [
  {
    labelId: 'nav.catalog',
    items: [
      { slug: 'products', labelId: 'nav.products', icon: FiBox },
      { slug: 'variants', labelId: 'nav.variants', icon: FiLayers },
      { slug: 'variant-types', labelId: 'nav.variantTypes', icon: FiSliders },
      { slug: 'categories', labelId: 'nav.categories', icon: FiGrid },
      { slug: 'brands', labelId: 'nav.brands', icon: FiTag },
    ],
  },
  {
    labelId: 'nav.partnersPricing',
    items: [
      { slug: 'suppliers', labelId: 'nav.suppliers', icon: FiTruck },
      { slug: 'customers', labelId: 'nav.customers', icon: FiUsers },
      { slug: 'price-lists', labelId: 'nav.priceLists', icon: FiDollarSign },
    ],
  },
];
