# Cosmetics Inventory — Application Documentation


---

## 1. What this is

An inventory-management and accounting system for a cosmetics wholesale/retail
business, built on **Strapi v5**. It tracks products and their sellable
**variants** (shades, sizes, finishes…), and the **stock batches** purchased
from suppliers — with cost in USD, a daily exchange rate to convert to EGP,
purchase/production/expiry dates, and remaining quantity. Batches are consumed
in FIFO order (oldest purchase first). Orders are recorded against customers,
FIFO-resolved and priced from a customer's price list, confirmed (which
atomically decrements stock and snapshots cost), and tracked to payment. On
top of the data model sits a bespoke admin plugin that gives the operator a
single control center: an at-a-glance overview, generic create/edit/delete for
every inventory record, and guided flows for stock purchase, product creation,
and order entry.

Phases 1–3 are complete: foundation/content-types, the inventory-dashboard
plugin (generic CRUD + Overview + Stock Purchase), and Orders/FIFO/Pricing
(order entry, confirm, payments). Phase 4 is also complete: the plugin's
entire admin UI was reskinned from `@strapi/design-system` to **Chakra UI
v2** (see §5.2).

### Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Strapi `5.49.0` (TypeScript, CommonJS) |
| Runtime DB | MySQL 8 (`mysql2` driver) |
| Admin UI | React 18, **Chakra UI v2.10** (`@chakra-ui/react`, `@emotion/react`/`styled`, `framer-motion`, `react-icons`), `react-router-dom` v6 |
| Plugin build | `@strapi/sdk-plugin` v6 (`strapi-plugin build`) |
| Tests | Jest + `ts-jest`, `cross-env NODE_ENV=test` |

---

## 2. Project layout

```
d:\7meed\cosmtic\                     ← Strapi application root
├─ config/                         app config
│  ├─ database.ts                  MySQL connection (reads .env)
│  └─ plugins.ts                   enables the inventory-dashboard plugin
├─ src/
│  ├─ index.ts                     app register/bootstrap (runs the seed)
│  ├─ bootstrap/seed.ts            idempotent reference-data seed
│  ├─ admin/app.tsx                admin panel customization — hides Strapi's
│  │                               built-in nav for non-super-admins (see §5.3)
│  ├─ utils/order-totals.ts        pure totals/status/below-cost math (app-level copy)
│  ├─ api/                         the content types (schema + lifecycles)
│  │  ├─ brand/  category/  variant-type/  supplier/  customer/
│  │  ├─ system-settings/          … single-type for exchange rate and global config
│  │  ├─ price-list/               … named price lists (Retail / Wholesale / VIP)
│  │  ├─ product/                  … content-types/product/schema.json + lifecycles.ts
│  │  ├─ variant/                  … lifecycles.ts (typed-variant guard)
│  │  ├─ stock-batch/              … lifecycles.ts (qty seeding + delete guard)
│  │  ├─ order/                    … order header + lifecycles.ts (status/edit guard)
│  │  ├─ order-line/               … per-line sale record + lifecycles.ts (edit guard)
│  │  └─ payment/                  … payment installments + lifecycles.ts (status recompute)
│  └─ plugins/inventory-dashboard/ the admin plugin (see §5)
├─ tests/                          app-level Jest suites (see §8)
└─ docs/                           this file + superpowers specs/plans
```

---

## 3. Data model

All collection types have `draftAndPublish: false` (records are live
immediately). They fall into three groups.

### 3.1 Reference / master data

| Type | Key fields | Notes |
|------|-----------|-------|
| **Brand** | `name` (required, unique), `notes` | `products` (1‑many); delete blocked if products reference it |
| **Category** | `name` (required, unique), `notes` | `products` (1‑many); four entries are seeded (see §3.5); delete blocked if products reference it |
| **Variant Type** | `name` (required, unique) | classifies a variant (Shade/Size/…); `variants` (1‑many); delete blocked if variants reference it |
| **Supplier** | `name` (required), `phone`, `notes` | `batches` (1‑many) |
| **Customer** | `name` (required), `phone`, `address`, `notes`, `priceList` → Price List | `priceList` determines default pricing on new orders; can be overridden per order |
| **Price List** | `name` (required, unique), `type` (enum: `retail` / `wholesale` / `vip`), `marginPercent` (decimal), `wholesaleMinQty` (integer, wholesale only), `vipDiscountPercent` (decimal, VIP only), `notes` | Three lists are seeded (see §3.5); delete blocked if customers are assigned to it |
| **System Settings** | *(single-type)* `exchangeRate` (decimal, **required**), `exchangeRateUpdatedAt` (datetime) | One row only; the operator updates `exchangeRate` daily from the Overview screen. Changing it recalculates EGP cost display everywhere — stored costs in USD are never mutated |

### 3.2 Core inventory data

**Product** — a sellable item.
- `name` (required)
- `brand` → Brand (many‑to‑one, **required**)
- `category` → Category (many‑to‑one, **required**)
- `relatedProducts` → Product (many‑to‑many, self) — accessories/cross-sell links; e.g. a foundation links to brushes and sponges so the order UI can suggest them
- `variants` → Variant (one‑to‑many, inverse)

**Variant** — a concrete sellable form of a product. Stock is tracked per
variant, not per product.
- `label` (string, optional — e.g. "Shade 220")
- `lowStockThreshold` (integer ≥ 0, optional)
- `isDefault` (boolean, default `false`)
- `product` → Product (many‑to‑one, **required**)
- `variantType` → Variant Type (many‑to‑one, optional *but see business rule*)
- `batches` → Stock Batch (one‑to‑many, inverse)

**Stock Batch** — one purchase of one variant from one supplier.
- `quantityPurchased` (integer ≥ 0, **required**)
- `quantityRemaining` (integer ≥ 0, *auto-seeded* — see §4)
- `costPriceUsd` (decimal ≥ 0, **required**) — purchase cost in US dollars
- `purchaseDate` (date, **required**), `productionDate` (date), `expiryDate` (date)
- `notes` (text)
- `variant` → Variant (many‑to‑one, **required**)
- `supplier` → Supplier (many‑to‑one, **required**)

> **Why USD only on batches:** the operator buys in dollars. The EGP equivalent
> is always `costPriceUsd × exchangeRate` (read live from System Settings). This
> means a single rate change instantly updates the EGP cost shown everywhere
> without touching any stored data.

### 3.3 Order data

**Order** — one sales transaction with one customer.
- `customer` → Customer (many‑to‑one)
- `priceList` → Price List (many‑to‑one) — snapshot of which pricing mode was used; defaults from the customer but can be overridden per order
- `orderDate` (date, **required**)
- `status` (enum: `draft` / `confirmed` / `partially_paid` / `paid`, default `draft`, **required**) — never write this field directly; see §4
- `discountAmount` (decimal, default 0) — flat EGP discount on the whole order
- `shippingNotes` (text)
- `notes` (text)
- `lines` → Order Line (one‑to‑many, inverse)
- `payments` → Payment (one‑to‑many, inverse)

Computed (not stored, derived on read by `computeTotals()` — see §4):
- `subtotal` = Σ (line.sellPrice × line.quantitySold)
- `totalCostEgp` = Σ (line.costPriceUsdSnapshot × exchangeRate × line.quantitySold)
- `finalTotal` = subtotal − discountAmount
- `netProfit` = finalTotal − totalCostEgp
- `totalPaid` = Σ payments.amount
- `balanceDue` = finalTotal − totalPaid

