# Purity-Inspired Theme & Unified Shell Design

**Status:** Approved by user, ready for implementation planning.

## Problem

The `inventory-dashboard` plugin's Chakra theme (`admin/src/theme/index.ts`) is close to Chakra defaults: one blue accent (`brand.50..900`), and light `Button`/`Badge`/`Table` overrides. There is no elevation/shadow system, no icon usage anywhere in the UI, and form inputs (`Input`/`Select`/`Textarea`/`NumberInput` in `FieldRenderer.tsx`) have no styling beyond `bg="white"`. In short: there is no real design system, just unstyled Chakra primitives with a color swapped in.

Navigation is also fragmented. The plugin registers 4 independent Strapi admin menu links, each mounting its own React subtree wrapped once in `ChakraRoot`: "Inventory" (`App.tsx`, itself containing `Overview` plus the old flat `r/:resource` routes), "Stock purchase" (`StockPurchaseStandalone`), "New Order" (`OrderFormStandalone`), and "Catalog" (`CatalogStandalone`, the only one with an in-plugin sidebar, scoped to itself per the earlier Catalog hub design). A user moving between these sees 4 differently-shaped tools, not one cohesive app.

The ask: adopt the free, MIT-licensed **Purity UI Dashboard** (Chakra-based, Creative Tim) as the visual reference — its icon-badge stat cards, soft-shadow card surfaces, refined tables and spacing — applied across the whole plugin, with one consistent navigation shell replacing the current fragmentation.

## Scope

**In scope — touch everything:**
- `theme/index.ts`: full component-level styling pass (see Theme section).
- New shared navigation shell (`AppShell`/`AppSidebar`) used by all 4 entry points.
- Every page and shared UI primitive in the plugin restyled to the new system: `PageHeader`, `StatCard`, `DataTable`, `FormField`, `Overview`, `StockPurchase`, `OrderForm`, `CatalogHub`, `ResourceListPage`, `ResourceFormPage`, `ProductVariantsForm`, `FieldRenderer`, `RelationSelect`.
- `CatalogSidebar`/`CatalogLayout` are superseded by the new `AppSidebar`/`AppShell` (generalized, not duplicated).

**Explicitly out of scope (non-goals):**
- No second top navbar. Strapi's own admin chrome already renders a top bar (user menu, notifications) above whatever the plugin mounts; adding Purity's own navbar (breadcrumb/search/bell/avatar) on top of that would be a duplicate, competing chrome. The new shell is sidebar + content only.
- No adoption of Purity's actual purple/gradient palette. The existing `brand.500 = #2563eb` blue stays as the single accent color, so the plugin doesn't visually clash with Strapi's own purple/pink admin branding. Only Purity's *structure* (cards, shadows, spacing, icon badges, table/form polish) is adopted, not its specific colors.
- No new npm dependency for icons. `@strapi/icons` is already a direct dependency (used today for the 4 menu icons in `index.ts`) and has enough variety (`Archive`, `PuzzlePiece`, `GridFour`, `Palette`, `Store`, `User`, `PriceTag`, `Faders`, etc. — confirmed present) to cover every nav item without pulling in `react-icons` or any other icon set.
- No backend changes. This is a pure admin-UI restyle; `server/src/config/resources.ts` and all `/resources/*` routes are untouched.
- No change to the relative-navigation behavior fixed during the Catalog hub work — `ResourceFormPage.tsx`'s `navigate('..', { relative: 'path' })` calls stay exactly as they are; only their surrounding visual chrome changes.

## Architecture

### Unified shell

Each of the 4 Strapi menu links still independently mounts its own subtree (this is a Strapi admin constraint, not something this project controls), each still wrapping `ChakraRoot` exactly once — that invariant from the Catalog hub work is preserved. What changes: one more shared wrapper is added inside each, immediately under `ChakraRoot`:

```
ChakraRoot > AppShell > (page content, unchanged internal routing)
```

`AppShell` (new, replaces `CatalogLayout` — same shape, generalized): a `Flex` with `AppSidebar` (fixed width, full height) + `Box flex={1}` for content. No padding added at this level (pages keep their own `p={8}`, as `CatalogLayout` already does today, to avoid double-padding).

Because `App.tsx` wraps its own internal `<Routes>` (Overview at `index`, plus the old flat `r/:resource` list/form routes used by `OrderForm`'s cancel target and `StockPurchase`'s redirect target), `AppShell` wraps the *entire* `<Routes>` block in `App.tsx` — so the sidebar persists across all of "Inventory"'s internal navigation, including those old resource routes, without those routes needing any structural change.

`StockPurchaseStandalone` and `OrderFormStandalone` currently render a single page with no internal routing — `AppShell` wraps that single page directly.

### Navigation config

`admin/src/config/catalogGroups.ts` is superseded by a fuller `admin/src/config/navConfig.ts`, exporting:

- `TOP_LINKS`: the 3 direct entry-point links, each `{ to: string; label: string; icon: IconType }`:
  - `{ to: '/plugins/inventory-dashboard', label: 'Overview', icon: Database }`
  - `{ to: '/plugins/inventory-stock', label: 'Stock Purchase', icon: Briefcase }`
  - `{ to: '/plugins/inventory-orders', label: 'New Order', icon: ShoppingCart }`

  (Same icons already used for these 3 in `index.ts`'s `addMenuLink` calls, so the sidebar visually matches Strapi's own left-nav icon for the same destination.)

