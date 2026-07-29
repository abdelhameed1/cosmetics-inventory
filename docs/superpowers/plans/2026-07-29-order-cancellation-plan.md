# Order Cancellation with Stock Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff cancel a `draft`, `confirmed`, or `partially_paid` order and have any stock already deducted at confirm time automatically returned to the batches it came from, plus a minimal Orders list so an order can actually be found and cancelled.

**Architecture:** A new `cancelled` order status and a `cancel()` service method (mirroring the existing `confirm()`) that, inside one DB transaction, increments each affected `stock-batch.quantityRemaining` back by the line's `quantitySold` and flips the order to `cancelled`. A `statusFromPayments` guard fix stops a later payment edit from silently un-cancelling an order. A small "Cancel order" UI action is added to the existing confirmed-order view, plus a new minimal Orders list page (none exists today) so cancellation is reachable at all.

**Tech Stack:** Strapi 5.49.0 (TypeScript), Chakra UI 2.8, react-intl, Jest (`ts-jest`) against a live MySQL `cosmetics_test` database.

## Global Constraints

- Cancellable statuses: `draft`, `confirmed`, `partially_paid` only. `paid` orders cannot be cancelled (would need a separate refund flow, out of scope).
- Payments already recorded on a cancelled order are left untouched — kept as history, never deleted or blocked.
- Any direct `strapi.documents('api::order.order').update(...)` call that sets `status` must pass `data: { ..., __trusted: true }`, or `order/content-types/order/lifecycles.ts`'s `beforeUpdate` guard rejects it (this is the existing mechanism `confirm()` already uses — not new).
- `order-totals.ts` is duplicated verbatim in two places: `src/utils/order-totals.ts` (root — this is the one actually wired to `src/api/payment/content-types/payment/lifecycles.ts` and is what matters functionally) and `src/plugins/inventory-dashboard/server/src/utils/order-totals.ts` (plugin copy, currently unused within the plugin but kept in sync). Every change to one must be mirrored in the other. Do not consolidate them into a shared module — that's a separate cleanup, not part of this feature.
- `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts` is typed `Record<keyof typeof en, string>` — every new key added to `en.ts` needs a matching key in `ar.ts` or the type check fails.
- Every new Chakra portal component (`Modal`, `Drawer`, `AlertDialog`, `Popover` content) needs an explicit `dir={locale === 'ar' ? 'rtl' : 'ltr'}` prop (portals render outside the RTL root) and `fontSize="md"` (portals don't inherit the app's anchored base font size — see `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`'s wrapper `Box` for the pattern every other root/portal boundary in this app already follows).
- No toast/notification system exists in this plugin. Errors surface as inline `<Text color="red.600">` near the action that failed, matching every existing form/action in this codebase.
- `npm test` (`cross-env NODE_ENV=test jest --runInBand --forceExit`) requires the live `cosmetics_test` MySQL database — confirmed reachable in this environment (verified via `npm test -- --testPathPatterns=order-guards`, 8/8 passing). Run the real suite; do not skip it.

---

### Task 1: Fix `statusFromPayments` to keep a cancelled order cancelled

**Files:**
- Modify: `src/utils/order-totals.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/utils/order-totals.ts`
- Test: `tests/order-totals.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `statusFromPayments(totalPaid: number, finalTotal: number, currentStatus: string): string` now short-circuits to `currentStatus` for `'cancelled'` in addition to the existing `'draft'` short-circuit. Every later task that writes `status: 'cancelled'` relies on this so a subsequent payment edit can't silently flip it back.

This closes a real bug the new `cancelled` status would otherwise introduce: `src/api/payment/content-types/payment/lifecycles.ts` calls `statusFromPayments` on every payment create/update/delete and unconditionally writes back whatever it returns. Today only `'draft'` is protected from being overwritten; once orders can carry payments *and* be `cancelled`, deleting a stale payment on a cancelled order would recompute status from `totalPaid`/`finalTotal` and silently un-cancel it.

- [ ] **Step 1: Write the failing test**

In `tests/order-totals.test.ts`, add this test inside the existing `describe('statusFromPayments', ...)` block (after the `'maps payments to confirmed/partially_paid/paid...'` test, before the closing `});` of that describe block):

```ts
  it('keeps a cancelled order cancelled regardless of payments', () => {
    expect(statusFromPayments(0, 230, 'cancelled')).toBe('cancelled');
    expect(statusFromPayments(300, 230, 'cancelled')).toBe('cancelled');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPatterns=order-totals`
Expected: FAIL — `statusFromPayments(0, 230, 'cancelled')` currently returns `'confirmed'`, not `'cancelled'`.

- [ ] **Step 3: Fix both copies of the function**

In `src/utils/order-totals.ts`, change:
```ts
export function statusFromPayments(
  totalPaid: number,
  finalTotal: number,
  currentStatus: string
): string {
  if (currentStatus === 'draft') return 'draft';
  if (finalTotal > 0 && totalPaid >= finalTotal) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'confirmed';
}
```
to:
```ts
export function statusFromPayments(
  totalPaid: number,
  finalTotal: number,
  currentStatus: string
): string {
  if (currentStatus === 'draft' || currentStatus === 'cancelled') return currentStatus;
  if (finalTotal > 0 && totalPaid >= finalTotal) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'confirmed';
}
```

Apply the exact same change (same before/after) to `src/plugins/inventory-dashboard/server/src/utils/order-totals.ts` — its `statusFromPayments` function is currently byte-identical to the root copy.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPatterns=order-totals`
Expected: PASS — `Tests: 4 passed, 4 total` (3 existing + the 1 new one) in the `computeTotals`/`statusFromPayments`/`isBelowCost` suite.

- [ ] **Step 5: Commit**

```bash
git add src/utils/order-totals.ts src/plugins/inventory-dashboard/server/src/utils/order-totals.ts tests/order-totals.test.ts
git commit -m "fix: statusFromPayments must not override a cancelled order's status"
```

---

### Task 2: `cancelled` status, `orders.cancel()` service, controller, route

**Files:**
- Modify: `src/api/order/content-types/order/schema.json`
- Modify: `src/plugins/inventory-dashboard/server/src/services/orders.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/controllers/orders.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/routes/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/cancel.test.ts` (new)

**Interfaces:**
- Consumes: `statusFromPayments`'s `cancelled` guard from Task 1 (via the payment lifecycle hook, indirectly — not imported directly by this task's code).
- Produces:
  - `strapi.plugin('inventory-dashboard').service('orders').cancel(documentId: string): Promise<OrderWithTotals>` — same return shape as the existing `confirm(documentId)` (the full order with `.status`, `.lines`, `.totals`, `.exchangeRate`).
  - `POST /orders/:documentId/cancel` admin route, `requireAccess`-gated like every other route in this file, returning that same shape as the response body.
  - These are what Task 3 (frontend hook) and Task 4 (Orders list) call.

- [ ] **Step 1: Write the failing test**

Create `src/plugins/inventory-dashboard/server/tests/cancel.test.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('orders');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function seedBatch(namePrefix: string) {
  const brand = await docs('api::brand.brand').create({ data: { name: `${namePrefix}B-${Math.random()}` } });
  const category = await docs('api::category.category').create({ data: { name: `${namePrefix}C-${Math.random()}` } });
  const product = await docs('api::product.product').create({
    data: { name: `${namePrefix} P`, brand: brand.documentId, category: category.documentId },
  });
  const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
  const supplier = await docs('api::supplier.supplier').create({ data: { name: `${namePrefix}S-${Math.random()}` } });
  const batch = await docs('api::stock-batch.stock-batch').create({
    data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
  });
  return { batch };
}

describe('orders.cancel', () => {
  it('cancels a draft order without touching any batch quantity', async () => {
    const { batch } = await seedBatch('CancelDraft');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelDraftCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const unchangedBatch = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(unchangedBatch.quantityRemaining).toBe(10);
  });

  it('cancels a confirmed order and restores the batch quantity it consumed', async () => {
    const { batch } = await seedBatch('CancelConfirmed');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelConfCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);

    const decremented = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(decremented.quantityRemaining).toBe(7); // 10 - 3

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const restored = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(restored.quantityRemaining).toBe(10);
  });

  it('cancels a partially-paid order, restores stock, and leaves its payment untouched', async () => {
    const { batch } = await seedBatch('CancelPartial');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelPartCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 2, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId); // finalTotal = 200
    const payment = await docs('api::payment.payment').create({
      data: { amount: 50, paymentDate: '2026-07-02', order: order.documentId },
    });
    const beforeCancel = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(beforeCancel.status).toBe('partially_paid');

    const result = await svc().cancel(order.documentId);
    expect(result.status).toBe('cancelled');

    const restored = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(restored.quantityRemaining).toBe(10);

    const survivingPayment = await docs('api::payment.payment').findOne({ documentId: payment.documentId });
    expect(survivingPayment).toBeTruthy();
    expect(Number(survivingPayment.amount)).toBe(50);
  });

  it('rejects cancelling a fully paid order', async () => {
    const { batch } = await seedBatch('CancelPaid');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelPaidCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 1, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);
    await docs('api::payment.payment').create({ data: { amount: 100, paymentDate: '2026-07-02', order: order.documentId } });

    await expect(svc().cancel(order.documentId)).rejects.toThrow(/paid/i);
  });

  it('rejects cancelling an order that is already cancelled', async () => {
    const { batch } = await seedBatch('CancelTwice');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelTwiceCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 1, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);
    await svc().cancel(order.documentId);

    await expect(svc().cancel(order.documentId)).rejects.toThrow(/cancel/i);
  });

  it('stays cancelled even after a payment on it is later deleted (regression: statusFromPayments guard)', async () => {
    const { batch } = await seedBatch('CancelRegression');
    const customer = await docs('api::customer.customer').create({ data: { name: `CancelRegCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 2, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });
    await svc().confirm(order.documentId);
    const payment = await docs('api::payment.payment').create({
      data: { amount: 50, paymentDate: '2026-07-02', order: order.documentId },
    });
    await svc().cancel(order.documentId);

    await docs('api::payment.payment').delete({ documentId: payment.documentId });

    const reloaded = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(reloaded.status).toBe('cancelled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPatterns=cancel`
Expected: FAIL — `svc().cancel is not a function` (and the schema doesn't accept `'cancelled'` yet).

- [ ] **Step 3: Add `cancelled` to the order status enum**

In `src/api/order/content-types/order/schema.json`, change:
```json
    "status": {
      "type": "enumeration",
      "enum": ["draft", "confirmed", "partially_paid", "paid"],
      "default": "draft",
      "required": true
    },
```
to:
```json
    "status": {
      "type": "enumeration",
      "enum": ["draft", "confirmed", "partially_paid", "paid", "cancelled"],
      "default": "draft",
      "required": true
    },
```

- [ ] **Step 4: Implement `cancel()` in the service**

In `src/plugins/inventory-dashboard/server/src/services/orders.ts`, insert this method right after `confirm(...)`'s closing `},` (i.e. between the end of `confirm` and the final `});` that closes the service object):

```ts
  async cancel(documentId: string) {
    const order = await strapi.documents(ORDER as any).findOne({
      documentId,
      populate: { lines: { populate: { stockBatch: true } } },
    } as any);
    if (!order) throw new errors.NotFoundError('Order not found');
    if (!['draft', 'confirmed', 'partially_paid'].includes(order.status)) {
      throw new errors.ApplicationError(
        'Only draft, confirmed, or partially paid orders can be cancelled. A fully paid order needs a refund handled outside the system.'
      );
    }

    if (order.status === 'draft') {
      // draft orders never reached confirm(), so no batch was ever decremented
      await strapi.documents(ORDER as any).update({
        documentId,
        data: { status: 'cancelled', __trusted: true },
      } as any);
      return this.getWithTotals(documentId);
    }

    // status is 'confirmed' or 'partially_paid': both are only reachable after
    // confirm() ran exactly once, so every line's stockBatch was decremented by
    // exactly quantitySold. Aggregate quantity per batch and restore it.
    const lines = order.lines ?? [];
    const perBatch = new Map<string, { batchId: number; qty: number }>();
    for (const line of lines) {
      const key = line.stockBatch.documentId;
      const entry = perBatch.get(key) ?? { batchId: line.stockBatch.id, qty: 0 };
      entry.qty += Number(line.quantitySold);
      perBatch.set(key, entry);
    }

    const batchMeta = strapi.db.metadata.get(BATCH);
    const quantityRemainingColumn = (batchMeta.attributes as any).quantityRemaining?.columnName ?? 'quantityRemaining';

    await strapi.db.transaction(async () => {
      for (const [, { batchId, qty }] of perBatch) {
        await strapi.db
          .queryBuilder(BATCH)
          .where({ id: batchId })
          .increment(quantityRemainingColumn, qty)
          .execute();
      }

      await strapi.documents(ORDER as any).update({
        documentId,
        data: { status: 'cancelled', __trusted: true },
      } as any);
    });

    return this.getWithTotals(documentId);
  },
```

- [ ] **Step 5: Add the controller handler**

In `src/plugins/inventory-dashboard/server/src/controllers/orders.ts`, add this method inside the exported object, after `confirm`:

```ts
  async cancel(ctx) {
    const { documentId } = ctx.params;
    ctx.body = await strapi.plugin('inventory-dashboard').service('orders').cancel(documentId);
  },
```

- [ ] **Step 6: Add the route**

In `src/plugins/inventory-dashboard/server/src/routes/index.ts`, add this line immediately after the `orders/:documentId/confirm` route:

```ts
      { method: 'POST', path: '/orders/:documentId/cancel', handler: 'orders.cancel', config: { policies: [requireAccess] } },
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --testPathPatterns=cancel`
Expected: PASS — `Tests: 6 passed, 6 total`.

Then run the full suite to check for regressions:
Run: `npm test`
Expected: PASS — all suites green, including `tests/order-lifecycle.test.ts` and `tests/order-guards.test.ts` (unaffected by this change) and `src/plugins/inventory-dashboard/server/tests/confirm.test.ts` (unaffected — `confirm()` itself wasn't touched).

- [ ] **Step 8: Commit**

```bash
git add src/api/order/content-types/order/schema.json src/plugins/inventory-dashboard/server/src/services/orders.ts src/plugins/inventory-dashboard/server/src/controllers/orders.ts src/plugins/inventory-dashboard/server/src/routes/index.ts src/plugins/inventory-dashboard/server/tests/cancel.test.ts
git commit -m "feat: add order cancellation with stock restoration"
```

---

### Task 3: Cancel-order UI in the confirmed-order view

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx` (one-line adjacent fix, see Step 5)
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`

**Interfaces:**
- Consumes: `POST /orders/:documentId/cancel` from Task 2.
- Produces: `useOrder(documentId)` now returns `{ order, loading, reload, confirm, cancel }` where `cancel(): Promise<any>` posts to the cancel endpoint and updates local order state — Task 4 does **not** consume this hook (it isn't scoped to a single order), but reuses the same endpoint directly.

- [ ] **Step 1: Add `cancel` to `useOrder`**

In `src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts`, change:
```ts
  const confirm = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/confirm`);
    setOrder(updated);
    return updated;
  }, [documentId]);

  return { order, loading, reload, confirm };
}
```
to:
```ts
  const confirm = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/confirm`);
    setOrder(updated);
    return updated;
  }, [documentId]);

  const cancel = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/cancel`);
    setOrder(updated);
    return updated;
  }, [documentId]);

  return { order, loading, reload, confirm, cancel };
}
```

- [ ] **Step 2: Add i18n strings**

In `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`, add these lines right after `'orderForm.shortfallError': 'Not enough stock: short by {count} unit(s).',` (still inside the object, before the closing `} as const;`):

```ts
  'orderForm.confirmed.cancelOrderButton': 'Cancel order',
  'orderForm.confirmed.cancelConfirmTitle': 'Cancel this order?',
  'orderForm.confirmed.cancelConfirmBody': 'This restores any deducted stock and cannot be undone.',
  'orderForm.confirmed.cancelError': 'Could not cancel order',
