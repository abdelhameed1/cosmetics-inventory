# Cosmetics Inventory — Phase 3: Orders, Payments, Pricing & FIFO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the sales side of the system: Order / Order Line / Payment content types, FIFO batch consumption on order confirmation, price-list-driven sell-price suggestions, a below-cost warning flag, automatic order status from payments, and an Order form UI with cross-sell suggestions.

**Architecture:** Three new content types carry order data. Pure, unit-tested utilities compute order totals and status. Plugin services resolve FIFO segments and suggested prices and expose a confirm endpoint that decrements `quantityRemaining`, snapshots cost, and locks the order. Computed order figures are derived on read (never stored) using the live exchange rate. The order status rule lives on the Payment model so it applies regardless of caller.

**Tech Stack:** Strapi `5.49.0` (TypeScript), MySQL 8, Jest + `ts-jest`, the `inventory-dashboard` plugin (React 18, `@strapi/design-system` v2, `react-router-dom` v6).

## Global Constraints

- Requires Phase 1 (data model) and Phase 2 (dashboard plugin) complete.
- Costs are stored only as USD snapshots; EGP is always `costPriceUsdSnapshot × exchangeRate` at read time. Never store EGP.
- FIFO order: batches with `quantityRemaining > 0`, sorted `purchaseDate ASC`, ties broken by `createdAt ASC`. Expired batches **are included** (expiry is informational, not blocking).
- Below-cost is a non-blocking **warning flag**, never an error: `sellPrice < costPriceUsdSnapshot × exchangeRate`.
- Order status values: `draft | confirmed | partially_paid | paid`. Payments never move an order out of `draft`.
- Computed order figures (subtotal, totalCostEgp, finalTotal, netProfit, totalPaid, balanceDue) are derived on read, not stored.
- New plugin endpoints stay under `type: 'admin'` at `/inventory-dashboard/*`.
- `@strapi/utils` remains externalized in the plugin (Phase 2 constraint).
- Plugin quality gate after plugin changes: `npm run build`, `npm run lint`, `npx tsc --noEmit` — all clean. Commit after each task.

---

### Task 1: Order, Order Line, and Payment content types

**Files:**
- Create: `src/api/order/...` (schema + controller/service/route)
- Create: `src/api/order-line/...` (schema + controller/service/route)
- Create: `src/api/payment/...` (schema + controller/service/route)

**Interfaces:**
- Consumes: Phase 1 customer, price-list, stock-batch types.
- Produces:
  - `api::order.order` — `orderDate: date (required)`, `status: enumeration [draft, confirmed, partially_paid, paid] (default draft)`, `discountAmount: decimal (default 0)`, `shippingNotes: text`, `notes: text`, `customer: manyToOne → customer`, `priceList: manyToOne → price-list`, `lines: oneToMany → order-line (mappedBy "order")`, `payments: oneToMany → payment (mappedBy "order")`.
  - `api::order-line.order-line` — `quantitySold: integer (min 1, required)`, `costPriceUsdSnapshot: decimal`, `sellPrice: decimal (required)`, `referenceRetailPrice: decimal`, `lineNotes: text`, `order: manyToOne → order (inversedBy "lines")`, `stockBatch: manyToOne → stock-batch` (one-sided).
  - `api::payment.payment` — `amount: decimal (required)`, `paymentDate: date (required)`, `method: enumeration [cash, transfer]`, `notes: text`, `order: manyToOne → order (inversedBy "payments")`.

- [ ] **Step 1: Write the Order schema**

`src/api/order/content-types/order/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "orders",
  "info": { "singularName": "order", "pluralName": "orders", "displayName": "Order" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "orderDate": { "type": "date", "required": true },
    "status": {
      "type": "enumeration",
      "enum": ["draft", "confirmed", "partially_paid", "paid"],
      "default": "draft",
      "required": true
    },
    "discountAmount": { "type": "decimal", "default": 0 },
    "shippingNotes": { "type": "text" },
    "notes": { "type": "text" },
    "customer": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::customer.customer"
    },
    "priceList": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::price-list.price-list"
    },
    "lines": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::order-line.order-line",
      "mappedBy": "order"
    },
    "payments": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::payment.payment",
      "mappedBy": "order"
    }
  }
}
```

- [ ] **Step 2: Write the Order Line schema**

`src/api/order-line/content-types/order-line/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "order_lines",
  "info": { "singularName": "order-line", "pluralName": "order-lines", "displayName": "Order Line" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "quantitySold": { "type": "integer", "min": 1, "required": true },
    "costPriceUsdSnapshot": { "type": "decimal" },
    "sellPrice": { "type": "decimal", "required": true },
    "referenceRetailPrice": { "type": "decimal" },
    "lineNotes": { "type": "text" },
    "order": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::order.order",
      "inversedBy": "lines"
    },
    "stockBatch": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::stock-batch.stock-batch"
    }
  }
}
```

- [ ] **Step 3: Write the Payment schema**

`src/api/payment/content-types/payment/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "payments",
  "info": { "singularName": "payment", "pluralName": "payments", "displayName": "Payment" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "amount": { "type": "decimal", "required": true },
    "paymentDate": { "type": "date", "required": true },
    "method": { "type": "enumeration", "enum": ["cash", "transfer"] },
    "notes": { "type": "text" },
    "order": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::order.order",
      "inversedBy": "payments"
    }
  }
}
```

- [ ] **Step 4: Write factory files for all three**

For each of `order` (`api::order.order`), `order-line` (`api::order-line.order-line`), `payment` (`api::payment.payment`), create `controllers/<name>.ts`, `services/<name>.ts`, `routes/<name>.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::order.order');
```
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::order.order');
```
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::order.order');
```
(Substitute the matching UID in each folder.)

- [ ] **Step 5: Verify the app boots with the new types**

Run: `npm run build`
Expected: exits 0 (admin builds; new content types compile).

- [ ] **Step 6: Commit**

```bash
git add src/api/order src/api/order-line src/api/payment
git commit -m "feat: add Order, Order Line, Payment content types"
```

---

### Task 2: Order-totals utility (pure functions)

