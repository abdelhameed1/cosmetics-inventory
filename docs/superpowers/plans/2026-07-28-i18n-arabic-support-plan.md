# i18n Support + Arabic Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every screen inside the `inventory-dashboard` plugin is fully translated into Arabic, with the layout mirroring to right-to-left, switchable from a sidebar toggle without losing wizard state, defaulting to English.

**Architecture:** A new, independent `admin/src/i18n/` module (typed `en`/`ar` catalogs with tsc-enforced key parity, a `LocaleProvider` wrapping `react-intl`'s `IntlProvider`, and small graceful-fallback dictionaries for schema-driven field/enum labels) is threaded through `ChakraRoot`. Every hardcoded JSX string across the plugin's ~27 files is converted to `useIntl().formatMessage(...)` or `<FormattedMessage .../>`. RTL mirrors natively via a `dir` attribute plus a handful of physical→logical Chakra prop conversions — no new npm dependency.

**Tech Stack:** React 18, TypeScript, Chakra UI v2, `react-intl` (already a plugin dependency, currently unused).

## Global Constraints

- **No new npm dependencies.** `react-intl` is already listed in `src/plugins/inventory-dashboard/package.json`. RTL works through native CSS logical properties and the `dir` attribute — do not add `stylis-plugin-rtl` or any other package.
- **Two i18n systems stay separate.** `src/plugins/inventory-dashboard/admin/src/translations/en.json` and the `registerTrads` function in `admin/src/index.ts` belong to Strapi's own core menu-label system (out of scope — do not touch either). Everything this plan builds lives under the new `admin/src/i18n/` directory and is wired through a plugin-owned `LocaleProvider`, completely independent of Strapi's core locale.
- **Catalog key parity is enforced by the type system.** `admin/src/i18n/en.ts` exports `export const en = { ... } as const;`. `admin/src/i18n/ar.ts` exports `export const ar: Record<keyof typeof en, string> = { ... };`. Every task that adds a key to `en.ts` must add the matching key to `ar.ts` in the same commit, or `tsc -p admin/tsconfig.json --noEmit` fails. This is the only test gate this plugin has (`npm run test:ts:front --prefix src/plugins/inventory-dashboard`) — run it after every task.
- **Reusable catalog namespaces** (defined once, consumed by many later files — see each task's Interfaces section for exactly which keys to reuse): `common.*` (back/next/save/cancel/delete/new/loading — Task 1), `field.*` and `enumValue.*` (schema-driven field/enum labels — Task 2), `nav.*` (sidebar + catalog labels — Task 1). Outside those namespaces, do not invent cross-task shared keys — each task's own strings get their own task-scoped keys, even where the English text happens to coincide with another task's string (e.g. "Select product" appears independently in three wizards). This keeps tasks independently reviewable without cross-task coupling risk.
- **Message ID convention:** flat, dotted, namespaced by area, e.g. `orderForm.pageTitle`, `productWizard.addVariantButton`. ICU placeholders (`{label}`, `{date}`, `{field}`) are used for any templated string; call sites pass the value via `formatMessage({id}, {placeholderName: value})`.
- **Numbers, currency, and dates are not localized** — they keep their existing formatting/Western digits in both languages. Only text translates.
- **Every `FormattedMessage`/`formatMessage` call includes a `defaultMessage`** matching the current English text exactly, so English-mode rendering is provably unchanged by this plan (the only behavior change in English mode is: RTL toggle now exists and works).
- **RTL is verified by running the dev server and visually toggling the language**, not just by `tsc` — the plan's final manual verification step (after all tasks) covers this; per-task testing is `tsc` plus a read-through of the rendered JSX logic.

---

### Task 1: i18n infrastructure + shared shell (LocaleProvider, catalogs, theme, AppSidebar, WizardShell, ColorModeToggle)

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/i18n/LocaleProvider.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/LanguageToggle.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/theme/index.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/config/navConfig.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`

**Interfaces:**
- Produces: `Locale = 'en' | 'ar'` type, `LocaleProvider` component, `useLocale(): { locale: Locale; setLocale: (l: Locale) => void }` hook — both exported from `i18n/LocaleProvider.tsx`. `getTheme(locale: Locale)` and `themeConfig` exported from `theme/index.ts`. Catalog keys `common.back`, `common.next`, `common.save`, `common.cancel`, `common.delete`, `common.new`, `common.loading`, `theme.lightMode`, `theme.darkMode`, `addNew.buttonLabel`, `nav.overview`, `nav.stockPurchase`, `nav.newOrder`, `nav.catalog`, `nav.products`, `nav.variants`, `nav.variantTypes`, `nav.categories`, `nav.brands`, `nav.partnersPricing`, `nav.suppliers`, `nav.customers`, `nav.priceLists` — all later tasks that need these reuse them by `id`, they do not redefine them.
- Consumes: nothing from other tasks (this is the first task).
- **Forced inclusion:** `navConfig.ts`'s `CatalogGroup`/`CatalogItem` types change from `label: string` to `labelId: string` in this task (Step 8). `CatalogHub.tsx` is the *only* consumer of `CATALOG_GROUPS` besides `AppSidebar.tsx` (verified by grepping the whole `admin/src` tree for `CATALOG_GROUPS`) — left unconverted, it would fail `tsc` the moment this task's Step 8 lands, since `.label` would no longer exist on the type. Step 10 below converts it now, even though it otherwise belongs with Task 4's "dashboard pages" cluster; Task 4 only touches `Overview.tsx` and `DataTable.tsx`.

- [ ] **Step 1: Create the English catalog**

Create `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`:

```ts
export const en = {
  'common.back': 'Back',
  'common.next': 'Next',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.new': 'New',
  'common.loading': 'Loading…',

  'theme.lightMode': 'Light mode',
  'theme.darkMode': 'Dark mode',

  'addNew.buttonLabel': 'Add new',

  'nav.overview': 'Overview',
  'nav.stockPurchase': 'Stock Purchase',
  'nav.newOrder': 'New Order',
  'nav.catalog': 'Catalog',
  'nav.products': 'Products',
  'nav.variants': 'Variants',
  'nav.variantTypes': 'Variant Types',
  'nav.categories': 'Categories',
  'nav.brands': 'Brands',
  'nav.partnersPricing': 'Partners & Pricing',
  'nav.suppliers': 'Suppliers',
  'nav.customers': 'Customers',
  'nav.priceLists': 'Price Lists',
} as const;
```

- [ ] **Step 2: Create the Arabic catalog**

Create `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`:

```ts
import { en } from './en';

export const ar: Record<keyof typeof en, string> = {
  'common.back': 'رجوع',
  'common.next': 'التالي',
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.delete': 'حذف',
  'common.new': 'جديد',
  'common.loading': 'جارٍ التحميل…',

  'theme.lightMode': 'الوضع الفاتح',
  'theme.darkMode': 'الوضع الداكن',

  'addNew.buttonLabel': 'إضافة جديد',

  'nav.overview': 'نظرة عامة',
  'nav.stockPurchase': 'شراء مخزون',
  'nav.newOrder': 'طلب جديد',
  'nav.catalog': 'الكتالوج',
  'nav.products': 'المنتجات',
  'nav.variants': 'المتغيرات',
  'nav.variantTypes': 'أنواع المتغيرات',
  'nav.categories': 'الفئات',
  'nav.brands': 'الماركات',
  'nav.partnersPricing': 'الشركاء والتسعير',
  'nav.suppliers': 'الموردون',
  'nav.customers': 'العملاء',
  'nav.priceLists': 'قوائم الأسعار',
};
```

- [ ] **Step 3: Create `LocaleProvider`**

Create `src/plugins/inventory-dashboard/admin/src/i18n/LocaleProvider.tsx`:

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { en } from './en';
import { ar } from './ar';

export type Locale = 'en' | 'ar';

const STORAGE_KEY = 'inventory-dashboard-locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'ar' ? 'ar' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  const messages = locale === 'ar' ? ar : en;

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} messages={messages}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
```

- [ ] **Step 4: Update the theme to be direction-aware and Arabic-friendly**

Read the current file first (`src/plugins/inventory-dashboard/admin/src/theme/index.ts`) — it's the one shown in this plan's research, reproduced here for reference. Replace its entire contents with:

```ts
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { type Locale } from '../i18n/LocaleProvider';

export const themeConfig: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const fontStack = `'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Roboto, sans-serif`;

const baseTheme = {
  config: themeConfig,
  colors: {
    brand: {
      50: '#eef4ff',
      100: '#d9e6ff',
      200: '#b3ccff',
      300: '#82adff',
      400: '#4d8bff',
      500: '#2563eb',
      600: '#1d4fc4',
      700: '#173e99',
      800: '#122e73',
      900: '#0c1f4d',
    },
  },
  fonts: {
    heading: fontStack,
    body: fontStack,
  },
  fontSizes: {
    xs: '0.8125rem',
    sm: '0.9375rem',
    md: '1.0625rem',
    lg: '1.1875rem',
    xl: '1.375rem',
    '2xl': '1.625rem',
    '3xl': '2rem',
  },
  shadows: {
    card: '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
    cardHover: '0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.06)',
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: 'gray.50', _dark: 'gray.900' },
      'bg.surface': { default: 'white', _dark: 'gray.800' },
      'bg.subtle': { default: 'gray.50', _dark: 'gray.700' },
      'border.default': { default: 'gray.100', _dark: 'gray.700' },
      'text.primary': { default: 'gray.800', _dark: 'gray.100' },
      'text.secondary': { default: 'gray.500', _dark: 'gray.400' },
      'accent.bg': { default: 'brand.50', _dark: 'rgba(77, 139, 255, 0.16)' },
      'accent.fg': { default: 'brand.600', _dark: 'brand.300' },
    },
  },
  components: {
    Button: {
      baseStyle: { borderRadius: 'lg', fontWeight: 'semibold' },
      defaultProps: { colorScheme: 'brand' },
    },
    Badge: {
      baseStyle: { borderRadius: 'md', px: 2, py: 0.5 },
    },
    Table: {
      variants: {
        simple: {
          th: {
            color: 'text.secondary',
            fontSize: 'xs',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
            borderColor: 'border.default',
            py: 3,
          },
          td: { borderColor: 'border.default', py: 3 },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'bg.surface',
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'border.default',
          boxShadow: 'card',
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    NumberInput: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    Select: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { borderRadius: 'lg', bg: 'bg.surface' },
    },
  },
};

export function getTheme(locale: Locale) {
  return extendTheme({
    ...baseTheme,
    direction: locale === 'ar' ? 'rtl' : 'ltr',
  });
}
```

This is the same theme as before, unchanged in content, plus: `'Noto Sans Arabic'` prepended to the font stack (Latin glyphs fall through unaffected — this font defines no Latin glyphs), and `getTheme(locale)` replacing the old static `export default theme`.

- [ ] **Step 5: Wire `LocaleProvider` and direction into `ChakraRoot`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx` with:

```tsx
import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { getTheme, themeConfig } from '../theme';
import { LocaleProvider, useLocale } from '../i18n/LocaleProvider';

function ThemedShell({ children }: { children: ReactNode }) {
  const { locale } = useLocale();

  return (
    <ChakraProvider theme={getTheme(locale)} resetCSS={false}>
      <Box bg="bg.canvas" color="text.primary" minH="100%" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </Box>
    </ChakraProvider>
  );
}

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={themeConfig.initialColorMode} />
      <LocaleProvider>
        <ThemedShell>{children}</ThemedShell>
      </LocaleProvider>
    </>
  );
}
```

`dir` now lives on the same `Box` that already wraps every page and modal in the plugin (per `App.tsx`, `CatalogStandalone.tsx`, `StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`, all of which wrap their content in `<ChakraRoot><AppShell>...`), so every descendant inherits RTL layout and Chakra's `Flex`/`HStack` mirror automatically — no changes needed to `AppShell.tsx` itself (verify this by reading `src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx`: it contains no hardcoded strings and no physical-direction style props, only a `Flex` wrapping `AppSidebar` and a content `Box` — dir inheritance handles the mirroring).

- [ ] **Step 6: Create `LanguageToggle`**

Create `src/plugins/inventory-dashboard/admin/src/components/LanguageToggle.tsx`:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/LanguageToggle.tsx
import { Box, HStack, Icon, Text } from '@chakra-ui/react';
import { FiGlobe } from 'react-icons/fi';
import { useLocale } from '../i18n/LocaleProvider';

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <Box
      as="button"
      w="100%"
      textAlign="start"
      px={3}
      py={2}
      borderRadius="lg"
      _hover={{ bg: 'bg.subtle' }}
      onClick={() => setLocale(isArabic ? 'en' : 'ar')}
    >
      <HStack spacing={3}>
        <Icon as={FiGlobe} boxSize={4} color="text.secondary" />
        {/* Target-language name, not translated content — always rendered in its
            own script regardless of the currently active locale. */}
        <Text fontSize="sm" color="text.secondary">{isArabic ? 'English' : 'العربية'}</Text>
      </HStack>
    </Box>
  );
}
```

- [ ] **Step 7: Convert `ColorModeToggle` to logical/translated text**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx
import { Box, HStack, Icon, Text, useColorMode } from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useIntl } from 'react-intl';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const intl = useIntl();
  const isDark = colorMode === 'dark';

  return (
    <Box
      as="button"
      w="100%"
      textAlign="start"
      px={3}
      py={2}
      borderRadius="lg"
      _hover={{ bg: 'bg.subtle' }}
      onClick={toggleColorMode}
    >
      <HStack spacing={3}>
        <Icon as={isDark ? FiSun : FiMoon} boxSize={4} color="text.secondary" />
        <Text fontSize="sm" color="text.secondary">
          {isDark
            ? intl.formatMessage({ id: 'theme.lightMode', defaultMessage: 'Light mode' })
            : intl.formatMessage({ id: 'theme.darkMode', defaultMessage: 'Dark mode' })}
        </Text>
      </HStack>
    </Box>
  );
}
```

