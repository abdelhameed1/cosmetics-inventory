# Purity-Inspired Theme & Unified Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the entire `inventory-dashboard` plugin admin UI with a Purity-UI-Dashboard-inspired visual system (icon-badge stat cards, soft-shadow `Card` surfaces, refined tables/forms) and replace the plugin's 4 fragmented entry points with one shared navigation shell.

**Architecture:** Extend `theme/index.ts` with `Card`/`Input`/`Select`/`Textarea`/`NumberInput`/`Table` component overrides (existing `brand.*` blue palette unchanged). Add a shared `AppShell`/`AppSidebar` (replacing the Catalog-only `CatalogLayout`/`CatalogSidebar`) wrapped by all 4 Strapi menu-link entry points, driven by one `navConfig.ts` (top-level links + the existing 8-entity Catalog groups, each now carrying an icon). Restyle every shared UI primitive and page on top of Chakra's native `Card` component.

**Tech Stack:** Chakra UI 2.10 (installed, includes `Card`/`CardBody`), `react-icons/fi` (Feather icons — already a direct dependency of this plugin, already used in `ResourceListPage.tsx`/`ProductVariantsForm.tsx`), React Router v6, TypeScript.

## Global Constraints

- Keep the existing `brand.*` blue color scale (`brand.500 = #2563eb`) exactly as-is — do not introduce Purity's purple/gradient palette. Only structure (cards, shadows, spacing, icon badges) is adopted, not colors.
- No new top navbar. `AppShell` is sidebar + content only — Strapi's own admin chrome (global sidebar, top user bar) is untouched and remains the only top bar.
- No new npm dependencies. All new icons come from `react-icons/fi` (already a direct dependency of `src/plugins/inventory-dashboard/package.json`, already used for `FiSearch`/`FiTrash2`/`FiX`). `@strapi/icons` stays exactly where it is today — the 4 `addMenuLink` icons in `index.ts` — and is not used anywhere in the new sidebar/cards, to avoid mixing two different icon visual styles in the same UI.
- No backend changes anywhere in this plan. `server/src/**` is never touched.
- Do not change `ResourceFormPage.tsx`'s three `navigate('..', { relative: 'path' })` calls — that relative-navigation fix from the Catalog hub work must survive this reskin unchanged; only the surrounding JSX/styling in that file changes.
- Every one of the 4 Strapi admin entry points (`App.tsx`, `StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`, `CatalogStandalone.tsx`) must keep wrapping `ChakraRoot` exactly once — `AppShell` nests *inside* `ChakraRoot`, never replaces or duplicates it.
- Verification command for every task in this plan (no frontend test harness exists — this is the authoritative type-check gate, confirmed from this plugin's own `package.json`):
  ```bash
  cd src/plugins/inventory-dashboard && npm run test:ts:front
  ```
  This runs `tsc -p admin/tsconfig.json --noEmit`. Run it after every task's code changes, before committing.

---

### Task 1: Theme system overhaul

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/theme/index.ts`

**Interfaces:**
- Produces: `theme.shadows.card`, `theme.shadows.cardHover` (new shadow tokens later tasks reference by name via Chakra's `boxShadow="card"` / `boxShadow="cardHover"`). Adds `Card` component styling (parts: `container`) and default `focusBorderColor`/rounded `field` styling for `Input`/`NumberInput`/`Select`/`Textarea`, consumed automatically by every existing and future form field with zero code changes at the call site.

- [ ] **Step 1: Replace the theme file**

```ts
// src/plugins/inventory-dashboard/admin/src/theme/index.ts
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
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
    heading: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  },
  shadows: {
    card: '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
    cardHover: '0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.06)',
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
            color: 'gray.500',
            fontSize: 'xs',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
            borderColor: 'gray.100',
            py: 3,
          },
          td: { borderColor: 'gray.100', py: 3 },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'white',
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'gray.100',
          boxShadow: 'card',
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg' } },
    },
    NumberInput: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg' } },
    },
    Select: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { borderRadius: 'lg' },
    },
  },
});

export default theme;
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Manual smoke check**

