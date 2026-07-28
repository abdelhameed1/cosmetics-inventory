// src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts
import { FiBox, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign, FiBriefcase, FiShoppingCart } from 'react-icons/fi';
import { type IconComponent } from './navConfig';

export interface AddNewItem {
  slug: string;
  labelId: string;
  icon: IconComponent;
  kind: 'simple' | 'wizard';
}

export interface AddNewGroup {
  labelId: string;
  items: AddNewItem[];
}

export const ADD_NEW_GROUPS: AddNewGroup[] = [
  {
    labelId: 'nav.catalog',
    items: [
      { slug: 'products', labelId: 'addNew.item.product', icon: FiBox, kind: 'wizard' },
      { slug: 'variant-types', labelId: 'addNew.item.variantType', icon: FiSliders, kind: 'simple' },
      { slug: 'categories', labelId: 'addNew.item.category', icon: FiGrid, kind: 'simple' },
      { slug: 'brands', labelId: 'addNew.item.brand', icon: FiTag, kind: 'simple' },
    ],
  },
  {
    labelId: 'nav.partnersPricing',
    items: [
      { slug: 'suppliers', labelId: 'addNew.item.supplier', icon: FiTruck, kind: 'simple' },
      { slug: 'customers', labelId: 'addNew.item.customer', icon: FiUsers, kind: 'simple' },
      { slug: 'price-lists', labelId: 'addNew.item.priceList', icon: FiDollarSign, kind: 'simple' },
    ],
  },
  {
    labelId: 'addNew.group.operations',
    items: [
      { slug: 'stock-purchase', labelId: 'nav.stockPurchase', icon: FiBriefcase, kind: 'wizard' },
      { slug: 'order', labelId: 'addNew.item.order', icon: FiShoppingCart, kind: 'wizard' },
    ],
  },
];