(Only change from the original: `textAlign="left"` → `"start"`, and the two literal strings routed through `formatMessage`.)

- [ ] **Step 8: Convert `navConfig.ts` to message IDs**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/config/navConfig.ts` with:

```ts
// src/plugins/inventory-dashboard/admin/src/config/navConfig.ts
import { type IconType } from 'react-icons';
import {
  FiHome, FiBriefcase, FiShoppingCart,
  FiBox, FiLayers, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign,
} from 'react-icons/fi';

export type IconComponent = IconType;

export interface NavLink {
  to: string;
  labelId: string;
  icon: IconComponent;
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
  { to: '/plugins/inventory-dashboard', labelId: 'nav.overview', icon: FiHome },
  { to: '/plugins/inventory-stock', labelId: 'nav.stockPurchase', icon: FiBriefcase },
  { to: '/plugins/inventory-orders', labelId: 'nav.newOrder', icon: FiShoppingCart },
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
```

(`StatCard.tsx` imports only the `IconComponent` type from this file — unaffected, no change needed there.)

- [ ] **Step 9: Convert `AppSidebar.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';
import { AddNewModal } from './AddNewModal';
import { ColorModeToggle } from './ColorModeToggle';
import { LanguageToggle } from './LanguageToggle';

function isLinkActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavButton({
  label, icon: IconComp, isActive, onClick,
}: { label: string; icon: IconComponent; isActive: boolean; onClick: () => void }) {
  return (
    <Box
      as="button"
      w="100%"
      textAlign="start"
      px={3}
      py={2}
      borderRadius="lg"
      bg={isActive ? 'accent.bg' : 'transparent'}
      _hover={{ bg: isActive ? 'accent.bg' : 'bg.subtle' }}
      onClick={onClick}
    >
      <HStack spacing={3}>
        <Icon as={IconComp} boxSize={4} color={isActive ? 'accent.fg' : 'text.secondary'} />
        <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'accent.fg' : 'text.secondary'}>
          {label}
        </Text>
      </HStack>
    </Box>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const intl = useIntl();
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);

  return (
    <Box
      as="nav"
      w="240px"
      flexShrink={0}
      bg="bg.surface"
      borderInlineEndWidth="1px"
      borderColor="border.default"
      minH="100%"
      py={6}
      px={4}
      display="flex"
      flexDirection="column"
    >
      <Button
        leftIcon={<Icon as={FiPlus} boxSize={4} />}
        w="100%"
        mb={4}
        onClick={() => setIsAddNewOpen(true)}
      >
        {intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
      </Button>

      <VStack align="stretch" spacing={1} pb={6}>
        {TOP_LINKS.map((link) => (
          <NavButton
            key={link.to}
            label={intl.formatMessage({ id: link.labelId })}
            icon={link.icon}
            isActive={isLinkActive(pathname, link.to)}
            onClick={() => navigate(link.to)}
          />
        ))}
      </VStack>

      {CATALOG_GROUPS.map((group) => (
        <Box key={group.labelId} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="text.secondary" mb={2} px={3}>
            {intl.formatMessage({ id: group.labelId })}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const to = `/plugins/inventory-catalog/${item.slug}`;
              return (
                <NavButton
                  key={item.slug}
                  label={intl.formatMessage({ id: item.labelId })}
                  icon={item.icon}
                  isActive={isLinkActive(pathname, to)}
                  onClick={() => navigate(to)}
                />
              );
            })}
          </VStack>
        </Box>
      ))}

      <Box flex={1} />
      <LanguageToggle />
      <ColorModeToggle />

      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
    </Box>
  );
}
```

Changes from the original: `textAlign="left"` → `"start"` (×2), `borderRightWidth` → `borderInlineEndWidth`, every `link.label`/`group.label`/`item.label` literal replaced by `intl.formatMessage({ id: ...labelId })` reading the now-`labelId`-shaped config, `"Add new"` routed through `formatMessage`, and `<LanguageToggle />` added above `<ColorModeToggle />`. `formatMessage({ id: link.labelId })` has no `defaultMessage` argument because every `labelId` referenced here is guaranteed to exist in the catalog (defined in Step 1 of this same task) — react-intl requires either a matching catalog entry or a `defaultMessage`; all of these have the former.

- [ ] **Step 10: Convert `CatalogHub.tsx` (forced by this task's `navConfig.ts` change)**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { useEffect, useState } from 'react';
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CATALOG_GROUPS } from '../config/navConfig';

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const slugs = CATALOG_GROUPS.flatMap((g) => g.items.map((i) => i.slug));

    Promise.all(
      slugs.map((slug) =>
        api
          .get<{ pagination: { total: number } }>(`/resources/${slug}`, { pageSize: 1 })
          .then((d) => [slug, d.pagination.total] as const)
          .catch(() => [slug, null] as const)
      )
    ).then((entries) => {
      if (!active) return;
      setCounts(Object.fromEntries(entries) as Record<string, number>);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Box p={8}>
      <PageHeader title={intl.formatMessage({ id: 'nav.catalog', defaultMessage: 'Catalog' })} />
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.labelId} pb={8}>
          <Heading size="md" color="text.primary" pb={4}>
            {intl.formatMessage({ id: group.labelId })}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {group.items.map((item) => (
              <Card
                key={item.slug}
                as="button"
                textAlign="start"
                cursor="pointer"
                transition="box-shadow 0.15s, border-color 0.15s"
                _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                onClick={() => navigate(item.slug)}
              >
                <CardBody>
                  <HStack spacing={4} align="flex-start">
                    <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={10} flexShrink={0}>
                      <Icon as={item.icon} boxSize={5} color="accent.fg" />
                    </VStack>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontSize="sm" color="text.secondary" fontWeight="medium">
                        {intl.formatMessage({ id: item.labelId })}
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="text.primary">
                        {counts[item.slug] ?? '—'}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
  );
}
```

