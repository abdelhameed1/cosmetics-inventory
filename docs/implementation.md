# Cosmetics Inventory — Application Documentation


---

## 1. What this is

A inventory-management and accounting system for a cosmetics wholesale/retail
business, built on **Strapi v5**. It tracks products and their sellable
**variants** (shades, sizes, finishes…), and the **stock batches** purchased
from suppliers — with cost in USD, a daily exchange rate to convert to EGP,
purchase/production/expiry dates, and remaining quantity. Batches are consumed
in FIFO order (oldest purchase first). On top of the data model sits a bespoke
admin plugin that gives the operator a single control center: an at-a-glance
overview, generic create/edit/delete for every inventory record, and guided
flows for stock purchase and product creation.


### Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Strapi `5.49.0` (TypeScript, CommonJS) |
| Runtime DB | MySQL 8 (`mysql2` driver) |
| Admin UI | React 18, `@strapi/design-system` v2, `react-router-dom` v6 |
| Plugin build | `@strapi/sdk-plugin` (`strapi-plugin build`) |
| Tests (foundation only) | Jest + `ts-jest` |

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
│  ├─ api/                         the content types (schema + lifecycles)
│  │  ├─ brand/  category/  variant-type/  supplier/  customer/
│  │  ├─ system-settings/  … single-type for exchange rate and global config
│  │  ├─ price-list/       … named price lists (Retail / Wholesale / VIP)
│  │  ├─ order/            … order header (Phase 3)
│  │  ├─ order-line/       … per-line sale record (Phase 3)
│  │  ├─ payment/          … payment installments against an order (Phase 3)
│  │  ├─ product/          … content-types/product/schema.json + lifecycles.ts
│  │  ├─ variant/          … lifecycles.ts (typed-variant guard)
│  │  └─ stock-batch/      … lifecycles.ts (quantityRemaining seeding)
│  └─ plugins/inventory-dashboard/ the admin plugin (see §5)
├─ tests/                          smoke + master-types Jest suites
└─ docs/                           this file + superpowers specs/plans
```

---

## 3. Data model

All collection types have `draftAndPublish: false` (records are live
immediately). They fall into three groups.

### 3.1 Reference / master data

| Type | Key fields | Notes |
|------|-----------|-------|
| **Brand** | `name` (required, unique), `notes` | `products` (1‑many) |
| **Category** | `name` (required, unique), `notes` | `products` (1‑many); four entries are seeded (see §3.5) but the operator can add more at any time |
| **Variant Type** | `name` (required, unique) | classifies a variant (Shade/Size/…); `variants` (1‑many) |
| **Supplier** | `name` (required), `phone`, `notes` | `batches` (1‑many) |
| **Customer** | `name` (required), `phone`, `address`, `notes`, `priceList` → Price List | `priceList` determines default pricing on new orders; can be overridden per order |
| **Price List** | `name` (required, unique), `type` (enum: `retail` / `wholesale` / `vip`), `marginPercent` (decimal), `wholesaleMinQty` (integer, wholesale only), `vipDiscountPercent` (decimal, VIP only), `notes` | Three lists are seeded (see §3.5); operator can add more |
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

### 3.3 Order data *(Phase 3 — planned)*

**Order** — one sales transaction with one customer.
- `customer` → Customer (many‑to‑one, **required**)
- `orderDate` (date, **required**)
- `status` (enum: `draft` / `confirmed` / `partially_paid` / `paid`)
- `discountAmount` (decimal, default 0) — flat EGP discount on the whole order
- `shippingNotes` (text)
- `notes` (text)
- `lines` → Order Line (one‑to‑many, inverse)
- `payments` → Payment (one‑to‑many, inverse)

Computed (not stored, derived on read):
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
- `sellPrice` (decimal, **required**) — entered manually by the operator in EGP; system warns if below `costPriceUsdSnapshot × exchangeRate`
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
                                    │
                                 Payment
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
created — dashboard plugin, Strapi content manager, or API.

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

### Stock Batch → FIFO consumption *(Phase 3)*
When an Order is **confirmed**, the system resolves which batch to consume for
each order line using FIFO:

1. For the chosen variant, fetch all batches where `quantityRemaining > 0`,
   ordered by `purchaseDate ASC` (oldest first). Ties broken by `createdAt ASC`.
2. Deduct `quantitySold` from the oldest batch. If that batch is exhausted
   before the quantity is covered, continue to the next oldest batch and
   so on, splitting across as many batches as needed.
3. Each consumed batch segment becomes one Order Line record with its own
   `costPriceUsdSnapshot`.
4. The operator sees the FIFO-resolved lines pre-filled and may override the
   batch assignment manually before confirming.
5. Expired batches are included in FIFO resolution by default (expired stock
   is not blocked from sale — the expiry flag is informational only).

> **Why FIFO:** the operator buys multiple shipments of the same product at
> different dollar costs. FIFO ensures the oldest (and often cheapest) stock is
> cleared first, and profit is calculated against the actual historical cost of
> what was sold — not an average.

### Order → status auto-update from payments *(Phase 3)*
`src/api/order/content-types/order/lifecycles.ts` — **`afterCreate`** and
**`afterUpdate`** on Payment: recalculate `totalPaid` vs `finalTotal` and set
`order.status` to `paid` (if totalPaid ≥ finalTotal), `partially_paid` (if
totalPaid > 0), or `confirmed` (if totalPaid = 0).

### Order Line → below-cost warning *(Phase 3)*
When `sellPrice` is saved on an Order Line, the system checks:
`sellPrice < costPriceUsdSnapshot × currentExchangeRate`. If true, the API
returns a warning flag (not a blocking error) and the UI displays a visible
alert: "Sell price is below cost — you are selling at a loss." The operator
can choose to proceed.

### Deletion guards
- Deleting a **Brand** or **Category** that has products is blocked with a
  clear error message.
- Deleting a **Variant Type** that has variants is blocked.
- Deleting a **Price List** that is assigned to one or more customers is blocked.
- Deleting a **Stock Batch** that is referenced by an Order Line is blocked.

---

## 5. The Inventory Dashboard plugin

A local Strapi plugin at `src/plugins/inventory-dashboard`, enabled in
[`config/plugins.ts`](../config/plugins.ts) (`enabled: true`, resolved from
`./src/plugins/inventory-dashboard`). Its defining idea is that it is
**schema-auto-driven**: the server exposes a small allow-list of content types
plus metadata describing each one's fields, and the admin renders its list
tables and edit forms generically from that metadata. There is almost no
per-entity UI code — the exceptions (Overview and the product-with-variants
flow) are intentional, curated screens.

### 5.1 Server engine (`server/src`)

**Allow-list — `config/resources.ts`.** A single `RESOURCES` map from a URL
slug to `{ uid, populate? }`:

```ts
brands, categories, variant-types, suppliers, customers, price-lists,
products       → populate brand, category, variants, relatedProducts
variants       → populate product, variantType, batches
stock-batches  → populate variant, supplier
orders         → populate customer, lines, payments          // Phase 3
order-lines    → populate order, stockBatch                 // Phase 3
payments       → populate order                             // Phase 3
```

This map is both the **security boundary** (any UID not listed 404s) and the
source of the navigation.

**Resource service — `services/resource.ts`.** Generic CRUD over
`strapi.documents(uid)` for any allow-listed slug: `find` (paginated,
`pageSize` capped at 100), `findOne`, `create`, `update`, `remove`.

**Metadata service — `services/metadata.ts`.** Turns a content type's
attributes into the `FieldMeta[]` the admin renders from: `type`, `required`,
`min`/`max`, `unique`, enum `values`, and for relations `{ resource, kind,
mainField }`. System fields are marked hidden; relations whose target is not
allow-listed are also hidden.

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
| GET | `/inventory-dashboard/fifo/:variantDocumentId` | FIFO batch preview for a variant *(Phase 3)* |
| POST | `/inventory-dashboard/orders/:documentId/confirm` | confirm order + trigger FIFO *(Phase 3)* |

> **Error handling note.** The plugin externalizes `@strapi/utils` (peer
> dependency). Without that, errors thrown inside the plugin bundle would be a
> different `ApplicationError` class and Strapi's `instanceof` mapping would
> turn a guarded 400/404 into a generic 500.

### 5.2 Admin UI (`admin/src`)

- **`utils/api.ts` — `useApi()`** — typed wrapper over `useFetchClient`.
- **Hooks** — `useResources` (nav), `useSchema` (per-resource metadata),
  `useOverview`, `useSettings` (exchange rate).
- **Router — `pages/App.tsx`** — routes: `/` (Overview), `stock-purchase`,
  `r/:resource` (list), `r/:resource/new` (create), `r/:resource/:id` (edit),
  `orders/new` *(Phase 3)*, `orders/:id` *(Phase 3)*.
- **Generic list — `pages/ResourceListPage.tsx`** — searchable table built from
  `SchemaMeta`; create/edit/delete with guarded delete confirmation.
- **Generic form — `pages/ResourceFormPage.tsx` + `components/FieldRenderer.tsx`
  + `components/RelationSelect.tsx`** — picks the right input per field type.
- **Overview — `pages/Overview.tsx`** — stat cards, exchange rate input,
  low-stock table (expired batches excluded from qty), expiry panels (90-day
  window), stock value shown in both USD and EGP.
- **Bespoke flows — `pages/StockPurchase.tsx`** and
  **`components/ProductVariantsForm.tsx`** — see §6.
- **Order flow — `pages/OrderForm.tsx`** *(Phase 3)* — see §6.

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

### Create and confirm an order *(Phase 3)*
`OrderForm.tsx`:

1. Operator selects a customer. Their assigned Price List auto-fills as the
   pricing mode for the order (can be changed per order).
2. Operator adds a product. The system fetches the FIFO-resolved batch(es)
   for that variant via `GET /fifo/:variantDocumentId` and pre-fills the batch,
   cost snapshot, and suggested sell price based on the active price list
   formula. The operator can override any value.
3. If `sellPrice < costPriceUsdSnapshot × exchangeRate`, a warning banner
   appears on that line: "Sell price is below cost — selling at a loss."
4. When adding a product, the UI checks `relatedProducts` and displays a
   suggestion strip: "Customers also buy: [Brush X] [Sponge Y] — add to order?"
5. Operator enters a flat discount at the order footer. Totals update live.
6. On **Confirm**: `POST /orders/:id/confirm` triggers FIFO consumption,
   decrements `quantityRemaining` on each affected batch, snapshots
   `costPriceUsdSnapshot` on each line, and locks the order (lines become
   read-only).
7. Operator records payments via the Payment panel. Status updates automatically
   (confirmed → partially_paid → paid).

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
hardcoded. Relevant `.env` keys:

```
DATABASE_HOST       (default localhost)
DATABASE_PORT       (default 3306)
DATABASE_NAME       runtime database (this project uses `3mto`)
DATABASE_USERNAME
DATABASE_PASSWORD
DATABASE_SSL        (default false)
```

- **Runtime DB:** `3mto`.
- **Test DB:** `3mto_test` (used by Jest suites so tests never touch real data).

---

## 8. Running, building, and the quality gate

From the app root (`d:\7meed\3mto`):

```bash
npm run develop          # start Strapi with auto-reload
npm run build            # build the Strapi admin
npm test                 # foundation Jest suites (smoke + master-types)
```

**Plugin quality gate** (run after changing plugin source):

```bash
cd src/plugins/inventory-dashboard
npm run build            # strapi-plugin build → dist/server + dist/admin
npm run lint             # eslint over {server,admin}/src
cd ../../..
npx tsc --noEmit         # whole-app type check
```

All four must be clean. The foundation Jest suites cover the data-model
lifecycle and require the test database.

---

## 9. Extending the system

**Add a content type to the dashboard** — add one line to
`src/plugins/inventory-dashboard/server/src/config/resources.ts`:

```ts
'purchase-orders': { uid: 'api::purchase-order.purchase-order', populate: ['supplier'] },
```

Rebuild the plugin and restart — the resource appears in navigation with
generic list + create/edit/delete. No further UI code needed.

**Change a field** — edit the content type's `schema.json`. The list and form
update automatically.

**Add business rules** — add a `lifecycles.ts` next to `schema.json`. Rules
belong on the model so they apply everywhere.

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
- **Plugin-local `@strapi/utils` must stay externalized.** If `npm install`
  inside the plugin pulls a local copy, re-verify error mapping (a dual
  `@strapi/utils` instance reintroduces the 500-instead-of-400 bug).
- **Mobile push notifications for expiry are not implemented.** The Overview
  flags expiry within 90 days visually. A push notification system (e.g. a
  background cron + FCM) is a future addition.
- **Cross-selling suggestions are display-only.** The `relatedProducts` field
  exists on Product and is shown in the Order form as a suggestion strip. There
  is no automatic add-to-order; the operator clicks to add manually.
- **Excel import is out of scope for Phase 3.** Export to Excel is planned for
  reports. Import will be addressed in a later phase.
- **Stock restoration on order cancellation is manual.** If a confirmed order
  is cancelled, the operator must manually adjust `quantityRemaining` on the
  affected batches. Automatic restoration is a future improvement.

---

