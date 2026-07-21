# Catalog Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable "Catalog" hub to the `inventory-dashboard` Strapi plugin — a persistent sidebar + landing page covering the 8 master-data entities (Products, Variants, Variant Types, Categories, Brands, Suppliers, Customers, Price Lists) — reusing the existing generic CRUD engine unmodified.

**Architecture:** A new 4th standalone admin entry point (`CatalogStandalone.tsx`, mirroring `StockPurchaseStandalone`/`OrderFormStandalone`) registered as a new "Catalog" menu link at `/plugins/inventory-catalog`. Its route tree wraps `ResourceListPage`/`ResourceFormPage` — reused completely unmodified in behavior — inside a new `CatalogLayout` (sidebar + outlet). No backend changes: `config/resources.ts` and all `/resources/*` routes stay exactly as they are.

**Tech Stack:** React 18, Chakra UI v2.10, react-router-dom v6, TypeScript. No new npm dependencies.

**Design doc:** `docs/superpowers/specs/2026-07-21-catalog-hub-design.md`

## Global Constraints

- **No backend changes.** `server/src/config/resources.ts`, the metadata service, and all `/resources/*` routes must not change.
- **No new npm dependencies.** Everything needed (`@chakra-ui/react`, `react-icons`, `@strapi/icons`, `react-router-dom`) is already installed.
- **Preserve existing navigation exactly.** `OrderForm.tsx`'s cancel button (→ `/plugins/inventory-dashboard/r/orders`) and `StockPurchase.tsx`'s post-save redirect (→ `/plugins/inventory-dashboard/r/stock-batches`) must resolve to the identical URLs after this plan as before it. `App.tsx`'s existing `r/:resource` routes must keep working unchanged.
- **`ResourceListPage.tsx` and `ResourceFormPage.tsx` behavior is otherwise unmodified** — same schema-driven fields, same bespoke product-with-variants create flow, same delete-confirmation dialog. The only permitted change to these two files is switching their internal `navigate()` calls from absolute paths to relative ones (Task 2).
- **Menu path naming convention:** existing standalone entries use `inventory-stock`, `inventory-orders` — the new one must be `inventory-catalog`.
- **Every new standalone entry point wraps `ChakraRoot` exactly once** (matches the plugin's established "exactly one ChakraProvider ancestor" invariant across all its independent entry points).
- **No automated frontend test harness exists in this plugin** (pre-existing, not something this plan introduces). Verification is `tsc --noEmit` (`npm run test:ts:front` from the plugin directory) after every task, a full `npm run build` after the two tasks that touch routing/bundling (Task 2, Task 5), and a manual click-through in the final task — consistent with how every prior task in this plugin's Chakra UI migration was verified.

---

### Task 1: Shared catalog group config

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/config/catalogGroups.ts`

**Interfaces:**
- Produces: `CatalogGroup` type, `CATALOG_GROUPS: CatalogGroup[]` — consumed by Task 3 (`CatalogSidebar.tsx`) and Task 4 (`CatalogHub.tsx`) for both the grouped nav list and the grouped card grid. This is the single source of truth for which entities appear in the hub; adding a 9th entity later means adding one object here.

- [ ] **Step 1: Create the config file**

```ts
// src/plugins/inventory-dashboard/admin/src/config/catalogGroups.ts

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
```

Every `slug` here must exactly match a key in `server/src/config/resources.ts`'s `RESOURCES` map — `products`, `variants`, `variant-types`, `categories`, `brands`, `suppliers`, `customers`, `price-lists` all already exist there, so no backend change is needed.

- [ ] **Step 2: Type-check**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/config/catalogGroups.ts
git commit -m "feat(plugin/admin): add catalog group config"
```

---

### Task 2: Generalize ResourceListPage/ResourceFormPage to relative navigation

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no interface change — same components, same props (none), same exported default. Only their internal `navigate()` call targets change from absolute to relative, so they resolve correctly under both the existing `/plugins/inventory-dashboard/r/:resource` tree (untouched, still used by `App.tsx`, `OrderForm.tsx`, `StockPurchase.tsx`) and the new `/plugins/inventory-catalog/:resource` tree that Task 5 adds.

React Router v6's `navigate()` resolves a target without a leading `/` relative to the current matched route. Both pages are always rendered as the leaf of a `:resource`-shaped route (`r/:resource`, `r/:resource/new`, `r/:resource/:id` today; `:resource`, `:resource/new`, `:resource/:id` under the new tree), so relative resolution produces the exact same absolute URL as the current hardcoded string in the existing tree, and the correct URL in the new tree.

- [ ] **Step 1: Update `ResourceListPage.tsx`**

Change the "New" button's `onClick` (currently hardcodes the full path):

```tsx
// Before
actions={<Button onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/new`)}>New</Button>}
```

```tsx
// After
actions={<Button onClick={() => navigate('new')}>New</Button>}
```

Change the row click handler:

```tsx
// Before
onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/${row.documentId}`)}
```