(Changes: `textAlign="left"` → `"start"`; `PageHeader title="Catalog"` now reuses `nav.catalog`; `group.label`/`item.label` → `group.labelId`/`item.labelId` resolved via `formatMessage`, matching `navConfig.ts`'s new shape from Step 8.)

- [ ] **Step 11: Convert `WizardShell.tsx`**

In `src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx`, add the import and replace the two literal button labels:

Change:
```tsx
import { type ReactNode } from 'react';
import {
  Box, Button, HStack, Step, StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, Text, useSteps,
} from '@chakra-ui/react';
```
to:
```tsx
import { type ReactNode } from 'react';
import {
  Box, Button, HStack, Step, StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, Text, useSteps,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
```

Change:
```tsx
export function WizardShell({ steps, onSubmit, submitLabel, isSubmitting, submitError }: WizardShellProps) {
  const { activeStep, setActiveStep } = useSteps({ index: 0, count: steps.length });
```
to:
```tsx
export function WizardShell({ steps, onSubmit, submitLabel, isSubmitting, submitError }: WizardShellProps) {
  const intl = useIntl();
  const { activeStep, setActiveStep } = useSteps({ index: 0, count: steps.length });
```

Change:
```tsx
        {activeStep > 0 && (
          <Button variant="ghost" onClick={goBack} isDisabled={isSubmitting}>Back</Button>
        )}
        {!isLastStep && (
          <Button onClick={goNext} isDisabled={!canAdvance}>Next</Button>
        )}
```
to:
```tsx
        {activeStep > 0 && (
          <Button variant="ghost" onClick={goBack} isDisabled={isSubmitting}>
            {intl.formatMessage({ id: 'common.back', defaultMessage: 'Back' })}
          </Button>
        )}
        {!isLastStep && (
          <Button onClick={goNext} isDisabled={!canAdvance}>
            {intl.formatMessage({ id: 'common.next', defaultMessage: 'Next' })}
          </Button>
        )}
```

`step.label` (the `Stepper`/`StepTitle` text) stays as a plain prop — it is supplied by each wizard's own `WizardStep[]` array (already-translated strings by the time Tasks 5–7 build them), not a literal in this file.

- [ ] **Step 12: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/components/LanguageToggle.tsx src/plugins/inventory-dashboard/admin/src/theme/index.ts src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx src/plugins/inventory-dashboard/admin/src/config/navConfig.ts src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
git commit -m "Add i18n infrastructure, RTL shell wiring, and sidebar language toggle"
```

---

### Task 2: Field-driven generic UI (FieldRenderer, RelationSelect, InlineResourceForm, AddNewModal, addNewConfig, QuickCreateSelect)

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/i18n/fieldLabels.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx`

**Interfaces:**
- Consumes (from Task 1, reuse by `id`, do not redefine): `common.back`, `common.save`, `common.cancel`, `addNew.buttonLabel`, `nav.catalog`, `nav.partnersPricing`, `nav.stockPurchase`. Types: `Locale`, `useLocale()` from `i18n/LocaleProvider.tsx`.
- Produces: `getFieldLabel(intl, fieldName)` and `getEnumValueLabel(intl, value)` from the new `i18n/fieldLabels.ts` — Task 3 reuses `getFieldLabel` for `ResourceListPage`'s table-column headers. Catalog keys `field.name`, `field.notes`, `field.phone`, `field.address`, `field.priceList`, `field.type`, `field.marginPercent`, `field.wholesaleMinQty`, `field.vipDiscountPercent`, `field.brand`, `field.category`, `field.label`, `field.lowStockThreshold`, `field.isDefault`, `field.product`, `field.variantType`, `field.supplier`, `field.customer` — Tasks 5–7 reuse `field.brand`, `field.category`, `field.variantType`, `field.label`, `field.lowStockThreshold`, `field.name`, `field.supplier`, `field.customer` for their own `QuickCreateSelect`/`FormField` label props (same UI role: a form-field caption for the same concept). `addNewConfig.ts`'s `AddNewItem`/`AddNewGroup` now carry `labelId` instead of `label` (mirrors Task 1's `navConfig.ts` conversion).

- [ ] **Step 1: Add this task's catalog entries to `en.ts`**

In `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`, add these keys inside the existing `en` object (anywhere after the Task 1 keys, before the closing `} as const;`):

```ts
  'field.name': 'Name',
  'field.notes': 'Notes',
  'field.phone': 'Phone',
  'field.address': 'Address',
  'field.priceList': 'Price List',
  'field.type': 'Type',
  'field.marginPercent': 'Margin %',
  'field.wholesaleMinQty': 'Wholesale Min. Qty',
  'field.vipDiscountPercent': 'VIP Discount %',
  'field.brand': 'Brand',
  'field.category': 'Category',
  'field.label': 'Label',
  'field.lowStockThreshold': 'Low-stock Threshold',
  'field.isDefault': 'Default',
  'field.product': 'Product',
  'field.variantType': 'Variant Type',
  'field.supplier': 'Supplier',
  'field.customer': 'Customer',

  'enumValue.retail': 'retail',
  'enumValue.wholesale': 'wholesale',
  'enumValue.vip': 'vip',

  'error.saveFailed': 'Save failed',

  'addNew.newItemTitle': 'New {label}',
  'addNew.guidedBadge': 'Guided',
  'addNew.group.operations': 'Operations',
  'addNew.item.product': 'Product',
  'addNew.item.variantType': 'Variant Type',
  'addNew.item.category': 'Category',
  'addNew.item.brand': 'Brand',
  'addNew.item.supplier': 'Supplier',
  'addNew.item.customer': 'Customer',
  'addNew.item.priceList': 'Price List',
  'addNew.item.order': 'Order',

  'quickCreate.selectPlaceholder': 'Select {label}',
  'quickCreate.createNewAria': 'Create new {label}',

  'relationSelect.placeholder': 'Select {field}',
```

- [ ] **Step 2: Add the matching Arabic entries to `ar.ts`**

In `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`, add the matching keys (same positions, inside the `ar` object):

```ts
  'field.name': 'الاسم',
  'field.notes': 'ملاحظات',
  'field.phone': 'الهاتف',
  'field.address': 'العنوان',
  'field.priceList': 'قائمة الأسعار',
  'field.type': 'النوع',
  'field.marginPercent': 'نسبة الهامش %',
  'field.wholesaleMinQty': 'الحد الأدنى لكمية الجملة',
  'field.vipDiscountPercent': 'نسبة خصم كبار العملاء %',
  'field.brand': 'الماركة',
  'field.category': 'الفئة',
  'field.label': 'التسمية',
  'field.lowStockThreshold': 'حد المخزون المنخفض',
  'field.isDefault': 'افتراضي',
  'field.product': 'المنتج',
  'field.variantType': 'نوع المتغير',
  'field.supplier': 'المورد',
  'field.customer': 'العميل',

  'enumValue.retail': 'تجزئة',
  'enumValue.wholesale': 'جملة',
  'enumValue.vip': 'كبار العملاء',

  'error.saveFailed': 'فشل الحفظ',

  'addNew.newItemTitle': 'إنشاء {label}',
  'addNew.guidedBadge': 'موجّه',
  'addNew.group.operations': 'العمليات',
  'addNew.item.product': 'منتج',
  'addNew.item.variantType': 'نوع المتغير',
  'addNew.item.category': 'فئة',
  'addNew.item.brand': 'ماركة',
  'addNew.item.supplier': 'مورد',
  'addNew.item.customer': 'عميل',
  'addNew.item.priceList': 'قائمة أسعار',
  'addNew.item.order': 'طلب',

  'quickCreate.selectPlaceholder': 'اختر {label}',
  'quickCreate.createNewAria': 'إنشاء {label}',

  'relationSelect.placeholder': 'اختر {field}',
```

- [ ] **Step 3: Create the field/enum label helper**

Create `src/plugins/inventory-dashboard/admin/src/i18n/fieldLabels.ts`:

```ts
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
```

- [ ] **Step 4: Convert `FieldRenderer.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx` with:

```tsx
import {
  Input, Textarea, NumberInput, NumberInputField, Switch, Select,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { RelationSelect } from './RelationSelect';
import { getFieldLabel, getEnumValueLabel } from '../i18n/fieldLabels';
import { type FieldMeta } from '../utils/api';

export function FieldRenderer({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const intl = useIntl();
  if (field.hidden) return null;
  const label = getFieldLabel(intl, field.name);

  switch (field.type) {
    case 'text':
      return (
        <FormField label={label} required={field.required}>
          <Textarea
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          />
        </FormField>
      );
    case 'integer':
    case 'decimal':
    case 'biginteger':
    case 'float':
      return (
        <FormField label={label} required={field.required}>
          <NumberInput
            value={value ?? ''}
            onChange={(_, valueAsNumber) => onChange(Number.isNaN(valueAsNumber) ? undefined : valueAsNumber)}
          >
            <NumberInputField />
          </NumberInput>
        </FormField>
      );
    case 'boolean':
      return (
        <FormField label={label} required={field.required}>
          <Switch
            isChecked={Boolean(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          />
        </FormField>
      );
    case 'date':
      return (
        <FormField label={label} required={field.required}>
          <Input
            type="date"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value || null)}
          />
        </FormField>
      );
    case 'datetime':
      return (
        <FormField label={label} required={field.required}>
          <Input
            type="datetime-local"
            value={value ? toDateTimeLocal(value) : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </FormField>
      );
    case 'enumeration':
      return (
        <FormField label={label} required={field.required}>
          <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {(field.values ?? []).map((opt) => (
              <option key={opt} value={opt}>{getEnumValueLabel(intl, opt)}</option>
            ))}
          </Select>
        </FormField>
      );
    case 'relation':
      return <RelationSelect field={field} value={value} onChange={onChange} />;
    default:
      return (
        <FormField label={label} required={field.required}>
          <Input
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          />
        </FormField>
      );
  }
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

(`useIntl()` is called before the `if (field.hidden) return null;` early return — required, since React hooks must run unconditionally on every render of this component.)

- [ ] **Step 5: Convert `RelationSelect.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Select } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { useApi, type FieldMeta } from '../utils/api';
import { getFieldLabel } from '../i18n/fieldLabels';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const intl = useIntl();
  const [options, setOptions] = useState<any[]>([]);
  const targetSlug = field.relation?.resource;

  useEffect(() => {
    if (!targetSlug) return;
    api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 })
      .then((d) => setOptions(d.results))
      .catch(() => setOptions([]));
  }, [targetSlug]);

  const selected = value?.documentId ?? value ?? '';
  const label = getFieldLabel(intl, field.name);

  return (
    <FormField label={label} required={field.required}>
      <Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        placeholder={intl.formatMessage({ id: 'relationSelect.placeholder', defaultMessage: 'Select {field}' }, { field: label })}
      >
        {options.map((o) => {
          const optionLabel = String(
            o[field.relation?.mainField ?? 'name'] ?? o.name ?? o.label ?? o.documentId ?? o.id
          );
          return (
            <option key={o.documentId} value={o.documentId}>
              {optionLabel}
            </option>
          );
        })}
      </Select>
    </FormField>
  );
}
```

(The dropdown `<option>` text (`optionLabel`) is actual record data — e.g. a real supplier's name — not UI copy, so it is not translated; only the field caption and the placeholder template are.)

- [ ] **Step 6: Convert `InlineResourceForm.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx
import { useMemo, useState } from 'react';
import { Box, Button, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from './FieldRenderer';

interface InlineResourceFormProps {
  resource: string;
  onDone: (created?: any) => void;
  onCancel?: () => void;
}

export function InlineResourceForm({ resource, onDone, onCancel }: InlineResourceFormProps) {
  const api = useApi();
  const intl = useIntl();
  const { schema } = useSchema(resource);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editableFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden),
    [schema]
  );

  const setField = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = serialize(values, editableFields);
      const created = await api.post<any>(`/resources/${resource}`, payload);
      onDone(created);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Save failed' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        {editableFields.map((f) => (
          <GridItem key={f.name} colSpan={6}>
            <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
          </GridItem>
        ))}
      </Grid>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit} isLoading={isSubmitting} isDisabled={isSubmitting}>
          {intl.formatMessage({ id: 'common.save', defaultMessage: 'Save' })}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
          </Button>
        )}
      </HStack>
    </Box>
  );
}

function serialize(values: Record<string, any>, fields: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (values[f.name] === undefined) continue;
    out[f.name] = values[f.name];
  }
  return out;
}
```

- [ ] **Step 7: Convert `addNewConfig.ts` to message IDs**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts` with:

```ts
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
```

- [ ] **Step 8: Convert `AddNewModal.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx
import { lazy, Suspense, useState } from 'react';
import {
  Badge, Box, Card, CardBody, Center, Heading, HStack, Icon, IconButton, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, SimpleGrid, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { ADD_NEW_GROUPS, type AddNewItem } from '../config/addNewConfig';
import { useLocale } from '../i18n/LocaleProvider';

// Lazy-loaded: AddNewModal is rendered unconditionally on every page via
// AppShell/AppSidebar, so a static import here would bundle every wizard's
// form logic (FIFO/pricing lookups, multi-step save/retry state, schema-driven
// field rendering) into the base shell chunk that loads on every page view,
// even when Add New is never opened. Loading these only once a card is picked
// keeps that shell chunk lightweight, matching how these forms were already
// code-split per-route before this modal embedded them.
const InlineResourceForm = lazy(() => import('./InlineResourceForm').then((m) => ({ default: m.InlineResourceForm })));
const ProductVariantsForm = lazy(() => import('./ProductVariantsForm'));
const StockPurchase = lazy(() => import('../pages/StockPurchase'));
const OrderForm = lazy(() => import('../pages/OrderForm'));

export function AddNewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const intl = useIntl();
  const { locale } = useLocale();
  const [active, setActive] = useState<AddNewItem | null>(null);

  const backToGrid = () => setActive(null);

  // Closes the modal and resets it back to the picker grid for next time it opens.
  const close = () => {
    onClose();
    setActive(null);
  };

  // For flows with no built-in redirect of their own (the 6 simple resources +
  // Product): land on that entity's list after a successful create, then close.
  const doneToList = () => {
    if (active) navigate(`/plugins/inventory-catalog/${active.slug}`);
    close();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size={active ? '3xl' : '2xl'} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            {active && (
              <IconButton
                aria-label={intl.formatMessage({ id: 'common.back', defaultMessage: 'Back' })}
                icon={locale === 'ar' ? <FiArrowRight /> : <FiArrowLeft />}
                size="sm"
                variant="ghost"
                onClick={backToGrid}
              />
            )}
            <Text>
              {active
                ? intl.formatMessage(
                    { id: 'addNew.newItemTitle', defaultMessage: 'New {label}' },
                    { label: intl.formatMessage({ id: active.labelId }) }
                  )
                : intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {!active && (
            <>
              {ADD_NEW_GROUPS.map((group) => (
                <Box key={group.labelId} pb={6}>
                  <Heading size="xs" textTransform="uppercase" color="text.secondary" pb={3}>
                    {intl.formatMessage({ id: group.labelId })}
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {group.items.map((item) => (
                      <Card
                        key={item.slug}
                        as="button"
                        textAlign="start"
                        cursor="pointer"
                        transition="box-shadow 0.15s, border-color 0.15s"
                        _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                        onClick={() => setActive(item)}
                      >
                        <CardBody>
                          <HStack justify="space-between">
                            <HStack spacing={3}>
                              <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={9} flexShrink={0}>
                                <Icon as={item.icon} boxSize={4} color="accent.fg" />
                              </VStack>
                              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                {intl.formatMessage({ id: item.labelId })}
                              </Text>
                            </HStack>
                            {item.kind === 'wizard' && (
                              <Badge colorScheme="brand">
                                {intl.formatMessage({ id: 'addNew.guidedBadge', defaultMessage: 'Guided' })}
                              </Badge>
                            )}
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Box>
              ))}
            </>
          )}

          {active && (
            <Suspense fallback={<Center py={10}><Spinner /></Center>}>
              {active.slug === 'products' && (
                <ProductVariantsForm embedded onDone={doneToList} onCancel={backToGrid} />
              )}
              {active.kind === 'simple' && (
                <InlineResourceForm resource={active.slug} onDone={doneToList} onCancel={backToGrid} />
              )}
              {active.slug === 'stock-purchase' && (
                <StockPurchase embedded onDone={close} onCancel={backToGrid} />
              )}
              {active.slug === 'order' && (
                <OrderForm embedded onDone={close} onCancel={backToGrid} />
              )}
            </Suspense>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
```

(Changes: `textAlign="left"` → `"start"`; the back-arrow icon now flips between `FiArrowLeft`/`FiArrowRight` based on `locale`; every literal label routed through `formatMessage`, resolving `active.labelId`/`group.labelId`/`item.labelId` from the now-`labelId`-shaped config.)

- [ ] **Step 9: Convert `QuickCreateSelect.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx` with:

