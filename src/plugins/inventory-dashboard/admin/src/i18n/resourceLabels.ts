import { type IntlShape } from 'react-intl';
import { CATALOG_GROUPS } from '../config/navConfig';

// Resource-slug page titles borrow the same labels already defined for the
// sidebar (Task 1) instead of a separate dictionary — a slug not found there
// (none exist among the resources reachable through these generic pages
// today) falls back to the raw slug.
export function getResourceLabel(intl: IntlShape, slug: string): string {
  for (const group of CATALOG_GROUPS) {
    const item = group.items.find((i) => i.slug === slug);
    if (item) return intl.formatMessage({ id: item.labelId });
  }
  return slug;
}
