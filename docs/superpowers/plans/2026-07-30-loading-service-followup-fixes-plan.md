# Loading Service Follow-Up Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the four items parked in the final review of the loading-service feature (see `docs/superpowers/specs/2026-07-30-loading-service-design.md` and the completed plan at `docs/superpowers/plans/2026-07-30-loading-service-plan.md`): drop the dead `loading` field from four hooks, make the top progress bar visible during modal/wizard flows, migrate `CatalogHub.tsx` and `RelationSelect.tsx` (the two sites specifically named in that review) to `useAsyncResource`, and stop Overview from blanking to an error box on a failed background reload.

> **Post-implementation correction (added after the final whole-branch review):** the phrase "the two remaining hand-rolled fetches" above understated the plugin's actual state — `OrderForm.tsx`, `StockPurchase.tsx`, and `ProductVariantsForm.tsx` each also hand-roll `useEffect`/`useState` option-list fetches (and, unlike `RelationSelect`'s old code, none of them has a `.catch()` at all, so a failed request there is an unhandled promise rejection). This plan did not migrate those three — they were never in its scope — but they should not be read as "already covered." See `docs/implementation.md` §10 for this as a tracked known limitation.

**Architecture:** No new infrastructure. Every task edits existing files in place, reusing `useAsyncResource` (`admin/src/hooks/useAsyncResource.ts`) and `LoadingState` (`admin/src/components/ui/LoadingState.tsx`) exactly as the loading-service feature already established. Two small technical decisions were made during planning (not left to implementers), both of which were revised after the final whole-branch review:
1. **Progress bar z-index fix:** `TopProgressBar` currently renders `position="absolute"` inside `AppShell`'s content `Box` (which has `position="relative"`), so it never escapes Chakra's `Modal` overlay (Chakra's default `overlay`/`modal` z-index is 1400). Fix: change the bar to `position="fixed"` with `zIndex={1500}`, and drop the now-unneeded `position="relative"` from `AppShell`'s content `Box` (verified no other element in the plugin relies on it as a positioning ancestor — it was added solely for this bar). `ChakraRoot`/`ThemedShell` apply no `transform`/`filter`/`opacity` that would trap fixed-position descendants, so this works everywhere the bar is mounted. **Revision:** the final review pointed out that Strapi's own admin shell — which wraps this plugin's mount point and is outside this codebase — could still apply a transform/filter ancestor that traps a merely-fixed-position element, the same risk Chakra's own `Modal` avoids by portaling to `document.body`. The bar was changed to render inside a Chakra `<Portal>` for the same reason, which makes the ancestor-stacking-context question moot rather than requiring it to be verified.
2. **Overview stale-data-on-error:** reorder the existing `error` / `isInitialLoading` checks so the full-page error box only appears when there is **no data at all** (first load failed). Once `data` exists, a later failed reload renders the page normally with the last-loaded data, plus a small inline red text banner above the content — never the blocking error box again. **Revision:** the inline banner's JSX condition is `error != null && (...)`, not `error && (...)` as originally drafted in Task 5 below — `error` is typed `unknown` (from `useAsyncResource`), and TypeScript rejects `unknown && JSX` as a `ReactNode`. `error != null` narrows to `boolean` first, which type-checks, and matches this plugin's existing idiom for the same situation (`loadError != null` in `OrdersList.tsx`/`ResourceListPage.tsx`). If replaying Task 5's code block verbatim, use this corrected condition, not the literal text below.

**Tech Stack:** Same as the rest of the plugin — React 18, Chakra UI v2, `react-intl`, TypeScript (strict `admin/tsconfig.json`).

## Global Constraints

- Every task's frontend change must type-check clean: `cd src/plugins/inventory-dashboard && npm run test:ts:front` (this is `tsc -p admin/tsconfig.json --noEmit`, strict — catches unused locals/vars and `noImplicitAny`).
- There is no frontend automated test harness for this plugin's admin UI (confirmed in `docs/implementation.md` §8) — verification per task is the type-check command above, not a test run. The final whole-branch review additionally runs the full plugin build (`npm run build`) and the app-level `npx tsc --noEmit`.
- Do not reintroduce a `loading` boolean anywhere its removal is requested below — the hooks' return shape drops it entirely, not renames it.
- Preserve every existing public function name, parameter, and return field not explicitly called out as removed/changed in a task — other files import these hooks/components and must keep compiling unchanged.
- New `react-intl` message ids must be added to **both** `admin/src/i18n/en.ts` and `admin/src/i18n/ar.ts` in the same task that introduces them — this plugin ships full English/Arabic support and both files are kept in lockstep (see `docs/superpowers/specs` i18n work).
- Commit after each task with a `fix(inventory-dashboard): ...` or `refactor(inventory-dashboard): ...` message (Conventional Commits, matching this repo's existing history).

---

### Task 1: Remove the dead `loading` field from four hooks

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useSettings.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useSchema.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts`

**Context:** These four hooks each wrap `useAsyncResource` and return a `loading: status === 'loading'`-style boolean left over from before the loading-service retrofit. No consumer anywhere in the codebase reads that field — confirmed by checking every call site (`Overview.tsx` destructures `{ exchangeRate, exchangeRateUpdatedAt, save }` from `useSettings`; `OrderForm.tsx` destructures `{ order, reload, confirm, cancel }` from `useOrder`; `InlineResourceForm.tsx`/`ResourceListPage.tsx`/`ResourceFormPage.tsx` all destructure only `{ schema }` from `useSchema`; nothing in the admin tree calls `useResources()` at all). Deleting the field is safe. Each hook's `status` variable becomes unused once `loading` is removed — remove it from the destructure too, since strict mode (`test:ts:front`) flags unused locals.

**Interfaces:**
- Produces: `useSettings()` now returns `{ exchangeRate, exchangeRateUpdatedAt, error, save }` (was: `+ loading`).
- Produces: `useOrder(documentId?)` now returns `{ order, reload, confirm, cancel }` (was: `+ loading`).
- Produces: `useSchema(resource?)` now returns `{ schema, error, reload }` (was: `+ loading`).
- Produces: `useResources()` now returns `{ resources, error }` (was: `+ loading`).
- No other task depends on these return shapes changing.

- [ ] **Step 1: Replace `useSettings.ts` in full**

```ts
import { useCallback } from 'react';
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

interface SettingsData {
  exchangeRate: number;
  exchangeRateUpdatedAt: string | null;
}

export function useSettings() {
  const api = useApi();
  const { data, setData, error } = useAsyncResource<SettingsData>(
    () => api.get<SettingsData>('/settings'),
    []
  );

  const save = useCallback(async (rate: number) => {
    const d = await api.put<{ exchangeRate: number; exchangeRateUpdatedAt: string }>('/settings', {
      exchangeRate: rate,
    });
    setData(d);
    return d;
  }, []);

  return {
    exchangeRate: data?.exchangeRate ?? null,
    exchangeRateUpdatedAt: data?.exchangeRateUpdatedAt ?? null,
    error,
    save,
  };
}
```

- [ ] **Step 2: Replace `useOrder.ts` in full**

```ts
import { useCallback } from 'react';
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useOrder(documentId?: string) {
  const api = useApi();
  const { data: order, setData, reload } = useAsyncResource<any>(
    () => (documentId ? api.get(`/orders/${documentId}`) : Promise.resolve(null)),
    [documentId]
  );

  const confirm = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/confirm`);
    setData(updated);
    return updated;
  }, [documentId]);

  const cancel = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/cancel`);
    setData(updated);
    return updated;
  }, [documentId]);

  return { order, reload, confirm, cancel };
}
```

- [ ] **Step 3: Replace `useSchema.ts` in full**

```ts
import { useApi, type SchemaMeta } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useSchema(resource?: string) {
  const api = useApi();
  const { data: schema, error, reload } = useAsyncResource<SchemaMeta | null>(
    () => (resource ? api.get<SchemaMeta>(`/resources/${resource}/schema`) : Promise.resolve(null)),
    [resource]
  );

  return { schema, error, reload };
}
```

- [ ] **Step 4: Replace `useResources.ts` in full**

```ts
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useResources() {
  const api = useApi();
  const { data, error } = useAsyncResource<string[]>(
    () => api.get<{ resources: string[] }>('/resources').then((d) => d.resources),
    []
  );

  return { resources: data ?? [], error };
}
```

- [ ] **Step 5: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useSettings.ts src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts src/plugins/inventory-dashboard/admin/src/hooks/useSchema.ts src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts
git commit -m "refactor(inventory-dashboard): drop dead loading field from useSettings/useOrder/useSchema/useResources"
```