Run `npm run develop` at the project root, log into the Strapi admin, open any existing form (e.g. Stock Purchase). Click into any text input. Expected: the input's focus ring is now blue (`brand.500`) with a slightly larger corner radius than before — this confirms the theme-level `Input`/`Select`/`NumberInput` overrides are live even though no other file has changed yet.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/theme/index.ts
git commit -m "feat(inventory-dashboard): extend theme with Card tokens and refined form-field styling"
```

---

### Task 2: Unified navigation shell (navConfig, AppSidebar, AppShell) wired into all 4 entry points

This task supersedes the Catalog-only navigation shell built in the Catalog hub work: `catalogGroups.ts` → `navConfig.ts` (adds `TOP_LINKS` + an `icon` per item), `CatalogSidebar.tsx` → `AppSidebar.tsx` (renders both `TOP_LINKS` and the catalog groups), `CatalogLayout.tsx` → `AppShell.tsx` (children-based wrapper instead of a route-nested `<Outlet/>`, so it can wrap `App.tsx`'s and `CatalogStandalone.tsx`'s entire `<Routes>` block the same way it wraps the single-page `StockPurchaseStandalone`/`OrderFormStandalone`). All of this must land in one commit — deleting the old files while leaving any of the 4 entry points still referencing them would leave the plugin in a non-compiling state between commits.

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/config/navConfig.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx`
- Delete: `src/plugins/inventory-dashboard/admin/src/config/catalogGroups.ts`
- Delete: `src/plugins/inventory-dashboard/admin/src/components/CatalogSidebar.tsx`
- Delete: `src/plugins/inventory-dashboard/admin/src/pages/CatalogLayout.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/App.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchaseStandalone.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderFormStandalone.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx` (import path only)

**Interfaces:**
- Produces: `TOP_LINKS: NavLink[]`, `CATALOG_GROUPS: CatalogGroup[]`, `type IconComponent` from `navConfig.ts` — Task 3 (`StatCard`) and Task 4 (`CatalogHub` restyle) import `IconComponent` and `CATALOG_GROUPS` from this file. `AppShell` (named export, `{ children: ReactNode }`) — no other task creates or wraps entry points again.

- [ ] **Step 1: Create `navConfig.ts`**

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
```

- [ ] **Step 2: Delete the superseded config file**

```bash
git rm src/plugins/inventory-dashboard/admin/src/config/catalogGroups.ts
```

- [ ] **Step 3: Create `AppSidebar.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { Box, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';

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
      textAlign="left"
      px={3}
      py={2}
      borderRadius="lg"
      bg={isActive ? 'brand.50' : 'transparent'}
      _hover={{ bg: isActive ? 'brand.50' : 'gray.50' }}
      onClick={onClick}
    >
      <HStack spacing={3}>
        <Icon as={IconComp} boxSize={4} color={isActive ? 'brand.700' : 'gray.500'} />
        <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'brand.700' : 'gray.700'}>
          {label}
        </Text>
      </HStack>
    </Box>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box as="nav" w="240px" flexShrink={0} bg="white" borderRightWidth="1px" borderColor="gray.100" minH="100%" py={6} px={4}>
      <VStack align="stretch" spacing={1} pb={6}>
        {TOP_LINKS.map((link) => (
          <NavButton
            key={link.to}
            label={link.label}
            icon={link.icon}
            isActive={isLinkActive(pathname, link.to)}
            onClick={() => navigate(link.to)}
          />
        ))}
      </VStack>

      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="gray.500" mb={2} px={3}>
            {group.label}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const to = `/plugins/inventory-catalog/${item.slug}`;
              return (
                <NavButton
                  key={item.slug}
                  label={item.label}
                  icon={item.icon}
                  isActive={isLinkActive(pathname, to)}
                  onClick={() => navigate(to)}
                />
              );
            })}
          </VStack>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 4: Delete the superseded sidebar**

```bash
git rm src/plugins/inventory-dashboard/admin/src/components/CatalogSidebar.tsx
```

- [ ] **Step 5: Create `AppShell.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
import { Flex, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Flex minH="100%">
      <AppSidebar />
      <Box flex={1}>{children}</Box>
    </Flex>
  );
}
```

- [ ] **Step 6: Delete the superseded layout**

```bash
git rm src/plugins/inventory-dashboard/admin/src/pages/CatalogLayout.tsx
```

- [ ] **Step 7: Wire `AppShell` into `App.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/App.tsx
import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';
import StockPurchase from './StockPurchase';
import OrderForm from './OrderForm';
import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';

const App = () => {
  return (
    <ChakraRoot>
      <AppShell>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="stock-purchase" element={<StockPurchase />} />
          <Route path="orders/new" element={<OrderForm />} />
          <Route path="orders/:id" element={<OrderForm />} />
          <Route path="r/:resource" element={<ResourceListPage />} />
          <Route path="r/:resource/new" element={<ResourceFormPage />} />
          <Route path="r/:resource/:id" element={<ResourceFormPage />} />
          <Route path="*" element={<Page.Error />} />
        </Routes>
      </AppShell>
    </ChakraRoot>
  );
};

export default App;
```