```tsx
// After
onClick={() => navigate(row.documentId)}
```

- [ ] **Step 2: Update `ResourceFormPage.tsx`**

Change the post-save-success navigation:

```tsx
// Before
navigate(`/plugins/inventory-dashboard/r/${resource}`);
```

```tsx
// After
navigate('..');
```

Change the bespoke product-with-variants flow's `onDone`:

```tsx
// Before
return <ProductVariantsForm onDone={() => navigate('/plugins/inventory-dashboard/r/products')} />;
```

```tsx
// After
return <ProductVariantsForm onDone={() => navigate('..')} />;
```

Change the Cancel button:

```tsx
// Before
<Button variant="ghost" onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}`)}>Cancel</Button>
```

```tsx
// After
<Button variant="ghost" onClick={() => navigate('..')}>Cancel</Button>
```

- [ ] **Step 3: Type-check and build**

Run (from `src/plugins/inventory-dashboard`):
```bash
npm run test:ts:front
npm run build
```
Expected: both succeed with no errors. The build step matters here specifically because this task changes behavior relied on by `App.tsx`'s routing (not just isolated components) — a clean build is the closest available signal short of a live click-through, which happens in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
git commit -m "refactor(plugin/admin): use relative navigation in ResourceListPage/ResourceFormPage"
```

---

### Task 3: CatalogLayout + CatalogSidebar

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/pages/CatalogLayout.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/CatalogSidebar.tsx`

**Interfaces:**
- Consumes: `CATALOG_GROUPS` from `../config/catalogGroups` (Task 1).
- Produces: `CatalogLayout` default export — a layout route element used by Task 5's route tree (`<Route element={<CatalogLayout />}>`). `CatalogSidebar` named export, used only internally by `CatalogLayout`.

- [ ] **Step 1: Create `CatalogSidebar.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/CatalogSidebar.tsx
import { Box, Heading, VStack, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CATALOG_GROUPS } from '../config/catalogGroups';

export function CatalogSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      as="nav"
      w="240px"
      flexShrink={0}
      bg="white"
      borderRightWidth="1px"
      borderColor="gray.100"
      minH="100%"
      py={6}
      px={4}
    >
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="gray.500" mb={2} px={2}>
            {group.label}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const isActive = pathname.startsWith(`/plugins/inventory-catalog/${item.slug}`);
              return (
                <Box
                  key={item.slug}
                  as="button"
                  textAlign="left"
                  px={2}
                  py={2}
                  borderRadius="md"
                  bg={isActive ? 'brand.50' : 'transparent'}
                  _hover={{ bg: isActive ? 'brand.50' : 'gray.50' }}
                  onClick={() => navigate(`/plugins/inventory-catalog/${item.slug}`)}
                >
                  <Text
                    fontSize="sm"
                    fontWeight={isActive ? 'semibold' : 'normal'}
                    color={isActive ? 'brand.700' : 'gray.700'}
                  >
                    {item.label}
                  </Text>
                </Box>
              );
            })}
          </VStack>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Create `CatalogLayout.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogLayout.tsx
import { Flex, Box } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { CatalogSidebar } from '../components/CatalogSidebar';

export default function CatalogLayout() {
  return (
    <Flex minH="100%">
      <CatalogSidebar />
      <Box flex={1}>
        <Outlet />
      </Box>
    </Flex>
  );
}
```

