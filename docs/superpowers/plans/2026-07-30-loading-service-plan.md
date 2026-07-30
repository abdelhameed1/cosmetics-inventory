# Loading Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `inventory-dashboard` plugin one shared, standard way to signal loading — for route navigation, initial page loads, and background reloads — replacing today's inconsistent per-page handling (some pages show "Loading…", some show nothing).

**Architecture:** A `LoadingProvider` React context (new) tracks an in-flight-request counter. `useApi()` — the single function every hook/page already calls for every network request — is wrapped so every `get`/`post`/`put`/`del` call increments/decrements that counter automatically, with zero changes needed at any call site. A `TopProgressBar` (new), rendered once inside `AppShell`, reflects that counter with debounced show/hide timing. A shared `useAsyncResource` hook (new) replaces the near-identical `loading`/`error`/`reload` boilerplate duplicated across 5 existing hooks and 3 inline page fetches, exposing an `isInitialLoading` flag so pages can tell "first load" (show a placeholder) from "reload" (keep stale content, let the top bar speak for itself).

**Tech Stack:** React 18, TypeScript, Chakra UI 2 (existing `accent.fg` semantic token, no new dependency), react-intl (existing `common.loading` key, no new i18n).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-30-loading-service-design.md` — every value/behavior below is copied verbatim from it; do not deviate.
- No new npm dependencies.
- Error-state UI is explicitly out of scope. Every task preserves each file's existing error copy/behavior byte-for-byte (same i18n keys, same fallback strings, same `String(e)` stringification where that's what the original code did) — only loading/first-render behavior changes. Do not add new i18n keys.
- Reuse the existing `common.loading` i18n key (already defined in both `admin/src/i18n/en.ts` and `admin/src/i18n/ar.ts`) for `LoadingState`'s default label. Do not add a new key for it.
- Reuse the existing `accent.fg` Chakra semantic token (already defined in `admin/src/theme/index.ts` from prior work) for the progress bar's color — do not invent a new token.
- Timing constants (from the design spec) — use these exact values: show-delay `150` ms, minimum-visible duration `200` ms.
- No frontend component/unit test harness exists in this repo (`jest.config.js` is `testEnvironment: 'node'`, scoped to `**/tests/**/*.test.ts` server-side integration tests only). The verification gate for every task in this plan is TypeScript, run from the plugin package:
  ```bash
  cd src/plugins/inventory-dashboard && npm run test:ts:front
  ```
  Run it after every task's code changes, before committing. Expected: exits 0, no errors.
- Final build check (last task only): `cd src/plugins/inventory-dashboard && npm run build`.
- Do not change any file's JSX structure, prop values, or behavior beyond what each task's steps literally show. If a step's "before" description doesn't match the current file content, stop and report a mismatch rather than guessing.

---

### Task 1: `LoadingProvider` context + wire into `ChakraRoot`

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/loading/LoadingProvider.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`

**Interfaces:**
- Produces: `LoadingProvider` (component, wraps `children: ReactNode`), `useIsLoading(): boolean` (true when 1+ requests in flight), `useLoadingTracker(): { begin: () => void; end: () => void }` (internal — only `utils/api.ts` in Task 2 calls this). Both hooks throw if called outside a `LoadingProvider`. Later tasks import these two hooks from `../loading/LoadingProvider`.

- [ ] **Step 1: Create LoadingProvider.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/loading/LoadingProvider.tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface LoadingContextValue {
  count: number;
  begin: () => void;
  end: () => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  return (
    <LoadingContext.Provider value={{ count, begin, end }}>
      {children}
    </LoadingContext.Provider>
  );
}

function useLoadingContext(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoadingContext must be used within a LoadingProvider');
  return ctx;
}

export function useIsLoading(): boolean {
  return useLoadingContext().count > 0;
}