- [ ] **Step 8: Wire `AppShell` into `StockPurchaseStandalone.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/StockPurchaseStandalone.tsx
import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';
import StockPurchase from './StockPurchase';

export default function StockPurchaseStandalone() {
  return (
    <ChakraRoot>
      <AppShell>
        <StockPurchase />
      </AppShell>
    </ChakraRoot>
  );
}
```

- [ ] **Step 9: Wire `AppShell` into `OrderFormStandalone.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrderFormStandalone.tsx
import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';
import OrderForm from './OrderForm';

export default function OrderFormStandalone() {
  return (
    <ChakraRoot>
      <AppShell>
        <OrderForm />
      </AppShell>
    </ChakraRoot>
  );
}
```

- [ ] **Step 10: Wire `AppShell` into `CatalogStandalone.tsx`, removing the now-superseded `CatalogLayout` route nesting**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx
import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';
import CatalogHub from './CatalogHub';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';

export default function CatalogStandalone() {
  return (
    <ChakraRoot>
      <AppShell>
        <Routes>
          <Route index element={<CatalogHub />} />
          <Route path=":resource" element={<ResourceListPage />} />
          <Route path=":resource/new" element={<ResourceFormPage />} />
          <Route path=":resource/:id" element={<ResourceFormPage />} />
          <Route path="*" element={<Page.Error />} />
        </Routes>
      </AppShell>
    </ChakraRoot>
  );
}
```

- [ ] **Step 11: Fix `CatalogHub.tsx`'s import of the now-renamed config**

In `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`, change only the import line:

```tsx
import { CATALOG_GROUPS } from '../config/catalogGroups';
```
to:
```tsx
import { CATALOG_GROUPS } from '../config/navConfig';
```

Nothing else in `CatalogHub.tsx` changes in this task — its own visual restyle (using each item's new `icon` field) happens in Task 4.

- [ ] **Step 12: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors. This confirms no leftover import references the three deleted files.

- [ ] **Step 13: Manual verification**

With `npm run develop` running, log into the Strapi admin and check all 4 entry points:
1. **Overview** (`/plugins/inventory-dashboard`) — sidebar renders on the left with "Overview" highlighted, followed by "Stock Purchase", "New Order", then "Catalog" and "Partners & Pricing" groups (8 items, unstyled counts for now — that's Task 4).
2. **Stock Purchase** (`/plugins/inventory-stock`) — same sidebar, "Stock Purchase" highlighted.
3. **New Order** (`/plugins/inventory-orders`) — same sidebar, "New Order" highlighted.
4. **Catalog** (`/plugins/inventory-catalog`) — same sidebar, landing hub still renders; click into e.g. "Suppliers" and confirm the sidebar persists and "Suppliers" highlights.
5. **Regression check** — from Overview, use the old `r/:resource` routes if reachable, or directly visit `/plugins/inventory-dashboard/r/orders` and `/plugins/inventory-dashboard/r/stock-batches`: confirm both render with the sidebar and "Overview" highlighted (these are the exact targets `OrderForm.tsx`'s Cancel button and `StockPurchase.tsx`'s post-save redirect still navigate to — unchanged in this task, only now wrapped in `AppShell`).
6. Confirm no console errors on any of the above.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(inventory-dashboard): replace fragmented entry points with a unified AppShell/AppSidebar"
```

---

### Task 3: Restyle shared UI primitives (StatCard, DataTable, PageHeader, FormField) + Overview

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`

**Interfaces:**
- Consumes: `type IconComponent` from `navConfig.ts` (Task 2).
- Produces: `StatCard`'s prop shape changes from `{ label, value }` to `{ label, value, icon: IconComponent }` — its only consumer, `Overview.tsx`, is updated in this same task. `DataTable`/`PageHeader`/`FormField` keep their existing prop shapes (visual-only changes) so `ResourceListPage.tsx`, `OrderForm.tsx`, and every `FieldRenderer`/`FormField` caller elsewhere need no changes yet.

- [ ] **Step 1: Rebuild `StatCard` on `Card` with an icon badge**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx
import { Card, CardBody, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { type IconComponent } from '../../config/navConfig';

export function StatCard({ label, value, icon }: { label: string; value: string; icon: IconComponent }) {
  return (
    <Card>
      <CardBody>
        <HStack spacing={4} align="flex-start">
          <VStack align="center" justify="center" bg="brand.50" borderRadius="lg" boxSize={10} flexShrink={0}>
            <Icon as={icon} boxSize={5} color="brand.600" />
          </VStack>
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="sm" color="gray.500" fontWeight="medium">{label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">{value}</Text>
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Rebuild `DataTable` on `Card`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx
import { Card, CardBody, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function DataTable({
  columns, isEmpty, emptyLabel = 'No records found', children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
  return (
    <Card overflow="hidden">
      <CardBody p={0}>
        <TableContainer>
          <Table variant="simple">
            <Thead bg="gray.50">
              <Tr>
                {columns.map((c) => <Th key={c}>{c}</Th>)}
              </Tr>
            </Thead>
            <Tbody>
              {isEmpty ? (
                <Tr>
                  <Td colSpan={columns.length}>
                    <Text color="gray.500" textAlign="center" py={6}>{emptyLabel}</Text>
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

- [ ] **Step 3: Polish `PageHeader`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx
import { Flex, Heading, HStack } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" mb={8}>
      <Heading size="lg" color="gray.800" fontWeight="bold" textTransform="capitalize">{title}</Heading>
      {actions && <HStack spacing={2}>{actions}</HStack>}
    </Flex>
  );
}
```

