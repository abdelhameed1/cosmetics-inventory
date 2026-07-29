# Low-Stock & Expiry In-App Notifications — Design

**Goal:** Surface low-stock, expired, and expiring-soon batch alerts proactively from anywhere in the admin — via an always-visible bell indicator in the sidebar — instead of requiring staff to remember to open the Overview page.

## Problem

`Overview.tsx` already computes and displays low-stock variants, expired batches, and batches expiring within 90 days (`server/src/services/overview.ts`'s `getOverview()`). But this data is only visible if someone happens to open that one page. There is no ambient indicator anywhere else in the admin, so a batch quietly expiring or a variant quietly running out doesn't reach anyone unless they go looking.

## Scope

**In scope:**
- A bell icon with a numeric badge in the sidebar (`AppSidebar.tsx`), visible on every page in every one of this plugin's four separately-registered admin entry points (Dashboard, Catalog, Stock Purchase, New Order — all four wrap `AppShell`, which renders `AppSidebar`), since `AppSidebar` is the one component already shared across all of them.
- Clicking it opens a "Notifications" modal listing expired batches, expiring-soon batches, and low-stock variants — the same three categories `Overview.tsx` already shows, reusing the same data.
- A lighter-weight backend endpoint than the full `/overview` call, since this data now gets polled in the background from every page, not fetched once when a user opens Overview.
- Periodic background refresh (polling), so the badge count updates without a manual reload.

**Out of scope:**
- Email or any other out-of-band delivery channel (explicit product decision — no SMTP is configured in this project).
- A "mark as read"/dismissal/persistent notification log. This is a live status indicator reflecting current state, not a history — same content shown on every open, refreshed on the same interval as the badge.
- Changing anything about `Overview.tsx` itself (it keeps showing the same three sections it already does; this feature adds a second place to see the same live data, not a replacement).
- Configurable thresholds or polling intervals — the 90-day expiry window and low-stock threshold are already configured per-variant/global elsewhere; this feature only surfaces what's already computed.

## Architecture

### Backend: a lighter `alerts` endpoint, sharing logic with `overview`

`server/src/services/overview.ts` currently computes `lowStock`/`expired`/`expiringSoon` inline inside `getOverview()`, alongside 12 separate resource `.count()` calls and full stock-value totals that this feature doesn't need. Repeating all of that on a polling interval from every page (not just when Overview is opened) adds avoidable database load. Extract the shared computation into its own function and expose a second, leaner endpoint on top of it:

```ts
// server/src/services/overview.ts
async function computeStockAlerts(strapi: Core.Strapi) {
  // the existing batch-scanning loop that produces { lowStock, expired, expiringSoon },
  // extracted verbatim from getOverview() into its own function so both
  // getOverview() and getAlerts() call the same logic instead of duplicating it.
}

const overview = ({ strapi }) => ({
  async getOverview() { /* unchanged, but now calls computeStockAlerts(strapi) internally */ },
  async getAlerts() {
    return computeStockAlerts(strapi); // no resource counts, no stock-value totals
  },
});
```

New admin route in `server/src/routes/index.ts`, alongside the existing `/overview` route:
```ts
{ method: 'GET', path: '/alerts', handler: 'overview.alerts', config: { policies: [requireAccess] } },
```

`server/src/controllers/overview.ts` already exists with one method, `index` (which `GET /overview` points at). Add a second method, `alerts`, calling `strapi.plugin('inventory-dashboard').service('overview').getAlerts()`.

Response shape: `{ lowStock: [...], expired: [...], expiringSoon: [...] }` — the same three arrays `/overview` already returns, just without `counts`, `exchangeRate`, `totalStockUnits`, `stockValueUsd`, `stockValueEgp`.

### Frontend: `useAlerts` hook + `NotificationBell` + `NotificationsModal`

`admin/src/hooks/useAlerts.ts` (new), mirroring the shape of the existing `useOverview.ts`:
```ts
export function useAlerts() {
  // fetches GET /alerts once on mount, then again every 5 minutes via setInterval
  // (cleared on unmount); returns { data, loading, error, reload }
}
```

`admin/src/components/NotificationBell.tsx` (new): an `IconButton` (bell icon) with a small numeric `Badge` positioned over its corner, count = `lowStock.length + expired.length + expiringSoon.length`. Badge is hidden entirely when count is 0 (not shown as "0"). Clicking opens `NotificationsModal`.

`admin/src/components/NotificationsModal.tsx` (new), structurally mirroring `AddNewModal.tsx`'s established `Modal`/`ModalOverlay`/`ModalContent fontSize="md" dir={...}` pattern (the only Modal-based reference this codebase has, since Popover has no existing precedent here and isn't worth introducing fresh for this). Three sections, same labels and color treatment `Overview.tsx` already uses (`red.600` for expired, `orange.600` for expiring soon, plain for low stock):
- Expired batches → each row links to `/plugins/inventory-catalog/stock-batches/{batchId}`
- Expiring soon (90 days) → each row links to the same stock-batches route
- Low stock → each row links to `/plugins/inventory-catalog/variants/{variantId}`