**Order Line** — one batch-level line inside an order.
- `order` → Order (many‑to‑one, **required**)
- `stockBatch` → Stock Batch (many‑to‑one, **required**) — selected automatically by FIFO (see §4); operator can override
- `quantitySold` (integer ≥ 1, **required**)
- `costPriceUsdSnapshot` (decimal) — copied from `stockBatch.costPriceUsd` at confirmation time; never changes after
- `sellPrice` (decimal, **required**) — entered manually by the operator in EGP; the API flags (does not block) a line priced below `costPriceUsdSnapshot × exchangeRate`
- `referenceRetailPrice` (decimal, optional) — for display/comparison only
- `lineNotes` (text — e.g. "includes Cairo shipping")

**Payment** — one installment against an order.
- `order` → Order (many‑to‑one, **required**)
- `amount` (decimal, **required**)
- `paymentDate` (date, **required**)
- `method` (enum: `cash` / `transfer`)
- `notes` (text)

### 3.4 Relationship map

```
                         System Settings (single-type: exchangeRate)

Brand ─1:M─┐                    ┌─M:1─ Variant Type
           ├─< Product >─1:M─< Variant >─1:M─< Stock Batch >─M:1─ Supplier
Category ─1:M─┘    │
                   M:M (self, relatedProducts)

Price List ─M:1─ Customer ─1:M─ Order ─1:M─ Order Line ─M:1─ Stock Batch
                            │        │
                     (priceList)  Payment
```

### 3.5 Seed data

The idempotent seed in `src/bootstrap/seed.ts` inserts the following records
on every cold start if they do not already exist. None are locked — the
operator can rename, add, or delete them (subject to the deletion guards in §4).

**Categories (4 seeded)**

| Name |
|------|
| High-End Makeup |
| Drugstore Makeup |
| Skin Care |
| Accessories |

**Price Lists (3 seeded)**

| Name | Type | Seeded values |
|------|------|--------------|
| Retail | `retail` | `marginPercent`: 30 — formula: cost × rate × (1 + margin) |
| Wholesale | `wholesale` | `marginPercent`: 15, `wholesaleMinQty`: 6 — auto-applied when order qty ≥ threshold |
| VIP | `vip` | `vipDiscountPercent`: 10 — applied as a flat % off the retail price |

**System Settings**

One row is upserted with `exchangeRate: 1` as a placeholder. The operator must
set the real rate before using cost calculations.

---

## 4. Business rules (lifecycle hooks)

All rules live on the model so they apply no matter how a record is
created — dashboard plugin, Strapi content manager, or API. **Every**
`lifecycles.ts` hook fires identically whether the write comes through
`strapi.documents(uid)` or `strapi.db.query(uid)` — content-type lifecycles are
wired at the `@strapi/database` model level, so there is no bypass via
`db.query`.

### Product → auto default variant
`src/api/product/content-types/product/lifecycles.ts` — **`afterCreate`**:
after a product is created with zero variants, one default variant
(`isDefault: true`) is created automatically. Every product therefore always
has at least one sellable variant to attach stock to. The dashboard's
"create product with variants" flow relies on and then supersedes this.

### Variant → non-default variant must have a type
`src/api/variant/content-types/variant/lifecycles.ts` — **`beforeCreate`** and
**`beforeUpdate`**: a variant that is **not** the default must have a
`variantType`. The `beforeUpdate` hook loads the persisted row and validates
the **merged** final state, so flipping `isDefault` off or clearing the type
on an existing variant is also guarded. Violations throw an `ApplicationError`
("A non-default variant must have a variant type.").

### Stock Batch → seed remaining quantity
`src/api/stock-batch/content-types/stock-batch/lifecycles.ts` —
**`beforeCreate`**: if `quantityRemaining` is not supplied, it is seeded from
`quantityPurchased`. A freshly recorded purchase starts with its full quantity
remaining.

### FIFO batch resolution
`src/plugins/inventory-dashboard/server/src/services/fifo.ts` —
`resolve(variantDocumentId, quantity)`:

1. For the chosen variant, fetch all batches where `quantityRemaining > 0`,
   ordered by `purchaseDate ASC` (ties broken by `createdAt ASC`).
2. Deduct the requested quantity from the oldest batch first. If that batch is
   exhausted before the quantity is covered, continue to the next oldest batch,
   splitting across as many batches as needed.
3. Returns `{ segments, shortfall }` — one segment per batch consumed
   (`batchDocumentId`, `costPriceUsd`, `quantityFromBatch`, dates), plus any
   quantity that couldn't be covered by remaining stock.
4. The Order form pre-fills one draft Order Line per segment; the operator can
   inspect or override the batch assignment before saving/confirming.
5. Expired batches are **included** in FIFO resolution (expiry is
   informational only — it is not blocked from sale).

> **Why FIFO:** the operator buys multiple shipments of the same product at
> different dollar costs. FIFO ensures the oldest (and often cheapest) stock is
> cleared first, and profit is calculated against the actual historical cost of
> what was sold — not an average.

### Order confirmation — atomic FIFO consumption
`src/plugins/inventory-dashboard/server/src/services/orders.ts` —
`confirm(documentId)`:

1. Loads the order with its lines + each line's stock batch; rejects if the
   order isn't `draft`, has no lines, or any line lacks a `stockBatch`.
2. Aggregates requested quantity per batch and fast-fails with a friendly
   "insufficient stock" error if any batch's aggregate exceeds
   `quantityRemaining` (common case, no concurrent activity).
3. Wraps the actual mutation in `strapi.db.transaction(...)`:
   - Each batch's decrement is an **atomic conditional UPDATE** —
     `queryBuilder(BATCH).where({ id, quantityRemaining: { $gte: qty } }).decrement(column, qty)`
     — so a concurrent confirm that already consumed the stock causes this one
     to affect 0 rows, which throws and rolls back the whole transaction
     (no half-confirmed order, no oversold batch).
   - Each line's `costPriceUsdSnapshot` is copied from its batch's
     `costPriceUsd`.
   - The order's `status` is set to `confirmed` via a **trusted write** (see
     "Order/Order-line CRUD guards" below).
4. Returns the recomputed order (`getWithTotals`).

**Gotchas baked into this code, worth knowing before touching it again:**
- `strapi.db.transaction(async () => {...})` is a real Knex transaction;
  nested `strapi.db.query()` / `strapi.documents()` / `strapi.db.queryBuilder()`
  calls join it automatically via Node's `AsyncLocalStorage` as long as they
  stay inside the same async callback (no detached promises/`setTimeout`) — no
  manual `{ transacting }` threading needed.
- `queryBuilder(uid).increment()/.decrement()` do **not** translate the Strapi
  attribute name to the actual DB column name (unlike `.where()`, which does).
  Resolve the real column first: `strapi.db.metadata.get(uid).attributes.<attr>.columnName`.
  Passing the raw camelCase attribute name fails with `Unknown column '...' in
  'field list'`.
- `execute()` on a non-select `queryBuilder` query returns the raw MySQL
  affected-row count — `0` means the conditional UPDATE's WHERE clause didn't
  match, i.e. you lost a race.