- [ ] **Step 4: Polish `FormField`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx
import { FormControl, FormLabel, type FormControlProps } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function FormField({
  label, required, children, ...rest
}: { label: string; required?: boolean; children: ReactNode } & FormControlProps) {
  return (
    <FormControl isRequired={required} {...rest}>
      <FormLabel textTransform="capitalize" fontSize="sm" fontWeight="semibold" color="gray.700">{label}</FormLabel>
      {children}
    </FormControl>
  );
}
```

- [ ] **Step 5: Update `Overview.tsx` to pass an icon to each `StatCard`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';

export default function Overview() {
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
      setSaveError('Enter a valid exchange rate');
      return;
    }
    try {
      await save(rateInput);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? 'Could not save rate');
    }
  };

  if (error) {
    return (
      <Box p={8}>
        <Text color="red.600">Could not load overview data</Text>
      </Box>
    );
  }

  if (loading || !data) return <Box p={8}><Text>Loading…</Text></Box>;

  return (
    <Box p={8}>
      <PageHeader title="Overview" />

      <Box pb={6}>
        <HStack spacing={2} align="flex-end">
          <FormField label="Exchange rate (EGP per USD)" maxW="xs">
            <NumberInput value={rateInput ?? ''} onChange={(_, v) => setRateInput(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>Save rate</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="gray.500" pt={1}>Updated: {exchangeRateUpdatedAt}</Text>
        )}
        {saveError && <Text color="red.600" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={4} spacing={4}>
        <StatCard label="Total stock units" value={String(data.totalStockUnits)} icon={FiArchive} />
        <StatCard label="Stock value (USD)" value={`$${data.stockValueUsd.toFixed(2)}`} icon={FiTrendingUp} />
        <StatCard label="Stock value (EGP)" value={`E£${data.stockValueEgp.toFixed(2)}`} icon={FiPieChart} />
        <StatCard label="Exchange rate" value={String(data.exchangeRate)} icon={FiRepeat} />
      </SimpleGrid>

      <Box pt={8}>
        <Text fontSize="lg" fontWeight="semibold" pb={3} color="gray.800">Low stock</Text>
        <DataTable columns={['Variant', 'Qty', 'Threshold']} isEmpty={data.lowStock.length === 0}>
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={8}>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="gray.800">Expired</Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="gray.800">Expiring soon (90 days)</Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0. (This also confirms `ResourceListPage.tsx`/`OrderForm.tsx`, which consume the unchanged `DataTable` API, still compile.)

- [ ] **Step 7: Manual verification**

Visit Overview. Confirm all 4 stat cards show a colored icon badge to the left of the label/value, the Low Stock table renders inside a bordered/shadowed card with no visual regression in its data, and the page still loads/reloads exchange-rate data correctly.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx \
        src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx \
        src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx \
        src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx \
        src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
git commit -m "feat(inventory-dashboard): restyle StatCard/DataTable/PageHeader/FormField on Card, add icon badges"
```

---

