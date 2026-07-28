import { type IntlShape } from 'react-intl';

const FIELD_LABEL_IDS: Record<string, string> = {
  name: 'field.name',
  notes: 'field.notes',
  phone: 'field.phone',
  address: 'field.address',
  priceList: 'field.priceList',
  type: 'field.type',
  marginPercent: 'field.marginPercent',
  wholesaleMinQty: 'field.wholesaleMinQty',
  vipDiscountPercent: 'field.vipDiscountPercent',
  brand: 'field.brand',
  category: 'field.category',
  label: 'field.label',
  lowStockThreshold: 'field.lowStockThreshold',
  isDefault: 'field.isDefault',
  product: 'field.product',
  variantType: 'field.variantType',
  supplier: 'field.supplier',
  customer: 'field.customer',
};

const ENUM_VALUE_IDS: Record<string, string> = {
  retail: 'enumValue.retail',
  wholesale: 'enumValue.wholesale',
  vip: 'enumValue.vip',
};

// Fallback for any schema field not in FIELD_LABEL_IDS (e.g. a future
// content-type attribute added after this catalog was written) — matches
// today's pre-i18n behavior of showing the raw, capitalized field name.
function humanize(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function getFieldLabel(intl: IntlShape, fieldName: string): string {
  const id = FIELD_LABEL_IDS[fieldName];
  return id ? intl.formatMessage({ id }) : humanize(fieldName);
}

export function getEnumValueLabel(intl: IntlShape, value: string): string {
  const id = ENUM_VALUE_IDS[value];
  return id ? intl.formatMessage({ id }) : value;
}