export function useLoadingTracker(): { begin: () => void; end: () => void } {
  const { begin, end } = useLoadingContext();
  return { begin, end };
}
```

- [ ] **Step 2: Replace ChakraRoot.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx
import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { getTheme, themeConfig } from '../theme';
import { LocaleProvider, useLocale } from '../i18n/LocaleProvider';
import { FontSizeProvider, useFontSizePreset } from '../theme/FontSizeProvider';
import { LoadingProvider } from '../loading/LoadingProvider';

function ThemedShell({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const { fontSizePreset } = useFontSizePreset();

  return (
    <ChakraProvider theme={getTheme(locale, fontSizePreset)} resetCSS={false}>
      <Box bg="bg.canvas" color="text.primary" minH="100%" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </Box>
    </ChakraProvider>
  );
}

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={themeConfig.initialColorMode} />
      <LoadingProvider>
        <LocaleProvider>
          <FontSizeProvider>
            <ThemedShell>{children}</ThemedShell>
          </FontSizeProvider>
        </LocaleProvider>
      </LoadingProvider>
    </>
  );
}
```

`LoadingProvider` sits outside `LocaleProvider`/`FontSizeProvider` because it has no dependency on locale or theme, and because `ChakraRoot` is instantiated once per plugin entry point (`App.tsx`, `CatalogStandalone.tsx`, `StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`), so each entry point gets its own independent request counter — no cross-entry-point leakage.

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/loading/LoadingProvider.tsx src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx
git commit -m "feat(inventory-dashboard): add LoadingProvider request-tracking context"
```

---

### Task 2: `useApi()` tracks every request

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/utils/api.ts`

**Interfaces:**
- Consumes: `useLoadingTracker()` from Task 1 (`../loading/LoadingProvider`).
- Produces: no change to `useApi()`'s public shape — `get`/`post`/`put`/`del` keep their exact existing signatures. Every existing call site in the codebase keeps working unmodified. This is the task that makes every hook and page automatically participate in the request counter.

- [ ] **Step 1: Replace api.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/utils/api.ts
import { useFetchClient } from '@strapi/strapi/admin';
import { pluginId } from '../pluginId';
import { useLoadingTracker } from '../loading/LoadingProvider';

export interface FieldMeta {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  hidden: boolean;
  min?: number;
  max?: number;
  values?: string[];
  relation?: { resource: string | null; kind: string; mainField: string };
}

export interface SchemaMeta {
  resource: string;
  uid: string;
  fields: FieldMeta[];
}