### Task 4: Restyle CatalogHub

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`

**Interfaces:**
- Consumes: `CATALOG_GROUPS` (now including `icon` per item) from `navConfig.ts` (Task 2); the `Card`/icon-badge visual pattern established by `StatCard` (Task 3).

- [ ] **Step 1: Rewrite `CatalogHub.tsx`'s card grid on `Card` with icon badges**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { useEffect, useState } from 'react';
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CATALOG_GROUPS } from '../config/navConfig';

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
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
      <PageHeader title="Catalog" />
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} pb={8}>
          <Heading size="md" color="gray.800" pb={4}>
            {group.label}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {group.items.map((item) => (
              <Card
                key={item.slug}
                as="button"
                textAlign="left"
                cursor="pointer"
                transition="box-shadow 0.15s, border-color 0.15s"
                _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                onClick={() => navigate(item.slug)}
              >
                <CardBody>
                  <HStack spacing={4} align="flex-start">
                    <VStack align="center" justify="center" bg="brand.50" borderRadius="lg" boxSize={10} flexShrink={0}>
                      <Icon as={item.icon} boxSize={5} color="brand.600" />
                    </VStack>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontSize="sm" color="gray.500" fontWeight="medium">
                        {item.label}
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="gray.800">
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

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0.

- [ ] **Step 3: Manual verification**

Visit `/plugins/inventory-catalog`. Confirm each of the 8 entity cards shows a distinct icon badge, live counts still populate (cross-check one, e.g. Brands, against `/plugins/inventory-dashboard/r/brands`'s row count), and clicking a card still navigates to that entity's list.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
git commit -m "feat(inventory-dashboard): restyle CatalogHub cards with icon badges"
```

---

### Task 5: Restyle StockPurchase

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`

**Interfaces:**
- No interface changes — same props/state/API calls, wraps the existing form grid in a `Card`.

- [ ] **Step 1: Wrap the form body in a `Card`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';

export default function StockPurchase() {
  const api = useApi();
  const navigate = useNavigate();
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

  const submit = async () => {
    setError(null);
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
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not record purchase');
    }
  };

  return (
    <Box p={8}>
      <PageHeader title="Record stock purchase" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label="Product">
                <Select bg="white" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Select product">
                  {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Variant">
                <Select
                  bg="white"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  isDisabled={!productId}
                  placeholder="Select variant"
                >
                  {variants.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Supplier">
                <Select bg="white" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
                  {suppliers.map((s) => <option key={s.documentId} value={s.documentId}>{s.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Quantity purchased">
                <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Cost price (USD)">
                <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={4} />
            <GridItem colSpan={4}>
              <FormField label="Purchase date">
                <Input bg="white" type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Production date">
                <Input bg="white" type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Expiry date">
                <Input bg="white" type="date" value={expiryDate ?? ''} onChange={(e) => setExpiryDate(e.target.value || null)} />
              </FormField>
            </GridItem>
          </Grid>
          <HStack spacing={2} pt={6}>
            <Button onClick={submit} isDisabled={!variantId || !supplierId || !qty || !cost || !purchaseDate}>
              Record purchase
            </Button>
          </HStack>
        </CardBody>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0.

- [ ] **Step 3: Manual verification**

Visit Stock Purchase. Confirm the form now sits inside a bordered/shadowed card, and record a real stock purchase end-to-end (product → variant → supplier → quantity/cost/dates → submit) to confirm no functional regression; verify it still redirects to `/plugins/inventory-dashboard/r/stock-batches` after submit.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
git commit -m "feat(inventory-dashboard): restyle StockPurchase form on Card"
```

---