### Order / Order-line CRUD guards
`src/api/order/content-types/order/lifecycles.ts` and
`src/api/order-line/content-types/order-line/lifecycles.ts`. The plugin's
generic `/resources/orders` and `/resources/order-lines` CRUD endpoints (same
generic layer used for every other resource) would otherwise let a client
bypass `confirm()` entirely — setting `status` directly, editing a
confirmed order's lines, or deleting a confirmed order outright. These hooks
close that gap:

- **Order `beforeUpdate`**: rejects any update once `status !== 'draft'`
  (the order is locked once confirmed), and separately rejects setting
  `status` directly unless the write carries a `__trusted: true` marker —
  which the hook strips out before persisting. `confirm()` and the payment
  lifecycle's `recomputeOrderStatus()` are the only two legitimate internal
  callers that set `__trusted`.
- **Order `beforeDelete`**: rejects deleting a non-draft order (its stock
  decrement can't be undone automatically).
- **Order-line `beforeUpdate`/`beforeDelete`**: look up the parent order's
  status (`strapi.db.query(LINE_UID).findOne({ where, populate: { order: true } })`)
  and reject touching a line once the parent order is no longer `draft`.

There is no built-in "skip lifecycle for this call" API in Strapi v5 — the
`__trusted`-marker-and-strip idiom above is the pattern to reuse for any future
internal-only status transition that needs to bypass its own guard.

### Order → status auto-update from payments
`src/api/payment/content-types/payment/lifecycles.ts` — **`afterCreate`**,
**`afterUpdate`**, **`afterDelete`** recompute the order's status from
`computeTotals()`/`statusFromPayments()` (`src/utils/order-totals.ts`) and
write it back with `{ status: nextStatus, __trusted: true }`: `paid` once
`totalPaid ≥ finalTotal` (and `finalTotal > 0`), `partially_paid` once
`totalPaid > 0`, else `confirmed`. A `draft` order is never touched by this
(payments can't be recorded against a draft in the UI). `beforeDelete` stashes
the order's `documentId` onto `event.state` before the payment row is gone, so
`afterDelete` can still recompute against the right order.

> Known edge case (documented, not yet fixed): `statusFromPayments` only
> returns `'paid'` when `finalTotal > 0`, so a 100%-discounted order
> (`finalTotal = 0`) can never leave `'confirmed'` status even though nothing
> is owed.

### Order Line → below-cost warning
`getWithTotals()` (orders service) computes `isBelowCost(sellPrice,
costPriceUsdSnapshot, exchangeRate)` per line and returns a `belowCost` flag;
the Order form renders a visible "Below cost" badge. This is advisory only —
the operator can still save/confirm a below-cost line.

### Deletion guards
- Deleting a **Brand** or **Category** that has products is blocked.
- Deleting a **Variant Type** that has variants is blocked.
- Deleting a **Price List** that is assigned to one or more customers is blocked.
- Deleting a **Stock Batch** that is referenced by an Order Line is blocked.
- Deleting a **confirmed Order** (or any Order Line on a confirmed order) is
  blocked (see "Order / Order-line CRUD guards" above).

> **Cleanup note (deferred, not fixed):** the beforeDelete/beforeDeleteMany
> guard logic is ~140 near-identical lines copy-pasted across 5 lifecycle
> files (brand/category/price-list/variant-type/stock-batch) instead of a
> shared factory. Functionally correct, just a refactor opportunity.

---

## 5. The Inventory Dashboard plugin

A local Strapi plugin at `src/plugins/inventory-dashboard`, enabled in
[`config/plugins.ts`](../config/plugins.ts) (`enabled: true`, resolved from
`./src/plugins/inventory-dashboard`). Its defining idea is that it is
**schema-auto-driven**: the server exposes a small allow-list of content types
plus metadata describing each one's fields, and the admin renders its list
tables and edit forms generically from that metadata. There is almost no
per-entity UI code — the exceptions (Overview, Stock Purchase, product-with-
variants, and the Order flow) are intentional, curated screens.

> **Strapi loads this plugin from its built `dist/`, not from `server/src` /
> `admin/src`.** After any plugin source change, run
> `cd src/plugins/inventory-dashboard && npm run build` before the app will
> see it (and before running the plugin's own Jest tests, which import from
> `dist`). `dist/` and the plugin's `node_modules` are gitignored — source is
> the git source of truth.

### 5.1 Server engine (`server/src`)

**Allow-list — `config/resources.ts`.** A single `RESOURCES` map from a URL
slug to `{ uid, populate? }`:

```ts
brands, categories, variant-types, suppliers,
customers      → populate priceList
price-lists,
products       → populate brand, category, variants, relatedProducts
variants       → populate product, variantType, batches
stock-batches  → populate variant, supplier
orders         → populate customer, priceList, lines, payments
order-lines    → populate order, stockBatch
payments       → populate order
```

This map is both the **security boundary** (any UID not listed 404s) and the
source of the navigation. Note it is the boundary for the *generic* CRUD
service only — see §4's CRUD guards for why `orders`/`order-lines` also need
content-type-level lifecycle guards on top of this allow-list.

**Resource service — `services/resource.ts`.** Generic CRUD over
`strapi.documents(uid)` for any allow-listed slug: `find` (paginated,
`pageSize` capped at 100), `findOne`, `create`, `update`, `remove`.

**Metadata service — `services/metadata.ts`.** Turns a content type's
attributes into the `FieldMeta[]` the admin renders from: `type`, `required`,
`min`/`max`, `unique`, enum `values`, and for relations `{ resource, kind,
mainField }`. System fields are marked hidden; relations whose target is not
allow-listed (or is a `*-to-many`) are also hidden.

**Overview service — `services/overview.ts`.** Aggregates the dashboard's
landing data:
- Entity counts
- Total stock units and stock value (`Σ quantityRemaining` and
  `Σ quantityRemaining × costPriceUsd × exchangeRate`)
- Current exchange rate read from System Settings, displayed prominently
- Per-variant low-stock rows (current quantity below `lowStockThreshold`);
  expired batches are **excluded** from the quantity sum so a variant whose
  only stock is expired correctly appears as low/out-of-stock
- Expiry bucketing: batches with an `expiryDate` are classified as **expired**
  (before today) or **expiring soon** (within **90 days** from today). Expiry
  dates are parsed at local midnight for the UTC+2/+3 deployment timezone.

**FIFO service — `services/fifo.ts`.** See §4.

**Pricing service — `services/pricing.ts`.** `suggest({ priceListDocumentId,
costPriceUsd, quantity })` → `{ sellPrice, retailPrice, exchangeRate }`:
- `retail`: `egpCost × (1 + marginPercent/100)`.
- `wholesale`: same formula **if** `quantity ≥ wholesaleMinQty`, else falls
  back to the retail price/margin.
- `vip`: `retailPrice × (1 − vipDiscountPercent/100)`.

> Callers must pass the customer's **total requested quantity** for the line
> item, not a single FIFO segment's own quantity — see the Order form note in
> §6. (Also: `pricing.ts` re-declares its own local `round2` instead of
> importing the identical helper already exported from
> `utils/order-totals.ts` in the same package — deferred cleanup, no
> correctness impact.)

**Orders service — `services/orders.ts`.** `getWithTotals(documentId)`
(populate customer/priceList/payments/lines.stockBatch, compute per-line
`belowCost` + order totals via `computeTotals`) and `confirm(documentId)` (see
§4). Imports `order-totals` from a **plugin-local copy**
(`server/src/utils/order-totals.ts`, byte-identical to `src/utils/order-totals.ts`)
because the plugin's Vite/Rollup bundler cannot resolve imports outside its
own package root — keep both copies in sync if the math ever changes.

**Exchange rate endpoint — `controllers/settings.ts`.**
- `GET /inventory-dashboard/settings` — returns current `exchangeRate` and
  `exchangeRateUpdatedAt`
- `PUT /inventory-dashboard/settings` — updates `exchangeRate`; the Overview
  screen exposes a single input field for this so the operator can update it
  without leaving the dashboard

**Controllers + routes — `controllers/*`, `index.ts`.** All routes registered
under `type: 'admin'`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/inventory-dashboard/health` | liveness `{ ok: true }` |
| GET | `/inventory-dashboard/overview` | overview aggregation |
| GET | `/inventory-dashboard/settings` | current exchange rate |
| PUT | `/inventory-dashboard/settings` | update exchange rate |
| GET | `/inventory-dashboard/resources` | list of allow-listed resources |
| GET | `/inventory-dashboard/resources/:resource/schema` | field metadata |
| GET | `/inventory-dashboard/resources/:resource` | paginated list |
| GET | `/inventory-dashboard/resources/:resource/:documentId` | one record |
| POST | `/inventory-dashboard/resources/:resource` | create |
| PUT | `/inventory-dashboard/resources/:resource/:documentId` | update |
| DELETE | `/inventory-dashboard/resources/:resource/:documentId` | delete |
| GET | `/inventory-dashboard/fifo/:variantDocumentId?quantity=N` | FIFO batch preview for a variant |
| GET | `/inventory-dashboard/orders/:documentId` | order + computed totals + per-line belowCost |
| POST | `/inventory-dashboard/orders/:documentId/confirm` | confirm order (atomic FIFO consumption) |
| POST | `/inventory-dashboard/pricing/suggest` | suggested sell price for a price list + cost + quantity |

> **Error handling note.** The plugin externalizes `@strapi/utils` (peer
> dependency). Without that, errors thrown inside the plugin bundle would be a
> different `ApplicationError` class and Strapi's `instanceof` mapping would
> turn a guarded 400/404 into a generic 500.

### 5.2 Admin UI (`admin/src`)

- **`utils/api.ts` — `useApi()`** — typed wrapper over `useFetchClient`; every
  `get`/`post`/`put`/`del` call is transparently wrapped in the loading
  service's request counter (see §5.2.2) with zero call-site changes.
- **Hooks** — thin wrappers around the shared `hooks/useAsyncResource.ts` (see
  §5.2.2): `useSchema` (per-resource metadata, returns `{ schema, error,
  reload }`), `useOverview` (returns `{ data, error, isInitialLoading,
  reload }`), `useSettings` (exchange rate, returns `{ exchangeRate,
  exchangeRateUpdatedAt, error, save }`), `useOrder` (documentId-driven
  fetch/reload/confirm/cancel for the Order form, returns `{ order, reload,
  confirm, cancel }`), `useResources` (returns `{ resources, error }` — not
  currently called anywhere in `admin/src`; the left nav is driven by the
  static `config/navConfig.ts` instead, so this hook is dead code as of the
  loading-service follow-up fixes, kept rather than deleted since removing an
  unused hook was out of that work's scope).
- **Router — `pages/App.tsx`** — routes: `/` (Overview), `stock-purchase`,
  `r/:resource` (list), `r/:resource/new` (create), `r/:resource/:id` (edit),
  `orders/new`, `orders/:id`.
- **Generic list — `pages/ResourceListPage.tsx`** — searchable table built from
  `SchemaMeta`; create/edit/delete with guarded delete confirmation; loading
  state via `useAsyncResource` (see §5.2.2).
- **Generic form — `pages/ResourceFormPage.tsx` + `components/FieldRenderer.tsx`
  + `components/RelationSelect.tsx`** — picks the right input per field type.
  `RelationSelect`'s option-list fetch uses `useAsyncResource` (see §5.2.2).
- **Catalog hub — `pages/CatalogHub.tsx`** — a discoverable grid of the 8
  master-data entity types with live per-entity record counts, fetched via
  `useAsyncResource`; reached through `pages/CatalogStandalone.tsx` (see
  §5.2.1's entry-point list).
- **Overview — `pages/Overview.tsx`** — stat cards, exchange rate input,
  low-stock table (expired batches excluded from qty), expiry panels (90-day
  window), stock value shown in both USD and EGP; loading/reload behavior via
  `useAsyncResource` (see §5.2.2).
- **Bespoke flows — `pages/StockPurchase.tsx`** and
  **`components/ProductVariantsForm.tsx`** — see §6. Both still hand-roll their
  own `useEffect`/`useState` option-list fetches rather than using
  `useAsyncResource` — see §10's known limitation.
- **Order flow — `pages/OrderForm.tsx`** — new-order entry + read-only
  confirmed view with payment recording; see §6. Also still hand-rolls its own
  option-list fetches (customers/products/variants) — see §10.

#### 5.2.1 Chakra UI architecture (Phase 4)

The plugin's UI was migrated from `@strapi/design-system` to Chakra UI v2.
Because this is an in-process Strapi plugin (not an iframe), Chakra's styling
had to be scoped so it never leaks onto Strapi's own admin shell, which
shares the same DOM tree.

- **`theme/index.ts`** — `extendTheme` config (brand color scale, fonts,
  Button/Badge/Table style overrides). Deliberately has **no `styles.global`
  key** — a global-style entry would apply to the real `document.body`
  regardless of `resetCSS`, leaking onto Strapi's own shell.
- **`components/ChakraRoot.tsx`** — the **only** place `ChakraProvider` is
  instantiated, with `resetCSS={false}` (Chakra's CSS reset would otherwise
  also leak onto the shared shell). Wraps its children in a scoped
  `<Box bg="gray.50" color="gray.800" minH="100%">` — page background/text
  color live here, not in the theme, for the same leak-avoidance reason.
- **Four independent top-level entry points**, each needing exactly one
  `ChakraRoot` ancestor (never zero, never double-nested):
  1. `pages/App.tsx` — wraps its own `<Routes>` in `<ChakraRoot>` once, at
     the router root. Covers Overview, the generic list/form pages, and the
     nested `stock-purchase`/`orders/*` routes when reached through the
     router.
  2. `pages/StockPurchaseStandalone.tsx` — a thin wrapper
     (`<ChakraRoot><StockPurchase /></ChakraRoot>`) registered as its own
     top-level Strapi `addMenuLink` in `admin/src/index.ts`, bypassing
     `App.tsx` entirely (this is how the left-nav "Stock purchase" link is
     actually reached).
  3. `pages/OrderFormStandalone.tsx` — same pattern for the left-nav "New
     Order" link (`<ChakraRoot><OrderForm /></ChakraRoot>`).
  4. `pages/CatalogStandalone.tsx` — same pattern for the left-nav "Catalog"
     link, wrapping its own nested `<Routes>` (`CatalogHub` at its index
     route, then the generic `ResourceListPage`/`ResourceFormPage` for each
     of the 8 catalog entity types) in one `<ChakraRoot><AppShell>`.

  Because of entry points 2-4, `StockPurchase.tsx` and `OrderForm.tsx`
  themselves must stay **bare** components with no self-wrapping
  `ChakraRoot` — self-wrapping either one would double-nest `ChakraProvider`
  when the same component is reached via `App.tsx`'s own `stock-purchase`/
  `orders/*` routes instead of the standalone link.
- **Shared primitives — `components/ui/`** — `PageHeader`, `StatCard`,
  `DataTable` (owns the table header + empty-state; callers own row
  content), `FormField` (label + required-asterisk wrapper). Every
  migrated screen reuses these rather than reinventing markup.
- **No `@strapi/design-system` imports remain** anywhere under `admin/src`
  after the migration; the only remaining `@strapi/*` UI import is
  `@strapi/icons` for nav icons (`index.ts`, `PluginIcon.tsx`), which is
  Strapi's own left-nav chrome, not plugin content, and was left as-is.

#### 5.2.2 Loading service

A unified loading system, added after Phase 4, gives the plugin one
consistent way to show navigation/data-loading feedback instead of ad hoc
per-page spinners (or, in several places before this, no loading feedback at
all). Three pieces, all under `admin/src/loading/` and `admin/src/hooks/`:

- **`loading/LoadingProvider.tsx`** — a React context holding an in-flight
  request counter (`begin()`/`end()`), mounted once per `ChakraRoot` (so each
  of the plugin's 4 entry points gets its own independent counter). Exposes
  `useIsLoading()` (`count > 0`) and `useLoadingTracker()` (`{ begin, end }`).
- **`utils/api.ts` — `useApi()`** wraps every `get`/`post`/`put`/`del` call
  with `begin()`/`end()` in a `finally`, so all call sites across the plugin
  automatically drive the counter — no per-call-site changes needed.
- **`loading/TopProgressBar.tsx`** — a debounced (150ms show-delay, 200ms
  min-visible, to avoid flicker on fast requests) slim animated bar, mounted
  once in `AppShell` right before `{children}`. Rendered inside a Chakra
  `<Portal>` (a direct child of `document.body`) at `position: fixed` with
  `zIndex={1500}` — this is a **deliberate, narrow exception** to the
  "never leak onto Strapi's shared shell" rule in §5.2.1: the bar is a 3px
  strip at the very top edge of the full viewport (crossing over Strapi's own
  left nav, not just the plugin's content column), chosen specifically so it
  also renders above Chakra's own `Modal` overlay (`zIndex: 1400`) — the
  `Portal` is required for that guarantee, since a plain `position: fixed`
  element without one only escapes ancestors within its own DOM subtree, not
  any stacking context Strapi's own admin shell might establish above it.
- **`hooks/useAsyncResource.ts` — `useAsyncResource<T>(fetcher, deps)`** — the
  shared data-fetch hook nearly every page/hook above is built on. Returns
  `{ data, setData, error, status, isInitialLoading, reload }`.
  `isInitialLoading` is `status === 'loading' && !hasSettled` — **`hasSettled`
  is a dedicated flag, set `true` the first time the fetcher resolves *or*
  rejects, and never reset by `reload()`.** This distinction matters: an
  earlier version computed `isInitialLoading` from `data === null`, which
  incorrectly re-armed after an error (a failed load followed by a retry
  looked identical to "never loaded," re-showing a full-page placeholder and
  dropping input focus, e.g. mid-search). Also guards against out-of-order
  responses via an internal request-id ref, so a slow earlier request can
  never clobber a faster later one's result.
  **Convention for any new page or hook in this plugin:** build on `useApi()`
  (already mandatory) + `useAsyncResource` + render
  `components/ui/LoadingState.tsx` when `isInitialLoading` is true. Never
  hand-roll `useState`/`useEffect` fetch bookkeeping, and never let a
  background reload blank a page back to a placeholder — keep showing the
  last-loaded data, with an inline error indicator if the reload failed (see
  `pages/Overview.tsx`'s `error != null && (...)` banner, or
  `pages/OrdersList.tsx`/`pages/ResourceListPage.tsx`'s `loadError != null`
  pattern, for the established idiom — note `error` is typed `unknown`, so
  `error && (...)` alone fails TypeScript's JSX-children check; always
  `!= null` it first). See §10 for the pages that still don't follow this.

#### 5.2.3 Design system rollout (Frontend Design Convention, Phases 1-2 of 5)

`docs/Frontend Design Convention.md` is a 5-phase design-system rollout for
the plugin's Chakra theme, executed via `superpowers:subagent-driven-development`
with plans under `docs/superpowers/plans/2026-08-03-design-convention-0{1..5}-*.md`.
Phases 1 ("Foundations") and 2 ("Layout & Navigation Shell") have landed on
`main`.

**Phase 1** touches only `theme/index.ts` (plus 2 call sites) and had no
visible effect on its own until Phase 2/later phases wired up consumers.

- **Severity color tokens** — 15 new `semanticTokens.colors` entries:
  `severity.{critical,warning,success,info,neutral}.{bg,fg,border}`, mode-aware
  (`default`/`_dark`), OKLCH values copied verbatim from doc §3.1.
  `severity.neutral.*` is not in the doc's table — added ahead of Phase 3's
  Badge work, which needs a 5th "quiet" status value; it reuses plain `gray.*`
  rather than inventing a new hue.
- **`radii` scale** — `sm`/`md`/`lg`/`xl` = `6px`/`10px`/`14px`/`20px`,
  overriding only those 4 of Chakra's 7 default steps (`base`/`2xl`/`3xl` are
  untouched and off-scale — a later pass should either extend the override or
  leave a code comment, per the Phase 1 final review). 7 component style
  overrides remapped onto the new tiers: `Button`/`Input`/`NumberInput`/
  `Select`/`Textarea` → `md`, `Badge` → `sm`, `Card` → `lg`.
- **Dark-mode-aware shadows** — the old flat `shadows.card`/`shadows.cardHover`
  keys were deleted and replaced with `semanticTokens.shadows['shadow.resting'
  | 'shadow.raised']`. In dark mode, `shadow.resting` is `none` (the `Card`
  override's existing 1px border already satisfies "border only, no shadow");
  `shadow.raised` keeps a soft glow plus a 1px `brand.400`-tinted ring. Renamed
  at all 3 usage sites (`theme/index.ts`'s own `Card` override,
  `pages/CatalogHub.tsx`, `components/AddNewModal.tsx`) — Chakra's `boxShadow`
  prop accepts any string, so a missed rename would NOT have been caught by
  `tsc`; verified via full-tree grep instead.
- **Known, deliberately ruled-on divergence:** the doc's severity table marks
  Info as "= brand" (same hue as `accent.*`), but the *existing* `accent.bg`/
  `accent.fg` tokens are hex-based (`brand.50`/`brand.600`) and were left
  untouched — realigning them would be an unplanned, app-wide brand-color
  change outside this phase's scope. `severity.info.*` (OKLCH, per-doc) and
  `accent.*` (existing hex) will therefore render as two visibly different
  blues once Phase 3 wires up an info-severity badge next to accent-colored
  links/active-nav. Not a bug; a scope boundary. See Phase 3's plan
  (`docs/superpowers/plans/2026-08-03-design-convention-03-core-components.md`,
  Self-Review Notes).
- **Plan correction found during Phase 1's final review:** the original
  Phase 2 plan only fixed `AppSidebar.tsx`'s stale inline `borderRadius="lg"`
  (now stale since `radii.lg` moved from Chakra's default ~8px to 14px).
  `components/LanguageToggle.tsx` and `components/ColorModeToggle.tsx` — two
  sidebar-footer rows structurally identical to `AppSidebar.tsx`'s
  `NavButton` — share the exact same defect and were missing from that plan.
  Phase 2's plan was amended to cover all 3 sites before execution.
- **No component-render test runner exists for `admin/src`** — the only
  automated gate for this and every later phase's UI work is
  `npm --prefix src/plugins/inventory-dashboard run test:ts:front` (`tsc
  --noEmit`). Pure token/config changes have no natural red→green cycle;
  verification is type-check + (where a dev server was reachable) manual
  visual check in both light/dark mode. No dev server was reachable in the
  sandboxes used for Phases 1-2's subagents — every task's verification is
  type-check plus diff-level/textual re-checks (grep for stale token
  names, full-file re-reads); a real browser pass is still owed once one is
  available, tracked as an open item, not a blocker.

**Phase 2** touches `AppSidebar.tsx`, `AppShell.tsx`, `LanguageToggle.tsx`,
`ColorModeToggle.tsx` — three literal-value changes, doc §4:

- **Sidebar width 240px → 260px** — desktop `AppSidebar.tsx`'s nav `Box`
  and the mobile `AppShell.tsx` `DrawerContent`'s `maxW` changed together in
  one commit, so they can't drift out of sync (a drawer narrower than the
  sidebar it mirrors would clip content).
- **Nav-item radius `lg`→`md`** at 3 sites: `AppSidebar.tsx`'s `NavButton`,
  `LanguageToggle.tsx`, `ColorModeToggle.tsx`. The 3-site scope was itself a
  correction — the original Phase 2 plan only named `AppSidebar.tsx`; Phase
  1's final review caught that the two sidebar-footer toggle rows are
  structurally identical (same `as="button"`/`px={3} py={2}`/`_hover`
  shape) and share the same stale-radius defect. Plan amended before
  execution; `components/FontSizeToggle.tsx` (the 4th footer row) was
  already `"md"` and needed no change — the whole footer stack is now a
  uniform 10px.
- **Catalog-group heading top margin** — `mt={4}` (16px) added to the one
  `Heading` shared by both `CATALOG_GROUPS.map()` entries ("Catalog",
  "Partners & Pricing"), so a single edit covers both group headers.
- **Ruled-on scope boundary, not a gap:** doc §4 says the sidebar widens
  "with the new padding scale," but §3.3's spacing table has no distinct
  "Sidebar padding" row — only "Sidebar width" (240→260px), which this
  phase implements in full. `AppSidebar.tsx`'s own `px={4} py={6}` was left
  unchanged. Flagged by Phase 2's final review as worth an explicit ruling
  rather than silent omission: read narrowly, "the new padding scale" most
  plausibly refers to the tabled width change itself, not an untabled
  internal-padding bump: If a future pass wants to also grow the sidebar's
  own internal padding (e.g. toward the card-body 16→24px scale as a
  visual analogy), that's an explicit follow-up decision, not something
  this rollout silently owns.
- **Deferred to Phase 3:** `ui/StatCard.tsx:9`, `pages/CatalogHub.tsx:58`,
  `components/AddNewModal.tsx:94` still use `borderRadius="lg"` on icon
  chips; doc §3.1 calls these "icon chips" and §3.4 assigns chips to
  `radius.sm` (6px). Phase 3's `StatTile` consolidation should explicitly
  rule which tier these belong to.

### 5.3 Admin panel access control (`src/admin/app.tsx`)

Strapi's own built-in left nav (`MainNav`/`LeftMenu`, rendered by
`@strapi/admin`'s `AuthenticatedLayout` around *every* `/admin/*` route,
including this plugin's own pages) is hidden for any logged-in admin user
who is **not** a Super Admin, so non-super-admin staff only see the plugin's
own `AppSidebar` (§5.2) and never Strapi's Content Manager / Content-Type
Builder / Marketplace / Settings chrome stacked next to it.

There is no Strapi config for this — admin customization
(`src/admin/app.tsx`) supports locales/theme/translations/menu links, not
removing the built-in shell, and RBAC alone can't fully do it either: the
Home and Settings nav icons are hardcoded to always render for every
logged-in user regardless of permissions (only Marketplace and
plugin/content links are permission-gated). So this is a client-side visual
toggle, not an access-control mechanism:

- On `bootstrap`, fetches `GET /admin/users/me` (using the JWT already in
  `localStorage['jwtToken']`) and checks `roles` for `code ===
  'strapi-super-admin'`, caching the result per-token to avoid refetching.
- Strapi's nav has no stable selector to target (no `data-testid`, hashed
  styled-components classnames). It relies on one structural fact instead:
  Strapi's nav is always the **first** `<nav>` in the document (rendered by
  `AuthenticatedLayout` before the routed page content), while this plugin's
  own `AppSidebar` (also a semantic `<nav>`, see §5.2) is always nested
  *inside* that routed content — so `document.querySelectorAll('nav')[0]`
  reliably means Strapi's, never ours.
- A `MutationObserver` on `document.body` (debounced via
  `requestAnimationFrame`) re-runs the check, since Strapi's login/logout
  swaps the whole layout client-side with no full page reload to hook into
  otherwise. A `storage` event listener covers the cross-tab case.
- The same `check()` also redirects non-super-admins away from Strapi's own
  Home page (`/admin` or `/admin/` — where login lands you, and the only
  other way to reach it now that the nav is hidden is a typed/stale URL) to
  the plugin's own Overview at `/admin/plugins/inventory-dashboard` via
  `window.location.replace`, so non-super-admins land on the plugin's
  Overview instead of Strapi's default dashboard.
- This only hides the nav / redirects the landing page visually — it is
  **not** a security boundary. Actual page-level access is (and must
  remain) enforced through Strapi's own Roles & Permissions:
  non-super-admin roles should be scoped to only
  `plugin::inventory-dashboard.access`, with no Content Manager /
  Content-Type Builder / Media Library / Marketplace / Settings
  permissions, configured in Settings → Administration Panel → Roles. That
  RBAC scoping is what actually blocks direct-URL access; hiding the nav
  just keeps the UI from advertising pages the role can't use anyway.

See §10 for the fragility caveat (this depends on `@strapi/admin`'s current
internal DOM structure, not a public API).

---

## 6. Key flows end-to-end

### Record a stock purchase
`StockPurchase.tsx`. Cascading **Product → Variant → Supplier** comboboxes,
then quantity, cost **in USD**, and the three dates. On submit it creates a
`stock-batches` record. The `beforeCreate` hook seeds `quantityRemaining` from
`quantityPurchased`. The Overview then shows EGP equivalent using the current
exchange rate.

### Create a product with its variants
`ProductVariantsForm.tsx` mounted inside `ResourceFormPage` when creating a
Product. The operator optionally defines real variant rows (label, type,
low-stock threshold) and optionally links related products for cross-selling.
On save:

1. The product is created → `afterCreate` makes one default variant.
2. Each explicit variant row is created (`isDefault: false`).
3. The auto-created default is deleted, leaving exactly the explicit variants.

### Update the exchange rate
The Overview screen shows the current EGP/USD rate and a text input. The
operator changes the number and clicks Save. The `PUT /settings` endpoint
updates System Settings. All EGP cost displays (Overview stock value, Order
Line cost reference, below-cost warning) recalculate immediately on next load.
No stored costs are mutated.

### Create and confirm an order
`OrderForm.tsx` (new order) / `useOrder` hook:

1. Operator selects a customer. Their assigned Price List auto-fills as the
   pricing mode for the order (can be changed per order).
2. Operator picks a product + variant + quantity and clicks **Add**. The form
   fetches the FIFO-resolved batch(es) via `GET /fifo/:variantDocumentId` and,
   for each segment, calls `POST /pricing/suggest` with the segment's cost
   **and the customer's total requested quantity** (not the segment's own
   split quantity — this matters for the wholesale `minQty` gate, see §5) to
   get a suggested sell price. One draft Order Line is added per segment. The
   operator can override any value.
3. If a line's `sellPrice` is below `costPriceUsdSnapshot × exchangeRate`, a
   "Below cost" badge appears on that line.
4. Adding a product checks its `relatedProducts` and shows a "Customers also
   buy" suggestion strip; clicking one pre-fills the product picker.
5. Operator enters a flat discount at the order footer. Totals update live.
6. **Save draft** creates the `orders` row (`status: 'draft'`) then each
   `order-lines` row, and navigates to `orders/:id`.
7. On that order's page, **Confirm** calls `POST /orders/:id/confirm`, which
   atomically resolves FIFO consumption, decrements `quantityRemaining` on
   each affected batch, snapshots `costPriceUsdSnapshot` on each line, and
   locks the order (see §4). The view switches to the read-only
   `ConfirmedOrderView`.
8. Operator records payments via the Payment panel (`POST /resources/payments`).
   `order.status` updates automatically (`confirmed` → `partially_paid` →
   `paid`) via the payment lifecycle.

> **Known gaps in this flow (documented, deferred — not correctness bugs in
> the confirmed/locked state, but real UX rough edges):**
> - A brand-new, not-yet-saved order has no `order.exchangeRate` yet (it comes
>   from the loaded order), so the below-cost badge can't render correctly
>   until after the first Save draft + reload.
>   Cross-sell suggestions are display-only — no automatic add-to-order.
> - Revisiting an existing **draft** order's URL (`orders/:id` with
>   `status: 'draft'`) re-renders the empty "new order" form instead of
>   pre-populating `draftLines` from the saved lines — clicking Save draft
>   again creates a second, separate order rather than updating the existing
>   one. Avoid navigating away from an unsaved draft; finish Save draft →
>   Confirm in one sitting.
> - `getSuggestedPrice()` silently returns `0` on any pricing-endpoint error
>   (e.g. a deleted price list) instead of surfacing it — watch for an
>   unexpectedly-0 sell price on a new line.
> - `saveDraft()` posts order-lines sequentially with no rollback; a mid-loop
>   failure leaves a persisted partial draft, and retrying creates a
>   duplicate order rather than resuming the partial one.

### Expiry / low-stock computation
`overview.ts` walks every stock batch once:
- Sums `quantityRemaining × costPriceUsd × exchangeRate` for total stock value
- For low-stock: sums `quantityRemaining` per variant **excluding expired
  batches**, compares against `lowStockThreshold`
- Buckets batches into **expired** (expiryDate before today) or **expiring
  soon** (expiryDate within **90 days** of today), parsed at local midnight

---

## 7. Database & environment

The runtime database is **MySQL**. Connection settings come from the environment
via [`config/database.ts`](../config/database.ts) — credentials are never
hardcoded and `.env` is gitignored. Relevant `.env` keys:

```
DATABASE_HOST       127.0.0.1
DATABASE_PORT       3306
DATABASE_NAME       cosmetics        (runtime database)
DATABASE_USERNAME   user1
DATABASE_PASSWORD   password
DATABASE_SSL        false
DATABASE_TEST_NAME  cosmetics_test   (test database)
```

- **Runtime DB:** `cosmetics`.
- **Test DB:** `cosmetics_test` (used by Jest suites so tests never touch real data).
- This is a clean rebuild — the legacy `3mto`/`3mto_test` databases and the
  old `d:\7meed\3mto` codebase are unrelated and must never be reused.

---

## 8. Running, building, and the quality gate

From the app root (`d:\7meed\cosmtic`):

```bash
npm run develop          # start Strapi with auto-reload
npm run build             # build the Strapi admin
npm test                  # app-level Jest suites (see below)
npx tsc --noEmit           # whole-app type check (EXCLUDES src/plugins/**)
```

App-level Jest suites (`tests/*.test.ts`, run via
`cross-env NODE_ENV=test jest --runInBand --forceExit`): `smoke`,
`master-types`, `seed`, `order-totals`, `order-lifecycle`, `order-guards` —
currently 13 suites / 41 tests passing counting the plugin suites below (app
Jest config also picks up the plugin's `server/tests/*.test.ts`).

**Plugin quality gate** (run after changing plugin source — the app's own
`tsc`/`build` do NOT check plugin code):

```bash
cd src/plugins/inventory-dashboard
npm run build              # strapi-plugin build → dist/server + dist/admin (MUST run before jest/dev pick up changes)
npm run test:ts:back       # tsc -p server/tsconfig.json --noEmit — authoritative server/plugin type gate
npm run test:ts:front      # tsc -p admin/tsconfig.json --noEmit — authoritative admin type gate (strict; catches noImplicitAny)
cd ../../..
npx tsc --noEmit            # whole-app type check
npm test                    # full suite (app + plugin tests)
```

There is no `npm run lint` script in this plugin (the `@strapi/sdk-plugin` v6
scaffold ships without one) — `test:ts:front`/`test:ts:back` are the real
gates. All of the above must be clean before considering plugin work done.

Plugin-only test suites (`src/plugins/inventory-dashboard/server/tests/`):
`resource`, `metadata`, `settings`, `overview`, `fifo`, `pricing`, `confirm`
(includes a concurrent-confirm race test).

---

## 9. Extending the system

**Add a content type to the dashboard** — add one line to
`src/plugins/inventory-dashboard/server/src/config/resources.ts`:

```ts
'purchase-orders': { uid: 'api::purchase-order.purchase-order', populate: ['supplier'] },
```

Rebuild the plugin and restart — the resource appears in navigation with
generic list + create/edit/delete. No further UI code needed. **If the new
type has its own confirm/lock-style state machine (like Order), it also needs
its own `lifecycles.ts` guard** — the generic allow-list is a routing/visibility
boundary only, not a business-rule boundary (see §4).

**Change a field** — edit the content type's `schema.json`. The list and form
update automatically.

**Add business rules** — add a `lifecycles.ts` next to `schema.json`. Rules
belong on the model so they apply everywhere. To let one internal code path
write a field that's otherwise guarded (like `order.status`), use the
`__trusted`-marker-and-strip idiom documented in §4 rather than reaching for
`strapi.db.query` as a bypass (it isn't one).

**Add a bespoke screen** — create a page under `admin/src/pages`, add a route
in `pages/App.tsx`, and a nav entry if needed.

---

## 10. Known limitations & open decisions

- **Required `*-to-many` relations aren't editable in the generic form.** The
  generic form excludes `*-to-many` relations (`variants`, `batches`) because
  they are managed from the other side. If a future content type has a required
  one-to-many that must be set on create, give it a bespoke screen or extend
  `FieldRenderer` with a multi-select.
- **FIFO across partially exhausted batches creates multiple Order Lines.** If a
  sale of 10 units spans two batches (6 remaining in batch A, 4 in batch B),
  the system creates two lines. The operator sees both lines pre-filled and can
  inspect or override before confirming.
- **Exchange rate is global, not per-order.** The rate used for EGP cost display
  and the below-cost warning is always the current live rate. Historical orders
  retain the `costPriceUsdSnapshot` in USD; if the operator needs to see the
  original EGP equivalent of an old order, they must know the rate that was
  active at the time. A future improvement would be to snapshot the rate on
  order confirmation.
- **Relation pickers load up to 100 options with no search/pagination.** Fine
  for current dataset sizes; revisit if any related set exceeds 100 rows.
- **The generic layer's search/relation-display assumes every resource has a
  `name` field.** `resource.ts`'s search filter and `metadata.ts`'s
  `mainField: 'name'` both hardcode it, but `variants` uses `label` and
  `stock-batches` has no name-like field — searching those two resources
  returns nothing and relation pickers targeting them show a blank display
  field. Would need a per-resource `searchField`/`mainField` in `RESOURCES`.
- **Plugin-local `@strapi/utils` must stay externalized.** If `npm install`
  inside the plugin pulls a local copy, re-verify error mapping (a dual
  `@strapi/utils` instance reintroduces the 500-instead-of-400 bug).
- **`statusFromPayments` can't reach `'paid'` on a 100%-discounted order**
  (see §4) — `finalTotal > 0` is required, so `finalTotal = 0` stays
  `'confirmed'` forever even with nothing owed.
- **OrderForm has several deferred UX gaps** — see the callout at the end of
  §6 (below-cost badge on a new unsaved order, draft-revisit not
  pre-populating lines, silently-swallowed pricing errors, non-atomic
  multi-line draft save). None of these affect a *confirmed* order's
  correctness (which is guarded server-side); they affect the drafting
  experience only.
- **The built-in Strapi nav is hidden via an unofficial DOM heuristic**
  (§5.3): "first `<nav>` in the document is Strapi's" holds today but isn't
  a public contract. If a future `@strapi/admin` upgrade changes that
  structure (e.g. Strapi stops using a semantic `<nav>` tag, or renders its
  own nav after the routed content), the script will simply stop finding a
  match and no-op — the built-in nav would just reappear, not break
  anything else. Re-verify this heuristic after any `@strapi/admin` major
  version bump. Also note there's an inherent brief flash of the built-in
  nav on every full page load before the async role check resolves — this
  is a client-side-only toggle, so it can't be avoided without
  server-rendering the check.
- **~140 lines of copy-pasted delete-guard logic** across 5 lifecycle files
  (brand/category/price-list/variant-type/stock-batch) — same shape, different
  field/message. A shared factory would remove the duplication; not done, no
  correctness impact.
- **Mobile push notifications for expiry are not implemented.** The Overview
  flags expiry within 90 days visually. A push notification system (e.g. a
  background cron + FCM) is a future addition.
- **Cross-selling suggestions are display-only.** The `relatedProducts` field
  exists on Product and is shown in the Order form as a suggestion strip. There
  is no automatic add-to-order; the operator clicks to add manually.
- **Excel import/export is out of scope for the current phases.** A later
  phase may add reporting/export and import.
- **Stock restoration on order cancellation is manual.** There is currently no
  "cancel a confirmed order" flow at all (confirmed orders are locked, and
  deleting one is blocked — see §4). If that need arises, it should restore
  `quantityRemaining` on the affected batches atomically, mirroring the
  `confirm()` transaction pattern.
- **Three pages still hand-roll `useEffect`/`useState` option-list fetches
  instead of using `useAsyncResource`** (see §5.2.2's convention):
  `pages/OrderForm.tsx` (customers/products/variants), `pages/StockPurchase.tsx`
  (products/suppliers/variants), and `components/ProductVariantsForm.tsx`
  (brands/categories/variant-types/products). Unlike the two sites already
  migrated (`CatalogHub.tsx`, `RelationSelect.tsx`), **none of these three has
  a `.catch()` at all** — a failed request is an unhandled promise rejection
  with a silently-empty dropdown, not just a missed convention. Discovered
  during the loading-service follow-up fixes' final review; migrating them
  was out of that work's scope and is a candidate for a future pass.
- **`hooks/useResources.ts` has zero call sites in `admin/src`.** The left
  nav is driven by the static `config/navConfig.ts` instead. Kept rather than
  deleted (removing it was out of scope for the work that noticed it) — a
  candidate for deletion in a future cleanup pass.
- **Minor cosmetic items carried over from the Chakra UI reskin (Phase 4),
  not correctness bugs:**
  - `ConfirmedOrderView`'s lines table header reads "Variant" but the cell
    renders the stock batch's id, not a variant label — pre-existing
    mislabel, not introduced by the reskin.
  - `ConfirmedOrderView` is the one screen that doesn't use the shared
    `PageHeader` primitive (it needs a right-aligned status badge next to
    the title) — visually slightly different from every other screen's
    heading.
  - There is no frontend automated test harness for the admin UI (no
    change from the Strapi-DS era) — admin screens are gated by
    `test:ts:front`/`build` plus manual browser click-through, not unit
    tests.
- **Minor items from the Frontend Design Convention rollout's Phase 1 final
  review, deferred rather than fixed (see §5.2.3):**
  - `theme/index.ts`'s new `radii` scale only overrides `sm`/`md`/`lg`/`xl`;
    Chakra's untouched `base` (4px) and `2xl` (16px) steps now sit *between*
    overridden neighbors (`sm`=6px > `base`=4px; `xl`=20px > `2xl`=16px).
    Nothing in the plugin currently uses `base`/`2xl`/`3xl` radii, so this is
    latent, not active — worth a comment or a full override if ever used.
  - 4 more inline `borderRadius="lg"` sites went 8px→14px as a side effect of
    the radii remap, beyond the ones any phase plan tracks:
    `pages/CatalogHub.tsx:58`, `components/AddNewModal.tsx:94`,
    `components/ui/StatCard.tsx:9` (icon chips), `pages/OrderForm.tsx:234`
    (an accent box). Not wrong per the doc (icon chips aren't in its radius
    table) but unreviewed visual drift — worth a browser check.
  - Phase 1's plan named 2 of the 3 `AlertDialogContent borderRadius="xl"`
    sites (`ResourceListPage.tsx:130`, `OrdersList.tsx:114`); a third exists
    at `OrderForm.tsx:536`. Harmless (all three get the intended 20px), just
    an inventory gap for anyone auditing against the plan text.

---