---

### Task 2: Make the top progress bar visible above modals

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/loading/TopProgressBar.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx`

**Context:** `TopProgressBar` is mounted once in `AppShell` and renders `position="absolute"` inside a `Box` that has `position="relative"`. Chakra's `Modal` (used by `AddNewModal`, opened via the "Add new" nav button) renders its overlay/content at `position: fixed` with Chakra's default `zIndex` of 1400, which visually covers the absolute-positioned bar (whose own `zIndex` is only 10) whenever a wizard inside the modal (Product/Stock Purchase/Order) is fetching data. Fix: make the bar `position="fixed"` (escapes the `AppShell` Box's stacking context entirely, since nothing between it and the viewport applies a `transform`/`filter`/`opacity`) with `zIndex={1500}` (above Chakra's 1400 overlay/modal). Once the bar is fixed-positioned it no longer needs a `position="relative"` ancestor, so remove that from `AppShell`'s content `Box` — no other element in the plugin was found using it as a positioning context.

**Interfaces:** None — both files are self-contained, no other task touches them.

- [ ] **Step 1: Replace `TopProgressBar.tsx` in full**

```tsx
// src/plugins/inventory-dashboard/admin/src/loading/TopProgressBar.tsx
import { Box } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useIsLoading } from './LoadingProvider';

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 200;