### Task 6: Restyle OrderForm and ProductVariantsForm

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`

**Interfaces:**
- No interface changes — `OrderForm`'s `ConfirmedOrderView` internal component and `ProductVariantsForm`'s `{ onDone }` prop are unchanged.

- [ ] **Step 1: Wrap `OrderForm.tsx`'s sections in `Card`s (both the draft-building view and `ConfirmedOrderView`)**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';

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

export default function OrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
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

  const addLine = async () => {
    if (!addVariantId || !priceListId) return;
    setError(null);
    // FIFO segments for the chosen variant + quantity
    const fifo = await api.get<{ segments: any[]; shortfall: number }>(
      `/fifo/${addVariantId}`, { quantity: addQty ?? 1 }
    );
    if (fifo.shortfall > 0) setError(`Not enough stock: short by ${fifo.shortfall} unit(s).`);

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
        variantLabel: variant?.label ?? 'Default',
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
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not save order');
    }
  };

  const onConfirm = async () => {
    setError(null);
    try { await confirm(); reload(); }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Could not confirm order'); }
  };

  // ----- confirmed view (read-only lines + payments) -----
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} />;
  }

  return (
    <Box p={8}>
      <PageHeader title="New order" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}

      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label="Customer">
                <Select bg="white" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Select customer">
                  {customers.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Order date">
                <Input bg="white" type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
              </FormField>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="gray.800">Add product</Text>
        <Card>
          <CardBody>
            <Grid templateColumns="repeat(12, 1fr)" gap={4}>
              <GridItem colSpan={4}>
                <FormField label="Product">
                  <Select
                    bg="white"
                    value={addProductId}
                    onChange={(e) => { setAddProductId(e.target.value); setAddVariantId(''); }}
                    placeholder="Select product"
                  >
                    {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                  </Select>
                </FormField>
              </GridItem>
              <GridItem colSpan={4}>
                <FormField label="Variant">
                  <Select
                    bg="white"
                    value={addVariantId}
                    onChange={(e) => setAddVariantId(e.target.value)}
                    isDisabled={!addProductId}
                    placeholder="Select variant"
                  >
                    {variantsForProduct.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</option>)}
                  </Select>
                </FormField>
              </GridItem>
              <GridItem colSpan={3}>
                <FormField label="Quantity">
                  <NumberInput value={addQty ?? ''} onChange={(_, v) => setAddQty(Number.isNaN(v) ? undefined : v)}>
                    <NumberInputField bg="white" />
                  </NumberInput>
                </FormField>
              </GridItem>
              <GridItem colSpan={1} display="flex" alignItems="flex-end">
                <Button onClick={addLine} isDisabled={!addVariantId}>Add</Button>
              </GridItem>
            </Grid>
          </CardBody>
        </Card>
      </Box>

      {relatedSuggestions.length > 0 && (
        <Box mt={4} bg="brand.50" p={3} borderRadius="lg">
          <Text as="span" fontSize="sm">Customers also buy:&nbsp;</Text>
          {relatedSuggestions.map((rp: any) => (
            <Button
              key={rp.documentId}
              variant="link"
              size="sm"
              mr={2}
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}
            >
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box pt={6}>
        <DataTable columns={['Variant', 'Batch', 'Qty', 'Sell (EGP)', 'Cost EGP', 'Flag']} isEmpty={draftLines.length === 0}>
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
                    <NumberInputField aria-label="sell" />
                  </NumberInput>
                </Td>
                <Td>{costEgp.toFixed(2)}</Td>
                <Td>{below ? <Badge colorScheme="red">Below cost</Badge> : null}</Td>
              </Tr>
            );
          })}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={6}>
        <GridItem colSpan={4}>
          <FormField label="Discount (EGP)">
            <NumberInput value={discount ?? ''} onChange={(_, v) => setDiscount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text>Subtotal: {subtotal.toFixed(2)} EGP</Text>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text fontSize="lg" fontWeight="semibold">Total: {finalTotal.toFixed(2)} EGP</Text>
        </GridItem>
      </Grid>

      <HStack spacing={2} pt={6}>
        <Button onClick={saveDraft} isDisabled={!customerId || draftLines.length === 0}>Save draft</Button>
        {id && <Button colorScheme="green" onClick={onConfirm}>Confirm order</Button>}
        <Button variant="ghost" onClick={() => navigate('/plugins/inventory-dashboard/r/orders')}>Cancel</Button>
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
        <Text fontSize="lg" fontWeight="bold" color="gray.800">{`Order ${order.documentId.slice(0, 8)}`}</Text>
        <Badge fontSize="sm">{order.status}</Badge>
      </HStack>

      <DataTable columns={['Variant', 'Qty', 'Sell', 'Cost USD snap', 'Flag']} isEmpty={order.lines.length === 0}>
        {order.lines.map((l: any) => (
          <Tr key={l.documentId}>
            <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
            <Td>{l.quantitySold}</Td>
            <Td>{l.sellPrice}</Td>
            <Td>{l.costPriceUsdSnapshot}</Td>
            <Td>{l.belowCost ? <Badge colorScheme="red">Below cost</Badge> : null}</Td>
          </Tr>
        ))}
      </DataTable>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" color="gray.800">Totals</Text>
        <Text>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Text>
        <Text>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="gray.800">Record payment</Text>
        <Card>
          <CardBody>
            <HStack spacing={2} align="flex-end">
              <FormField label="Amount">
                <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
              <FormField label="Method">
                <Select bg="white" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">cash</option>
                  <option value="transfer">transfer</option>
                </Select>
              </FormField>
              <Button onClick={addPayment} isDisabled={!amount}>Add payment</Button>
            </HStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Wrap `ProductVariantsForm.tsx`'s sections in `Card`s**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
import { useEffect, useState } from 'react';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, IconButton, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';

interface VariantRow { label: string; variantTypeId: string; lowStockThreshold?: number; }

export default function ProductVariantsForm({ onDone }: { onDone: () => void }) {
  const api = useApi();
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

  const save = async () => {
    setError(null);
    // Only submit rows the user actually filled in. A non-default variant must
    // have a variant type (enforced by the variant lifecycle), so reject any
    // partially-filled row up front — otherwise the POST would throw mid-loop,
    // after the product and earlier variants are already persisted, leaving a
    // half-built product behind with no rollback.
    const explicitVariants = rows.filter((r) => r.label.trim() || r.variantTypeId);
    if (explicitVariants.some((r) => !r.variantTypeId)) {
      setError('Each variant needs a type.');
      return;
    }
    try {
      // 1) create product (auto-creates one default variant)
      const product = await api.post<any>('/resources/products', {
        name, brand: brandId, category: categoryId,
        relatedProducts: relatedIds,
      });

      // 2) create explicit variants
      for (const row of explicitVariants) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: product.documentId,
        });
      }

      // 3) if explicit variants exist, delete the auto-created default
      if (explicitVariants.length > 0) {
        const all = await api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 });
        const auto = all.results.find(
          (v) => v.product?.documentId === product.documentId && v.isDefault
        );
        if (auto) await api.del(`/resources/variants/${auto.documentId}`);
      }

      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not create product');
    }
  };

  return (
    <Box p={8}>
      <PageHeader title="New product" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label="Name">
                <Input bg="white" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Brand">
                <Select bg="white" value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="Select brand">
                  {brands.map((b) => <option key={b.documentId} value={b.documentId}>{b.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Category">
                <Select bg="white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Select category">
                  {categories.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      <Box pt={6}>
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="semibold" color="gray.800">Variants (optional)</Text>
          <Button variant="outline" onClick={addRow}>Add variant</Button>
        </HStack>
        {rows.length > 0 && (
          <Card mt={2}>
            <CardBody>
              {rows.map((row, i) => (
                <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={i === 0 ? 0 : 4}>
                  <GridItem colSpan={4}>
                    <FormField label="Label">
                      <Input bg="white" value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
                    </FormField>
                  </GridItem>
                  <GridItem colSpan={4}>
                    <FormField label="Type">
                      <Select
                        bg="white"
                        value={row.variantTypeId}
                        onChange={(e) => updateRow(i, { variantTypeId: e.target.value })}
                        placeholder="Select type"
                      >
                        {variantTypes.map((t) => <option key={t.documentId} value={t.documentId}>{t.name}</option>)}
                      </Select>
                    </FormField>
                  </GridItem>
                  <GridItem colSpan={3}>
                    <FormField label="Low-stock threshold">
                      <NumberInput
                        value={row.lowStockThreshold ?? ''}
                        onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                      >
                        <NumberInputField bg="white" />
                      </NumberInput>
                    </FormField>
                  </GridItem>
                  <GridItem colSpan={1} display="flex" alignItems="flex-end">
                    <IconButton aria-label="Remove" icon={<FiTrash2 />} onClick={() => removeRow(i)} />
                  </GridItem>
                </Grid>
              ))}
            </CardBody>
          </Card>
        )}
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="gray.800">Related products (cross-sell)</Text>
        <Card>
          <CardBody>
            <FormField label="Add related product">
              <Select
                bg="white"
                value=""
                onChange={(e) => setRelatedIds((ids) => (ids.includes(e.target.value) ? ids : [...ids, e.target.value]))}
                placeholder="Select product"
              >
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
            <Box pt={2}>
              {relatedIds.map((id) => {
                const p = products.find((x) => x.documentId === id);
                return <Text key={id} display="inline-block" pr={2}>{p?.name ?? id}</Text>;
              })}
            </Box>
          </CardBody>
        </Card>
      </Box>

      <HStack spacing={2} pt={6}>
        <Button onClick={save} isDisabled={!name || !brandId || !categoryId}>Create product</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </HStack>
    </Box>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0.

- [ ] **Step 4: Manual verification**

1. Build a draft order end-to-end (customer → add product/variant/qty → confirm draft saves, total/subtotal still compute correctly) and confirm Cancel still lands on `/plugins/inventory-dashboard/r/orders`.
2. Confirm an order to reach `ConfirmedOrderView`, add a payment, confirm totals/payment recording still work.
3. Create a new product via `/plugins/inventory-catalog/products/new` (the bespoke `ProductVariantsForm` flow), add at least one variant row, submit, and confirm it still creates correctly and redirects back to the products list.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx \
        src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
git commit -m "feat(inventory-dashboard): restyle OrderForm and ProductVariantsForm on Card"
```

