# Loading Service — Design

**Goal:** Give the inventory-dashboard plugin one shared, standard way to signal "something is loading" — for route navigation, initial page loads, and background reloads — instead of the current ad hoc, inconsistent per-page handling (some pages show a "Loading…" text, some show nothing at all).

## Problem

Every page/hook in the plugin talks to the backend through `useApi()` (`admin/src/utils/api.ts`), but each one reinvents its own loading/error bookkeeping on top of it:

- `useOverview`, `useOrder`, `useSchema`, `useSettings` each duplicate the same `useState(loading)` + `useEffect` + `.finally(() => setLoading(false))` pattern.
- `useResources` duplicates it again with a slightly different shape.
- `OrdersList` and `ResourceListPage` fetch inline in a `useEffect` with **no loading state at all** — cancelling an order, deleting a record, or searching gives the user zero feedback that anything is happening.
- `ResourceFormPage`'s edit-mode fetch also has no loading state — the form briefly renders with empty fields before the record arrives.
- Where a loading state does exist (`Overview`), it blanks the whole page to a `<Text>Loading…</Text>`, including on reload after an action (e.g. saving the exchange rate) — a jarring flash of the entire page's content disappearing and reappearing.
- There is no indicator at all for route-to-route navigation within the plugin (e.g. Overview → Orders).

## Scope

**In scope:**
- A global request-tracking layer wired into the single existing `useApi()` choke point, so every request in the plugin (fetch or mutation) drives it automatically.
- A top progress bar, shared by all 4 plugin entry points, that reflects that tracker.
- A shared data-fetching hook (`useAsyncResource`) that replaces the duplicated `loading`/`error`/`reload` boilerplate in the 5 existing hooks, and is adopted by `OrdersList`, `ResourceListPage`, and `ResourceFormPage`'s inline fetches.
- A shared `LoadingState` UI component for first-load placeholders.
- Retrofitting every existing page/hook onto this (see Architecture below) — this is not additive-only infrastructure, existing inconsistencies get fixed now.
- Establishing this as the required convention for any page or hook added to the plugin in the future (see "Conventions going forward").

**Out of scope:**
- Anything outside the `inventory-dashboard` plugin (`src/admin/app.tsx` is not activated — only `.example` files exist there today; this stays plugin-scoped).
- Error-state UI standardization. Errors keep their current ad hoc per-page `<Text color="red.600">` treatment; only loading is addressed here.
- Any new dependency (no react-query/SWR/NProgress package) — the tracker is a small React context, the bar is a CSS animation.
- Per-request progress percentage — browsers don't expose upload/download progress for these calls, so the bar is indeterminate, not a real progress meter.

## Architecture

### Global request tracker

New `admin/src/loading/LoadingProvider.tsx`, following the same nesting convention `ChakraRoot` already uses for `LocaleProvider`/`FontSizeProvider`:

```tsx
const LoadingContext = createContext<{ count: number; begin: () => void; end: () => void } | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  return (
    <LoadingContext.Provider value={{ count, begin, end }}>{children}</LoadingContext.Provider>
  );
}

export function useIsLoading(): boolean {
  return useContext(LoadingContext)!.count > 0;
}

export function useLoadingTracker() {
  const { begin, end } = useContext(LoadingContext)!;
  return { begin, end };
}
```

`ChakraRoot.tsx` wraps `LoadingProvider` around `LocaleProvider` (outermost is fine — it has no dependency on locale/theme):

```tsx
<LoadingProvider>
  <LocaleProvider>
    <FontSizeProvider>
      <ThemedShell>{children}</ThemedShell>
    </FontSizeProvider>
  </LocaleProvider>
</LoadingProvider>
```

Because `ChakraRoot` is already instantiated once per plugin entry point (`App.tsx`, `CatalogStandalone.tsx`, `StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`), this one change gives every entry point its own independent tracker — no cross-entry-point leakage, no shared module-level state.

### `useApi()` wraps every call

`admin/src/utils/api.ts` — each of `get`/`post`/`put`/`del` calls `begin()`/`end()` around the underlying request:

```ts
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
    get: <T = any>(path: string, params?: Record<string, unknown>) => run<T>(() => get(`${base}${path}`, { params })),
    post: <T = any>(path: string, data?: unknown) => run<T>(() => post(`${base}${path}`, data)),
    put: <T = any>(path: string, data?: unknown) => run<T>(() => put(`${base}${path}`, data)),
    del: <T = any>(path: string) => run<T>(() => del(`${base}${path}`)),
  };
}
```

This is the key leverage point: every existing call site (all 5 hooks, all inline page fetches, every mutation — save, delete, cancel, confirm) starts contributing to the global tracker with no change to the call sites themselves.

### Top progress bar

New `admin/src/loading/TopProgressBar.tsx`:
- Reads `useIsLoading()`.
- Debounced appearance: starts a 150ms timer when loading flips `true`; if still loading when the timer fires, renders the bar. If loading flips back to `false` before the timer fires, nothing is ever shown (avoids flicker for fast requests).
- Minimum visible duration: once shown, stays visible at least 200ms even if loading ends sooner, then unmounts.
- Rendered as a 3px absolutely-positioned bar pinned to the top of `AppShell`'s content `Box` (the one already wrapping `{children}`), width spanning that box only (not the sidebar) — indeterminate CSS keyframe animation (sliding gradient), using the theme's accent color token.

`AppShell.tsx` renders `<TopProgressBar />` as the first child of the content `Box`, with `position="relative"` added to that `Box` so the bar's `position="absolute"` anchors correctly.

### Shared data-fetch hook

New `admin/src/hooks/useAsyncResource.ts`:

