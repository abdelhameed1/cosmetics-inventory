# Catalog Hub Design

**Status:** Approved by user, ready for implementation planning.

## Problem

The `inventory-dashboard` plugin already has a generic, schema-driven CRUD engine covering 12 business entities (`server/src/config/resources.ts`: brands, categories, variant-types, suppliers, customers, price-lists, products, variants, stock-batches, orders, order-lines, payments), with auto-derived forms (`ResourceListPage`, `ResourceFormPage`, `FieldRenderer`, `RelationSelect`) reachable at `/plugins/inventory-dashboard/r/:resource`.

Nobody can discover this. There is no menu, sidebar, or landing page listing what's manageable — you'd have to already know a URL segment like `r/suppliers` exists. A `useResources()` hook that fetches the list of registered slugs from `/resources` is defined but never called anywhere in the UI.

The ask: a centralized hub for managing the core business-model entities — starting with 8 master-data entities, explicitly extensible to more later.

## Scope

**In scope now (master data):** Products, Variants, Variant Types, Categories, Brands, Suppliers, Customers, Price Lists.

**Explicitly out of scope:** Stock Batches, Orders, Order Lines, Payments — these are transactional records with their own dedicated flows (Overview, StockPurchase, OrderForm) and stay reached only through those, not the new hub.

**No new Strapi content-types.** Products/Variants/Suppliers already model "items"/"variants"/"providers." The design must make adding an entity to the hub later (a 9th, 10th, ...) a small, obvious config change — not a structural one.

## Architecture

Extend the existing `inventory-dashboard` plugin (not a new plugin) — the generic CRUD engine (backend config, schema metadata service, list/form React components) already lives here, and duplicating it into a second plugin would mean either copy-pasting that engine or making a plugin depend cross-bundle on another plugin's admin code, which Strapi doesn't support cleanly.

**Zero backend changes.** `config/resources.ts`, the metadata service, and all `/resources/*` routes stay exactly as they are today. The hub is a pure admin-UI layer over the API that already exists. The `find` endpoint already returns `pagination.total`; the frontend currently ignores that field.

**New 4th standalone entry point:** `CatalogStandalone.tsx`, following the existing pattern of `StockPurchaseStandalone.tsx` / `OrderFormStandalone.tsx` — each top-level menu item independently wraps `ChakraRoot` exactly once. Registered in `admin/src/index.ts` as a new `addMenuLink` call:
- `to: /plugins/inventory-catalog`
- label: "Catalog"
- `Component: () => import('./pages/CatalogStandalone')`

This becomes the plugin's 4th independent entry point into its admin UI (alongside `App.tsx`'s router, `StockPurchaseStandalone`, `OrderFormStandalone`), following the same "exactly one `ChakraRoot` ancestor" invariant documented for the other three.

**Route tree**, all nested under `/plugins/inventory-catalog`, wrapped in `ChakraRoot`:

```
<Route element={<CatalogLayout />}>
  <Route index element={<CatalogHub />} />
  <Route path=":resource" element={<ResourceListPage />} />
  <Route path=":resource/new" element={<ResourceFormPage />} />
  <Route path=":resource/:id" element={<ResourceFormPage />} />
</Route>
<Route path="*" element={<Page.Error />} />
```

`ResourceListPage` and `ResourceFormPage` are reused completely unmodified in behavior — same schema-driven fields, same `FieldRenderer`/`RelationSelect`, same bespoke product-with-variants create flow. The only change needed to make them work under two different route trees at once:

- **Today** they hardcode absolute navigation targets: `navigate('/plugins/inventory-dashboard/r/${resource}/new')`, etc.
- **Change:** switch these to relative navigation — `navigate('new')` from the list page, `navigate('..')` from the form page's cancel/save-success paths, `navigate(row.documentId)` for row clicks. React Router v6 resolves these relative to the current matched route, so the exact same components produce the exact same absolute URLs under the old `/plugins/inventory-dashboard/r/:resource` tree (still used as-is by `OrderForm.tsx`'s cancel button → `r/orders`, and `StockPurchase.tsx`'s post-save redirect → `r/stock-batches` — both untouched) and correctly resolve under the new `/plugins/inventory-catalog/:resource` tree.
- This is the only edit to existing, already-shipped files (`ResourceListPage.tsx`, `ResourceFormPage.tsx`). `App.tsx`, `Overview.tsx`, `StockPurchase.tsx`, `OrderForm.tsx` are untouched.