export function TopProgressBar() {
  const isLoading = useIsLoading();
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      showTimer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
    } else if (shownAtRef.current !== null) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      hideTimer = setTimeout(() => {
        shownAtRef.current = null;
        setVisible(false);
      }, remaining);
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <Box position="fixed" top={0} left={0} right={0} height="3px" overflow="hidden" zIndex={1500}>
      <Box
        position="absolute"
        top={0}
        bottom={0}
        width="40%"
        bg="accent.fg"
        borderRadius="full"
        sx={{
          animation: 'inventory-dashboard-progress-slide 1.1s ease-in-out infinite',
          '@keyframes inventory-dashboard-progress-slide': {
            '0%': { insetInlineStart: '-40%' },
            '100%': { insetInlineStart: '100%' },
          },
        }}
      />
    </Box>
  );
}
```

- [ ] **Step 2: Replace `AppShell.tsx` in full**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
import { useEffect, type ReactNode } from 'react';
import {
  Box, Drawer, DrawerBody, DrawerContent, DrawerOverlay, Flex, HStack, Icon, IconButton, useDisclosure,
} from '@chakra-ui/react';
import { FiMenu } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { AppSidebar } from './AppSidebar';
import { TopProgressBar } from '../loading/TopProgressBar';

function MobileTopBar({ onOpen }: { onOpen: () => void }) {
  const intl = useIntl();

  return (
    <HStack
      display={{ base: 'flex', md: 'none' }}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      px={4}
      py={3}
      flexShrink={0}
    >
      <IconButton
        aria-label={intl.formatMessage({ id: 'nav.openMenuAria', defaultMessage: 'Open menu' })}
        icon={<Icon as={FiMenu} boxSize={5} />}
        variant="ghost"
        onClick={onOpen}
      />
    </HStack>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { locale } = useLocale();
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes (e.g. a nav link was
  // tapped) — AppSidebar's own nav buttons have no knowledge of the drawer,
  // so this is the only hook point available without modifying them.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Flex minH="100%" direction="column">
      <MobileTopBar onOpen={onOpen} />
      <Flex flex={1} minH={0}>
        <Box display={{ base: 'none', md: 'block' }}>
          <AppSidebar />
        </Box>
        <Drawer isOpen={isOpen} placement="start" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent maxW="240px" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <DrawerBody p={0}>
              <AppSidebar />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        <Box flex={1} minW={0}>
          <TopProgressBar />
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
```