```ts
type Status = 'loading' | 'success' | 'error';

export function useAsyncResource<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<Status>('loading');

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

`isInitialLoading` is the flag pages use: `true` only until the first successful (or failed) response ever arrives for this hook instance. A later `reload()` (e.g. after a mutation) flips `status` back to `'loading'` but `data` is still non-null, so `isInitialLoading` stays `false` — the page keeps rendering the stale data, and the top bar (driven independently by `useApi()`) is the only visible feedback. This directly implements "keep stale data on screen during refetches, top bar only."

`setData` is exposed directly (not just internally) because several existing mutations already update local state from their own response without a follow-up fetch — e.g. `useOrder`'s `confirm`/`cancel` and `useSettings`'s `save` today call `setOrder(updated)`/`setExchangeRate(d.exchangeRate)` straight from the POST/PUT response. Wrapping those hooks in `useAsyncResource` without exposing `setData` would force an unnecessary extra `reload()` round-trip after every mutation just to reflect data the response already contained.

### Retrofit of existing hooks

`useOverview`, `useSettings` become thin wrappers around `useAsyncResource`, keeping their extra return values (`save`, for `useSettings`) as plain `useApi()` calls alongside it — those already flow through the tracker.

`useOrder` and `useSchema` likewise wrap `useAsyncResource` for their fetch, keeping `confirm`/`cancel` (on `useOrder`) as direct `useApi()` calls that also call `setData` on success (mirrors current behavior — no `reload()` round-trip needed after a mutation that already returns the updated record).

`useResources` becomes a one-line call to `useAsyncResource(() => api.get<{resources: string[]}>('/resources').then(d => d.resources), [])`.

### Retrofit of pages with inline fetches

- `OrdersList.tsx` — replace the inline `load()`/`useEffect`/`useState(rows)` with `useAsyncResource(() => api.get('/resources/orders', { pageSize: 100 }), [])`. Render `<LoadingState />` when `isInitialLoading`; otherwise render the table with whatever `data` currently holds (empty array on first successful load renders `DataTable`'s existing empty state, unchanged).
- `ResourceListPage.tsx` — same swap for its `load()`, with `[resource, search]` as the dep array (search re-triggers a full reload, matching current behavior, now with a top-bar tick instead of nothing).
- `ResourceFormPage.tsx` — the edit-mode fetch (`isEdit && resource`) moves to `useAsyncResource`; render `<LoadingState />` while `isInitialLoading` in edit mode only (create mode has no fetch, renders immediately as today).

### `LoadingState` component

New `admin/src/components/ui/LoadingState.tsx`, matching the existing `DataTable` convention (internal `useIntl()` default, optional override prop):

```tsx
export function LoadingState({ label }: { label?: string }) {
  const intl = useIntl();
  const resolved = label ?? intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' });
  return (
    <Box p={{ base: 4, md: 8 }} display="flex" justifyContent="center">
      <Spinner /> <Text ms={3}>{resolved}</Text>
    </Box>
  );
}
```

Reuses the existing `common.loading` i18n key (already present in `en.ts`/`ar.ts`, currently used inline by `Overview`). No new i18n strings needed.

`Overview.tsx` swaps its inline `if (loading || !data) return <Box>...<Text>Loading…</Text></Box>` block for `if (isInitialLoading) return <LoadingState />;` (from its now-`useAsyncResource`-backed `useOverview`).

## Conventions going forward

This becomes the required pattern for any new page or hook added to the plugin:
- Any new data fetch goes through `useApi()` (already mandatory today) — this alone makes it participate in the top progress bar with no extra work.
- Any new hook that fetches on mount is built on `useAsyncResource` rather than hand-rolled `useState`/`useEffect` loading bookkeeping.
- Any new page renders `<LoadingState />` when its hook's `isInitialLoading` is `true`, and otherwise trusts the top bar for reloads — never re-introduce a full-page blank-and-reload flash.
- The tracker and bar are internal to `LoadingProvider`/`TopProgressBar` — new pages never touch `begin`/`end` directly; they're private to `useApi()`.

## Data flow

1. User navigates to a page (top-level plugin link, or an in-plugin route like Overview → Orders).
2. The page's hook (built on `useAsyncResource`) fires on mount, calling `useApi()`.
3. `useApi()` calls `begin()` → tracker count goes from 0 to 1.
4. If the request is still in flight 150ms later, `TopProgressBar` appears.
5. Request resolves → `useApi()` calls `end()` → count back to 0 → bar (if shown) stays for its minimum duration, then disappears; the hook's `status` becomes `'success'`/`'error'` and `data`/`error` populate.
6. On a later action (search, save, cancel, delete, `reload()`), steps 2–5 repeat, but since `data` is already non-null, `isInitialLoading` is `false` throughout — the page keeps rendering existing content, only the top bar ticks.
7. Concurrent requests (e.g. `Overview` mounting `useOverview` and `useSettings` at once) increment the counter twice; the bar stays visible until the counter returns to 0, i.e. until the last one settles.

## Testing

No frontend component/unit test setup exists in this repo (`jest.config.js` is `testEnvironment: 'node'`, scoped to `**/tests/**/*.test.ts` server-side integration tests only) — consistent with prior frontend-only work in this plugin (e.g. `2026-07-28-responsive-font-size-design.md`), this is verified via typecheck, build, and manual walkthrough:

- `npm run test:ts:front` (`tsc -p admin/tsconfig.json --noEmit`) — catches type mismatches in the new hook/context/component signatures.
- `npm run build` — confirm no bundle regressions across all 4 entry points.
- Manual, in the dev server, for each of the 4 entry points (`App`, `CatalogStandalone`, `StockPurchaseStandalone`, `OrderFormStandalone`):
  - First load of every page (`Overview`, `OrdersList`, every Catalog Hub resource list/form, `ResourceFormPage` edit mode, `StockPurchase`, `OrderForm`) shows `LoadingState` briefly, then content — no flash of empty/broken layout.
  - A fast, cached-feeling navigation (e.g. revisiting a page whose data is quick to fetch) does not show a flashing bar.
  - Triggering a mutation on a page with existing data (cancel an order in `OrdersList`, save the exchange rate on `Overview`, delete a record in `ResourceListPage`) keeps the existing content on screen throughout, with only the top bar ticking — no blank-and-repopulate flicker.
  - Two concurrent fetches on one page (`Overview`) keep the bar visible until both finish.
  - Dark mode and Arabic/RTL: bar color/contrast look correct in both (the bar spans the full content width, so RTL has no separate positioning case, but the sliding-gradient animation direction should still look natural in both).