---

### Task 7: Restyle ResourceListPage and ResourceFormPage

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`

**Interfaces:**
- No interface changes. `ResourceFormPage.tsx`'s three `navigate('..', { relative: 'path' })` calls (submit-success, `ProductVariantsForm.onDone`, Cancel button) are copied verbatim — untouched per Global Constraints.

- [ ] **Step 1: Polish `ResourceListPage.tsx`'s search bar and delete-confirmation dialog**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, IconButton, Input,
  InputGroup, InputLeftElement, InputRightElement, Text, Td, Tr,
} from '@chakra-ui/react';
import { FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
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
      setError(e?.response?.data?.error?.message ?? 'Delete failed');
      setToDelete(null);
    }
  };

  return (
    <Box p={8}>
      <PageHeader
        title={resource}
        actions={<Button onClick={() => navigate('new')}>New</Button>}
      />

      <Box pb={4}>
        <InputGroup maxW="sm">
          <InputLeftElement pointerEvents="none"><FiSearch color="var(--chakra-colors-gray-400)" /></InputLeftElement>
          <Input
            aria-label="Search"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg="white"
          />
          {search && (
            <InputRightElement>
              <IconButton
                aria-label="Clear search"
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
        columns={[...visibleFields.map((f) => f.name), 'Actions']}
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <Tr
            key={row.documentId}
            cursor="pointer"
            _hover={{ bg: 'gray.50' }}
            onClick={() => navigate(row.documentId)}
          >
            {visibleFields.map((f) => (
              <Td key={f.name}>{renderCell(row[f.name])}</Td>
            ))}
            <Td onClick={(e) => e.stopPropagation()}>
              <IconButton
                aria-label="Delete"
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
            <AlertDialogHeader>Confirm delete</AlertDialogHeader>
            <AlertDialogBody>Delete this record? This cannot be undone.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
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

- [ ] **Step 2: Wrap `ResourceFormPage.tsx`'s field grid in a `Card`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';

export default function ResourceFormPage() {
  const { resource = '', id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
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
      setError(e?.response?.data?.error?.message ?? 'Save failed');
    }
  };

  // Bespoke product-with-variants flow on create
  if (resource === 'products' && !isEdit) {
    return <ProductVariantsForm onDone={() => navigate('..', { relative: 'path' })} />;
  }

  return (
    <Box p={8}>
      <PageHeader title={isEdit ? `Edit ${resource}` : `New ${resource}`} />
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
        <Button onClick={submit}>Save</Button>
        <Button variant="ghost" onClick={() => navigate('..', { relative: 'path' })}>Cancel</Button>
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

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0.

- [ ] **Step 4: Manual verification**

Run a full CRUD cycle on one Catalog entity (e.g. Categories, same as the Catalog hub work's own verification): create, edit, delete, confirming the field grid now sits inside a card, the search bar and delete dialog still work, and Cancel/Save still navigate back to the entity's list under both the Catalog tree (`/plugins/inventory-catalog/categories`) and, if reachable, the old flat tree (`/plugins/inventory-dashboard/r/categories`, if `categories` happens to still be reachable there — otherwise skip, since Catalog is now the primary path for master-data entities).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx \
        src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
git commit -m "feat(inventory-dashboard): restyle ResourceListPage and ResourceFormPage on Card"
```