Clicking any row calls `navigate(...)` (this works across the plugin's 4 separately-registered top-level admin entries — `AddNewModal.tsx`'s `doneToList` already navigates from wherever it's mounted to `/plugins/inventory-catalog/...`, so this is an established, working pattern, not a new one) and closes the modal.

### Sidebar wiring

`admin/src/components/AppSidebar.tsx` — change the existing full-width "Add new" button into an `HStack` containing the button (flexible width) plus the new `NotificationBell` (fixed size), right where "Add new" currently sits alone:

```tsx
<HStack mb={4} spacing={2}>
  <Button leftIcon={<Icon as={FiPlus} boxSize={4} />} flex={1} onClick={() => setIsAddNewOpen(true)}>
    {intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
  </Button>
  <NotificationBell />
</HStack>
```

Since `AppSidebar` is rendered by `AppShell` in both the persistent desktop panel and the mobile drawer (`AppShell.tsx`), this one change covers both breakpoints and all four of the plugin's admin entry points without touching `AppShell.tsx` itself.

## i18n

New keys in both `admin/src/i18n/en.ts` and `admin/src/i18n/ar.ts`: bell button aria-label, modal title, the three section headings (reusing `overview.expiredTitle`/`overview.expiringSoonTitle`/`overview.lowStockTitle`, already defined — no new keys needed for the headings themselves), and an empty-state note if all three sections are empty (e.g. "No alerts right now").

## Data flow

1. `AppSidebar` mounts (on every page, in every one of the 4 admin entry points) → `useAlerts()` fetches `GET /alerts` immediately, then every 5 minutes.
2. `NotificationBell`'s badge count updates as `useAlerts()`'s data changes — no user action needed to see the current count.
3. Click the bell → `NotificationsModal` opens showing the current (already-fetched) data — no extra fetch on open, it reuses whatever `useAlerts()` last loaded.
4. Click a row → `navigate()` to that batch's or variant's edit page, modal closes.
5. Overview page continues to work exactly as it does today, calling `/overview` independently — this feature doesn't change or depend on that page.

## Error handling

If `/alerts` fails to load, the bell renders with no badge (fails silently — a background poll failing shouldn't surface an error banner on every page). If the user opens the modal while `data` is still `null` (first load in flight), show the same `common.loading` text used elsewhere.

## Testing

Server-side (Jest, mirroring `overview.test.ts`'s existing structure):
- `getAlerts()` returns the same `lowStock`/`expired`/`expiringSoon` values `getOverview()` would compute for the same seeded data, proving the extracted shared function didn't change behavior.
- `getAlerts()`'s response has no `counts`/`stockValueUsd`/`exchangeRate` keys.

Manual (dev server):
- Seed a low-stock variant and an expired batch, confirm the bell badge shows the correct count on the Overview page, on Stock Purchase, and on New Order (i.e. across entry points).
- Open the modal, confirm both items appear in the right section with the right color, click each, confirm it navigates to the right edit page and the modal closes.
- Confirm the badge disappears (not "0") when there's nothing to flag.
- Dark mode + Arabic/RTL rendering of the bell and modal; S/M/L font-size resizing of the modal (needs the same `fontSize="md"` anchor `AddNewModal.tsx` already carries).