**Files:**
- Create: `src/utils/order-totals.ts`
- Test: `tests/order-totals.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (all amounts in EGP unless noted):
  ```ts
  interface LineInput { sellPrice: number; quantitySold: number; costPriceUsdSnapshot?: number | null; }
  interface PaymentInput { amount: number; }
  interface OrderTotals {
    subtotal: number; totalCostEgp: number; finalTotal: number;
    netProfit: number; totalPaid: number; balanceDue: number;
  }
  function computeTotals(lines: LineInput[], discountAmount: number, exchangeRate: number, payments: PaymentInput[]): OrderTotals;
  function statusFromPayments(totalPaid: number, finalTotal: number, currentStatus: string): string;
  function isBelowCost(sellPrice: number, costPriceUsdSnapshot: number, exchangeRate: number): boolean;
  ```

- [ ] **Step 1: Write the failing test**

`tests/order-totals.test.ts`:
```ts
import { computeTotals, statusFromPayments, isBelowCost } from '../src/utils/order-totals';

describe('computeTotals', () => {
  it('derives subtotal, cost, profit, and balance', () => {
    const lines = [
      { sellPrice: 100, quantitySold: 2, costPriceUsdSnapshot: 1 }, // sell 200, cost 1*50*2=100
      { sellPrice: 50, quantitySold: 1, costPriceUsdSnapshot: 0.5 }, // sell 50, cost 0.5*50*1=25
    ];
    const t = computeTotals(lines, 20, 50, [{ amount: 100 }]);
    expect(t.subtotal).toBe(250);
    expect(t.totalCostEgp).toBe(125);
    expect(t.finalTotal).toBe(230);   // 250 - 20 discount
    expect(t.netProfit).toBe(105);    // 230 - 125
    expect(t.totalPaid).toBe(100);
    expect(t.balanceDue).toBe(130);   // 230 - 100
  });
});

describe('statusFromPayments', () => {
  it('keeps a draft order in draft regardless of payments', () => {
    expect(statusFromPayments(0, 230, 'draft')).toBe('draft');
    expect(statusFromPayments(300, 230, 'draft')).toBe('draft');
  });
  it('maps payments to confirmed/partially_paid/paid for a confirmed order', () => {
    expect(statusFromPayments(0, 230, 'confirmed')).toBe('confirmed');
    expect(statusFromPayments(100, 230, 'confirmed')).toBe('partially_paid');
    expect(statusFromPayments(230, 230, 'confirmed')).toBe('paid');
    expect(statusFromPayments(999, 230, 'partially_paid')).toBe('paid');
  });
});

