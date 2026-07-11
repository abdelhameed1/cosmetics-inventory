# Chakra UI reskin of the Inventory Dashboard plugin

Date: 2026-07-11
Status: approved (pending spec review)

## 1. What this is

Replace the visual layer of the `inventory-dashboard` Strapi plugin's admin
UI — currently built on `@strapi/design-system` v2.2.1 — with Chakra UI,
restyled to match the free, MIT-licensed **Purity UI Dashboard** (Creative
Tim / Simmmple) design language: clean cards, data-dense tables, a blue-based
accent on a white/gray canvas. This is a pure view-layer rewrite. No API
contracts, hooks, business rules, or lifecycle logic change.

## 2. Goals / non-goals

**Goals**
- Every screen under `src/plugins/inventory-dashboard/admin/src` renders with
  Chakra UI components instead of `@strapi/design-system` components.
- Visual language matches Purity UI Dashboard's card/table/stat-tile/typography
  style, adapted into a custom Chakra theme (not a literal install of the
  template).
- Zero behavior regressions — every business rule currently expressed in JSX
  (below-cost badges, wholesale-qty pricing, FIFO segment preview, deletion
  guard error surfacing, cascading selects, etc.) survives the rewrite.

**Non-goals**
- Strapi's own admin shell (login screen, main left nav, Content Manager) —
  a plugin has no reach there; it stays on `@strapi/design-system` regardless.
- Any new features, business rules, or API changes.
- An admin/front-end Jest test suite (none exists today for this plugin;
  none is being added — see §7).

## 3. Architecture

`ChakraProvider` wraps the plugin's route tree in `App.tsx` (the plugin's
own top-level component), not Strapi's whole app — a plugin cannot reach
outside its own mounted routes anyway.

Two settings are required for Chakra to coexist safely with
`@strapi/design-system` + `styled-components` v6, which continue to render
Strapi's shell in the same DOM tree:
- `resetCSS={false}` on `ChakraProvider` — Chakra's default global CSS reset
  targets `html`/`body`/form elements globally; left on, it would leak
  `box-sizing`, margin, and font resets onto Strapi's own nav, top bar, and
  Content Manager outside the plugin's subtree.