- `CATALOG_GROUPS`: the same 2-group, 8-entity structure from the Catalog hub design, each item gaining an `icon` field. Proposed mapping (all confirmed present in `@strapi/icons`):
  - Products → `Archive`
  - Variants → `PuzzlePiece`
  - Variant Types → `Faders`
  - Categories → `GridFour`
  - Brands → `Palette`
  - Suppliers → `Store`
  - Customers → `User`
  - Price Lists → `PriceTag`

`AppSidebar` (new, replaces `CatalogSidebar`) renders `TOP_LINKS` first as plain top-level nav buttons (active state: exact-match or prefix-match against the link's `to`), then the two `CATALOG_GROUPS` sections exactly as `CatalogSidebar` renders them today (group heading + item list), with the active-state check generalized from today's Catalog-only prefix (`pathname.startsWith('/plugins/inventory-catalog/...')`) to also correctly highlight when on `/plugins/inventory-dashboard`, `/plugins/inventory-stock`, or `/plugins/inventory-orders`.

Since `TOP_LINKS` cross Strapi's own top-level menu-link boundaries (different `to` paths registered as separate `addMenuLink` entries), `AppSidebar` navigates between them with a plain `navigate(to)` (absolute path) — React Router's single root router (which Strapi's admin owns) resolves this the same way clicking Strapi's own left-nav does today.

## Theme changes

`theme/index.ts` keeps the existing `brand.*` scale and font stack unchanged, and extends `components`:

- **`Card`** (new override): Chakra 2.10 — the installed version — ships `Card`/`CardHeader`/`CardBody`/`CardFooter` natively. Add a `baseStyle` (rounded `xl`, `boxShadow: sm`, `borderWidth: 1px`, `borderColor: gray.100`, white background) matching what `StatCard`/`DataTable` already hand-roll today, so both can be rewritten on top of `<Card>` instead of duplicating the same `Box` styling.
- **`Input` / `Select` / `Textarea` / `NumberInput`**: add a shared `defaultProps`/`baseStyle` (`focusBorderColor: 'brand.500'`, consistent `borderRadius`) so every field in `FieldRenderer.tsx` picks up the polish automatically — no edits needed inside `FieldRenderer.tsx` itself for this part.
- **`Table`**: keep today's header/border styling, refine row hover/padding for the denser data seen in `ResourceListPage`.
- **`Button`/`Badge`**: kept as-is (already reasonable).

## Component & page changes

- **`StatCard`**: gains an icon-badge (colored circular/rounded box with a Chakra `Icon` inside, using each caller's icon prop) alongside the existing label/value, rebuilt on `<Card>`.
- **`DataTable`**: rebuilt on `<Card>`/`<CardBody>` instead of a hand-rolled `TableContainer` box; same columns/empty-state API, so `Overview.tsx` and `ResourceListPage.tsx` need no prop changes.
- **`PageHeader`**: minor polish only (spacing/weight), API unchanged.
- **`FormField`**: minor spacing polish, API unchanged.
- **Pages** (`Overview`, `StockPurchase`, `OrderForm`, `CatalogHub`, `ResourceListPage`, `ResourceFormPage`, `ProductVariantsForm`): each restyled to use the refreshed primitives and new spacing/shadow language; no functional/data-flow changes.
- **`FieldRenderer`/`RelationSelect`**: no direct edits expected — their inputs inherit the new theme-level styling automatically. If review finds a spot the theme override can't reach, that gets fixed in the plan/implementation, not the design.

## Data flow

No new endpoints, no new content-types, no state-shape changes anywhere. This is styling and navigation-shell only — every data hook (`useOverview`, `useOrder`, `useSchema`, `useSettings`, `useResources`) and every API call in `utils/api.ts` is untouched.

## Testing

No frontend test harness exists for this plugin (consistent with the Catalog hub work) — verification is manual, per the established pattern:
1. Click through all 4 entry points (Overview/Inventory, Stock Purchase, New Order, Catalog) confirming `AppSidebar` renders identically and highlights the correct active item in each.
2. Spot-check each restyled page (stat cards show icons, tables/forms show the new card/shadow treatment) for visual correctness and no console errors.
3. Regression-check the two navigation targets carried over from the Catalog hub work: `OrderForm`'s Cancel button (→ `r/orders`) and `StockPurchase`'s post-save redirect (→ `r/stock-batches`) still land correctly now that `AppShell` wraps `App.tsx`'s full route tree.
4. Confirm the full CRUD cycle (create/edit/delete) still works end-to-end on at least one Catalog entity, now under the new shell and card styling.

## Future extensibility

Adding a 9th+ catalog entity still means one object in `navConfig.ts`'s `CATALOG_GROUPS` (now including an `icon` field) — the sidebar and hub pick it up automatically, unchanged from the Catalog hub design's extensibility story. Adding a 5th top-level entry point (if ever needed) means one more `addMenuLink` in `index.ts`, wrapping the new page in `AppShell` the same way the other 4 do, and one more entry in `TOP_LINKS`.
