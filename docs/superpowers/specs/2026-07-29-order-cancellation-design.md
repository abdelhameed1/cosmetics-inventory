# Order Cancellation with Stock Restoration — Design

**Goal:** Let staff cancel a draft, confirmed, or partially-paid order and have any stock that was already deducted at confirm time automatically returned to the batches it came from — closing the gap where a mis-entered or fallen-through order currently can't be undone once confirmed.

## Problem

`orders.confirm()` (`src/plugins/inventory-dashboard/server/src/services/orders.ts`) atomically decrements `stock-batch.quantityRemaining` for every line and flips the order to `confirmed`. There is no reverse path: `order/content-types/order/lifecycles.ts` explicitly blocks *deleting* a non-draft order ("its stock changes cannot be undone automatically"), and there is no cancel endpoint at all. If an order is confirmed by mistake, or the customer backs out after paying a deposit, the stock it consumed is permanently gone from inventory as far as the system is concerned.

Separately, there is currently no way to browse existing orders in the admin UI — an order is only reachable right after creating it (`saveDraft` navigates to `/orders/:id`) or by knowing its URL directly. A cancel feature nobody can reach isn't useful, so a minimal orders list is included here.

## Scope

**In scope:**
- New `cancelled` order status; a cancel action for `draft`, `confirmed`, and `partially_paid` orders.
- Stock restoration: for orders that had passed through `confirm()` (`confirmed`/`partially_paid`), return each line's `quantitySold` to its `stockBatch.quantityRemaining`.
- Fix the latent status-recompute bug this uncovers (see below).
- "Cancel order" UI action + status badge treatment.
- A minimal Orders list page (find an order, see its status, open it) — the smallest UI needed to make cancellation reachable.

**Out of scope:**
- Cancelling a `paid` order — that needs a refund workflow, which is a separate feature.
- Any change to payment records on cancellation — they stay attached to the order as-is, for manual reconciliation (explicit product decision).
- A full orders management page (filtering, bulk actions, date-range search) — the list added here is intentionally minimal; it is not the Catalog Hub (orders are deliberately excluded from that hub per `2026-07-21-catalog-hub-design.md`, and this doesn't change that — it's its own dedicated flow, same as Overview/StockPurchase/OrderForm).
- Deduplicating `order-totals.ts`, which is currently duplicated verbatim at `src/utils/order-totals.ts` (root, wired to the live payment lifecycle) and `src/plugins/inventory-dashboard/server/src/utils/order-totals.ts` (plugin copy, currently unused within the plugin). Both copies get the same one-line fix below to stay in sync; consolidating them into one shared module is a separate cleanup, not bundled into this feature.

## Architecture

### Schema change

`src/api/order/content-types/order/schema.json` — `status` enum gains `cancelled`:
```json
"enum": ["draft", "confirmed", "partially_paid", "paid", "cancelled"]
```

### Latent bug this feature surfaces: `statusFromPayments` needs a `cancelled` guard

`src/utils/order-totals.ts` (and its plugin-side duplicate) currently has:
```ts
export function statusFromPayments(totalPaid: number, finalTotal: number, currentStatus: string): string {
  if (currentStatus === 'draft') return 'draft';
  if (finalTotal > 0 && totalPaid >= finalTotal) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'confirmed';
}
```
This is called from `src/api/payment/content-types/payment/lifecycles.ts` every time a payment is created, updated, or deleted, and unconditionally writes back whatever it returns. Today `draft` is the only status it won't override. Once `cancelled` orders can carry payment rows (per the "keep payments as history" decision above), any later edit to one of those payment rows — e.g. deleting a stale payment — would recompute status from `totalPaid`/`finalTotal` and silently flip the order back to `confirmed`/`partially_paid`/`paid`, un-cancelling it. Fix, in both copies of the file:
```ts
if (currentStatus === 'draft' || currentStatus === 'cancelled') return currentStatus;
```

### Server: cancel service + controller + route