(Only change from the current file: the last `Box` before `{children}` drops `position="relative"`.)

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/loading/TopProgressBar.tsx src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
git commit -m "fix(inventory-dashboard): show top progress bar above modal overlays"
```

---

### Task 3: Migrate `CatalogHub.tsx` to `useAsyncResource`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`

**Context:** `CatalogHub` currently hand-rolls its own `useEffect`/`useState` fetch (with a manual `active` flag to avoid a stale-set-state-after-unmount race) instead of using `useAsyncResource`, which already solves that same race generically via its internal request-id guard. Replace it with `useAsyncResource`, and show `LoadingState` during the first load — this matches the pattern every other retrofitted page in this plugin already uses (e.g. `Overview.tsx`).

**Interfaces:** None — self-contained, no other task touches this file.

- [ ] **Step 1: Replace `CatalogHub.tsx` in full**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { CATALOG_GROUPS } from '../config/navConfig';

type CatalogCounts = Record<string, number | null>;

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();

  const { data: counts, isInitialLoading } = useAsyncResource<CatalogCounts>(
    () => {
      const slugs = CATALOG_GROUPS.flatMap((g) => g.items.map((i) => i.slug));
      return Promise.all(
        slugs.map((slug) =>
          api
            .get<{ pagination: { total: number } }>(`/resources/${slug}`, { pageSize: 1 })
            .then((d) => [slug, d.pagination.total] as const)
            .catch(() => [slug, null] as const)
        )
      ).then((entries) => Object.fromEntries(entries) as CatalogCounts);
    },
    []
  );

  if (isInitialLoading || !counts) {
    return <LoadingState />;
  }

  return (
    <Box p={{ base: 4, md: 8 }}>
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

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
git commit -m "refactor(inventory-dashboard): migrate CatalogHub to useAsyncResource"
```

---

### Task 4: Migrate `RelationSelect.tsx` to `useAsyncResource`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`

**Context:** `RelationSelect` (the relation-picker `<Select>` used by the generic resource form) currently hand-rolls its own `useEffect`/`useState` fetch of the target resource's options, silently swallowing errors into an empty array. Replace it with `useAsyncResource`, keeping the same silent-empty-on-error behavior (this component has no error UI of its own and is not in scope for adding one) by defaulting the render to `options ?? []`.

**Interfaces:** None — self-contained, no other task touches this file.

- [ ] **Step 1: Replace `RelationSelect.tsx` in full**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx
import { Select } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { useApi, type FieldMeta } from '../utils/api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { getFieldLabel } from '../i18n/fieldLabels';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const intl = useIntl();
  const targetSlug = field.relation?.resource;

  const { data: options } = useAsyncResource<any[]>(
    () =>
      targetSlug
        ? api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 }).then((d) => d.results)
        : Promise.resolve([]),
    [targetSlug]
  );

  const selected = value?.documentId ?? value ?? '';
  const label = getFieldLabel(intl, field.name);

  return (
    <FormField label={label} required={field.required}>
      <Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        placeholder={intl.formatMessage({ id: 'relationSelect.placeholder', defaultMessage: 'Select {field}' }, { field: label })}
      >
        {(options ?? []).map((o) => {
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

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx
git commit -m "refactor(inventory-dashboard): migrate RelationSelect to useAsyncResource"
```

---

### Task 5: Stop Overview from blanking to an error box on a failed background reload

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`

**Context:** `Overview.tsx` currently checks `if (error) { return <full error box> }` **before** checking `isInitialLoading`/`data`. This means once data has successfully loaded once, a later failed reload (e.g. after saving the exchange rate, or any background refetch) discards the entire page and replaces it with the error box — exactly the full-page blanking the loading-service feature was built to eliminate. Fix: only show the blocking full-page error box when there is no data at all (first load failed). Once `data` exists, render the page normally with the last-loaded (possibly stale) data, plus a small inline red-text banner above the page content when `error` is currently truthy. Add one new `react-intl` message id, `overview.reloadError`, to both locale files (placed immediately after the existing `overview.loadError` key in each file, matching this plugin's convention of keeping `en.ts`/`ar.ts` in lockstep).

**Interfaces:** None — self-contained, no other task touches these files.

- [ ] **Step 1: Replace `Overview.tsx` in full**

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
import { LoadingState } from '../components/ui/LoadingState';

export default function Overview() {
  const intl = useIntl();
  const { data, error, isInitialLoading, reload } = useOverview();
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

  if (isInitialLoading || !data) {
    if (error) {
      return (
        <Box p={{ base: 4, md: 8 }}>
          <Text color="red.600">{intl.formatMessage({ id: 'overview.loadError', defaultMessage: 'Could not load overview data' })}</Text>
        </Box>
      );
    }
    return <LoadingState />;
  }

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.overview', defaultMessage: 'Overview' })} />

      {error && (
        <Text color="red.600" pb={4}>
          {intl.formatMessage({ id: 'overview.reloadError', defaultMessage: 'Could not refresh overview data — showing last loaded data' })}
        </Text>
      )}

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

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
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
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiredTitle', defaultMessage: 'Expired' })}
          </Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 6 }}>
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

(Only functional change from the current file: the guard block right after `onSaveRate` moved the `error` check inside the `isInitialLoading || !data` branch, and a new inline error `Text` was added right after `PageHeader` in the main render.)

- [ ] **Step 2: Add the new message id to `en.ts`**

Find this line in `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`:

```ts
  'overview.loadError': 'Could not load overview data',
```

Add this line immediately after it:

```ts
  'overview.reloadError': 'Could not refresh overview data — showing last loaded data',
```

- [ ] **Step 3: Add the new message id to `ar.ts`**

Find this line in `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`:

```ts
  'overview.loadError': 'تعذّر تحميل بيانات النظرة العامة',
```

Add this line immediately after it:

```ts
  'overview.reloadError': 'تعذّر تحديث بيانات النظرة العامة — يتم عرض آخر بيانات محمّلة',
```

- [ ] **Step 4: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx src/plugins/inventory-dashboard/admin/src/i18n/en.ts src/plugins/inventory-dashboard/admin/src/i18n/ar.ts
git commit -m "fix(inventory-dashboard): keep stale Overview data visible on a failed background reload"
```

---

## Final Verification (after all tasks, before final review)

```bash
cd src/plugins/inventory-dashboard
npm run build
npm run test:ts:back
npm run test:ts:front
cd ../../..
npx tsc --noEmit
npx cross-env NODE_ENV=test jest --runInBand --forceExit --testPathIgnorePatterns='.claude/worktrees'
```

All must be clean. (Use `--testPathIgnorePatterns` for the reason recorded in this project's memory: the main checkout's Jest config has no built-in exclusion for other concurrently-checked-out worktrees under `.claude/worktrees/`, and a bare `npm test` from the repo root will pick up and can fail on unrelated sibling branches' test files.)