```tsx
import { useState } from 'react';
import {
  HStack, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Select,
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { InlineResourceForm } from './InlineResourceForm';

interface QuickCreateSelectProps {
  resource: string;
  label: string;
  value: string;
  onChange: (documentId: string) => void;
  options: any[];
  onCreated: (record: any) => void;
  required?: boolean;
  isDisabled?: boolean;
  mainField?: string;
}

export function QuickCreateSelect({
  resource, label, value, onChange, options, onCreated, required, isDisabled, mainField = 'name',
}: QuickCreateSelectProps) {
  const intl = useIntl();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreated = (created?: any) => {
    if (created) {
      onCreated(created);
      onChange(created.documentId);
    }
    setIsCreateOpen(false);
  };

  return (
    <>
      <FormField label={label} required={required}>
        <HStack spacing={2}>
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            isDisabled={isDisabled}
            placeholder={intl.formatMessage(
              { id: 'quickCreate.selectPlaceholder', defaultMessage: 'Select {label}' },
              { label: label.toLowerCase() }
            )}
          >
            {options.map((o) => (
              <option key={o.documentId} value={o.documentId}>
                {String(o[mainField] ?? o.documentId)}
              </option>
            ))}
          </Select>
          <IconButton
            aria-label={intl.formatMessage(
              { id: 'quickCreate.createNewAria', defaultMessage: 'Create new {label}' },
              { label }
            )}
            icon={<FiPlus />}
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
          />
        </HStack>
      </FormField>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {intl.formatMessage({ id: 'addNew.newItemTitle', defaultMessage: 'New {label}' }, { label })}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <InlineResourceForm
              resource={resource}
              onDone={handleCreated}
              onCancel={() => setIsCreateOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
```