Note: the content `Box` deliberately carries no `p={8}` — `CatalogHub`, `ResourceListPage`, and `ResourceFormPage` each already wrap their own content in `<Box p={8}>`, so adding padding here would double it.

- [ ] **Step 3: Type-check**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors. (`CatalogLayout` is not yet referenced by any route, so this only proves the two new files compile — routing wire-up is Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/CatalogLayout.tsx src/plugins/inventory-dashboard/admin/src/components/CatalogSidebar.tsx
git commit -m "feat(plugin/admin): add CatalogLayout and CatalogSidebar"
```

---

### Task 4: CatalogHub landing page

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`

**Interfaces:**
- Consumes: `CATALOG_GROUPS` from `../config/catalogGroups` (Task 1); `useApi()` from `../utils/api` (existing, unmodified — `api.get<T>(path, params)`); `PageHeader` from `../components/ui/PageHeader` (existing, unmodified).
- Produces: `CatalogHub` default export — the index-route element used by Task 5's route tree.

- [ ] **Step 1: Create `CatalogHub.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { useEffect, useState } from 'react';
import { Box, Heading, SimpleGrid, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CATALOG_GROUPS } from '../config/catalogGroups';

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
              <Box
                key={item.slug}
                as="button"
                textAlign="left"
                bg="white"
                borderRadius="xl"
                boxShadow="sm"
                borderWidth="1px"
                borderColor="gray.100"
                p={5}
                _hover={{ borderColor: 'brand.200', boxShadow: 'md' }}
                onClick={() => navigate(item.slug)}
              >
                <Text fontSize="sm" color="gray.500" fontWeight="medium">
                  {item.label}
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color="gray.800" mt={1}>
                  {counts[item.slug] ?? '—'}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
  );
}
```

`navigate(item.slug)` is relative: `CatalogHub` is always rendered at the index route (`/plugins/inventory-catalog`), so `navigate('products')` resolves to `/plugins/inventory-catalog/products`.

- [ ] **Step 2: Type-check**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
git commit -m "feat(plugin/admin): add CatalogHub landing page"
```

---

### Task 5: CatalogStandalone entry point + menu registration

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/index.ts`

**Interfaces:**
- Consumes: `ChakraRoot` (existing), `CatalogLayout`/`CatalogHub` (Tasks 3/4), `ResourceListPage`/`ResourceFormPage` (existing, generalized in Task 2), `PLUGIN_ID` (existing, from `./pluginId`).
- Produces: the plugin's 4th independent admin entry point, registered as a new top-level Strapi admin menu link.

- [ ] **Step 1: Create `CatalogStandalone.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx
import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import { ChakraRoot } from '../components/ChakraRoot';
import CatalogLayout from './CatalogLayout';
import CatalogHub from './CatalogHub';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';

export default function CatalogStandalone() {
  return (
    <ChakraRoot>
      <Routes>
        <Route element={<CatalogLayout />}>
          <Route index element={<CatalogHub />} />
          <Route path=":resource" element={<ResourceListPage />} />
          <Route path=":resource/new" element={<ResourceFormPage />} />
          <Route path=":resource/:id" element={<ResourceFormPage />} />
        </Route>
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </ChakraRoot>
  );
}
```

- [ ] **Step 2: Register the menu link in `index.ts`**

Add `Folder` to the existing `@strapi/icons` import:

```ts
// Before
import { Database, Briefcase, ShoppingCart } from "@strapi/icons";
```

```ts
// After
import { Database, Briefcase, ShoppingCart, Folder } from "@strapi/icons";
```

Add a new `addMenuLink` call after the existing "New Order" registration (still inside `register(app) { ... }`, before the closing `app.registerPlugin({...})` call):

```ts
app.addMenuLink({
  to: `/plugins/inventory-catalog`,
  icon: Folder,
  intlLabel: {
    id: `${PLUGIN_ID}.menu.catalog`,
    defaultMessage: 'Catalog',
  },
  Component: () => import("./pages/CatalogStandalone"),
  permissions: [],
});
```

- [ ] **Step 3: Type-check and build**

Run (from `src/plugins/inventory-dashboard`):
```bash
npm run test:ts:front
npm run build
```
Expected: both succeed with no errors. This is the task that wires everything into the actual Strapi admin menu, so a clean build here confirms the new entry point bundles correctly.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx src/plugins/inventory-dashboard/admin/src/index.ts
git commit -m "feat(plugin/admin): register Catalog menu entry point"
```

---

### Task 6: Final verification pass

**Files:** none (verification only — no code changes expected unless this step surfaces a defect, in which case fix it, re-run the checks below, and commit the fix before considering this task done).

**Interfaces:** none.

This task has no unit under test in isolation — it's the full click-through of everything Tasks 1-5 built together, plus a regression check on the one existing behavior Task 2 touched.

- [ ] **Step 1: Automated gates**

From the repo root:
```bash
npm test
```
From `src/plugins/inventory-dashboard`:
```bash
npm run test:ts:front
npm run test:ts:back
npm run build
```
Expected: all clean (no new backend tests are needed or expected — this plan makes no backend changes, so the existing suite count should be unchanged from before this plan).

- [ ] **Step 2: Start the app and log in**

Use whichever driver this project already has set up for manual admin verification (Playwright scripts under the scratchpad, or a fresh login if the session has gone stale — this has happened before in this project and is resolved by re-running the login script).

- [ ] **Step 3: Hub landing page**

Click the new "Catalog" menu item. Confirm:
- Two groups render: "Catalog" (Products, Variants, Variant Types, Categories, Brands) and "Partners & Pricing" (Suppliers, Customers, Price Lists).
- Each card shows a count. Spot-check at least 2 counts against the actual row count for that entity (e.g. via the existing `/plugins/inventory-dashboard/r/<slug>` list page, or Strapi's own Content Manager) to confirm the count isn't off-by-one or always zero.
- No console errors.

- [ ] **Step 4: Sidebar + generic CRUD parity**

From the hub, click into at least 3 of the 8 entities (pick ones spanning both groups, e.g. one of Products/Variants/Categories and one of Suppliers/Price Lists). For each:
- Confirm the sidebar highlights the active entity.
- Confirm the list page loads and matches what the old `/plugins/inventory-dashboard/r/<slug>` URL shows for the same entity (same rows, same columns).
- Do one full create → edit → delete cycle on a low-risk entity (e.g. `categories` or `brands`) to confirm the relative-navigation change (Task 2) didn't break the save/cancel/delete flow.

- [ ] **Step 5: Regression check on existing navigation**

Confirm the two call sites Task 2 touched indirectly still behave identically:
- Open an existing order, click Cancel — confirm it still lands on `/plugins/inventory-dashboard/r/orders` (not `/plugins/inventory-catalog/...`).
- Complete a stock purchase — confirm the post-save redirect still lands on `/plugins/inventory-dashboard/r/stock-batches`.
- Open `/plugins/inventory-dashboard/r/products/new` directly (the old entry point) and confirm the bespoke product-with-variants create flow still works and still redirects back to `/plugins/inventory-dashboard/r/products` on completion.

- [ ] **Step 6: Record results**

Append a dated entry to `.superpowers/sdd/progress.md` (or wherever this project's SDD ledger lives) summarizing: automated gate results, manual findings, and whether any fixes were needed. If fixes were needed, they should already be committed by this point with their own commit message; note the commit hash(es) here.