`src/plugins/inventory-dashboard/server/src/services/orders.ts` — new `cancel(documentId)`, structured like the existing `confirm()`:
1. Load the order with `lines: { populate: { stockBatch: true } }`.
2. 404 if not found. `ApplicationError` if `order.status` is not one of `draft`, `confirmed`, `partially_paid` (message should say cancelling a paid order isn't supported and a fully-paid order needs a refund handled outside the system).
3. If `order.status === 'draft'`: no batches were ever decremented (draft orders never reach `confirm()`), so there's nothing to restore — just update status.
4. If `order.status` is `confirmed` or `partially_paid`: both states are only reachable after `confirm()` ran exactly once, so every line's `stockBatch` was decremented by exactly `quantitySold`. Aggregate quantity per batch (same `Map`-based grouping `confirm()` uses) and, inside one `strapi.db.transaction`, increment `quantityRemaining` on each batch via the same `queryBuilder(BATCH)...increment(...)` pattern `confirm()` uses for its decrement (no `$gte` guard needed for an increment — there's no lower bound to violate).
5. Inside the same transaction, update the order: `strapi.documents(ORDER).update({ documentId, data: { status: 'cancelled', __trusted: true } })` — the `__trusted` flag is required to pass `order/lifecycles.ts`'s `beforeUpdate` guard, exactly as `confirm()` already does.
6. Return `this.getWithTotals(documentId)` (same as `confirm()`'s return shape), so the frontend gets back the full order with the new status and unchanged totals/lines.

`src/plugins/inventory-dashboard/server/src/controllers/orders.ts` — new `cancel(ctx)` handler mirroring `confirm`:
```ts
async cancel(ctx) {
  const { documentId } = ctx.params;
  ctx.body = await strapi.plugin('inventory-dashboard').service('orders').cancel(documentId);
},
```

`src/plugins/inventory-dashboard/server/src/routes/index.ts` — new route alongside `confirm`:
```ts
{ method: 'POST', path: '/orders/:documentId/cancel', handler: 'orders.cancel', config: { policies: [requireAccess] } },
```

No change needed to `order-line/content-types/order-line/lifecycles.ts` (blocks editing/deleting lines once `status !== 'draft'` — a cancelled order's lines stay frozen as history, which is correct) or to `order/lifecycles.ts`'s `beforeDelete` (still blocks deleting any non-draft order, including now `cancelled` — cancelled orders remain permanent historical records, consistent with keeping their payment rows).

### Frontend: hook, confirmed-order view, status badge

`src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts` — add a `cancel` action alongside the existing `confirm`:
```ts
const cancel = useCallback(async () => {
  if (!documentId) return;
  const updated = await api.post(`/orders/${documentId}/cancel`);
  setOrder(updated);
  return updated;
}, [documentId]);
```
returned alongside `{ order, loading, reload, confirm, cancel }`.

`src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`, `ConfirmedOrderView`:
- Accept `cancel` as a prop (passed from the parent `OrderForm`, same way `reload`/`api` already are).
- Add a "Cancel order" button, shown only when `order.status === 'confirmed' || order.status === 'partially_paid'` (not for `paid` or already-`cancelled`), styled `colorScheme="red"` `variant="outline"` next to the existing payment section — clicking calls `cancel()` then relies on the existing `reload()`-free `setOrder` inside the hook to reflect the new state (mirrors how `onConfirm` already works one level up, but `ConfirmedOrderView` calls the passed-in `cancel` directly and reads the returned order, matching the existing local pattern of `await addPayment(); reload();` for other mutations in this component).
- Wrap the cancel button in a Chakra `AlertDialog` confirmation (destructive, not reversible via UI) — same conventions already used elsewhere in this codebase for destructive actions (dark-mode/RTL aware, no new pattern to invent).
- Status `Badge` gets a `colorScheme`: green-ish for `paid`, yellow/orange for `partially_paid`/`confirmed`, gray for `draft`, red for `cancelled` (currently the badge is plain with no color at all — this is a small, in-scope improvement since cancelled orders need to be visually distinct at a glance).
- When `order.status === 'cancelled'`, hide the "Record payment" card (nothing more should be added to a cancelled order).

The draft wizard's existing "Cancel" button (the ghost button that calls `onCancel`/navigates away in the non-confirmed branch of `OrderForm`) is unchanged — it's a "leave without saving further changes" action, not a delete, and stays that way. A saved draft order (one with an `id`, already persisted by `saveDraft`) that the user walks away from is not orphaned silently, though: it will show up with a `draft` badge in the new Orders list below, where a small inline "Cancel" action per row calls the same `POST /orders/:documentId/cancel` endpoint the confirmed-order view uses. This is the one place drafts actually get cancelled — keeping the wizard's own Cancel button semantics untouched avoids confusing "navigate away" with "cancel the order" inside the wizard itself.

### New minimal Orders list page

`src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx` (new file):
- Fetches `GET /resources/orders` (already a registered resource in `config/resources.ts`, populated with `customer`, `priceList`, `lines`, `payments`) using the same `useApi`/pagination shape the Catalog Hub's `ResourceListPage` already uses.
- Renders a `DataTable` with columns: Order date, Customer name, Status (colored `Badge`, same scheme as above), Final total (computed client-side the same way `computeTotals`/`order.totals` already does it, or simply read `order.totals` if the list endpoint is switched to return it — simplest: reuse the existing per-row shape from `/resources/orders`, compute `finalTotal` as `sum(line.sellPrice * line.quantitySold) - discountAmount` inline, matching the read-only display need without pulling in the full totals endpoint per row).
- Each row links to `/plugins/inventory-dashboard/orders/:documentId`.
- Rows with `status === 'draft'` get a small inline "Cancel" button (with the same `AlertDialog` confirmation as the confirmed-order view) that calls `POST /orders/:documentId/cancel` and refreshes that row in place — the only UI entry point for cancelling a draft, per the wizard-button note above.
- No search/sort/filter beyond what `ResourceListPage`'s existing generic search-by-name pattern gives for free through the shared `/resources/:resource` endpoint — omitted entirely if it adds complexity, since `name` doesn't exist on orders; a plain paginated list (`createdAt:desc`, already the resource service's default sort) is enough to find a recent order.

`src/plugins/inventory-dashboard/admin/src/config/navConfig.ts` — add one `NavLink` to `TOP_LINKS`, e.g. `{ to: '/plugins/inventory-dashboard/orders', labelId: 'nav.orders', icon: FiList }`, next to the existing "New order" link.

`src/plugins/inventory-dashboard/admin/src/pages/App.tsx` — new route `<Route path="orders" element={<OrdersList />} />`.

## i18n

New strings needed in both `admin/src/i18n/en.ts` and `admin/src/i18n/ar.ts` (mirroring the existing key-per-string convention): nav label for the new Orders link, the "Cancel order" button label, the confirmation dialog copy, an error message for a failed cancel, and column headers for the new list page. No new locale infrastructure — this reuses the existing `LocaleProvider`/`useIntl` setup.

## Data flow

1. Staff opens the new Orders list, finds the order, clicks into it → lands on the existing `ConfirmedOrderView` (or the draft wizard, if still a draft).
2. Clicks "Cancel order" → confirms in the `AlertDialog` → `cancel()` → `POST /orders/:documentId/cancel`.
3. Server: validates status, restores stock (if any was deducted), flips status to `cancelled`, all in one transaction.
4. Response is the full order (same shape `confirm()` already returns) → `useOrder`'s `cancel()` calls `setOrder(updated)` → UI re-renders with the red "Cancelled" badge, payment form hidden, cancel button gone.
5. Overview's stock-value/low-stock/expired numbers are automatically correct on next load — they're computed live from `stock-batch.quantityRemaining`, which the cancel transaction already updated. No separate sync needed.

## Error handling

- Cancelling a `paid` order or an already-`cancelled` order: `ApplicationError` from the service, surfaced in the UI the same way `onConfirm`'s error handling already works (`e?.response?.data?.error?.message`) — a text line above the button, not a toast (no toast system exists in this plugin).
- Concurrent cancel + confirm race (e.g. two staff acting on the same order): not reachable in practice since `confirm()` only fires once per order (guarded by its own `status !== 'draft'` check) and `cancel()`'s own status check + the order lifecycle's `beforeUpdate` guard together prevent a double-transition; no new locking primitive needed beyond what `confirm()` already established for the batch-level race (the same `queryBuilder` conditional pattern is reused for the increment, though an increment can't "fail" the way a decrement can, so no new failure mode is introduced there).

## Testing

Server-side (Jest, mirroring the existing `confirm.test.ts` structure in `src/plugins/inventory-dashboard/server/tests/`):
- Cancel a draft order → status becomes `cancelled`, no batch quantities change.
- Cancel a confirmed order → status becomes `cancelled`, each affected batch's `quantityRemaining` is back to its pre-confirm value.
- Cancel a partially-paid order → same stock restoration; existing payment rows are untouched and still linked.
- Attempt to cancel a `paid` order → `ApplicationError`.
- Attempt to cancel an already-`cancelled` order → `ApplicationError`.
- After cancelling an order with payments, delete one of its payments → order status stays `cancelled` (regression test for the `statusFromPayments` fix).

Manual (dev server, since this plugin has no frontend component test setup):
- Create and confirm an order, note the variant's stock count, cancel it, confirm stock count is restored on the variant's batch and on Overview's totals.
- Cancel a draft order, confirm it disappears from "active" consideration (still visible in the new Orders list with a `cancelled` badge).
- Try cancelling a paid order — confirm the button doesn't appear.
- Open the new Orders list, confirm pagination/links work, confirm dark mode + Arabic/RTL render correctly (badge colors, dialog direction, nav label).