---

### Task 8: Final manual verification

No code changes — this task is a full click-through of the reskinned plugin, mirroring the verification depth used at the end of the Catalog hub work.

- [ ] **Step 1: Full type-check and build**

```bash
cd src/plugins/inventory-dashboard && npm run test:ts:front
cd ../../.. && npm run build
```
Expected: both exit 0.

- [ ] **Step 2: Click through all 4 entry points**

With `npm run develop` running and logged into the admin:
1. **Overview** — sidebar present, "Overview" highlighted, 4 icon-badge stat cards, Low Stock table styled, Expired/Expiring panels intact.
2. **Stock Purchase** — sidebar present, "Stock Purchase" highlighted, form in a card, full submit cycle works, redirects to `r/stock-batches`.
3. **New Order** — sidebar present, "New Order" highlighted, draft-building form in cards, add a line, save draft, confirm order, add a payment in `ConfirmedOrderView`, Cancel still goes to `r/orders`.
4. **Catalog** — sidebar present, "Catalog" section highlighted correctly per sub-item, hub cards show icons + live counts, full CRUD cycle on one entity.

- [ ] **Step 3: Regression-check navigation targets carried over from the Catalog hub work**

Confirm `OrderForm.tsx`'s Cancel button and `StockPurchase.tsx`'s post-save redirect still land on `/plugins/inventory-dashboard/r/orders` and `/plugins/inventory-dashboard/r/stock-batches` respectively, now rendered inside `AppShell` with "Overview" highlighted in the sidebar.

- [ ] **Step 4: Console error check**

Confirm no console errors across all of the above (browser DevTools console, checked page-by-page).

- [ ] **Step 5: Record completion**

No commit needed for this task (verification only) unless issues are found and fixed, in which case follow the fix + re-verify + commit pattern from earlier tasks.