**`CatalogLayout.tsx`** (new): a `Flex` wrapping `CatalogSidebar` (fixed-width) + `<Outlet/>` (content area, `flex={1}`). This layout applies only within the Catalog entry point — Overview/StockPurchase/OrderForm keep their current full-width layouts.

**`config/catalogGroups.ts`** (new, single source of truth): both the sidebar and the hub render from one shared config module — not schema-driven, since the grouping is a curated UX decision, not something to infer from content-type metadata:

```ts
export const CATALOG_GROUPS: { label: string; items: { slug: string; label: string }[] }[] = [
  { label: 'Catalog', items: [
    { slug: 'products', label: 'Products' },
    { slug: 'variants', label: 'Variants' },
    { slug: 'variant-types', label: 'Variant Types' },
    { slug: 'categories', label: 'Categories' },
    { slug: 'brands', label: 'Brands' },
  ] },
  { label: 'Partners & Pricing', items: [
    { slug: 'suppliers', label: 'Suppliers' },
    { slug: 'customers', label: 'Customers' },
    { slug: 'price-lists', label: 'Price Lists' },
  ] },
];
```

**`CatalogSidebar.tsx`** (new): renders `CATALOG_GROUPS` as a heading + `NavLink`-style list per group, highlighting the active resource via `useLocation()`.

**`CatalogHub.tsx`** (new): landing page at the index route. Renders the same `CATALOG_GROUPS` as a card grid (reuses the existing `StatCard`-style visual language), one card per entity showing its `label` and a live record count. Count is fetched via the existing `GET /resources/:slug?pageSize=1` endpoint, reading `pagination.total` from the response (already computed server-side, currently unused by any frontend caller) — one lightweight parallel request per entity (8 total) on mount. Clicking a card navigates to `/plugins/inventory-catalog/:resource`.

Adding a 9th entity later means adding one object to `CATALOG_GROUPS` (or a new group) in this one file — both the sidebar and the hub pick it up automatically, no other component changes.

## Data flow

No new endpoints, no new services, no new content-types. The hub only adds:
1. A new admin route tree + 3 new small components (`CatalogStandalone`, `CatalogLayout`, `CatalogSidebar`, `CatalogHub` — 4 new files).
2. A relative-navigation generalization to 2 existing files (`ResourceListPage.tsx`, `ResourceFormPage.tsx`) so they serve both route trees.
3. One new menu registration in `index.ts`.

## Testing

- Existing server-side tests (`resource.test.ts`, `metadata.test.ts`) are untouched and continue to cover the underlying CRUD engine — no backend changes means no new server tests are needed.
- Manual verification (per this plugin's established pattern — no frontend test harness exists yet, consistent with the rest of the plugin): click through the Catalog menu item, confirm the hub landing page shows all 8 entities with correct counts, confirm navigating into each entity's list/create/edit/delete cycle works identically to how it worked at the old `r/:resource` URLs, and confirm `OrderForm`'s and `StockPurchase`'s existing cancel/redirect behavior to `r/orders` / `r/stock-batches` is unaffected by the relative-navigation change.

## Future extensibility

Adding a 9th+ entity later requires, at most:
1. One entry in `server/src/config/resources.ts` (already how all 12 current resources are registered) if it's a new content-type not yet whitelisted.
2. One object added to `CATALOG_GROUPS` in `admin/src/config/catalogGroups.ts`.

No new page types, no new route patterns, no schema-fetching changes — the generic `ResourceListPage`/`ResourceFormPage` machinery already handles arbitrary content-type shapes.