- Emotion (Chakra's CSS-in-JS engine) runs alongside styled-components v6
  with no runtime conflict — they're independent libraries injecting
  independent `<style>` tags with distinct class-name prefixes. The only
  cost is a small amount of duplicate CSS-in-JS overhead, acceptable for an
  internal admin tool.

`Page.Error` (from `@strapi/strapi/admin`, used for the catch-all 404 route
in `App.tsx`) is a Strapi-owned component, not part of `@strapi/design-system`
proper — it stays as-is.

## 4. Dependencies

Added to the plugin's `package.json`, in both `dependencies` and
`peerDependencies` (mirroring how `@strapi/design-system` is currently
declared):
- `@chakra-ui/react`
- `@emotion/react`, `@emotion/styled` (Chakra's required peers)
- `framer-motion` (Chakra v2's required peer for its animated components)
- `react-icons` (icon library — see below)

`@strapi/design-system` and `@strapi/icons` remain installed but are used
only where the plugin has no choice: `PluginIcon.tsx` (registers the
left-nav menu icon via Strapi's own plugin registration API — not a page,
untouched) and `Page.Error`.

**Icons**: `react-icons` was chosen over `@chakra-ui/icons` for its larger
set (Feather/Font Awesome/etc.), matching what Purity UI and most Chakra
templates use. Current icon usage in scope is minimal (just the `Trash`
icon in `ProductVariantsForm.tsx`) — maps to `react-icons`'s Feather `FiTrash2`
or similar.

## 5. Theme & shared components

A new `admin/src/theme/index.ts` defines a custom Chakra theme: Purity UI's
palette (white/gray canvas, blue primary accent, soft card shadows, rounded
corners), typography scale, and component style overrides for `Card`,
`Table`, `Button`, `Badge`.

A small shared component set, built once under `admin/src/components/ui/`
and reused across every screen:
- **PageHeader** — title + optional back-navigation + action buttons
  (replaces the repeated `<Typography variant="alpha">` + `<Flex>` pattern).
- **StatCard** — Overview's four stat tiles.
- **DataTable** — wraps Chakra `Table` with consistent header/empty/loading
  states (replaces the raw `Table/Thead/Tbody/Tr/Th/Td` markup duplicated in
  `Overview`, `ResourceListPage`, and both order tables in `OrderForm`).
- Form primitives used by `FieldRenderer` and `RelationSelect` (Chakra
  `Input`, `NumberInput`, `Select`, `Textarea`, `Switch`, native `<input
  type="date">` or a lightweight Chakra-compatible date input) — replacing
  `Field.Root/Label`, `TextInput`, `Toggle`, `DatePicker`, `DateTimePicker`,
  `SingleSelect/SingleSelectOption` one-for-one.

## 6. Per-screen behavior inventory (must not regress)

This is the checklist the implementation plan and each phase's manual
verification pass against. All of these are pure JSX/state behaviors today —
none involve server changes.

**Overview.tsx**
- Exchange-rate input pre-filled from `useSettings()`, Save button posts the
  rate, shows `exchangeRateUpdatedAt`, shows a save error inline.
- Loading state (`Loading…`) and fetch-error state (full-page error message)
  before data arrives.
- 4 stat cards (stock units, stock value USD, stock value EGP, exchange rate).
- Low-stock table (variant/qty/threshold).
- Expired list (red/danger text) and expiring-soon list (orange/warning
  text), each keyed by `batchId`.

**StockPurchase.tsx**
- Variant select is populated only from variants of the selected product,
  and resets when the product changes.
- Submit button disabled until variant, supplier, qty, cost, and purchase
  date are all set.
- Inline error on failed submit; navigates to the stock-batches list on
  success.

**ResourceListPage.tsx**
- Columns are derived dynamically from schema metadata (first 6 non-hidden
  fields) — this must stay schema-driven, not hardcoded per resource.
- Search re-fetches on every `search` state change (no debounce today —
  preserve as-is, not a place to add new behavior).
- Row click navigates to the edit page; the delete icon button stops
  propagation so it doesn't also trigger row navigation.
- Delete requires confirmation via a dialog; a failed delete shows an inline
  error and closes the dialog.
- Cell rendering falls back through `name` → `label` → `documentId` →
  `JSON.stringify` for relation/object values.

**ResourceFormPage.tsx**
- Fields render dynamically from schema metadata, in edit or create mode.
- Special case: creating a `products` record renders `ProductVariantsForm`
  instead of the generic form — this branch must be preserved exactly.
- `normalize()`/`serialize()` helpers (relation objects ↔ `documentId`
  strings) are unchanged (not a view concern).

**FieldRenderer.tsx**
- One Chakra input type per Strapi field type: text→Textarea,
  integer/decimal/biginteger/float→NumberInput, boolean→Switch,
  date→date input, datetime→datetime input, enumeration→Select,
  relation→`RelationSelect`, default→Input. `required` must still surface
  visually (Chakra `FormControl isRequired`).

**RelationSelect.tsx**
- Fetches up to 100 options for the relation's target resource (no
  search/pagination — documented existing limitation, not being fixed here).
- Display label falls back through `field.relation.mainField` → `name` →
  `label` → `documentId`/`id`.

**ProductVariantsForm.tsx**
- Dynamic variant rows: add/remove, per-row label/type/threshold.
- Client-side validation: any row with a label or type filled in must have a
  type, or save is blocked with an inline error (prevents a partially-built
  product with no rollback, per the existing code comment).
- Related-products multi-picker with dedupe-on-add, rendered as a list with
  no per-item remove today (preserve as-is).
- Submit disabled until name, brand, and category are set.
- 3-step save (create product → create explicit variants → delete the
  auto-created default variant) is unchanged (not a view concern), but error
  surfacing from that flow must still render inline.

**OrderForm.tsx** (most complex screen — two very different render modes)
- *Draft mode* (`order` is null or `status === 'draft'`):
  - Customer select auto-fills `priceListId` from the customer's assigned
    price list via a `useEffect`.
  - Product→Variant cascading select (variant list filtered by product,
    like StockPurchase).
  - "Add" calls FIFO resolution then, per FIFO segment, calls the pricing
    endpoint with the segment's cost **and the total requested quantity**
    (not the segment's own split quantity) — this exact quantity argument
    matters for the wholesale `minQty` gate and must not be simplified to
    "per-segment quantity" during the rewrite.
  - A FIFO shortfall produces an inline error but still adds whatever
    segments were resolved.
  - Adding a product with `relatedProducts` shows a cross-sell suggestion
    strip; clicking a suggestion pre-fills the product picker (product only,
    not an auto-add-to-order).
  - Draft lines table: sell price is editable inline per row (NumberInput →
    Chakra NumberInput), a client-computed "Below cost" badge appears when
    `sellPrice < costPriceUsd × exchangeRate`.
  - Discount input, live subtotal/final-total display.
  - "Save draft" posts the order then each line sequentially (no rollback on
    partial failure — existing documented limitation, not being fixed here)
    and navigates to the saved order's page.
  - "Confirm order" button only renders when an `id` route param exists
    (i.e. an already-saved draft, not a brand-new unsaved one).
- *Confirmed mode* (`ConfirmedOrderView`, rendered when `order.status !==
  'draft'`):
  - Order id (truncated) + status badge.
  - Read-only lines table using the **server-computed** `belowCost` flag
    (different source of truth than the draft table's client-computed one —
    do not merge these into one code path).
  - Totals summary: subtotal, final total, net profit, paid, balance due.
  - Payment form: amount + method (cash/transfer), submit disabled until an
    amount is entered, reloads the order after a successful payment.

**App.tsx**
- Route table is unchanged; only the wrapping `ChakraProvider` and each
  routed page's internals change.

## 7. Migration phases

Each phase leaves the app in a buildable, runnable state.

1. **Foundation** — add dependencies, theme file, `ChakraProvider` in
   `App.tsx`, build the shared component set (`PageHeader`, `StatCard`,
   `DataTable`, form primitives). No page is switched over yet.
2. **Generic screens** — `ResourceListPage`, `ResourceFormPage`,
   `FieldRenderer`, `RelationSelect`. Highest reuse payoff: every resource
   (brands, categories, suppliers, customers, price lists, variants,
   stock-batches, payments, etc.) benefits immediately.
3. **Bespoke screens** — `Overview`, `StockPurchase`, `ProductVariantsForm`.
4. **Most complex screen** — `OrderForm` (both draft and confirmed render
   modes).

## 8. Testing / verification plan

No existing admin/front-end Jest suite covers this plugin (plugin tests are
server-only, per `docs/implementation.md` §8) — none is being added as part
of this change.

After each phase:
- `cd src/plugins/inventory-dashboard && npm run test:ts:front` (strict tsc)
  must be clean.
- `npm run build` (plugin) must succeed.
- Manual click-through in the browser (`npm run develop` at the app root) of
  every screen touched in that phase, driving the golden path and the edge
  cases called out in §6 — not just a visual glance. In particular, before
  calling this done: a full brand-new resource create/edit/delete cycle on
  at least two different resource types, a stock purchase, a product+variants
  creation (including the delete-auto-default-variant path), and a full
  draft → confirm → payment order cycle including a below-cost line and a
  FIFO split across two batches.

At the end of all phases: whole-app `npx tsc --noEmit` and `npm test`
(app-level) stay clean (they don't cover plugin admin code today, but must
not be broken incidentally).

## 9. Risks

- **Regression risk is in the rewrite itself, not in Chakra.** Every screen
  in §6 has business-rule-shaped conditionals expressed only in JSX (badges,
  disabled-until-valid buttons, fallback chains). The phase-by-phase manual
  verification pass exists specifically to catch these before they ship.
- **Two CSS-in-JS runtimes in one page** (Emotion + styled-components) adds
  bundle weight and a small amount of runtime overhead. Acceptable for an
  internal single-operator admin tool; would need reconsideration if this
  plugin's UI were ever exposed to end customers directly.
- **`resetCSS={false}` must be verified, not assumed** — the first manual
  verification pass after Phase 1 must specifically check that Strapi's own
  nav/top bar/Content Manager render unaffected by the newly-mounted
  `ChakraProvider`.