```

In `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`, add the matching keys right after `'orderForm.shortfallError': 'المخزون غير كافٍ — ينقص {count} وحدة.',` (before the closing `};`):

```ts
  'orderForm.confirmed.cancelOrderButton': 'إلغاء الطلب',
  'orderForm.confirmed.cancelConfirmTitle': 'هل تريد إلغاء هذا الطلب؟',
  'orderForm.confirmed.cancelConfirmBody': 'سيؤدي هذا إلى إعادة أي مخزون تم خصمه، ولا يمكن التراجع عن هذا الإجراء.',
  'orderForm.confirmed.cancelError': 'تعذّر إلغاء الطلب',
```

- [ ] **Step 3: Update `OrderForm.tsx`**

First, change how `ConfirmedOrderView` is invoked and what it receives. In `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`:

Change:
```ts
  const { order, reload, confirm } = useOrder(id);
```
to:
```ts
  const { order, reload, confirm, cancel } = useOrder(id);
```

Change:
```tsx
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} />;
  }
```
to:
```tsx
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} cancel={cancel} />;
  }
```

Add these imports to the existing import block at the top of the file — change:
```ts
import { useEffect, useState } from 'react';
```
to:
```ts
import { useEffect, useRef, useState } from 'react';
```
and change:
```ts
import {
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
```
to:
```ts
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay,
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
```
and add this import alongside the existing `useIntl`/`useApi` imports:
```ts
import { useLocale } from '../i18n/LocaleProvider';
```

Now rewrite `ConfirmedOrderView` itself. Replace the entire function (from `function ConfirmedOrderView({ order, reload, api }: { order: any; reload: () => void; api: any }) {` through its closing `}` at the end of the file) with:

```tsx
const STATUS_COLOR_SCHEME: Record<string, string> = {
  draft: 'gray',
  confirmed: 'yellow',
  partially_paid: 'orange',
  paid: 'green',
  cancelled: 'red',
};

function ConfirmedOrderView({
  order, reload, api, cancel,
}: { order: any; reload: () => void; api: any; cancel: () => Promise<any> }) {
  const intl = useIntl();
  const { locale } = useLocale();
  const [amount, setAmount] = useState<number | undefined>(0);
  const [method, setMethod] = useState('cash');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const addPayment = async () => {
    await api.post('/resources/payments', {
      amount: amount ?? 0, method, paymentDate: formatLocalDate(new Date()), order: order.documentId,
    });
    setAmount(0);
    reload();
  };

  const canCancel = order.status === 'confirmed' || order.status === 'partially_paid';

  const onCancelOrder = async () => {
    setCancelError(null);
    try {
      await cancel();
    } catch (e: any) {
      setCancelError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.confirmed.cancelError', defaultMessage: 'Could not cancel order' }));
    } finally {
      setIsCancelOpen(false);
    }
  };

  return (
    <Box p={{ base: 4, md: 8 }}>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="lg" fontWeight="bold" color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.orderTitle', defaultMessage: 'Order {id}' }, { id: order.documentId.slice(0, 8) })}
        </Text>
        <HStack spacing={2}>
          <Badge fontSize="sm" colorScheme={STATUS_COLOR_SCHEME[order.status] ?? 'gray'}>{order.status}</Badge>
          {canCancel && (
            <Button colorScheme="red" variant="outline" size="sm" onClick={() => setIsCancelOpen(true)}>
              {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
            </Button>
          )}
        </HStack>
      </HStack>
      {cancelError && <Text color="red.600" pb={4}>{cancelError}</Text>}

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

      {order.status !== 'cancelled' && (
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
      )}

      <AlertDialog isOpen={isCancelOpen} leastDestructiveRef={cancelRef} onClose={() => setIsCancelOpen(false)}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmTitle', defaultMessage: 'Cancel this order?' })}</AlertDialogHeader>
            <AlertDialogBody>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmBody', defaultMessage: 'This restores any deducted stock and cannot be undone.' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setIsCancelOpen(false)}>
                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button colorScheme="red" onClick={onCancelOrder} ms={3}>
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

- [ ] **Step 4: Type-check**

Run: `npm run test:ts:front`
Expected: PASS, no errors — this also catches any `ar.ts`/`en.ts` key mismatch from Step 2.

- [ ] **Step 5: Adjacent fix — `ResourceListPage.tsx`'s delete-confirmation dialog is missing the same `fontSize="md"` anchor**

While implementing Step 3 above you added `fontSize="md"` to a new `AlertDialogContent`, per the Global Constraints rule that every portal needs it. `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx` already has an `AlertDialogContent` (its delete-confirmation dialog) that predates that rule and was missed by the font-scale feature's review — it has `dir` but not `fontSize`, so its text doesn't respect the S/M/L font size setting. Fix it now, in the same file, one line:

Change:
```tsx
          <AlertDialogContent borderRadius="xl" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```
to:
```tsx
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

- [ ] **Step 6: Manual verification (dev server)**

This plugin has no frontend component test setup, so this task's UI is verified manually:
```bash
npm run develop
```
- Create and confirm an order, note the variant's stock count on the Overview page.
- Open the confirmed order, confirm the status badge is now colored (yellow for `confirmed`).
- Click "Cancel order", confirm the `AlertDialog` appears with correct text, dismiss it via the "Cancel" button — order should be unchanged.
- Click "Cancel order" again, confirm via the dialog's "Cancel order" button — status badge turns red/"cancelled", the "Record payment" card disappears, the "Cancel order" button disappears.
- Check the Overview page — the variant's stock count is back to what it was before the order was confirmed.
- Switch to Arabic (RTL) and dark mode, repeat the cancel flow, confirm the dialog renders mirrored/dark correctly and its text is legible.
- Try the Small/Medium/Large text-size toggle while the cancel dialog and (separately) the ResourceListPage delete dialog are open — confirm both now resize.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx src/plugins/inventory-dashboard/admin/src/i18n/en.ts src/plugins/inventory-dashboard/admin/src/i18n/ar.ts
git commit -m "feat: add Cancel order action to the confirmed-order view"
```

---

### Task 4: Minimal Orders list page

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/config/navConfig.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/App.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`

**Interfaces:**
- Consumes: `GET /resources/orders` (already registered in `config/resources.ts` with `populate: ['customer', 'priceList', 'lines', 'payments']` — no server change needed) and `POST /orders/:documentId/cancel` from Task 2, called directly (not through `useOrder`, since this page lists many orders at once).
- Produces: route `/plugins/inventory-dashboard/orders`, nav entry, and the `OrdersList` component — nothing later consumes these programmatically.

- [ ] **Step 1: Add i18n strings**

In `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`, add these lines right after the 4 keys Task 3 added (`'orderForm.confirmed.cancelError': ...`), still before the closing `} as const;`:

```ts
  'nav.orders': 'Orders',
  'ordersList.col.date': 'Date',
  'ordersList.col.customer': 'Customer',
  'ordersList.col.status': 'Status',
  'ordersList.col.total': 'Total (EGP)',
  'ordersList.cancelError': 'Could not cancel order',
```

In `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`, add the matching keys right after the 4 keys Task 3 added, before the closing `};`:

```ts
  'nav.orders': 'الطلبات',
  'ordersList.col.date': 'التاريخ',
  'ordersList.col.customer': 'العميل',
  'ordersList.col.status': 'الحالة',
  'ordersList.col.total': 'الإجمالي (جنيه)',
  'ordersList.cancelError': 'تعذّر إلغاء الطلب',
```

- [ ] **Step 2: Create `OrdersList.tsx`**

Create `src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx`:

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay,
  Badge, Box, Button, Td, Text, Tr,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useLocale } from '../i18n/LocaleProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';

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
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<any | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const load = () => {
    api
      .get<{ results: any[] }>('/resources/orders', { pageSize: 100 })
      .then((d) => setRows(d.results))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => { load(); }, []);

  const confirmCancel = async () => {
    if (!toCancel) return;
    try {
      await api.post(`/orders/${toCancel.documentId}/cancel`);
      setError(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'ordersList.cancelError', defaultMessage: 'Could not cancel order' }));
    } finally {
      setToCancel(null);
    }
  };

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.orders', defaultMessage: 'Orders' })} />

      {error && <Text color="red.600" pb={4}>{error}</Text>}

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
                <Button size="sm" variant="ghost" colorScheme="red" onClick={() => setToCancel(row)}>
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
              <Button colorScheme="red" onClick={confirmCancel} ms={3}>
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

- [ ] **Step 3: Wire the route**

In `src/plugins/inventory-dashboard/admin/src/pages/App.tsx`, add the import:
```ts
import OrdersList from './OrdersList';
```
right after `import OrderForm from './OrderForm';`, and add the route right after `<Route path="stock-purchase" element={<StockPurchase />} />`:
```tsx
          <Route path="orders" element={<OrdersList />} />
```

- [ ] **Step 4: Add the nav link**

In `src/plugins/inventory-dashboard/admin/src/config/navConfig.ts`, change:
```ts
import {
  FiHome, FiBriefcase, FiShoppingCart,
  FiBox, FiLayers, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign,
} from 'react-icons/fi';
```
to:
```ts
import {
  FiHome, FiBriefcase, FiShoppingCart, FiList,
  FiBox, FiLayers, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign,
} from 'react-icons/fi';
```
and change:
```ts
export const TOP_LINKS: NavLink[] = [
  { to: '/plugins/inventory-dashboard', labelId: 'nav.overview', icon: FiHome },
  { to: '/plugins/inventory-stock', labelId: 'nav.stockPurchase', icon: FiBriefcase },
  { to: '/plugins/inventory-orders', labelId: 'nav.newOrder', icon: FiShoppingCart },
];
```
to:
```ts
export const TOP_LINKS: NavLink[] = [
  { to: '/plugins/inventory-dashboard', labelId: 'nav.overview', icon: FiHome },
  { to: '/plugins/inventory-dashboard/orders', labelId: 'nav.orders', icon: FiList },
  { to: '/plugins/inventory-stock', labelId: 'nav.stockPurchase', icon: FiBriefcase },
  { to: '/plugins/inventory-orders', labelId: 'nav.newOrder', icon: FiShoppingCart },
];
```

- [ ] **Step 5: Type-check**

Run: `npm run test:ts:front`
Expected: PASS, no errors.

- [ ] **Step 6: Manual verification (dev server)**

```bash
npm run develop
```
- Confirm a new "Orders" nav link appears and navigates to a list of existing orders (date, customer, colored status badge, total).
- Click a row, confirm it opens that order (wizard for a draft, `ConfirmedOrderView` for anything else).
- Create a new draft order but don't confirm it (use the wizard's own "Cancel" button to leave, or just navigate away) — confirm it shows up in the Orders list with a gray "draft" badge and a "Cancel order" row action.
- Click that row action, confirm through the dialog, confirm the row updates to a red "cancelled" badge and the action disappears.
- Switch to Arabic/RTL and dark mode, confirm the list, badges, and dialog all render correctly.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx src/plugins/inventory-dashboard/admin/src/pages/App.tsx src/plugins/inventory-dashboard/admin/src/config/navConfig.ts src/plugins/inventory-dashboard/admin/src/i18n/en.ts src/plugins/inventory-dashboard/admin/src/i18n/ar.ts
git commit -m "feat: add minimal Orders list page with nav entry"
```