export function useApi() {
  const { get, post, put, del } = useFetchClient();
  const { begin, end } = useLoadingTracker();
  const base = `/${pluginId}`;

  async function run<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    begin();
    try {
      const res = await fn();
      return res.data;
    } finally {
      end();
    }
  }

  return {
    get: <T = any>(path: string, params?: Record<string, unknown>) =>
      run<T>(() => get(`${base}${path}`, { params })),
    post: <T = any>(path: string, data?: unknown) =>
      run<T>(() => post(`${base}${path}`, data)),
    put: <T = any>(path: string, data?: unknown) =>
      run<T>(() => put(`${base}${path}`, data)),
    del: <T = any>(path: string) =>
      run<T>(() => del(`${base}${path}`)),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/utils/api.ts
git commit -m "feat(inventory-dashboard): wire useApi() requests into the loading tracker"
```

---

### Task 3: `TopProgressBar` + wire into `AppShell`

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/loading/TopProgressBar.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useIsLoading()` from Task 1 (`../loading/LoadingProvider`).
- Produces: `TopProgressBar` component (no props), rendered once inside `AppShell`'s content area. Nothing outside this task needs it.

- [ ] **Step 1: Create TopProgressBar.tsx**

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
    <Box position="absolute" top={0} left={0} right={0} height="3px" overflow="hidden" zIndex={10}>
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

`insetInlineStart` (a standard CSS logical property, set via the raw `sx` style object, not a Chakra shorthand prop) makes the slide animation mirror automatically under the ambient `dir="rtl"` attribute that `ChakraRoot` already sets — no locale-aware code needed in this component.

- [ ] **Step 2: Replace AppShell.tsx**

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
        <Box flex={1} minW={0} position="relative">
          <TopProgressBar />
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/loading/TopProgressBar.tsx src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
git commit -m "feat(inventory-dashboard): add top progress bar to AppShell"
```

---

### Task 4: `useAsyncResource` shared hook

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/hooks/useAsyncResource.ts`

**Interfaces:**
- Produces: `useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[])` returning `{ data: T | null; setData: (data: T | null) => void; error: unknown; status: 'loading' | 'success' | 'error'; isInitialLoading: boolean; reload: () => void }`. `isInitialLoading` is `true` only while `status === 'loading'` AND `data === null` (i.e. before the very first response, success or error, ever arrives). `setData` lets a caller update `data` directly from a mutation's response without re-fetching. `reload()` re-runs `fetcher()`; it re-runs automatically on mount and whenever an entry in `deps` changes. This is a new file with no existing consumers yet — it does not change behavior anywhere else in the app.

- [ ] **Step 1: Create useAsyncResource.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/hooks/useAsyncResource.ts
import { useCallback, useEffect, useState } from 'react';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncResource<T> {
  data: T | null;
  setData: (data: T | null) => void;
  error: unknown;
  status: AsyncStatus;
  isInitialLoading: boolean;
  reload: () => void;
}

export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<AsyncStatus>('loading');

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    fetcher()
      .then((d) => { setData(d); setStatus('success'); })
      .catch((e) => { setError(e); setStatus('error'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  return {
    data,
    setData,
    error,
    status,
    isInitialLoading: status === 'loading' && data === null,
    reload,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useAsyncResource.ts
git commit -m "feat(inventory-dashboard): add shared useAsyncResource data-fetch hook"
```

---

### Task 5: `LoadingState` shared UI component

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/ui/LoadingState.tsx`

**Interfaces:**
- Produces: `LoadingState({ label?: string })` — a centered spinner + label, defaulting to the existing `common.loading` i18n key. Matches the existing `DataTable` convention (internal `useIntl()` default, optional override prop — see `admin/src/components/ui/DataTable.tsx`'s `emptyLabel` prop for the pattern this follows). This is a new file with no existing consumers yet.

- [ ] **Step 1: Create LoadingState.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ui/LoadingState.tsx
import { Box, Spinner, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';

export function LoadingState({ label }: { label?: string }) {
  const intl = useIntl();
  const resolved = label ?? intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' });

  return (
    <Box p={{ base: 4, md: 8 }} display="flex" alignItems="center" justifyContent="center">
      <Spinner />
      <Text ms={3}>{resolved}</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ui/LoadingState.tsx
git commit -m "feat(inventory-dashboard): add shared LoadingState component"
```

---

### Task 6: Retrofit `useSettings`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useSettings.ts`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4 (`./useAsyncResource`).
- Produces: `useSettings()` keeps its exact existing return shape — `{ exchangeRate: number | null; exchangeRateUpdatedAt: string | null; loading: boolean; error: unknown; save: (rate: number) => Promise<{exchangeRate: number; exchangeRateUpdatedAt: string}> }`. Its only consumer, `Overview.tsx`, needs no changes because of this task.

- [ ] **Step 1: Replace useSettings.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/hooks/useSettings.ts
import { useCallback } from 'react';
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

interface SettingsData {
  exchangeRate: number;
  exchangeRateUpdatedAt: string | null;
}

export function useSettings() {
  const api = useApi();
  const { data, setData, error, status } = useAsyncResource<SettingsData>(
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
    loading: status === 'loading',
    error,
    save,
  };
}
```

`save` calls the exposed `setData` directly from the PUT response, exactly like the original file did with its two separate `setState` calls — no extra network round-trip.

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useSettings.ts
git commit -m "refactor(inventory-dashboard): rebuild useSettings on useAsyncResource"
```

---

### Task 7: Retrofit `useOverview` + `Overview.tsx`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useOverview.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4, `LoadingState` from Task 5.
- Produces: `useOverview()` now returns `{ data: any; error: unknown; isInitialLoading: boolean; reload: () => void }` — note `loading` is replaced by `isInitialLoading` (its only consumer, `Overview.tsx`, is updated in this same task).

- [ ] **Step 1: Replace useOverview.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/hooks/useOverview.ts
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useOverview() {
  const api = useApi();
  const { data, error, isInitialLoading, reload } = useAsyncResource<any>(
    () => api.get('/overview'),
    []
  );

  return { data, error, isInitialLoading, reload };
}
```

- [ ] **Step 2: Replace Overview.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
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

  if (error) {
    return (
      <Box p={{ base: 4, md: 8 }}>
        <Text color="red.600">{intl.formatMessage({ id: 'overview.loadError', defaultMessage: 'Could not load overview data' })}</Text>
      </Box>
    );
  }

  if (isInitialLoading || !data) {
    return <LoadingState />;
  }

  return (
    <Box p={{ base: 4, md: 8 }}>
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

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useOverview.ts src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
git commit -m "refactor(inventory-dashboard): rebuild useOverview on useAsyncResource, use LoadingState"
```

---

### Task 8: Retrofit `useOrder`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4.
- Produces: `useOrder(documentId?: string)` keeps its exact existing return shape — `{ order: any; loading: boolean; reload: () => void; confirm: () => Promise<any>; cancel: () => Promise<any> }`. Its only consumer, `OrderForm.tsx`, needs no changes because of this task (it destructures `{ order, reload, confirm, cancel }` and never reads `loading`).

- [ ] **Step 1: Replace useOrder.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts
import { useCallback } from 'react';
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useOrder(documentId?: string) {
  const api = useApi();
  const { data: order, setData, status, reload } = useAsyncResource<any>(
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

  return { order, loading: status === 'loading' && Boolean(documentId), reload, confirm, cancel };
}
```

When `documentId` is undefined (creating a new order), the fetcher resolves to `null` without calling the API, matching the original file's behavior of never fetching in create mode. `loading` is forced to `false` in that case even during the first render tick, matching the original's `useState(Boolean(documentId))` initial value.

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts
git commit -m "refactor(inventory-dashboard): rebuild useOrder on useAsyncResource"
```

---

### Task 9: Retrofit `useSchema`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useSchema.ts`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4.
- Produces: `useSchema(resource?: string)` keeps its exact existing return shape — `{ schema: SchemaMeta | null; loading: boolean; error: unknown; reload: () => void }`. Its consumers, `ResourceListPage.tsx` and `ResourceFormPage.tsx`, need no changes because of this task (both only destructure `{ schema }`).

- [ ] **Step 1: Replace useSchema.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/hooks/useSchema.ts
import { useApi, type SchemaMeta } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useSchema(resource?: string) {
  const api = useApi();
  const { data: schema, error, status, reload } = useAsyncResource<SchemaMeta | null>(
    () => (resource ? api.get<SchemaMeta>(`/resources/${resource}/schema`) : Promise.resolve(null)),
    [resource]
  );

  return { schema, loading: status === 'loading', error, reload };
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useSchema.ts
git commit -m "refactor(inventory-dashboard): rebuild useSchema on useAsyncResource"
```

---

### Task 10: Retrofit `useResources`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4.
- Produces: `useResources()` keeps its exact existing return shape — `{ resources: string[]; loading: boolean; error: unknown }`. This hook currently has no consumers anywhere in the codebase (verified by search) — this task is a pure mechanical retrofit with no runtime-visible effect.

- [ ] **Step 1: Replace useResources.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts
import { useApi } from '../utils/api';
import { useAsyncResource } from './useAsyncResource';

export function useResources() {
  const api = useApi();
  const { data, error, status } = useAsyncResource<string[]>(
    () => api.get<{ resources: string[] }>('/resources').then((d) => d.resources),
    []
  );

  return { resources: data ?? [], loading: status === 'loading', error };
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts
git commit -m "refactor(inventory-dashboard): rebuild useResources on useAsyncResource"
```

---

### Task 11: Retrofit `OrdersList.tsx`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4, `LoadingState` from Task 5.
- Produces: no external consumers of this page's internals — this closes the gap where `OrdersList` currently has zero loading indicator on first load, and zero feedback while cancelling an order.

- [ ] **Step 1: Replace OrdersList.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay,
  Badge, Box, Button, Td, Text, Tr,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useLocale } from '../i18n/LocaleProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';

const STATUS_COLOR_SCHEME: Record<string, string> = {
  draft: 'gray',
  confirmed: 'yellow',
  partially_paid: 'orange',
  paid: 'green',
  cancelled: 'red',
};

function orderFinalTotal(order: any): number {
  const subtotal = (order.lines ?? []).reduce(
    (s: number, l: any) => s + Number(l.sellPrice) * Number(l.quantitySold),
    0
  );
  return subtotal - (Number(order.discountAmount) || 0);
}

export default function OrdersList() {
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { locale } = useLocale();
  const { data, error: loadError, isInitialLoading, reload } = useAsyncResource<{ results: any[]; pagination: { total: number } }>(
    () => api.get<{ results: any[]; pagination: { total: number } }>('/resources/orders', { pageSize: 100 }),
    []
  );
  const rows = data?.results ?? [];
  const total = data?.pagination.total ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const displayError = actionError ?? (loadError ? String(loadError) : null);

  const confirmCancel = async () => {
    if (!toCancel) return;
    setIsCancelling(true);
    try {
      await api.post(`/orders/${toCancel.documentId}/cancel`);
      setActionError(null);
      reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'ordersList.cancelError', defaultMessage: 'Could not cancel order' }));
    } finally {
      setIsCancelling(false);
      setToCancel(null);
    }
  };

  if (isInitialLoading) return <LoadingState />;

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.orders', defaultMessage: 'Orders' })} />

      {displayError && <Text color="red.600" pb={4}>{displayError}</Text>}
      {total !== null && total > rows.length && (
        <Text color="text.secondary" fontSize="sm" pb={4}>
          {intl.formatMessage(
            { id: 'ordersList.showingCount', defaultMessage: 'Showing the {shown} most recent of {total} orders.' },
            { shown: rows.length, total }
          )}
        </Text>
      )}

      <DataTable
        columns={[
          intl.formatMessage({ id: 'ordersList.col.date', defaultMessage: 'Date' }),
          intl.formatMessage({ id: 'ordersList.col.customer', defaultMessage: 'Customer' }),
          intl.formatMessage({ id: 'ordersList.col.status', defaultMessage: 'Status' }),
          intl.formatMessage({ id: 'ordersList.col.total', defaultMessage: 'Total (EGP)' }),
          intl.formatMessage({ id: 'resourceList.actionsColumn', defaultMessage: 'Actions' }),
        ]}
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <Tr key={row.documentId} cursor="pointer" _hover={{ bg: 'bg.subtle' }} onClick={() => navigate(row.documentId)}>
            <Td>{row.orderDate}</Td>
            <Td>{row.customer?.name ?? '—'}</Td>
            <Td><Badge colorScheme={STATUS_COLOR_SCHEME[row.status] ?? 'gray'}>{row.status}</Badge></Td>
            <Td>{orderFinalTotal(row).toFixed(2)}</Td>
            <Td onClick={(e) => e.stopPropagation()}>
              {row.status === 'draft' && (
                <Button size="sm" variant="ghost" colorScheme="red" onClick={() => setToCancel(row)} isDisabled={isCancelling}>
                  {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
                </Button>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog isOpen={!!toCancel} leastDestructiveRef={cancelRef} onClose={() => setToCancel(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmTitle', defaultMessage: 'Cancel this order?' })}</AlertDialogHeader>
            <AlertDialogBody>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmBody', defaultMessage: 'This restores any deducted stock and cannot be undone.' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setToCancel(null)}>
                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button colorScheme="red" onClick={confirmCancel} ms={3} isLoading={isCancelling}>
                {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
```

`loadError`/`actionError` are kept as two separate variables — `loadError` (from the fetch) is stringified with `String(...)` exactly as the original file's `.catch((e) => setError(String(e)))` did; `actionError` (from cancel) keeps the original's localized fallback message. `displayError` picks whichever is set, preserving both exact original error copies with no new i18n keys.

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx
git commit -m "feat(inventory-dashboard): add loading state to OrdersList"
```

---

### Task 12: Retrofit `ResourceListPage.tsx`

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4, `LoadingState` from Task 5, `useSchema` from Task 9 (unchanged shape — `{ schema }` still destructured the same way).
- Produces: no external consumers of this page's internals — this closes the gap where `ResourceListPage` currently has zero loading indicator on first load or search, and zero feedback while deleting a record.

- [ ] **Step 1: Replace ResourceListPage.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx
import { useMemo, useRef, useState } from 'react';
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
import { useAsyncResource } from '../hooks/useAsyncResource';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';
import { getFieldLabel } from '../i18n/fieldLabels';
import { getResourceLabel } from '../i18n/resourceLabels';
import { useLocale } from '../i18n/LocaleProvider';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { locale } = useLocale();
  const { schema } = useSchema(resource);
  const [search, setSearch] = useState('');
  const { data, error: loadError, isInitialLoading, reload } = useAsyncResource<{ results: any[] }>(
    () => (resource
      ? api.get<{ results: any[] }>(`/resources/${resource}`, { search, pageSize: 100 })
      : Promise.resolve({ results: [] })),
    [resource, search]
  );
  const rows = data?.results ?? [];
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const visibleFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden).slice(0, 6),
    [schema]
  );

  const displayError = actionError ?? (loadError ? String(loadError) : null);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.del(`/resources/${resource}/${toDelete.documentId}`);
      setToDelete(null);
      setActionError(null);
      reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.deleteFailed', defaultMessage: 'Delete failed' }));
      setToDelete(null);
    }
  };

  if (isInitialLoading) return <LoadingState />;

  return (
    <Box p={{ base: 4, md: 8 }}>
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

      {displayError && <Text color="red.600" pb={4}>{displayError}</Text>}

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
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
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

Note the declaration order: `const [search, setSearch] = useState('');` comes **before** the `useAsyncResource` call because the fetcher closure and the `[resource, search]` deps array both reference `search` immediately (deps arrays are evaluated eagerly on every render, unlike the closure body itself) — declaring it after would throw a "used before initialization" error. Match this exact order when writing the file.

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx
git commit -m "feat(inventory-dashboard): add loading state to ResourceListPage"
```

---

### Task 13: Retrofit `ResourceFormPage.tsx` + final build check

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`

**Interfaces:**
- Consumes: `useAsyncResource` from Task 4, `LoadingState` from Task 5.
- Produces: no external consumers of this page's internals — this closes the gap where, in edit mode, the form currently renders briefly with empty fields before the existing record arrives.

- [ ] **Step 1: Replace ResourceFormPage.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
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

  const { isInitialLoading } = useAsyncResource<any>(
    () => (isEdit && resource
      ? api.get(`/resources/${resource}/${id}`).then((rec) => { setValues(normalize(rec)); return rec; })
      : Promise.resolve(null)),
    [isEdit, resource, id]
  );

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

  if (isEdit && isInitialLoading) {
    return <LoadingState />;
  }

  const resourceLabel = getResourceLabel(intl, resource);

  return (
    <Box p={{ base: 4, md: 8 }}>
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
              <GridItem key={f.name} colSpan={{ base: 12, md: 6 }}>
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

`useEffect` is no longer imported (its one use — the edit-mode fetch — is now `useAsyncResource`); the `isEdit && isInitialLoading` guard means create mode (which never fetches) renders immediately, exactly as before.

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Final build check**

Run: `cd src/plugins/inventory-dashboard && npm run build`
Expected: exits 0, no errors — confirms no bundle regressions across all 4 plugin entry points (`App`, `CatalogStandalone`, `StockPurchaseStandalone`, `OrderFormStandalone`).

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
git commit -m "feat(inventory-dashboard): add loading state to ResourceFormPage edit mode"
```

---

## After all tasks: manual verification

No frontend test harness exists to automate this — after Task 13, in the dev server, walk through the design spec's Testing section (`docs/superpowers/specs/2026-07-30-loading-service-design.md`): first-load placeholders on every page, no bar-flicker on fast navigations, stale-content-plus-bar-only behavior on reload-triggering mutations (cancel order, save rate, delete record), concurrent-request bar behavior on Overview, and dark-mode/RTL appearance. This is a manual walkthrough step for the orchestrating session, not a subagent task.