(`label` itself is not translated here — it arrives already-translated as a prop from the caller, per this task's Interfaces section. `label.toLowerCase()` is kept exactly as before: a no-op on Arabic text, unchanged behavior for English.)

- [ ] **Step 10: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx
git commit -m "Translate field-driven generic UI: FieldRenderer, RelationSelect, AddNewModal, QuickCreateSelect"
```

---

### Task 3: Generic list/detail pages (ResourceListPage, ResourceFormPage)

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/i18n/resourceLabels.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`

**Interfaces:**
- Consumes (reuse by `id`, do not redefine): `common.new`, `common.cancel`, `common.delete` (Task 1); `getFieldLabel` from `i18n/fieldLabels.ts`, `error.saveFailed`, `addNew.newItemTitle` (Task 2). Types: `CatalogGroup`/`CatalogItem` shape with `labelId` from `config/navConfig.ts` (Task 1).
- Produces: `getResourceLabel(intl, slug)` from the new `i18n/resourceLabels.ts` — not reused elsewhere in this plan, but available for any future generic-resource page.

- [ ] **Step 1: Add this task's catalog entries to `en.ts`**

Add inside the `en` object:

```ts
  'resourceList.searchAria': 'Search',
  'resourceList.searchPlaceholder': 'Search by name',
  'resourceList.clearSearchAria': 'Clear search',
  'resourceList.actionsColumn': 'Actions',
  'resourceList.confirmDeleteTitle': 'Confirm delete',
  'resourceList.confirmDeleteBody': 'Delete this record? This cannot be undone.',
  'error.deleteFailed': 'Delete failed',
  'resourceForm.editTitle': 'Edit {label}',
```

- [ ] **Step 2: Add the matching Arabic entries to `ar.ts`**

```ts
  'resourceList.searchAria': 'بحث',
  'resourceList.searchPlaceholder': 'ابحث بالاسم',
  'resourceList.clearSearchAria': 'مسح البحث',
  'resourceList.actionsColumn': 'إجراءات',
  'resourceList.confirmDeleteTitle': 'تأكيد الحذف',
  'resourceList.confirmDeleteBody': 'هل تريد حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.',
  'error.deleteFailed': 'فشل الحذف',
  'resourceForm.editTitle': 'تعديل {label}',
```

- [ ] **Step 3: Create the resource-label helper**

Create `src/plugins/inventory-dashboard/admin/src/i18n/resourceLabels.ts`:

```ts
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
```

- [ ] **Step 4: Convert `ResourceListPage.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx` with:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, IconButton, Input,
  InputGroup, InputLeftElement, InputRightElement, Text, Td, Tr,
} from '@chakra-ui/react';
import { FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { getFieldLabel } from '../i18n/fieldLabels';
import { getResourceLabel } from '../i18n/resourceLabels';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { schema } = useSchema(resource);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const visibleFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden).slice(0, 6),
    [schema]
  );

  const load = () => {
    api
      .get<{ results: any[] }>(`/resources/${resource}`, { search, pageSize: 100 })
      .then((d) => setRows(d.results))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => { if (resource) load(); /* eslint-disable-next-line */ }, [resource, search]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.del(`/resources/${resource}/${toDelete.documentId}`);
      setToDelete(null);
      setError(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.deleteFailed', defaultMessage: 'Delete failed' }));
      setToDelete(null);
    }
  };

  return (
    <Box p={8}>
      <PageHeader
        title={getResourceLabel(intl, resource)}
        actions={<Button onClick={() => navigate('new')}>{intl.formatMessage({ id: 'common.new', defaultMessage: 'New' })}</Button>}
      />

      <Box pb={4}>
        <InputGroup maxW="sm">
          <InputLeftElement pointerEvents="none"><FiSearch color="var(--chakra-colors-gray-400)" /></InputLeftElement>
          <Input
            aria-label={intl.formatMessage({ id: 'resourceList.searchAria', defaultMessage: 'Search' })}
            placeholder={intl.formatMessage({ id: 'resourceList.searchPlaceholder', defaultMessage: 'Search by name' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <InputRightElement>
              <IconButton
                aria-label={intl.formatMessage({ id: 'resourceList.clearSearchAria', defaultMessage: 'Clear search' })}
                icon={<FiX />}
                size="sm"
                variant="ghost"
                onClick={() => setSearch('')}
              />
            </InputRightElement>
          )}
        </InputGroup>
      </Box>

      {error && <Text color="red.600" pb={4}>{error}</Text>}

      <DataTable
        columns={[
          ...visibleFields.map((f) => getFieldLabel(intl, f.name)),
          intl.formatMessage({ id: 'resourceList.actionsColumn', defaultMessage: 'Actions' }),
        ]}
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <Tr
            key={row.documentId}
            cursor="pointer"
            _hover={{ bg: 'bg.subtle' }}
            onClick={() => navigate(row.documentId)}
          >
            {visibleFields.map((f) => (
              <Td key={f.name}>{renderCell(row[f.name])}</Td>
            ))}
            <Td onClick={(e) => e.stopPropagation()}>
              <IconButton
                aria-label={intl.formatMessage({ id: 'common.delete', defaultMessage: 'Delete' })}
                icon={<FiTrash2 />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => setToDelete(row)}
              />
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog isOpen={!!toDelete} leastDestructiveRef={cancelRef} onClose={() => setToDelete(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl">
            <AlertDialogHeader>{intl.formatMessage({ id: 'resourceList.confirmDeleteTitle', defaultMessage: 'Confirm delete' })}</AlertDialogHeader>
            <AlertDialogBody>{intl.formatMessage({ id: 'resourceList.confirmDeleteBody', defaultMessage: 'Delete this record? This cannot be undone.' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setToDelete(null)}>
                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ms={3}>
                {intl.formatMessage({ id: 'common.delete', defaultMessage: 'Delete' })}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

function renderCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const v: any = value;
    return v.name ?? v.label ?? v.documentId ?? JSON.stringify(v);
  }
  return String(value);
}
```

Note two fixes beyond translation, both required for correct RTL rendering: `ml={3}` on the Delete button → `ms={3}` (margin-inline-start, so the gap stays between the two buttons regardless of which side they render on), and the error fallback corrected to reuse the new `error.deleteFailed` key (the original code used `'Delete failed'`, not `'Save failed'` — check this against the current file before editing, since the exact fallback text matters for the `defaultMessage`).

- [ ] **Step 5: Convert `ResourceFormPage.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';
import { getResourceLabel } from '../i18n/resourceLabels';

export default function ResourceFormPage() {
  const { resource = '', id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { schema } = useSchema(resource);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const editableFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden),
    [schema]
  );

  useEffect(() => {
    if (isEdit && resource) {
      api.get(`/resources/${resource}/${id}`).then((rec) => setValues(normalize(rec)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, resource, id]);

  const setField = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    try {
      const payload = serialize(values, editableFields);
      if (isEdit) {
        await api.put(`/resources/${resource}/${id}`, payload);
      } else {
        await api.post(`/resources/${resource}`, payload);
      }
      navigate('..', { relative: 'path' });
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Save failed' }));
    }
  };

  // Bespoke product-with-variants flow on create
  if (resource === 'products' && !isEdit) {
    return <ProductVariantsForm onDone={() => navigate('..', { relative: 'path' })} />;
  }

  const resourceLabel = getResourceLabel(intl, resource);

  return (
    <Box p={8}>
      <PageHeader
        title={
          isEdit
            ? intl.formatMessage({ id: 'resourceForm.editTitle', defaultMessage: 'Edit {label}' }, { label: resourceLabel })
            : intl.formatMessage({ id: 'addNew.newItemTitle', defaultMessage: 'New {label}' }, { label: resourceLabel })
        }
      />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            {editableFields.map((f) => (
              <GridItem key={f.name} colSpan={6}>
                <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
              </GridItem>
            ))}
          </Grid>
        </CardBody>
      </Card>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit}>{intl.formatMessage({ id: 'common.save', defaultMessage: 'Save' })}</Button>
        <Button variant="ghost" onClick={() => navigate('..', { relative: 'path' })}>
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
      </HStack>
    </Box>
  );
}

function normalize(rec: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(rec ?? {})) {
    out[k] = v && typeof v === 'object' && 'documentId' in (v as any) ? (v as any).documentId : v;
  }
  return out;
}

function serialize(values: Record<string, any>, fields: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (values[f.name] === undefined) continue;
    out[f.name] = values[f.name];
  }
  return out;
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
git commit -m "Translate generic ResourceListPage/ResourceFormPage and fix RTL button spacing"
```

---

### Task 4: Dashboard pages (Overview, DataTable's default empty-state label)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`

**Interfaces:**
- Consumes (reuse by `id`, do not redefine): `nav.overview`, `common.loading` (Task 1).
- Produces: nothing consumed by later tasks — `DataTable`'s `dataTable.emptyLabel` is an internal default only; every caller in later tasks (Tasks 5–7 don't use `DataTable` at all; Task 3 already passes no `emptyLabel` override, so it already benefits from this default once this task lands).

- [ ] **Step 1: Add this task's catalog entries to `en.ts`**

```ts
  'dataTable.emptyLabel': 'No records found',
  'overview.exchangeRateLabel': 'Exchange rate (EGP per USD)',
  'overview.saveRateButton': 'Save rate',
  'overview.updatedLabel': 'Updated: {date}',
  'overview.invalidRateError': 'Enter a valid exchange rate',
  'overview.saveRateError': 'Could not save rate',
  'overview.loadError': 'Could not load overview data',
  'overview.stat.totalStockUnits': 'Total stock units',
  'overview.stat.stockValueUsd': 'Stock value (USD)',
  'overview.stat.stockValueEgp': 'Stock value (EGP)',
  'overview.stat.exchangeRate': 'Exchange rate',
  'overview.lowStockTitle': 'Low stock',
  'overview.col.variant': 'Variant',
  'overview.col.qty': 'Qty',
  'overview.col.threshold': 'Threshold',
  'overview.expiredTitle': 'Expired',
  'overview.expiringSoonTitle': 'Expiring soon (90 days)',
```

- [ ] **Step 2: Add the matching Arabic entries to `ar.ts`**

```ts
  'dataTable.emptyLabel': 'لا توجد سجلات',
  'overview.exchangeRateLabel': 'سعر الصرف (جنيه مصري لكل دولار)',
  'overview.saveRateButton': 'حفظ السعر',
  'overview.updatedLabel': 'آخر تحديث: {date}',
  'overview.invalidRateError': 'أدخل سعر صرف صالح',
  'overview.saveRateError': 'تعذّر حفظ السعر',
  'overview.loadError': 'تعذّر تحميل بيانات النظرة العامة',
  'overview.stat.totalStockUnits': 'إجمالي وحدات المخزون',
  'overview.stat.stockValueUsd': 'قيمة المخزون (دولار)',
  'overview.stat.stockValueEgp': 'قيمة المخزون (جنيه مصري)',
  'overview.stat.exchangeRate': 'سعر الصرف',
  'overview.lowStockTitle': 'المخزون المنخفض',
  'overview.col.variant': 'المتغير',
  'overview.col.qty': 'الكمية',
  'overview.col.threshold': 'الحد الأدنى',
  'overview.expiredTitle': 'منتهي الصلاحية',
  'overview.expiringSoonTitle': 'قريب الانتهاء (90 يومًا)',
```

- [ ] **Step 3: Convert `DataTable.tsx`'s default empty-state label**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx` with:

```tsx
import { Card, CardBody, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';

export function DataTable({
  columns, isEmpty, emptyLabel, children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
  const intl = useIntl();
  const resolvedEmptyLabel = emptyLabel ?? intl.formatMessage({ id: 'dataTable.emptyLabel', defaultMessage: 'No records found' });

  return (
    <Card overflow="hidden">
      <CardBody p={0}>
        <TableContainer>
          <Table variant="simple">
            <Thead bg="bg.subtle">
              <Tr>
                {columns.map((c) => <Th key={c}>{c}</Th>)}
              </Tr>
            </Thead>
            <Tbody>
              {isEmpty ? (
                <Tr>
                  <Td colSpan={columns.length}>
                    <Text color="text.secondary" textAlign="center" py={6}>{resolvedEmptyLabel}</Text>
                  </Td>
                </Tr>
              ) : children}
            </Tbody>
          </Table>
        </TableContainer>
      </CardBody>
    </Card>
  );
}
```

(The default value moved from a JS default parameter — which cannot call a hook — to a computed fallback inside the function body. Every existing caller that doesn't pass `emptyLabel` gets the same "No records found" text as before, now translated.)

- [ ] **Step 4: Convert `Overview.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';

export default function Overview() {
  const intl = useIntl();
  const { data, loading, error, reload } = useOverview();
  const { exchangeRate, exchangeRateUpdatedAt, save } = useSettings();
  const [rateInput, setRateInput] = useState<number | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeRate != null) setRateInput(exchangeRate);
  }, [exchangeRate]);

  const onSaveRate = async () => {
    setSaveError(null);
    if (rateInput == null || Number.isNaN(rateInput)) {
      setSaveError(intl.formatMessage({ id: 'overview.invalidRateError', defaultMessage: 'Enter a valid exchange rate' }));
      return;
    }
    try {
      await save(rateInput);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'overview.saveRateError', defaultMessage: 'Could not save rate' }));
    }
  };

  if (error) {
    return (
      <Box p={8}>
        <Text color="red.600">{intl.formatMessage({ id: 'overview.loadError', defaultMessage: 'Could not load overview data' })}</Text>
      </Box>
    );
  }

  if (loading || !data) {
    return <Box p={8}><Text>{intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' })}</Text></Box>;
  }

  return (
    <Box p={8}>
      <PageHeader title={intl.formatMessage({ id: 'nav.overview', defaultMessage: 'Overview' })} />

      <Box pb={6}>
        <HStack spacing={2} align="flex-end">
          <FormField label={intl.formatMessage({ id: 'overview.exchangeRateLabel', defaultMessage: 'Exchange rate (EGP per USD)' })} maxW="xs">
            <NumberInput value={rateInput ?? ''} onChange={(_, v) => setRateInput(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>{intl.formatMessage({ id: 'overview.saveRateButton', defaultMessage: 'Save rate' })}</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="text.secondary" pt={1}>
            {intl.formatMessage({ id: 'overview.updatedLabel', defaultMessage: 'Updated: {date}' }, { date: exchangeRateUpdatedAt })}
          </Text>
        )}
        {saveError && <Text color="red.600" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={4} spacing={4}>
        <StatCard label={intl.formatMessage({ id: 'overview.stat.totalStockUnits', defaultMessage: 'Total stock units' })} value={String(data.totalStockUnits)} icon={FiArchive} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.stockValueUsd', defaultMessage: 'Stock value (USD)' })} value={`$${data.stockValueUsd.toFixed(2)}`} icon={FiTrendingUp} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.stockValueEgp', defaultMessage: 'Stock value (EGP)' })} value={`E£${data.stockValueEgp.toFixed(2)}`} icon={FiPieChart} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.exchangeRate', defaultMessage: 'Exchange rate' })} value={String(data.exchangeRate)} icon={FiRepeat} />
      </SimpleGrid>

      <Box pt={8}>
        <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
          {intl.formatMessage({ id: 'overview.lowStockTitle', defaultMessage: 'Low stock' })}
        </Text>
        <DataTable
          columns={[
            intl.formatMessage({ id: 'overview.col.variant', defaultMessage: 'Variant' }),
            intl.formatMessage({ id: 'overview.col.qty', defaultMessage: 'Qty' }),
            intl.formatMessage({ id: 'overview.col.threshold', defaultMessage: 'Threshold' }),
          ]}
          isEmpty={data.lowStock.length === 0}
        >
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={8}>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiredTitle', defaultMessage: 'Expired' })}
          </Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiringSoonTitle', defaultMessage: 'Expiring soon (90 days)' })}
          </Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
git commit -m "Translate Overview page and DataTable's default empty-state label"
```

---

### Task 5: Product wizard (ProductVariantsForm)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`

**Interfaces:**
- Consumes (reuse by `id`, do not redefine): `common.cancel` (Task 1); `field.name`, `field.brand`, `field.category`, `field.label`, `field.variantType`, `field.lowStockThreshold` (Task 2, same UI role — a form-field caption for the same concept).
- Produces: `productWizard.selectProductPlaceholder` — this task's own key; Tasks 6 and 7 do **not** reuse it (each defines its own task-scoped equivalent per this plan's Global Constraints — avoid cross-task coupling outside the `common.*`/`field.*`/`nav.*` namespaces).

- [ ] **Step 1: Add this task's catalog entries to `en.ts`**

```ts
  'productWizard.pageTitle': 'New product',
  'productWizard.step.productInfo': 'Product Info',
  'productWizard.step.variants': 'Variants',
  'productWizard.step.relatedProducts': 'Related Products',
  'productWizard.step.review': 'Review',
  'productWizard.variantsHint': 'Optional — leave empty to keep a single default variant.',
  'productWizard.addVariantButton': 'Add variant',
  'productWizard.removeVariantAria': 'Remove',
  'productWizard.addRelatedProductLabel': 'Add related product',
  'productWizard.selectProductPlaceholder': 'Select product',
  'productWizard.variantNeedsTypeError': 'Each variant needs a type.',
  'productWizard.partialSaveError': 'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.',
  'productWizard.createError': 'Could not create product',
  'productWizard.retryButton': 'Retry remaining steps',
  'productWizard.createButton': 'Create product',
  'productWizard.review.nameLabel': 'Name:',
  'productWizard.review.brandLabel': 'Brand:',
  'productWizard.review.categoryLabel': 'Category:',
  'productWizard.review.variantsLabel': 'Variants:',
  'productWizard.review.relatedProductsLabel': 'Related products:',
  'productWizard.review.singleDefaultVariant': 'Single default variant',
  'productWizard.review.none': 'None',
  'productWizard.review.unnamed': '(unnamed)',
```

- [ ] **Step 2: Add the matching Arabic entries to `ar.ts`**

```ts
  'productWizard.pageTitle': 'منتج جديد',
  'productWizard.step.productInfo': 'بيانات المنتج',
  'productWizard.step.variants': 'المتغيرات',
  'productWizard.step.relatedProducts': 'منتجات ذات صلة',
  'productWizard.step.review': 'المراجعة',
  'productWizard.variantsHint': 'اختياري — اتركه فارغًا للاحتفاظ بمتغير افتراضي واحد.',
  'productWizard.addVariantButton': 'إضافة متغير',
  'productWizard.removeVariantAria': 'إزالة',
  'productWizard.addRelatedProductLabel': 'إضافة منتج ذي صلة',
  'productWizard.selectProductPlaceholder': 'اختر منتجًا',
  'productWizard.variantNeedsTypeError': 'كل متغير يحتاج إلى نوع.',
  'productWizard.partialSaveError': 'تم حفظ المنتج، لكن فشلت خطوة لاحقة. اضغط "إعادة محاولة الخطوات المتبقية" للمتابعة.',
  'productWizard.createError': 'تعذّر إنشاء المنتج',
  'productWizard.retryButton': 'إعادة محاولة الخطوات المتبقية',
  'productWizard.createButton': 'إنشاء المنتج',
  'productWizard.review.nameLabel': 'الاسم:',
  'productWizard.review.brandLabel': 'الماركة:',
  'productWizard.review.categoryLabel': 'الفئة:',
  'productWizard.review.variantsLabel': 'المتغيرات:',
  'productWizard.review.relatedProductsLabel': 'منتجات ذات صلة:',
  'productWizard.review.singleDefaultVariant': 'متغير افتراضي واحد',
  'productWizard.review.none': 'لا يوجد',
  'productWizard.review.unnamed': '(بدون اسم)',
```

- [ ] **Step 3: Convert `ProductVariantsForm.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
import { useEffect, useState } from 'react';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, IconButton, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';
import { WizardShell, type WizardStep } from './WizardShell';
import { QuickCreateSelect } from './QuickCreateSelect';

interface VariantRow { label: string; variantTypeId: string; lowStockThreshold?: number; }

interface ProductVariantsFormProps {
  onDone: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function ProductVariantsForm({ onDone, onCancel, embedded = false }: ProductVariantsFormProps) {
  const api = useApi();
  const intl = useIntl();
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [variantTypes, setVariantTypes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once product creation succeeds, so a retry after a later failure
  // (variant creation / default-variant cleanup) does not re-create the product.
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  // How many explicit variants have been successfully created so far, so a
  // retry resumes from the next one instead of re-creating earlier ones.
  const [variantsCreatedCount, setVariantsCreatedCount] = useState(0);
  // Frozen at the moment the product is first created, so a retry after the
  // user navigates back and edits variant rows still resumes against exactly
  // what was decided at that point, not whatever `rows` currently contains.
  const [variantsSnapshot, setVariantsSnapshot] = useState<VariantRow[] | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/brands', { pageSize: 100 }).then((d) => setBrands(d.results));
    api.get<{ results: any[] }>('/resources/categories', { pageSize: 100 }).then((d) => setCategories(d.results));
    api.get<{ results: any[] }>('/resources/variant-types', { pageSize: 100 }).then((d) => setVariantTypes(d.results));
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRow = () => setRows((r) => [...r, { label: '', variantTypeId: '' }]);
  const updateRow = (i: number, patch: Partial<VariantRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const explicitVariants = rows.filter((r) => r.label.trim() || r.variantTypeId);

  const save = async () => {
    setError(null);
    // Only submit rows the user actually filled in. A non-default variant must
    // have a variant type (enforced by the variant lifecycle), so reject any
    // partially-filled row up front — otherwise the POST would throw mid-loop,
    // after the product and earlier variants are already persisted, leaving a
    // half-built product behind with no rollback.
    if (explicitVariants.some((r) => !r.variantTypeId)) {
      setError(intl.formatMessage({ id: 'productWizard.variantNeedsTypeError', defaultMessage: 'Each variant needs a type.' }));
      return;
    }
    setIsSubmitting(true);
    let productId = savedProductId;
    try {
      // 1) create product (auto-creates one default variant) — skipped on retry
      if (!productId) {
        const product = await api.post<any>('/resources/products', {
          name, brand: brandId, category: categoryId,
          relatedProducts: relatedIds,
        });
        productId = product.documentId;
        setSavedProductId(productId);
        setVariantsSnapshot(explicitVariants);
      }

      // 2) create explicit variants — on retry, resume after the ones already created,
      // against the snapshot taken when the product was created (not live `rows`)
      const toCreate = variantsSnapshot ?? explicitVariants;
      const remaining = toCreate.slice(variantsCreatedCount);
      for (const row of remaining) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: productId,
        });
        setVariantsCreatedCount((n) => n + 1);
      }

      // 3) if explicit variants exist, delete the auto-created default
      // (idempotent: if already deleted by a prior attempt, `auto` is simply not found)
      if (toCreate.length > 0) {
        const all = await api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 });
        const auto = all.results.find(
          (v) => v.product?.documentId === productId && v.isDefault
        );
        if (auto) await api.del(`/resources/variants/${auto.documentId}`);
      }

      onDone();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ??
          (productId
            ? intl.formatMessage({
                id: 'productWizard.partialSaveError',
                defaultMessage: 'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.',
              })
            : intl.formatMessage({ id: 'productWizard.createError', defaultMessage: 'Could not create product' }))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const nameLabel = intl.formatMessage({ id: 'field.name', defaultMessage: 'Name' });
  const brandLabel = intl.formatMessage({ id: 'field.brand', defaultMessage: 'Brand' });
  const categoryLabel = intl.formatMessage({ id: 'field.category', defaultMessage: 'Category' });
  const rowLabelLabel = intl.formatMessage({ id: 'field.label', defaultMessage: 'Label' });
  const variantTypeLabel = intl.formatMessage({ id: 'field.variantType', defaultMessage: 'Variant Type' });
  const lowStockThresholdLabel = intl.formatMessage({ id: 'field.lowStockThreshold', defaultMessage: 'Low-stock Threshold' });

  const productInfoStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label={nameLabel} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="brands"
              label={brandLabel}
              required
              value={brandId}
              onChange={setBrandId}
              options={brands}
              onCreated={(b) => setBrands((prev) => [...prev, b])}
            />
          </GridItem>
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="categories"
              label={categoryLabel}
              required
              value={categoryId}
              onChange={setCategoryId}
              options={categories}
              onCreated={(c) => setCategories((prev) => [...prev, c])}
            />
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const variantsStep = (
    <Box>
      <HStack justify="space-between" pb={2}>
        <Text fontSize="sm" color="text.secondary">
          {intl.formatMessage({ id: 'productWizard.variantsHint', defaultMessage: 'Optional — leave empty to keep a single default variant.' })}
        </Text>
        <Button variant="outline" onClick={addRow}>
          {intl.formatMessage({ id: 'productWizard.addVariantButton', defaultMessage: 'Add variant' })}
        </Button>
      </HStack>
      {rows.length > 0 && (
        <Card>
          <CardBody>
            {rows.map((row, i) => (
              <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={i === 0 ? 0 : 4}>
                <GridItem colSpan={4}>
                  <FormField label={rowLabelLabel}>
                    <Input value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
                  </FormField>
                </GridItem>
                <GridItem colSpan={4}>
                  <QuickCreateSelect
                    resource="variant-types"
                    label={variantTypeLabel}
                    value={row.variantTypeId}
                    onChange={(v) => updateRow(i, { variantTypeId: v })}
                    options={variantTypes}
                    onCreated={(t) => setVariantTypes((prev) => [...prev, t])}
                  />
                </GridItem>
                <GridItem colSpan={3}>
                  <FormField label={lowStockThresholdLabel}>
                    <NumberInput
                      value={row.lowStockThreshold ?? ''}
                      onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                    >
                      <NumberInputField />
                    </NumberInput>
                  </FormField>
                </GridItem>
                <GridItem colSpan={1} display="flex" alignItems="flex-end">
                  <IconButton
                    aria-label={intl.formatMessage({ id: 'productWizard.removeVariantAria', defaultMessage: 'Remove' })}
                    icon={<FiTrash2 />}
                    onClick={() => removeRow(i)}
                  />
                </GridItem>
              </Grid>
            ))}
          </CardBody>
        </Card>
      )}
    </Box>
  );

  const relatedStep = (
    <Card>
      <CardBody>
        <FormField label={intl.formatMessage({ id: 'productWizard.addRelatedProductLabel', defaultMessage: 'Add related product' })}>
          <Select
            value=""
            onChange={(e) => setRelatedIds((ids) => (ids.includes(e.target.value) ? ids : [...ids, e.target.value]))}
            placeholder={intl.formatMessage({ id: 'productWizard.selectProductPlaceholder', defaultMessage: 'Select product' })}
          >
            {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
          </Select>
        </FormField>
        <Box pt={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Text key={id} display="inline-block" pe={2}>{p?.name ?? id}</Text>;
          })}
        </Box>
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'productWizard.review.nameLabel', defaultMessage: 'Name:' })}</b> {name || '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'productWizard.review.brandLabel', defaultMessage: 'Brand:' })}</b> {brands.find((b) => b.documentId === brandId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'productWizard.review.categoryLabel', defaultMessage: 'Category:' })}</b> {categories.find((c) => c.documentId === categoryId)?.name ?? '—'}</Text>
        <Text pt={2}>
          <b>{intl.formatMessage({ id: 'productWizard.review.variantsLabel', defaultMessage: 'Variants:' })}</b>{' '}
          {explicitVariants.length === 0
            ? intl.formatMessage({ id: 'productWizard.review.singleDefaultVariant', defaultMessage: 'Single default variant' })
            : explicitVariants
                .map((r) => r.label || intl.formatMessage({ id: 'productWizard.review.unnamed', defaultMessage: '(unnamed)' }))
                .join(', ')}
        </Text>
        <Text pt={2}>
          <b>{intl.formatMessage({ id: 'productWizard.review.relatedProductsLabel', defaultMessage: 'Related products:' })}</b>{' '}
          {relatedIds.length === 0
            ? intl.formatMessage({ id: 'productWizard.review.none', defaultMessage: 'None' })
            : relatedIds.map((id) => products.find((p) => p.documentId === id)?.name ?? id).join(', ')}
        </Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'productWizard.step.productInfo', defaultMessage: 'Product Info' }),
      content: productInfoStep,
      isValid: () => Boolean(name && brandId && categoryId),
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.variants', defaultMessage: 'Variants' }),
      content: variantsStep,
      isValid: () => explicitVariants.every((r) => r.variantTypeId),
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.relatedProducts', defaultMessage: 'Related Products' }),
      content: relatedStep,
      isValid: () => true,
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'productWizard.pageTitle', defaultMessage: 'New product' })} />}
      <WizardShell
        steps={steps}
        onSubmit={save}
        submitLabel={
          savedProductId
            ? intl.formatMessage({ id: 'productWizard.retryButton', defaultMessage: 'Retry remaining steps' })
            : intl.formatMessage({ id: 'productWizard.createButton', defaultMessage: 'Create product' })
        }
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <Button variant="ghost" mt={4} onClick={onCancel ?? onDone} isDisabled={isSubmitting}>
        {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
      </Button>
    </Box>
  );
}
```

Note the RTL fix beyond translation: `pr={2}` on the related-product chip `Text` → `pe={2}` (padding-inline-end), so the gap between chips stays on the correct trailing side after mirroring.

- [ ] **Step 4: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
git commit -m "Translate Product wizard (ProductVariantsForm)"
```

---

### Task 6: Stock Purchase wizard (StockPurchase)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`

**Interfaces:**
- Consumes (reuse by `id`, do not redefine): `common.cancel` (Task 1); `field.supplier`, `field.product` (Task 2, same UI role as the QuickCreateSelect/FormField labels here).
- Produces: nothing reused by other tasks (Task 7's near-identical strings — "Select product", "Select variant", "Default" — get their own independent task-scoped keys per this plan's Global Constraints, not a reuse of this task's keys).

- [ ] **Step 1: Add this task's catalog entries to `en.ts`**

```ts
  'stockPurchase.pageTitle': 'Record stock purchase',
  'stockPurchase.step.productQuantity': 'Product & Quantity',
  'stockPurchase.step.review': 'Review',
  'stockPurchase.selectProductPlaceholder': 'Select product',
  'stockPurchase.selectVariantPlaceholder': 'Select variant',
  'stockPurchase.variantFieldLabel': 'Variant',
  'stockPurchase.defaultVariantLabel': 'Default',
  'stockPurchase.quantityPurchasedLabel': 'Quantity purchased',
  'stockPurchase.costPriceLabel': 'Cost price (USD)',
  'stockPurchase.purchaseDateLabel': 'Purchase date',
  'stockPurchase.productionDateLabel': 'Production date',
  'stockPurchase.expiryDateLabel': 'Expiry date',
  'stockPurchase.saveError': 'Could not record purchase',
  'stockPurchase.recordButton': 'Record purchase',
  'stockPurchase.review.supplierLabel': 'Supplier:',
  'stockPurchase.review.productLabel': 'Product:',
  'stockPurchase.review.variantLabel': 'Variant:',
  'stockPurchase.review.quantityLabel': 'Quantity:',
  'stockPurchase.review.costPriceLabel': 'Cost price (USD):',
  'stockPurchase.review.purchaseDateLabel': 'Purchase date:',
  'stockPurchase.review.productionDateLabel': 'Production date:',
  'stockPurchase.review.expiryDateLabel': 'Expiry date:',
```

- [ ] **Step 2: Add the matching Arabic entries to `ar.ts`**

```ts
  'stockPurchase.pageTitle': 'تسجيل شراء مخزون',
  'stockPurchase.step.productQuantity': 'المنتج والكمية',
  'stockPurchase.step.review': 'المراجعة',
  'stockPurchase.selectProductPlaceholder': 'اختر منتجًا',
  'stockPurchase.selectVariantPlaceholder': 'اختر متغيرًا',
  'stockPurchase.variantFieldLabel': 'المتغير',
  'stockPurchase.defaultVariantLabel': 'افتراضي',
  'stockPurchase.quantityPurchasedLabel': 'الكمية المُشتراة',
  'stockPurchase.costPriceLabel': 'سعر التكلفة (دولار)',
  'stockPurchase.purchaseDateLabel': 'تاريخ الشراء',
  'stockPurchase.productionDateLabel': 'تاريخ الإنتاج',
  'stockPurchase.expiryDateLabel': 'تاريخ الانتهاء',
  'stockPurchase.saveError': 'تعذّر تسجيل عملية الشراء',
  'stockPurchase.recordButton': 'تسجيل الشراء',
  'stockPurchase.review.supplierLabel': 'المورد:',
  'stockPurchase.review.productLabel': 'المنتج:',
  'stockPurchase.review.variantLabel': 'المتغير:',
  'stockPurchase.review.quantityLabel': 'الكمية:',
  'stockPurchase.review.costPriceLabel': 'سعر التكلفة (دولار):',
  'stockPurchase.review.purchaseDateLabel': 'تاريخ الشراء:',
  'stockPurchase.review.productionDateLabel': 'تاريخ الإنتاج:',
  'stockPurchase.review.expiryDateLabel': 'تاريخ الانتهاء:',
```

- [ ] **Step 3: Convert `StockPurchase.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';

interface StockPurchaseProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function StockPurchase({ onDone, onCancel, embedded = false }: StockPurchaseProps = {}) {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [qty, setQty] = useState<number | undefined>();
  const [cost, setCost] = useState<number | undefined>();
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [productionDate, setProductionDate] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    api.get<{ results: any[] }>('/resources/suppliers', { pageSize: 100 }).then((d) => setSuppliers(d.results));
  }, []);

  useEffect(() => {
    if (!productId) { setVariants([]); return; }
    api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 }).then((d) =>
      setVariants(d.results.filter((v) => v.product?.documentId === productId))
    );
    setVariantId('');
  }, [productId]);

  const defaultVariantLabel = intl.formatMessage({ id: 'stockPurchase.defaultVariantLabel', defaultMessage: 'Default' });

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/resources/stock-batches', {
        quantityPurchased: qty,
        costPriceUsd: cost,
        purchaseDate,
        productionDate,
        expiryDate,
        variant: variantId,
        supplier: supplierId,
      });
      navigate('/plugins/inventory-dashboard/r/stock-batches');
      onDone?.();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'stockPurchase.saveError', defaultMessage: 'Could not record purchase' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplierStep = (
    <Card>
      <CardBody>
        <QuickCreateSelect
          resource="suppliers"
          label={intl.formatMessage({ id: 'field.supplier', defaultMessage: 'Supplier' })}
          required
          value={supplierId}
          onChange={setSupplierId}
          options={suppliers}
          onCreated={(s) => setSuppliers((prev) => [...prev, s])}
        />
      </CardBody>
    </Card>
  );

  const productStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'field.product', defaultMessage: 'Product' })} required>
              <Select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={intl.formatMessage({ id: 'stockPurchase.selectProductPlaceholder', defaultMessage: 'Select product' })}
              >
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.variantFieldLabel', defaultMessage: 'Variant' })} required>
              <Select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                isDisabled={!productId}
                placeholder={intl.formatMessage({ id: 'stockPurchase.selectVariantPlaceholder', defaultMessage: 'Select variant' })}
              >
                {variants.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? defaultVariantLabel}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.quantityPurchasedLabel', defaultMessage: 'Quantity purchased' })} required>
              <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.costPriceLabel', defaultMessage: 'Cost price (USD)' })} required>
              <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4} />
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.purchaseDateLabel', defaultMessage: 'Purchase date' })} required>
              <Input type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.productionDateLabel', defaultMessage: 'Production date' })}>
              <Input type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.expiryDateLabel', defaultMessage: 'Expiry date' })}>
              <Input type="date" value={expiryDate ?? ''} onChange={(e) => setExpiryDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.supplierLabel', defaultMessage: 'Supplier:' })}</b> {suppliers.find((s) => s.documentId === supplierId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.productLabel', defaultMessage: 'Product:' })}</b> {products.find((p) => p.documentId === productId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.variantLabel', defaultMessage: 'Variant:' })}</b> {variants.find((v) => v.documentId === variantId)?.label ?? defaultVariantLabel}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.quantityLabel', defaultMessage: 'Quantity:' })}</b> {qty ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.costPriceLabel', defaultMessage: 'Cost price (USD):' })}</b> {cost ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.purchaseDateLabel', defaultMessage: 'Purchase date:' })}</b> {purchaseDate ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.productionDateLabel', defaultMessage: 'Production date:' })}</b> {productionDate ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.expiryDateLabel', defaultMessage: 'Expiry date:' })}</b> {expiryDate ?? '—'}</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'field.supplier', defaultMessage: 'Supplier' }),
      content: supplierStep,
      isValid: () => Boolean(supplierId),
    },
    {
      label: intl.formatMessage({ id: 'stockPurchase.step.productQuantity', defaultMessage: 'Product & Quantity' }),
      content: productStep,
      isValid: () => Boolean(productId && variantId && qty && cost && purchaseDate),
    },
    {
      label: intl.formatMessage({ id: 'stockPurchase.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'stockPurchase.pageTitle', defaultMessage: 'Record stock purchase' })} />}
      <WizardShell
        steps={steps}
        onSubmit={submit}
        submitLabel={intl.formatMessage({ id: 'stockPurchase.recordButton', defaultMessage: 'Record purchase' })}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      {onCancel && (
        <Button variant="ghost" mt={4} onClick={onCancel} isDisabled={isSubmitting}>
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
git commit -m "Translate Stock Purchase wizard"
```

---

### Task 7: Order wizard (OrderForm, including the confirmed-order/payments view)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`

**Interfaces:**
- Consumes (reuse by `id`, do not redefine): `common.cancel` (Task 1); `field.product`, `field.customer` (Task 2, same UI role as this file's `FormField`/`QuickCreateSelect` labels).
- Produces: nothing reused by other tasks — this is the last task.
- Currency codes/symbols (`EGP`, `USD`) are not translated anywhere in this file, consistent with the plan's Global Constraints ("numbers, currency, and dates are not localized") — only the surrounding label text (e.g. "Subtotal:", "Discount (EGP)") is routed through the catalog; the `EGP`/`USD` suffixes stay as literal Latin text in both languages.

- [ ] **Step 1: Add this task's catalog entries to `en.ts`**

```ts
  'orderForm.pageTitle': 'New order',
  'orderForm.step.customerDate': 'Customer & Date',
  'orderForm.step.lineItems': 'Line Items',
  'orderForm.step.review': 'Review',
  'orderForm.orderDateLabel': 'Order date',
  'orderForm.addProductTitle': 'Add product',
  'orderForm.selectProductPlaceholder': 'Select product',
  'orderForm.variantFieldLabel': 'Variant',
  'orderForm.selectVariantPlaceholder': 'Select variant',
  'orderForm.defaultVariantLabel': 'Default',
  'orderForm.quantityLabel': 'Quantity',
  'orderForm.addButton': 'Add',
  'orderForm.crossSellLabel': 'Customers also buy:',
  'orderForm.col.variant': 'Variant',
  'orderForm.col.batch': 'Batch',
  'orderForm.col.qty': 'Qty',
  'orderForm.col.sellEgp': 'Sell (EGP)',
  'orderForm.col.costEgp': 'Cost EGP',
  'orderForm.col.flag': 'Flag',
  'orderForm.sellAria': 'sell',
  'orderForm.belowCostBadge': 'Below cost',
  'orderForm.discountLabel': 'Discount (EGP)',
  'orderForm.subtotalLabel': 'Subtotal:',
  'orderForm.totalLabel': 'Total:',
  'orderForm.review.customerLabel': 'Customer:',
  'orderForm.review.orderDateLabel': 'Order date:',
  'orderForm.review.discountLabel': 'Discount:',
  'orderForm.saveDraftButton': 'Save draft',
  'orderForm.saveDraftError': 'Could not save order',
  'orderForm.confirmOrderButton': 'Confirm order',
  'orderForm.confirmError': 'Could not confirm order',
  'orderForm.confirmed.orderTitle': 'Order {id}',
  'orderForm.confirmed.col.sell': 'Sell',
  'orderForm.confirmed.col.costUsdSnap': 'Cost USD snap',
  'orderForm.confirmed.totalsTitle': 'Totals',
  'orderForm.confirmed.totalsSummary': 'Subtotal: {subtotal} | Final: {final} | Profit: {profit}',
  'orderForm.confirmed.paymentSummary': 'Paid: {paid} | Balance due: {due}',
  'orderForm.confirmed.recordPaymentTitle': 'Record payment',
  'orderForm.confirmed.amountLabel': 'Amount',
  'orderForm.confirmed.methodLabel': 'Method',
  'orderForm.confirmed.paymentMethodCash': 'cash',
  'orderForm.confirmed.paymentMethodTransfer': 'transfer',
  'orderForm.confirmed.addPaymentButton': 'Add payment',
  'orderForm.shortfallError': 'Not enough stock: short by {count} unit(s).',
```

- [ ] **Step 2: Add the matching Arabic entries to `ar.ts`**

```ts
  'orderForm.pageTitle': 'طلب جديد',
  'orderForm.step.customerDate': 'العميل والتاريخ',
  'orderForm.step.lineItems': 'بنود الطلب',
  'orderForm.step.review': 'المراجعة',
  'orderForm.orderDateLabel': 'تاريخ الطلب',
  'orderForm.addProductTitle': 'إضافة منتج',
  'orderForm.selectProductPlaceholder': 'اختر منتجًا',
  'orderForm.variantFieldLabel': 'المتغير',
  'orderForm.selectVariantPlaceholder': 'اختر متغيرًا',
  'orderForm.defaultVariantLabel': 'افتراضي',
  'orderForm.quantityLabel': 'الكمية',
  'orderForm.addButton': 'إضافة',
  'orderForm.crossSellLabel': 'العملاء يشترون أيضًا:',
  'orderForm.col.variant': 'المتغير',
  'orderForm.col.batch': 'الدفعة',
  'orderForm.col.qty': 'الكمية',
  'orderForm.col.sellEgp': 'سعر البيع (جنيه)',
  'orderForm.col.costEgp': 'التكلفة (جنيه)',
  'orderForm.col.flag': 'ملاحظة',
  'orderForm.sellAria': 'سعر البيع',
  'orderForm.belowCostBadge': 'أقل من التكلفة',
  'orderForm.discountLabel': 'الخصم (جنيه)',
  'orderForm.subtotalLabel': 'الإجمالي الفرعي:',
  'orderForm.totalLabel': 'الإجمالي:',
  'orderForm.review.customerLabel': 'العميل:',
  'orderForm.review.orderDateLabel': 'تاريخ الطلب:',
  'orderForm.review.discountLabel': 'الخصم:',
  'orderForm.saveDraftButton': 'حفظ كمسودة',
  'orderForm.saveDraftError': 'تعذّر حفظ الطلب',
  'orderForm.confirmOrderButton': 'تأكيد الطلب',
  'orderForm.confirmError': 'تعذّر تأكيد الطلب',
  'orderForm.confirmed.orderTitle': 'طلب {id}',
  'orderForm.confirmed.col.sell': 'سعر البيع',
  'orderForm.confirmed.col.costUsdSnap': 'لقطة التكلفة (دولار)',
  'orderForm.confirmed.totalsTitle': 'الإجماليات',
  'orderForm.confirmed.totalsSummary': 'الإجمالي الفرعي: {subtotal} | النهائي: {final} | الربح: {profit}',
  'orderForm.confirmed.paymentSummary': 'المدفوع: {paid} | الرصيد المستحق: {due}',
  'orderForm.confirmed.recordPaymentTitle': 'تسجيل دفعة',
  'orderForm.confirmed.amountLabel': 'المبلغ',
  'orderForm.confirmed.methodLabel': 'طريقة الدفع',
  'orderForm.confirmed.paymentMethodCash': 'نقدًا',
  'orderForm.confirmed.paymentMethodTransfer': 'تحويل',
  'orderForm.confirmed.addPaymentButton': 'إضافة دفعة',
  'orderForm.shortfallError': 'المخزون غير كافٍ — ينقص {count} وحدة.',
```

- [ ] **Step 3: Convert `OrderForm.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx` with:

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';

interface DraftLine {
  variantDocumentId: string;
  variantLabel: string;
  stockBatchDocumentId: string;
  costPriceUsd: number;
  quantitySold: number;
  sellPrice: number;
}

function formatLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface OrderFormProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function OrderForm({ onDone, onCancel, embedded = false }: OrderFormProps = {}) {
  const params = useParams();
  // When embedded (e.g. inside the Add New modal, which is mounted alongside
  // whatever page is currently active), useParams() would otherwise pick up an
  // unrelated `:id` from the ambient route — always force "new order" mode.
  const id = embedded ? undefined : params.id;
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { order, reload, confirm } = useOrder(id);

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [orderDate, setOrderDate] = useState<string | null>(formatLocalDate(new Date()));
  const [discount, setDiscount] = useState<number | undefined>(0);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addVariantId, setAddVariantId] = useState('');
  const [addQty, setAddQty] = useState<number | undefined>(1);
  const [relatedSuggestions, setRelatedSuggestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmed = order && order.status !== 'draft';

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/customers', { pageSize: 100 }).then((d) => setCustomers(d.results));
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 }).then((d) => setVariants(d.results));
  }, []);

  // auto-fill price list from selected customer
  useEffect(() => {
    const c = customers.find((x) => x.documentId === customerId);
    if (c?.priceList?.documentId) setPriceListId(c.priceList.documentId);
  }, [customerId, customers]);

  const variantsForProduct = variants.filter((v) => v.product?.documentId === addProductId);
  const defaultVariantLabel = intl.formatMessage({ id: 'orderForm.defaultVariantLabel', defaultMessage: 'Default' });

  const addLine = async () => {
    if (!addVariantId || !priceListId) return;
    setError(null);
    // FIFO segments for the chosen variant + quantity
    const fifo = await api.get<{ segments: any[]; shortfall: number }>(
      `/fifo/${addVariantId}`, { quantity: addQty ?? 1 }
    );
    if (fifo.shortfall > 0) {
      setError(intl.formatMessage(
        { id: 'orderForm.shortfallError', defaultMessage: 'Not enough stock: short by {count} unit(s).' },
        { count: fifo.shortfall }
      ));
    }

    const variant = variants.find((v) => v.documentId === addVariantId);
    const newLines: DraftLine[] = [];
    for (const seg of fifo.segments) {
      // suggested sell price via the pricing endpoint (POST /pricing/suggest).
      // Pass the TOTAL requested quantity (not this segment's own quantityFromBatch)
      // so a wholesale minQty threshold is evaluated against the whole order, not
      // artificially failed when FIFO happens to split it across several batches.
      const priced = await getSuggestedPrice(api, priceListId, seg.costPriceUsd, addQty ?? 1);
      newLines.push({
        variantDocumentId: addVariantId,
        variantLabel: variant?.label ?? defaultVariantLabel,
        stockBatchDocumentId: seg.batchDocumentId,
        costPriceUsd: seg.costPriceUsd,
        quantitySold: seg.quantityFromBatch,
        sellPrice: priced,
      });
    }
    setDraftLines((prev) => [...prev, ...newLines]);

    // cross-sell suggestions from the product's relatedProducts
    const product = products.find((p) => p.documentId === addProductId);
    if (product?.relatedProducts?.length) setRelatedSuggestions(product.relatedProducts);
  };

  const exchangeRate = order?.exchangeRate ?? 0;
  const subtotal = draftLines.reduce((s, l) => s + l.sellPrice * l.quantitySold, 0);
  const finalTotal = subtotal - (discount ?? 0);

  const saveDraft = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // create order header
      const created = await api.post<any>('/resources/orders', {
        orderDate, status: 'draft', discountAmount: discount ?? 0,
        customer: customerId, priceList: priceListId,
      });
      // create lines
      for (const l of draftLines) {
        await api.post('/resources/order-lines', {
          quantitySold: l.quantitySold, sellPrice: l.sellPrice,
          order: created.documentId, stockBatch: l.stockBatchDocumentId,
        });
      }
      navigate(`/plugins/inventory-dashboard/orders/${created.documentId}`);
      onDone?.();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.saveDraftError', defaultMessage: 'Could not save order' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    try { await confirm(); reload(); }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.confirmError', defaultMessage: 'Could not confirm order' })); }
  };

  // ----- confirmed view (read-only lines + payments) -----
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} />;
  }

  const customerStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="customers"
              label={intl.formatMessage({ id: 'field.customer', defaultMessage: 'Customer' })}
              required
              value={customerId}
              onChange={setCustomerId}
              options={customers}
              onCreated={(c) => setCustomers((prev) => [...prev, c])}
            />
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label={intl.formatMessage({ id: 'orderForm.orderDateLabel', defaultMessage: 'Order date' })}>
              <Input type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const lineItemsStep = (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">
        {intl.formatMessage({ id: 'orderForm.addProductTitle', defaultMessage: 'Add product' })}
      </Text>
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label={intl.formatMessage({ id: 'field.product', defaultMessage: 'Product' })}>
                <Select
                  value={addProductId}
                  onChange={(e) => { setAddProductId(e.target.value); setAddVariantId(''); }}
                  placeholder={intl.formatMessage({ id: 'orderForm.selectProductPlaceholder', defaultMessage: 'Select product' })}
                >
                  {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label={intl.formatMessage({ id: 'orderForm.variantFieldLabel', defaultMessage: 'Variant' })}>
                <Select
                  value={addVariantId}
                  onChange={(e) => setAddVariantId(e.target.value)}
                  isDisabled={!addProductId}
                  placeholder={intl.formatMessage({ id: 'orderForm.selectVariantPlaceholder', defaultMessage: 'Select variant' })}
                >
                  {variantsForProduct.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? defaultVariantLabel}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={3}>
              <FormField label={intl.formatMessage({ id: 'orderForm.quantityLabel', defaultMessage: 'Quantity' })}>
                <NumberInput value={addQty ?? ''} onChange={(_, v) => setAddQty(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={1} display="flex" alignItems="flex-end">
              <Button onClick={addLine} isDisabled={!addVariantId}>
                {intl.formatMessage({ id: 'orderForm.addButton', defaultMessage: 'Add' })}
              </Button>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      {relatedSuggestions.length > 0 && (
        <Box mt={4} bg="accent.bg" p={3} borderRadius="lg">
          <Text as="span" fontSize="sm">
            {intl.formatMessage({ id: 'orderForm.crossSellLabel', defaultMessage: 'Customers also buy:' })}&nbsp;
          </Text>
          {relatedSuggestions.map((rp: any) => (
            <Button
              key={rp.documentId}
              variant="link"
              size="sm"
              me={2}
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}
            >
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box pt={6}>
        <DataTable
          columns={[
            intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
            intl.formatMessage({ id: 'orderForm.col.batch', defaultMessage: 'Batch' }),
            intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
            intl.formatMessage({ id: 'orderForm.col.sellEgp', defaultMessage: 'Sell (EGP)' }),
            intl.formatMessage({ id: 'orderForm.col.costEgp', defaultMessage: 'Cost EGP' }),
            intl.formatMessage({ id: 'orderForm.col.flag', defaultMessage: 'Flag' }),
          ]}
          isEmpty={draftLines.length === 0}
        >
          {draftLines.map((l, i) => {
            const costEgp = l.costPriceUsd * exchangeRate;
            const below = l.sellPrice < costEgp;
            return (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.stockBatchDocumentId.slice(0, 6)}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>
                  <NumberInput
                    size="sm"
                    value={l.sellPrice}
                    onChange={(_, v) =>
                      setDraftLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, sellPrice: Number.isNaN(v) ? 0 : v } : x)))}
                  >
                    <NumberInputField aria-label={intl.formatMessage({ id: 'orderForm.sellAria', defaultMessage: 'sell' })} />
                  </NumberInput>
                </Td>
                <Td>{costEgp.toFixed(2)}</Td>
                <Td>
                  {below ? (
                    <Badge colorScheme="red">{intl.formatMessage({ id: 'orderForm.belowCostBadge', defaultMessage: 'Below cost' })}</Badge>
                  ) : null}
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={6}>
        <GridItem colSpan={4}>
          <FormField label={intl.formatMessage({ id: 'orderForm.discountLabel', defaultMessage: 'Discount (EGP)' })}>
            <NumberInput value={discount ?? ''} onChange={(_, v) => setDiscount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text>{intl.formatMessage({ id: 'orderForm.subtotalLabel', defaultMessage: 'Subtotal:' })} {subtotal.toFixed(2)} EGP</Text>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text fontSize="lg" fontWeight="semibold">
            {intl.formatMessage({ id: 'orderForm.totalLabel', defaultMessage: 'Total:' })} {finalTotal.toFixed(2)} EGP
          </Text>
        </GridItem>
      </Grid>
    </Box>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'orderForm.review.customerLabel', defaultMessage: 'Customer:' })}</b> {customers.find((c) => c.documentId === customerId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'orderForm.review.orderDateLabel', defaultMessage: 'Order date:' })}</b> {orderDate ?? '—'}</Text>
        <Box pt={4}>
          <DataTable
            columns={[
              intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
              intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
              intl.formatMessage({ id: 'orderForm.col.sellEgp', defaultMessage: 'Sell (EGP)' }),
            ]}
            isEmpty={draftLines.length === 0}
          >
            {draftLines.map((l, i) => (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice.toFixed(2)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Box>
        <Text pt={4}>
          <b>{intl.formatMessage({ id: 'orderForm.review.discountLabel', defaultMessage: 'Discount:' })}</b> {(discount ?? 0).toFixed(2)} EGP
        </Text>
        <Text fontSize="lg" fontWeight="semibold">
          {intl.formatMessage({ id: 'orderForm.totalLabel', defaultMessage: 'Total:' })} {finalTotal.toFixed(2)} EGP
        </Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'orderForm.step.customerDate', defaultMessage: 'Customer & Date' }),
      content: customerStep,
      isValid: () => Boolean(customerId),
    },
    {
      label: intl.formatMessage({ id: 'orderForm.step.lineItems', defaultMessage: 'Line Items' }),
      content: lineItemsStep,
      isValid: () => draftLines.length > 0,
    },
    {
      label: intl.formatMessage({ id: 'orderForm.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'orderForm.pageTitle', defaultMessage: 'New order' })} />}
      {error && !isSubmitting && draftLines.length === 0 && <Text color="red.600" pb={2}>{error}</Text>}
      <WizardShell
        steps={steps}
        onSubmit={saveDraft}
        submitLabel={intl.formatMessage({ id: 'orderForm.saveDraftButton', defaultMessage: 'Save draft' })}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <HStack spacing={2} pt={4}>
        <Button
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : navigate('/plugins/inventory-dashboard/r/orders'))}
          isDisabled={isSubmitting}
        >
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
        {id && (
          <Button colorScheme="green" onClick={onConfirm}>
            {intl.formatMessage({ id: 'orderForm.confirmOrderButton', defaultMessage: 'Confirm order' })}
          </Button>
        )}
      </HStack>
    </Box>
  );
}

async function getSuggestedPrice(api: any, priceListDocumentId: string, costPriceUsd: number, quantity: number): Promise<number> {
  try {
    const r = await api.post('/pricing/suggest', { priceListDocumentId, costPriceUsd, quantity });
    return r.sellPrice;
  } catch {
    return 0;
  }
}

function ConfirmedOrderView({ order, reload, api }: { order: any; reload: () => void; api: any }) {
  const intl = useIntl();
  const [amount, setAmount] = useState<number | undefined>(0);
  const [method, setMethod] = useState('cash');

  const addPayment = async () => {
    await api.post('/resources/payments', {
      amount: amount ?? 0, method, paymentDate: formatLocalDate(new Date()), order: order.documentId,
    });
    setAmount(0);
    reload();
  };

  return (
    <Box p={8}>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="lg" fontWeight="bold" color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.orderTitle', defaultMessage: 'Order {id}' }, { id: order.documentId.slice(0, 8) })}
        </Text>
        <Badge fontSize="sm">{order.status}</Badge>
      </HStack>

      <DataTable
        columns={[
          intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
          intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
          intl.formatMessage({ id: 'orderForm.confirmed.col.sell', defaultMessage: 'Sell' }),
          intl.formatMessage({ id: 'orderForm.confirmed.col.costUsdSnap', defaultMessage: 'Cost USD snap' }),
          intl.formatMessage({ id: 'orderForm.col.flag', defaultMessage: 'Flag' }),
        ]}
        isEmpty={order.lines.length === 0}
      >
        {order.lines.map((l: any) => (
          <Tr key={l.documentId}>
            <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
            <Td>{l.quantitySold}</Td>
            <Td>{l.sellPrice}</Td>
            <Td>{l.costPriceUsdSnapshot}</Td>
            <Td>
              {l.belowCost ? (
                <Badge colorScheme="red">{intl.formatMessage({ id: 'orderForm.belowCostBadge', defaultMessage: 'Below cost' })}</Badge>
              ) : null}
            </Td>
          </Tr>
        ))}
      </DataTable>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.totalsTitle', defaultMessage: 'Totals' })}
        </Text>
        <Text>
          {intl.formatMessage(
            { id: 'orderForm.confirmed.totalsSummary', defaultMessage: 'Subtotal: {subtotal} | Final: {final} | Profit: {profit}' },
            { subtotal: order.totals.subtotal, final: order.totals.finalTotal, profit: order.totals.netProfit }
          )}
        </Text>
        <Text>
          {intl.formatMessage(
            { id: 'orderForm.confirmed.paymentSummary', defaultMessage: 'Paid: {paid} | Balance due: {due}' },
            { paid: order.totals.totalPaid, due: order.totals.balanceDue }
          )}
        </Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.recordPaymentTitle', defaultMessage: 'Record payment' })}
        </Text>
        <Card>
          <CardBody>
            <HStack spacing={2} align="flex-end">
              <FormField label={intl.formatMessage({ id: 'orderForm.confirmed.amountLabel', defaultMessage: 'Amount' })}>
                <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
              <FormField label={intl.formatMessage({ id: 'orderForm.confirmed.methodLabel', defaultMessage: 'Method' })}>
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">{intl.formatMessage({ id: 'orderForm.confirmed.paymentMethodCash', defaultMessage: 'cash' })}</option>
                  <option value="transfer">{intl.formatMessage({ id: 'orderForm.confirmed.paymentMethodTransfer', defaultMessage: 'transfer' })}</option>
                </Select>
              </FormField>
              <Button onClick={addPayment} isDisabled={!amount}>
                {intl.formatMessage({ id: 'orderForm.confirmed.addPaymentButton', defaultMessage: 'Add payment' })}
              </Button>
            </HStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
```

Two notes beyond translation: `mr={2}` on the cross-sell suggestion `Button` → `me={2}` (margin-inline-end), the RTL fix for that spacing; and the `<option>` elements' `value` attributes (`"cash"`, `"transfer"`) stay as the raw, untranslated values sent to the backend — only their displayed text is routed through the catalog. `order.status` (the plain `Badge` in `ConfirmedOrderView`) is backend data (e.g. `"confirmed"`), not UI copy — left untranslated, unchanged from the original.

- [ ] **Step 4: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/i18n src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
git commit -m "Translate Order wizard (OrderForm + confirmed-order/payments view)"
```

---

## Final manual verification (plan controller, not delegated to any subagent)

After all 7 tasks are implemented and reviewed, before considering this feature done:

1. Start the dev server (`npm run develop` from the repo root) against a working local database.
2. Open the plugin in the admin UI. Confirm it starts in English (no `inventory-dashboard-locale` in `localStorage` yet).
3. Click the sidebar language toggle. Confirm: every visible string switches to Arabic, the layout mirrors (sidebar moves to the right, text aligns to the right, the `AddNewModal` back arrow points right-to-left), and the page you were on does not navigate away or lose state.
4. Reload the page. Confirm it starts in Arabic again (localStorage persistence).
5. Walk through, in Arabic: the Product wizard (including a variant row's Quick Create), the Stock Purchase wizard, the Order wizard (including confirming an order and recording a payment), the Catalog hub, a resource list page (search, delete-confirm dialog), a resource create/edit page for one of the 6 simple resources, and the Overview page (exchange-rate save, low-stock/expired tables).
6. Toggle back to English mid-flow at least once and confirm nothing breaks (no leftover Arabic text, no layout glitch).
7. Confirm Strapi's own outer sidebar/menu labels ("Inventory", "Stock purchase", etc., rendered by Strapi core, not this plugin) stay in English regardless of the in-plugin toggle — the scope boundary from the design spec held.
8. Note any string found still in English (a miss in this plan's string inventory) or any visual RTL glitch (wrong-side spacing, an unmirrored icon) for a follow-up fix — this plan's per-task reviews checked code correctness against each task's brief, not a full bilingual click-through, so this pass is the first time the two languages are compared side-by-side in a browser.