describe('isBelowCost', () => {
  it('flags a sell price below the EGP cost', () => {
    expect(isBelowCost(40, 1, 50)).toBe(true);  // 40 < 50
    expect(isBelowCost(60, 1, 50)).toBe(false); // 60 >= 50
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx cross-env NODE_ENV=test jest tests/order-totals.test.ts --runInBand --forceExit`
Expected: FAIL — cannot find module `../src/utils/order-totals`.

- [ ] **Step 3: Write the utility**

`src/utils/order-totals.ts`:
```ts
export interface LineInput {
  sellPrice: number;
  quantitySold: number;
  costPriceUsdSnapshot?: number | null;
}
export interface PaymentInput {
  amount: number;
}
export interface OrderTotals {
  subtotal: number;
  totalCostEgp: number;
  finalTotal: number;
  netProfit: number;
  totalPaid: number;
  balanceDue: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(
  lines: LineInput[],
  discountAmount: number,
  exchangeRate: number,
  payments: PaymentInput[]
): OrderTotals {
  const subtotal = lines.reduce((s, l) => s + Number(l.sellPrice) * Number(l.quantitySold), 0);
  const totalCostEgp = lines.reduce(
    (s, l) => s + Number(l.costPriceUsdSnapshot ?? 0) * exchangeRate * Number(l.quantitySold),
    0
  );
  const discount = Number(discountAmount) || 0;
  const finalTotal = subtotal - discount;
  const netProfit = finalTotal - totalCostEgp;
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = finalTotal - totalPaid;

  return {
    subtotal: round2(subtotal),
    totalCostEgp: round2(totalCostEgp),
    finalTotal: round2(finalTotal),
    netProfit: round2(netProfit),
    totalPaid: round2(totalPaid),
    balanceDue: round2(balanceDue),
  };
}

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

export function isBelowCost(
  sellPrice: number,
  costPriceUsdSnapshot: number,
  exchangeRate: number
): boolean {
  return Number(sellPrice) < Number(costPriceUsdSnapshot) * exchangeRate;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx cross-env NODE_ENV=test jest tests/order-totals.test.ts --runInBand --forceExit`
Expected: PASS — all three describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/order-totals.ts tests/order-totals.test.ts
git commit -m "feat: pure order-totals utility (totals, status, below-cost)"
```

---

### Task 3: Payment status rule + Stock Batch deletion guard

**Files:**
- Create: `src/api/payment/content-types/payment/lifecycles.ts`
- Modify: `src/api/stock-batch/content-types/stock-batch/lifecycles.ts`
- Test: `tests/order-lifecycle.test.ts`

**Interfaces:**
- Consumes: `order-totals` util; Order/Order Line/Payment/Stock Batch types.
- Produces:
  - Payment `afterCreate`/`afterUpdate`/`afterDelete`: recompute the parent order's `totalPaid` vs `finalTotal` and set `order.status` via `statusFromPayments` (never overriding `draft`).
  - Stock Batch `beforeDelete`/`beforeDeleteMany`: block deletion when any order line references the batch.

- [ ] **Step 1: Write the failing test**

`tests/order-lifecycle.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function seedConfirmedOrder(sellPrice: number, qty: number) {
  const customer = await docs('api::customer.customer').create({ data: { name: `OC-${Math.random()}` } });
  const order = await docs('api::order.order').create({
    data: { orderDate: '2026-07-01', status: 'confirmed', discountAmount: 0, customer: customer.documentId },
  });
  await docs('api::order-line.order-line').create({
    data: { quantitySold: qty, sellPrice, order: order.documentId },
  });
  return order;
}

describe('Payment → order status', () => {
  it('moves a confirmed order to partially_paid then paid', async () => {
    const order = await seedConfirmedOrder(100, 1); // finalTotal = 100
    await docs('api::payment.payment').create({
      data: { amount: 40, paymentDate: '2026-07-02', order: order.documentId },
    });
    let reloaded = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(reloaded.status).toBe('partially_paid');

    await docs('api::payment.payment').create({
      data: { amount: 60, paymentDate: '2026-07-03', order: order.documentId },
    });
    reloaded = await docs('api::order.order').findOne({ documentId: order.documentId });
    expect(reloaded.status).toBe('paid');
  });
});

describe('Stock Batch deletion guard', () => {
  it('blocks deleting a batch referenced by an order line', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `GB-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `GC-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Guarded P', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `GS-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, costPriceUsd: 2, purchaseDate: '2026-06-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customer = await docs('api::customer.customer').create({ data: { name: `GCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 1, sellPrice: 100, order: order.documentId, stockBatch: batch.documentId },
    });

    await expect(
      docs('api::stock-batch.stock-batch').delete({ documentId: batch.documentId })
    ).rejects.toThrow(/cannot delete this stock batch/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx cross-env NODE_ENV=test jest tests/order-lifecycle.test.ts --runInBand --forceExit`
Expected: FAIL — status stays `confirmed`; batch delete does not throw.

- [ ] **Step 3: Write the Payment lifecycle**

`src/api/payment/content-types/payment/lifecycles.ts`:
```ts
import { computeTotals, statusFromPayments } from '../../../../utils/order-totals';

async function recomputeOrderStatus(orderEntityId: number | undefined, orderDocumentId?: string) {
  if (!orderEntityId && !orderDocumentId) return;

  const order = orderDocumentId
    ? await strapi.documents('api::order.order').findOne({
        documentId: orderDocumentId,
        populate: { lines: true, payments: true },
      })
    : await strapi.db.query('api::order.order').findOne({
        where: { id: orderEntityId },
        populate: { lines: true, payments: true },
      });

  if (!order) return;

  const totals = computeTotals(
    (order.lines ?? []).map((l: any) => ({
      sellPrice: Number(l.sellPrice),
      quantitySold: Number(l.quantitySold),
      costPriceUsdSnapshot: l.costPriceUsdSnapshot,
    })),
    Number(order.discountAmount) || 0,
    1, // exchangeRate irrelevant to status (only totalPaid vs finalTotal)
    (order.payments ?? []).map((p: any) => ({ amount: Number(p.amount) }))
  );

  const nextStatus = statusFromPayments(totals.totalPaid, totals.finalTotal, order.status);
  if (nextStatus !== order.status) {
    await strapi.documents('api::order.order').update({
      documentId: order.documentId,
      data: { status: nextStatus },
    });
  }
}

async function orderRefFromEvent(event: any): Promise<{ documentId?: string }> {
  // resolve the linked order's documentId from the payment row
  const id = event.result?.id ?? event.params?.where?.id;
  if (!id) return {};
  const payment = await strapi.db.query('api::payment.payment').findOne({
    where: { id },
    populate: { order: true },
  });
  return { documentId: payment?.order?.documentId };
}

export default {
  async afterCreate(event) {
    const { documentId } = await orderRefFromEvent(event);
    await recomputeOrderStatus(undefined, documentId);
  },
  async afterUpdate(event) {
    const { documentId } = await orderRefFromEvent(event);
    await recomputeOrderStatus(undefined, documentId);
  },
  async beforeDelete(event) {
    // capture order link before the row is gone
    const id = event.params?.where?.id;
    if (id) {
      const payment = await strapi.db.query('api::payment.payment').findOne({
        where: { id }, populate: { order: true },
      });
      (event.state ||= {}).orderDocumentId = payment?.order?.documentId;
    }
  },
  async afterDelete(event) {
    await recomputeOrderStatus(undefined, event.state?.orderDocumentId);
  },
};
```

- [ ] **Step 4: Add the Stock Batch deletion guard**

Replace `src/api/stock-batch/content-types/stock-batch/lifecycles.ts` with (keeps the Phase 1 `beforeCreate` seed rule and adds the guard):
```ts
import { errors } from '@strapi/utils';

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    if (data.quantityRemaining === undefined || data.quantityRemaining === null) {
      data.quantityRemaining = data.quantityPurchased;
    }
  },
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::order-line.order-line')
      .count({ where: { stockBatch: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this stock batch: ${count} order line(s) reference it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::order-line.order-line')
        .count({ where: { stockBatch: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a stock batch referenced by order lines.'
        );
      }
    }
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx cross-env NODE_ENV=test jest tests/order-lifecycle.test.ts --runInBand --forceExit`
Expected: PASS — order goes partially_paid → paid; batch deletion blocked.

- [ ] **Step 6: Commit**

```bash
git add src/api/payment src/api/stock-batch tests/order-lifecycle.test.ts
git commit -m "feat: payment-driven order status + stock-batch deletion guard"
```

---

### Task 4: FIFO resolution service

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/services/fifo.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/services/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/fifo.test.ts`

**Interfaces:**
- Consumes: stock-batch + variant types.
- Produces: service `fifo` with `resolve(variantDocumentId, quantity)`:
  ```ts
  interface FifoSegment {
    batchDocumentId: string;
    costPriceUsd: number;
    quantityFromBatch: number;
    purchaseDate: string;
    expiryDate: string | null;
  }
  resolve(variantDocumentId: string, quantity: number): Promise<{ segments: FifoSegment[]; shortfall: number }>;
  ```
  Batches sorted `purchaseDate ASC, createdAt ASC`, only `quantityRemaining > 0`, expired included. `shortfall > 0` when stock cannot cover `quantity`.

- [ ] **Step 1: Write the failing FIFO test**

`src/plugins/inventory-dashboard/server/tests/fifo.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('fifo');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('fifo service', () => {
  it('splits a quantity across batches oldest-first', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `FB-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `FC-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'FIFO P', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const variant = variants[0];
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `FS-${Math.random()}` } });

    await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 6, quantityRemaining: 6, costPriceUsd: 2, purchaseDate: '2026-01-01', variant: variant.documentId, supplier: supplier.documentId },
    });
    await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 3, purchaseDate: '2026-03-01', variant: variant.documentId, supplier: supplier.documentId },
    });

    const { segments, shortfall } = await svc().resolve(variant.documentId, 8);
    expect(shortfall).toBe(0);
    expect(segments).toHaveLength(2);
    expect(segments[0].quantityFromBatch).toBe(6); // oldest fully consumed
    expect(segments[0].costPriceUsd).toBe(2);
    expect(segments[1].quantityFromBatch).toBe(2); // remainder from newer batch
    expect(segments[1].costPriceUsd).toBe(3);
  });

  it('reports a shortfall when stock is insufficient', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `FB2-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `FC2-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'FIFO P2', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `FS2-${Math.random()}` } });
    await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 2, quantityRemaining: 2, costPriceUsd: 1, purchaseDate: '2026-02-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const { segments, shortfall } = await svc().resolve(variants[0].documentId, 5);
    expect(segments).toHaveLength(1);
    expect(shortfall).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/fifo.test.ts --runInBand --forceExit; cd ../../..`
Expected: FAIL — service `fifo` not registered.

- [ ] **Step 3: Write the FIFO service**

`src/plugins/inventory-dashboard/server/src/services/fifo.ts`:
```ts
import type { Core } from '@strapi/strapi';

export interface FifoSegment {
  batchDocumentId: string;
  costPriceUsd: number;
  quantityFromBatch: number;
  purchaseDate: string;
  expiryDate: string | null;
}

const fifo = ({ strapi }: { strapi: Core.Strapi }) => ({
  async resolve(variantDocumentId: string, quantity: number): Promise<{ segments: FifoSegment[]; shortfall: number }> {
    const batches = await strapi.documents('api::stock-batch.stock-batch' as any).findMany({
      filters: {
        variant: { documentId: variantDocumentId },
        quantityRemaining: { $gt: 0 },
      },
      sort: ['purchaseDate:asc', 'createdAt:asc'],
      pageSize: 1000,
    } as any);

    let remaining = Math.max(0, Number(quantity) || 0);
    const segments: FifoSegment[] = [];

    for (const b of batches) {
      if (remaining <= 0) break;
      const available = Number(b.quantityRemaining);
      const take = Math.min(remaining, available);
      segments.push({
        batchDocumentId: b.documentId,
        costPriceUsd: Number(b.costPriceUsd),
        quantityFromBatch: take,
        purchaseDate: b.purchaseDate,
        expiryDate: b.expiryDate ?? null,
      });
      remaining -= take;
    }

    return { segments, shortfall: remaining };
  },
});

export default fifo;
```

- [ ] **Step 4: Register the service**

Add to `src/plugins/inventory-dashboard/server/src/services/index.ts`:
```ts
import resource from './resource';
import metadata from './metadata';
import overview from './overview';
import fifo from './fifo';

export default {
  resource,
  metadata,
  overview,
  fifo,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/fifo.test.ts --runInBand --forceExit; cd ../../..`
Expected: PASS — split 6+2 oldest-first; shortfall 3 when short.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): FIFO batch resolution service"
```

---

### Task 5: Pricing service

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/services/pricing.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/services/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/pricing.test.ts`

**Interfaces:**
- Consumes: price-list + system-settings types.
- Produces: service `pricing` with `suggest({ priceListDocumentId, costPriceUsd, quantity })` → `{ sellPrice: number; retailPrice: number; exchangeRate: number }`. Rules (let `egpCost = costPriceUsd × exchangeRate`, `retailMargin` from the seeded "Retail" list):
  - **retail**: `egpCost × (1 + marginPercent/100)`
  - **wholesale**: if `quantity ≥ wholesaleMinQty` → `egpCost × (1 + marginPercent/100)`; else fall back to retail price (`egpCost × (1 + retailMargin/100)`)
  - **vip**: `retailPrice × (1 − vipDiscountPercent/100)` where `retailPrice = egpCost × (1 + retailMargin/100)`

- [ ] **Step 1: Write the failing pricing test**

`src/plugins/inventory-dashboard/server/tests/pricing.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('pricing');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

async function setRate(rate: number) {
  const existing = await docs('api::system-settings.system-settings').findFirst();
  if (existing) await docs('api::system-settings.system-settings').update({ data: { exchangeRate: rate } } as any);
  else await docs('api::system-settings.system-settings').create({ data: { exchangeRate: rate } } as any);
}

async function priceListByName(name: string) {
  const [pl] = await docs('api::price-list.price-list').findMany({ filters: { name } });
  return pl;
}

describe('pricing service', () => {
  it('applies the retail margin', async () => {
    await setRate(50);
    const retail = await priceListByName('Retail'); // marginPercent 30 (seeded)
    const r = await svc().suggest({ priceListDocumentId: retail.documentId, costPriceUsd: 2, quantity: 1 });
    // egpCost = 100; retail = 100 * 1.30 = 130
    expect(r.sellPrice).toBeCloseTo(130, 2);
    expect(r.exchangeRate).toBe(50);
  });

  it('applies wholesale margin only at/above min quantity', async () => {
    await setRate(50);
    const wholesale = await priceListByName('Wholesale'); // margin 15, minQty 6
    const below = await svc().suggest({ priceListDocumentId: wholesale.documentId, costPriceUsd: 2, quantity: 3 });
    const atMin = await svc().suggest({ priceListDocumentId: wholesale.documentId, costPriceUsd: 2, quantity: 6 });
    // below min → retail (130); at min → 100 * 1.15 = 115
    expect(below.sellPrice).toBeCloseTo(130, 2);
    expect(atMin.sellPrice).toBeCloseTo(115, 2);
  });

  it('applies vip discount off the retail price', async () => {
    await setRate(50);
    const vip = await priceListByName('VIP'); // vipDiscountPercent 10
    const r = await svc().suggest({ priceListDocumentId: vip.documentId, costPriceUsd: 2, quantity: 1 });
    // retail 130; vip = 130 * 0.90 = 117
    expect(r.sellPrice).toBeCloseTo(117, 2);
  });
});
```

> The seed (Phase 1) must have run on the test DB so Retail/Wholesale/VIP exist. The app bootstrap seeds on every boot, including under `NODE_ENV=test`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/pricing.test.ts --runInBand --forceExit; cd ../../..`
Expected: FAIL — service `pricing` not registered.

- [ ] **Step 3: Write the pricing service**

`src/plugins/inventory-dashboard/server/src/services/pricing.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const pricing = ({ strapi }: { strapi: Core.Strapi }) => ({
  async suggest(input: { priceListDocumentId: string; costPriceUsd: number; quantity: number }) {
    const settings = await strapi.documents('api::system-settings.system-settings' as any).findFirst();
    const exchangeRate = settings ? Number(settings.exchangeRate) : 0;

    const priceList = await strapi.documents('api::price-list.price-list' as any).findOne({
      documentId: input.priceListDocumentId,
    } as any);
    if (!priceList) throw new errors.NotFoundError('Price list not found');

    const egpCost = Number(input.costPriceUsd) * exchangeRate;

    // retail margin (used by wholesale fallback and vip base)
    const [retailList] = await strapi.documents('api::price-list.price-list' as any).findMany({
      filters: { type: 'retail' },
    } as any);
    const retailMargin = Number(retailList?.marginPercent ?? 0);
    const retailPrice = egpCost * (1 + retailMargin / 100);

    let sellPrice: number;
    switch (priceList.type) {
      case 'retail':
        sellPrice = egpCost * (1 + Number(priceList.marginPercent ?? 0) / 100);
        break;
      case 'wholesale': {
        const minQty = Number(priceList.wholesaleMinQty ?? Number.POSITIVE_INFINITY);
        sellPrice =
          input.quantity >= minQty
            ? egpCost * (1 + Number(priceList.marginPercent ?? 0) / 100)
            : retailPrice;
        break;
      }
      case 'vip':
        sellPrice = retailPrice * (1 - Number(priceList.vipDiscountPercent ?? 0) / 100);
        break;
      default:
        sellPrice = retailPrice;
    }

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    return { sellPrice: round2(sellPrice), retailPrice: round2(retailPrice), exchangeRate };
  },
});

export default pricing;
```

- [ ] **Step 4: Register the service**

`src/plugins/inventory-dashboard/server/src/services/index.ts`:
```ts
import resource from './resource';
import metadata from './metadata';
import overview from './overview';
import fifo from './fifo';
import pricing from './pricing';

export default {
  resource,
  metadata,
  overview,
  fifo,
  pricing,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/pricing.test.ts --runInBand --forceExit; cd ../../..`
Expected: PASS — retail 130, wholesale 130/115 by qty, vip 117.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): price-list-driven sell-price suggestion service"
```

---

### Task 6: Orders service + confirm/fifo/orders endpoints + allow-list

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/services/orders.ts`
- Create: `src/plugins/inventory-dashboard/server/src/controllers/orders.ts`
- Modify: `controllers/index.ts`, `routes/index.ts`, `services/index.ts`, `server/src/config/resources.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/confirm.test.ts`

**Interfaces:**
- Consumes: `fifo` service, `order-totals` util, Order/Order Line/Stock Batch types.
- Produces:
  - service `orders` with:
    - `getWithTotals(documentId)` → order populated with customer, priceList, lines (+stockBatch), payments, plus `totals` (from `computeTotals`), per-line `belowCost`, and `exchangeRate`.
    - `confirm(documentId)` → validates the order is `draft`, aggregates `quantitySold` per batch, errors on insufficient `quantityRemaining`, decrements each batch, snapshots `costPriceUsdSnapshot` per line, sets `status: 'confirmed'`, returns `getWithTotals`.
  - endpoints:
    - `GET /inventory-dashboard/orders/:documentId` → `getWithTotals`
    - `POST /inventory-dashboard/orders/:documentId/confirm` → `confirm`
    - `GET /inventory-dashboard/fifo/:variantDocumentId?quantity=N` → `{ segments, shortfall }`
  - `RESOURCES` gains `orders`, `order-lines`, `payments` (so generic CRUD/nav include them).

- [ ] **Step 1: Add orders to the allow-list**

Append to `src/plugins/inventory-dashboard/server/src/config/resources.ts` `RESOURCES`:
```ts
  orders: { uid: 'api::order.order', populate: ['customer', 'priceList', 'lines', 'payments'] },
  'order-lines': { uid: 'api::order-line.order-line', populate: ['order', 'stockBatch'] },
  payments: { uid: 'api::payment.payment', populate: ['order'] },
```

- [ ] **Step 2: Write the failing confirm test**

`src/plugins/inventory-dashboard/server/tests/confirm.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('orders');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('orders.confirm', () => {
  it('decrements batch quantity, snapshots cost, and locks the order', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `CB-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `CC-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Confirm P', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `CS-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 10, quantityRemaining: 10, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customer = await docs('api::customer.customer').create({ data: { name: `CCust-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 3, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });

    const result = await svc().confirm(order.documentId);
    expect(result.status).toBe('confirmed');

    const updatedBatch = await docs('api::stock-batch.stock-batch').findOne({ documentId: batch.documentId });
    expect(updatedBatch.quantityRemaining).toBe(7); // 10 - 3

    const line = result.lines[0];
    expect(Number(line.costPriceUsdSnapshot)).toBe(4);
  });

  it('rejects confirming when a batch lacks enough remaining quantity', async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `CB2-${Math.random()}` } });
    const category = await docs('api::category.category').create({ data: { name: `CC2-${Math.random()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Confirm P2', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({ filters: { product: { documentId: product.documentId } } });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `CS2-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: { quantityPurchased: 2, quantityRemaining: 2, costPriceUsd: 4, purchaseDate: '2026-05-01', variant: variants[0].documentId, supplier: supplier.documentId },
    });
    const customer = await docs('api::customer.customer').create({ data: { name: `CCust2-${Math.random()}` } });
    const order = await docs('api::order.order').create({ data: { orderDate: '2026-07-01', status: 'draft', customer: customer.documentId } });
    await docs('api::order-line.order-line').create({
      data: { quantitySold: 5, sellPrice: 250, order: order.documentId, stockBatch: batch.documentId },
    });

    await expect(svc().confirm(order.documentId)).rejects.toThrow(/insufficient/i);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/confirm.test.ts --runInBand --forceExit; cd ../../..`
Expected: FAIL — service `orders` not registered.

- [ ] **Step 4: Write the orders service**

`src/plugins/inventory-dashboard/server/src/services/orders.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { computeTotals, isBelowCost } from '../../../../../src/utils/order-totals';

const ORDER = 'api::order.order';
const LINE = 'api::order-line.order-line';
const BATCH = 'api::stock-batch.stock-batch';
const SETTINGS = 'api::system-settings.system-settings';

const orders = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getWithTotals(documentId: string) {
    const order = await strapi.documents(ORDER as any).findOne({
      documentId,
      populate: {
        customer: true,
        priceList: true,
        payments: true,
        lines: { populate: { stockBatch: true } },
      },
    } as any);
    if (!order) throw new errors.NotFoundError('Order not found');

    const settings = await strapi.documents(SETTINGS as any).findFirst();
    const exchangeRate = settings ? Number(settings.exchangeRate) : 0;

    const lines = (order.lines ?? []).map((l: any) => {
      const costSnapshot = Number(l.costPriceUsdSnapshot ?? l.stockBatch?.costPriceUsd ?? 0);
      return { ...l, belowCost: isBelowCost(Number(l.sellPrice), costSnapshot, exchangeRate) };
    });

    const totals = computeTotals(
      lines.map((l: any) => ({
        sellPrice: Number(l.sellPrice),
        quantitySold: Number(l.quantitySold),
        costPriceUsdSnapshot: l.costPriceUsdSnapshot ?? l.stockBatch?.costPriceUsd ?? 0,
      })),
      Number(order.discountAmount) || 0,
      exchangeRate,
      (order.payments ?? []).map((p: any) => ({ amount: Number(p.amount) }))
    );

    return { ...order, lines, totals, exchangeRate };
  },

  async confirm(documentId: string) {
    const order = await strapi.documents(ORDER as any).findOne({
      documentId,
      populate: { lines: { populate: { stockBatch: true } } },
    } as any);
    if (!order) throw new errors.NotFoundError('Order not found');
    if (order.status !== 'draft') {
      throw new errors.ApplicationError('Order is already confirmed and cannot be re-confirmed.');
    }

    const lines = order.lines ?? [];
    if (lines.length === 0) {
      throw new errors.ApplicationError('Cannot confirm an order with no lines.');
    }

    // aggregate quantity per batch
    const perBatch = new Map<string, { remaining: number; qty: number }>();
    for (const line of lines) {
      if (!line.stockBatch) {
        throw new errors.ApplicationError('Every order line must have a stock batch before confirming.');
      }
      const key = line.stockBatch.documentId;
      const entry = perBatch.get(key) ?? { remaining: Number(line.stockBatch.quantityRemaining), qty: 0 };
      entry.qty += Number(line.quantitySold);
      perBatch.set(key, entry);
    }

    // validate availability
    for (const [batchDocId, { remaining, qty }] of perBatch) {
      if (qty > remaining) {
        throw new errors.ApplicationError(
          `Insufficient stock on batch ${batchDocId}: need ${qty}, have ${remaining}.`
        );
      }
    }

    // decrement each batch
    for (const [batchDocId, { remaining, qty }] of perBatch) {
      await strapi.documents(BATCH as any).update({
        documentId: batchDocId,
        data: { quantityRemaining: remaining - qty },
      } as any);
    }

    // snapshot cost per line
    for (const line of lines) {
      await strapi.documents(LINE as any).update({
        documentId: line.documentId,
        data: { costPriceUsdSnapshot: Number(line.stockBatch.costPriceUsd) },
      } as any);
    }

    await strapi.documents(ORDER as any).update({
      documentId,
      data: { status: 'confirmed' },
    } as any);

    return this.getWithTotals(documentId);
  },
});

export default orders;
```

> Import note: the relative path `../../../../../src/utils/order-totals` resolves from `server/src/services/` up to the app root `src/utils/`. Confirm the depth against the built layout; if `strapi-plugin build` complains about importing outside the plugin, copy `order-totals.ts` into `server/src/utils/order-totals.ts` and import locally (keep the two in sync, or have the app file re-export the plugin copy).

- [ ] **Step 5: Write the orders controller, register, and route**

`src/plugins/inventory-dashboard/server/src/controllers/orders.ts`:
```ts
import type { Core } from '@strapi/strapi';

const orders = ({ strapi }: { strapi: Core.Strapi }) => ({
  async findOne(ctx) {
    const { documentId } = ctx.params;
    ctx.body = await strapi.plugin('inventory-dashboard').service('orders').getWithTotals(documentId);
  },
  async confirm(ctx) {
    const { documentId } = ctx.params;
    ctx.body = await strapi.plugin('inventory-dashboard').service('orders').confirm(documentId);
  },
  async fifo(ctx) {
    const { variantDocumentId } = ctx.params;
    const quantity = Number(ctx.query.quantity) || 0;
    ctx.body = await strapi.plugin('inventory-dashboard').service('fifo').resolve(variantDocumentId, quantity);
  },
});

export default orders;
```
`controllers/index.ts` — add `orders`:
```ts
import health from './health';
import resource from './resource';
import settings from './settings';
import overview from './overview';
import orders from './orders';

export default {
  health,
  resource,
  settings,
  overview,
  orders,
};
```
`services/index.ts` — add `orders`:
```ts
import resource from './resource';
import metadata from './metadata';
import overview from './overview';
import fifo from './fifo';
import pricing from './pricing';
import orders from './orders';

export default {
  resource,
  metadata,
  overview,
  fifo,
  pricing,
  orders,
};
```
Add to `routes/index.ts` `admin.routes` (place the `orders/:documentId` route **before** the generic `/resources/:resource/:documentId` is irrelevant since paths differ, but keep them grouped):
```ts
      { method: 'GET', path: '/fifo/:variantDocumentId', handler: 'orders.fifo', config: { policies: [] } },
      { method: 'GET', path: '/orders/:documentId', handler: 'orders.findOne', config: { policies: [] } },
      { method: 'POST', path: '/orders/:documentId/confirm', handler: 'orders.confirm', config: { policies: [] } },
```

- [ ] **Step 6: Run the confirm test to verify it passes**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/confirm.test.ts --runInBand --forceExit; cd ../../..`
Expected: PASS — batch 10→7, snapshot 4, status confirmed; over-allocation rejected with "insufficient".

- [ ] **Step 7: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): orders totals/confirm + fifo preview endpoints + allow-list"
```

---

### Task 7: Order form UI (pricing, FIFO pre-fill, below-cost warning, payments)

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/App.tsx` (routes)
- Modify: `src/plugins/inventory-dashboard/admin/src/index.ts` (Orders menu link)

**Interfaces:**
- Consumes: `useApi`; endpoints `/resources/*`, `/fifo/:variantDocumentId`, `/orders/:documentId`, `/orders/:documentId/confirm`.
- Produces:
  - `useOrder(documentId)` → `{ order, loading, reload, confirm }` where `order` is the `getWithTotals` shape.
  - `OrderForm` at routes `orders/new` and `orders/:id`: pick customer (auto-fill priceList), add products (FIFO-prefilled lines with suggested sell price, editable), below-cost banner per line, order discount + live totals, Confirm button, payments panel after confirmation.

- [ ] **Step 1: Write useOrder**

`src/plugins/inventory-dashboard/admin/src/hooks/useOrder.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useOrder(documentId?: string) {
  const api = useApi();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(documentId));

  const reload = useCallback(() => {
    if (!documentId) return;
    setLoading(true);
    api.get(`/orders/${documentId}`).then(setOrder).finally(() => setLoading(false));
  }, [documentId]);

  useEffect(() => { reload(); }, [reload]);

  const confirm = useCallback(async () => {
    if (!documentId) return;
    const updated = await api.post(`/orders/${documentId}/confirm`);
    setOrder(updated);
    return updated;
  }, [documentId]);

  return { order, loading, reload, confirm };
}
```

- [ ] **Step 2: Write OrderForm**

`src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Flex, Grid, GridItem, Typography, NumberInput, DatePicker,
  SingleSelect, SingleSelectOption, Table, Thead, Tbody, Tr, Th, Td, Badge,
} from '@strapi/design-system';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';

interface DraftLine {
  variantDocumentId: string;
  variantLabel: string;
  stockBatchDocumentId: string;
  costPriceUsd: number;
  quantitySold: number;
  sellPrice: number;
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
  const [orderDate, setOrderDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState<number>(0);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addVariantId, setAddVariantId] = useState('');
  const [addQty, setAddQty] = useState<number>(1);
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
      `/fifo/${addVariantId}`, { quantity: addQty }
    );
    if (fifo.shortfall > 0) setError(`Not enough stock: short by ${fifo.shortfall} unit(s).`);

    const variant = variants.find((v) => v.documentId === addVariantId);
    const newLines: DraftLine[] = [];
    for (const seg of fifo.segments) {
      // suggested sell price via the pricing endpoint (POST /pricing/suggest)
      const priced = await getSuggestedPrice(api, priceListId, seg.costPriceUsd, seg.quantityFromBatch);
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
  const finalTotal = subtotal - (discount || 0);

  const saveDraft = async () => {
    setError(null);
    try {
      // create order header
      const created = await api.post<any>('/resources/orders', {
        orderDate, status: 'draft', discountAmount: discount,
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
    <Box padding={8}>
      <Typography variant="alpha">New order</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}

      <Grid gap={4} paddingTop={6}>
        <GridItem col={4}>
          <SingleSelect label="Customer" value={customerId} onChange={setCustomerId}>
            {customers.map((c) => <SingleSelectOption key={c.documentId} value={c.documentId}>{c.name}</SingleSelectOption>)}
          </SingleSelect>
        </GridItem>
        <GridItem col={4}>
          <DatePicker label="Order date" selectedDate={orderDate ? new Date(orderDate) : undefined}
            onChange={(d: Date) => setOrderDate(d ? d.toISOString().slice(0, 10) : null)} />
        </GridItem>
      </Grid>

      <Box paddingTop={6}>
        <Typography variant="beta">Add product</Typography>
        <Grid gap={4} paddingTop={2}>
          <GridItem col={4}>
            <SingleSelect label="Product" value={addProductId} onChange={(v: string) => { setAddProductId(v); setAddVariantId(''); }}>
              {products.map((p) => <SingleSelectOption key={p.documentId} value={p.documentId}>{p.name}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
          <GridItem col={4}>
            <SingleSelect label="Variant" value={addVariantId} onChange={setAddVariantId} disabled={!addProductId}>
              {variantsForProduct.map((v) => <SingleSelectOption key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
          <GridItem col={3}><NumberInput label="Quantity" value={addQty} onValueChange={(v: number) => setAddQty(v)} /></GridItem>
          <GridItem col={1}><Box paddingTop={6}><Button onClick={addLine} disabled={!addVariantId}>Add</Button></Box></GridItem>
        </Grid>
      </Box>

      {relatedSuggestions.length > 0 && (
        <Box paddingTop={4} background="primary100" padding={3} hasRadius>
          <Typography variant="omega">Customers also buy:&nbsp;</Typography>
          {relatedSuggestions.map((rp: any) => (
            <Button key={rp.documentId} variant="tertiary"
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}>
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box paddingTop={6}>
        <Table colCount={6} rowCount={draftLines.length}>
          <Thead><Tr><Th>Variant</Th><Th>Batch</Th><Th>Qty</Th><Th>Sell (EGP)</Th><Th>Cost EGP</Th><Th>Flag</Th></Tr></Thead>
          <Tbody>
            {draftLines.map((l, i) => {
              const costEgp = l.costPriceUsd * exchangeRate;
              const below = l.sellPrice < costEgp;
              return (
                <Tr key={i}>
                  <Td>{l.variantLabel}</Td>
                  <Td>{l.stockBatchDocumentId.slice(0, 6)}</Td>
                  <Td>{l.quantitySold}</Td>
                  <Td>
                    <NumberInput aria-label="sell" value={l.sellPrice}
                      onValueChange={(v: number) => setDraftLines((prev) => prev.map((x, idx) => idx === i ? { ...x, sellPrice: v } : x))} />
                  </Td>
                  <Td>{costEgp.toFixed(2)}</Td>
                  <Td>{below ? <Badge backgroundColor="danger500" textColor="neutral0">Below cost</Badge> : null}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>

      <Box paddingTop={6}>
        <Grid gap={4}>
          <GridItem col={4}><NumberInput label="Discount (EGP)" value={discount} onValueChange={(v: number) => setDiscount(v)} /></GridItem>
          <GridItem col={4}><Box paddingTop={6}><Typography>Subtotal: {subtotal.toFixed(2)} EGP</Typography></Box></GridItem>
          <GridItem col={4}><Box paddingTop={6}><Typography variant="beta">Total: {finalTotal.toFixed(2)} EGP</Typography></Box></GridItem>
        </Grid>
      </Box>

      <Flex gap={2} paddingTop={6}>
        <Button onClick={saveDraft} disabled={!customerId || draftLines.length === 0}>Save draft</Button>
        {id && <Button variant="success" onClick={onConfirm}>Confirm order</Button>}
        <Button variant="tertiary" onClick={() => navigate('/plugins/inventory-dashboard/r/orders')}>Cancel</Button>
      </Flex>
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
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('cash');

  const addPayment = async () => {
    await api.post('/resources/payments', {
      amount, method, paymentDate: new Date().toISOString().slice(0, 10), order: order.documentId,
    });
    setAmount(0);
    reload();
  };

  return (
    <Box padding={8}>
      <Flex justifyContent="space-between">
        <Typography variant="alpha">Order {order.documentId.slice(0, 8)}</Typography>
        <Badge>{order.status}</Badge>
      </Flex>

      <Box paddingTop={6}>
        <Table colCount={5} rowCount={order.lines.length}>
          <Thead><Tr><Th>Variant</Th><Th>Qty</Th><Th>Sell</Th><Th>Cost USD snap</Th><Th>Flag</Th></Tr></Thead>
          <Tbody>
            {order.lines.map((l: any) => (
              <Tr key={l.documentId}>
                <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice}</Td>
                <Td>{l.costPriceUsdSnapshot}</Td>
                <Td>{l.belowCost ? <Badge backgroundColor="danger500" textColor="neutral0">Below cost</Badge> : null}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Box paddingTop={6}>
        <Typography variant="beta">Totals</Typography>
        <Typography>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Typography>
        <Typography>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Typography>
      </Box>

      <Box paddingTop={6}>
        <Typography variant="beta">Record payment</Typography>
        <Flex gap={2} alignItems="flex-end" paddingTop={2}>
          <NumberInput label="Amount" value={amount} onValueChange={(v: number) => setAmount(v)} />
          <SingleSelect label="Method" value={method} onChange={setMethod}>
            <SingleSelectOption value="cash">cash</SingleSelectOption>
            <SingleSelectOption value="transfer">transfer</SingleSelectOption>
          </SingleSelect>
          <Button onClick={addPayment} disabled={!amount}>Add payment</Button>
        </Flex>
      </Box>
    </Box>
  );
}
```

> The Order form calls `POST /inventory-dashboard/pricing/suggest` (via `getSuggestedPrice`). Add that route + a thin controller method as part of this step: in `controllers/orders.ts` add `async suggest(ctx){ ctx.body = await strapi.plugin('inventory-dashboard').service('pricing').suggest(ctx.request.body?.data ?? ctx.request.body); }` and register `{ method: 'POST', path: '/pricing/suggest', handler: 'orders.suggest', config: { policies: [] } }` in `routes/index.ts`.

- [ ] **Step 3: Wire routes and menu link**

In `admin/src/pages/App.tsx` add inside `<Routes>`:
```tsx
      <Route path="orders/new" element={<OrderForm />} />
      <Route path="orders/:id" element={<OrderForm />} />
```
and import:
```tsx
import OrderForm from './OrderForm';
```
In `admin/src/index.ts` add a second menu link after the first:
```tsx
    app.addMenuLink({
      to: `/plugins/${pluginId}/orders/new`,
      icon: () => null,
      intlLabel: { id: `${pluginId}.menu.orders`, defaultMessage: 'New Order' },
      Component: async () => {
        const { default: App } = await import('./pages/App');
        return App;
      },
    });
```

- [ ] **Step 4: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0. (Fix any `@strapi/design-system` v2 import-name mismatches the build reports.)

- [ ] **Step 5: Manual verification**

```bash
npm run develop
```
In `/admin` → Inventory: seed a customer (with a price list), a product/variant, and a stock batch. Create an order: add the product (line pre-fills with a FIFO batch + suggested price), set a sell price below cost and confirm the "Below cost" badge appears, save the draft, open it, Confirm, then add a payment and watch the status move to partially_paid/paid and `quantityRemaining` drop. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin src/plugins/inventory-dashboard/server
git commit -m "feat(plugin/admin): order form with FIFO pre-fill, pricing, below-cost, payments"
```

---

### Task 8: Full Phase 3 quality gate

**Files:** none (verification only)

**Interfaces:**
- Consumes: the whole app + plugin.
- Produces: a clean build, lint, type check, and green test suite across all phases.

- [ ] **Step 1: Run the complete gate**

```bash
npm test
cd src/plugins/inventory-dashboard
npm run build
npm run lint
cd ../../..
npx tsc --noEmit
```
Expected: app `npm test` (Phase 1 + Phase 3 suites: smoke, master-types, seed, order-totals, order-lifecycle) green; plugin tests (resource, metadata, overview, fifo, pricing, confirm) green; plugin `build`/`lint` clean; `tsc --noEmit` exits 0.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "chore: Phase 3 passes full quality gate"
```

---

## Phase 3 Self-Review Notes

- **Spec coverage:** Order/Order Line/Payment types (§3.3) ✓; computed order figures subtotal/totalCostEgp/finalTotal/netProfit/totalPaid/balanceDue derived on read (§3.3) ✓; FIFO consumption oldest-first with tie-break and multi-batch split (§4 FIFO, §10) ✓; expired batches included in FIFO (§4 step 5) ✓; order status auto-update from payments, never overriding draft (§4) ✓; below-cost warning flag, non-blocking (§4) ✓; deletion guard for stock batch referenced by order line (§4) ✓; FIFO preview `GET /fifo/:variantDocumentId` and `POST /orders/:documentId/confirm` (§5.1 table) ✓; order flow UI with customer→priceList auto-fill, FIFO pre-fill, suggested price, below-cost banner, discount + live totals, confirm + lock, payments (§6) ✓; cross-sell suggestion strip from `relatedProducts` (§6 step 4, §10) ✓; price-list formulas retail/wholesale/vip (§3.5) ✓.
- **Known-limitation alignment:** snapshot is USD-only and EGP is recomputed at read with the live rate (§10 "Exchange rate is global"); cross-sell is display-only / click-to-add (§10); stock restoration on cancellation remains manual / out of scope (§10) — not implemented here by design.
- **Type consistency:** `computeTotals`/`statusFromPayments`/`isBelowCost` signatures match across the util, the payment lifecycle, and the plugin `orders` service. `FifoSegment` fields (`batchDocumentId`, `costPriceUsd`, `quantityFromBatch`) are produced by `fifo.resolve` and consumed unchanged by `orders.confirm` and the Order form. Plugin service names (`fifo`, `pricing`, `orders`) match their `services/index.ts` registrations and route handlers.
- **Executor notes:** (1) the `orders` service imports `order-totals` from the app `src/utils`; if the plugin build rejects an out-of-package import, copy the file into `server/src/utils/` and keep them identical. (2) Adjust `@strapi/design-system` v2 component/prop names to the installed version as the build reports them.
