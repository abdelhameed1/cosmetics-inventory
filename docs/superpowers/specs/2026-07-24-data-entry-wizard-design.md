# Data Entry Wizard Design

**Status:** Approved by user, ready for implementation planning.

## Problem

Data entry in the `inventory-dashboard` plugin is scattered across three separate UI patterns with no single starting point:

- 6 simple resources (brands, categories, variant-types, suppliers, customers, price-lists) are created via the generic, schema-driven `ResourceFormPage` at `r/:resource/new`, reached only by first navigating into `CatalogHub`.
- Products are created via a bespoke, single-screen composite form (`ProductVariantsForm.tsx`, special-cased inside `ResourceFormPage.tsx:48-50`) covering product info, a repeatable variant list, and a related-products picker, saved via 3 sequential API calls.
- Stock Purchases (`StockPurchase.tsx`) and Orders (`OrderForm.tsx`) are reached only via dedicated sidebar links (`TOP_LINKS` in `navConfig.ts`), each a single-screen form with no shared entry point with the resources above.

A user has to already know which of these three patterns applies, and where to find it, before they can start entering any given kind of data. Products, Stock Purchases, and Orders in particular pack many fields and multi-part logic (variant rows, FIFO/pricing lookups) onto one screen with no guidance on order or progress.

## Scope

**In scope:**
1. A single global entry point ("Add New") that lets a user pick what kind of record to create, from anywhere in the plugin.
2. Restructuring the three complex creation flows (Product, Stock Purchase, Order-draft-creation) into true multi-step wizards with a progress indicator, back/next navigation, and per-step validation.
3. A shared, reusable wizard shell component that both the picker-driven flows and any future complex flow can use.

**Out of scope:**
- Variants, Order Lines, and Payments as standalone creation targets — they remain reachable only through their parent flow (Product wizard creates variants; Order confirm/payment recording creates order lines/payments), exactly as today. They are not offered in the "Add New" picker.
- Order confirmation and payment recording (`ConfirmedOrderView`, reached at `orders/:id`) — this is post-creation order lifecycle management, not "adding new order" data entry, and stays exactly as it is today.
- The 6 simple resources' form screens (`ResourceFormPage` / `FieldRenderer`) — these are already single-screen, schema-driven, and adequate; they are not restructured into multi-step wizards, only made reachable from the new picker.
- No backend changes. No new content-types, no new API routes, no changes to `server/src/config/resources.ts` or any controller/service. This is purely an admin-UI-layer feature over APIs that already exist.

## Architecture

### Entry point: "Add New" button + type picker

A new **"Add New" button** is added to the top of `AppSidebar.tsx` (above the existing `TOP_LINKS` navigation), visible on every screen inside the plugin's main router (`App.tsx`'s route tree, which `AppShell`/`AppSidebar` wrap). Clicking it opens a **type picker modal** (`AddNewModal.tsx`, new) — a card grid grouped the same way `CatalogHub` groups its cards today, plus one new "Operations" group:

```ts
// admin/src/config/addNewConfig.ts (new)
// Icons reused verbatim from admin/src/config/navConfig.ts (CATALOG_GROUPS / TOP_LINKS)
// so a given entity always shows the same icon everywhere in the plugin.
import { FiBox, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign, FiBriefcase, FiShoppingCart } from 'react-icons/fi';
import { type IconComponent } from './navConfig';

export const ADD_NEW_GROUPS: {
  label: string;
  items: { slug: string; label: string; icon: IconComponent; kind: 'simple' | 'wizard'; path: string }[];
}[] = [
  { label: 'Catalog', items: [
    { slug: 'products', label: 'Product', icon: FiBox, kind: 'wizard', path: 'r/products/new' },
    { slug: 'variant-types', label: 'Variant Type', icon: FiSliders, kind: 'simple', path: 'r/variant-types/new' },
    { slug: 'categories', label: 'Category', icon: FiGrid, kind: 'simple', path: 'r/categories/new' },
    { slug: 'brands', label: 'Brand', icon: FiTag, kind: 'simple', path: 'r/brands/new' },
  ] },
  { label: 'Partners & Pricing', items: [
    { slug: 'suppliers', label: 'Supplier', icon: FiTruck, kind: 'simple', path: 'r/suppliers/new' },
    { slug: 'customers', label: 'Customer', icon: FiUsers, kind: 'simple', path: 'r/customers/new' },
    { slug: 'price-lists', label: 'Price List', icon: FiDollarSign, kind: 'simple', path: 'r/price-lists/new' },
  ] },
  { label: 'Operations', items: [
    { slug: 'stock-purchase', label: 'Stock Purchase', icon: FiBriefcase, kind: 'wizard', path: 'stock-purchase' },
    { slug: 'order', label: 'Order', icon: FiShoppingCart, kind: 'wizard', path: 'orders/new' },
  ] },
];
```

Clicking a card closes the modal and navigates (`useNavigate()`) to `item.path`. This reuses **existing routes** — `r/products/new`, `stock-purchase`, `orders/new` — already defined in `App.tsx`. No new routes are added for the picker's targets. The `kind` field exists only to visually distinguish wizard-flow cards from simple-form cards in the modal (e.g., a small step-count badge); it does not change navigation behavior.

### Complex flows become real wizards

A new shared component, `WizardShell.tsx` (`admin/src/components/WizardShell.tsx`), wraps Chakra UI's `Stepper` / `useSteps` / `StepIndicator` (confirmed present in the installed `@chakra-ui/react@2.10.10`). It is the single reusable shell for all three restructured flows:

**Props:**
```ts
interface WizardStep {
  label: string;
  content: React.ReactNode;
  isValid: () => boolean; // gates the Next button for this step
}
interface WizardShellProps {
  steps: WizardStep[];
  onSubmit: () => Promise<void>; // called from the final step's "Submit"/"Save" action
  submitLabel?: string; // e.g. "Create Product", "Save Draft"
  isSubmitting: boolean;
  submitError: string | null;
}
```

**Behavior:**
- Renders a `Stepper` header showing all step labels and current progress.
- Renders `steps[activeStep].content` below it.
- "Back" is always enabled except on step 0.
- "Next" is disabled unless `steps[activeStep].isValid()` returns true; calling it advances `activeStep`.
- Clicking a step indicator directly jumps back to any **already-completed** step (index < activeStep); it does not allow skipping forward past the current step.
- On the last step, "Next" is replaced by a submit button (`submitLabel`) that calls `onSubmit`. While `isSubmitting`, the button shows a loading state and all navigation is disabled. If `submitError` is set, it renders inline above the submit button.

Each of the three flows below keeps its **existing top-level page component and route** (`ProductVariantsForm.tsx` at `r/products/new`, `StockPurchase.tsx` at `stock-purchase`, `OrderForm.tsx` at `orders/new`), but internally restructures its JSX to split into per-step content components rendered through `WizardShell`, instead of one long scrolling form. All existing state management, API calls, and field validation logic already present in these components carry over unchanged — only the *presentation* is split into steps, gated by `isValid()` functions built from the same field-level checks these forms already perform before their current single "Save" action.

**Product wizard** (`ProductVariantsForm.tsx`):
1. **Product Info** — existing top-level product fields (name, SKU, category, brand, base price, description, etc.)
2. **Variants** — existing repeatable variant-row UI
3. **Related Products** — existing related-products picker
4. **Review & Create** — read-only summary of steps 1–3; submit triggers the existing sequential save (create product → create explicit variants → delete auto-created default variant). If a later call in that sequence fails after an earlier one succeeded, the Review step surfaces which part failed and offers a "Retry remaining steps" action rather than forcing the user to redo the whole form — this risk exists in the current implementation too (silently), the wizard just makes it visible and recoverable.

**Stock Purchase wizard** (`StockPurchase.tsx`):
1. **Supplier** — existing supplier picker
2. **Product & Quantity** — existing product/variant pickers, quantity, cost, dates
3. **Review & Confirm** — read-only summary; submit posts to `/resources/stock-batches` exactly as today

**Order wizard** (`OrderForm.tsx`, creation portion only):
1. **Customer & Date** — existing header fields
2. **Line Items** — existing "add product" line-builder, including the live FIFO (`/fifo/:variantDocumentId`) and pricing-suggestion (`/pricing/suggest`) calls, unchanged
3. **Review & Save Draft** — read-only summary of customer + all lines; submit performs the existing `POST /resources/orders` + per-line `POST /resources/order-lines` sequence

After a draft order is saved, navigation proceeds to `orders/:id` exactly as it does today, where the existing (unmodified) confirm action and `ConfirmedOrderView` (payment recording) take over — these are not part of the wizard.

## Data flow

No new endpoints, no new services, no schema changes. This feature adds:
1. Two new admin-only components: `AddNewModal.tsx`, `WizardShell.tsx`.
2. One new config file: `admin/src/config/addNewConfig.ts`.
3. One small addition to `AppSidebar.tsx` (the "Add New" button + modal open/close state).
4. Internal restructuring (JSX split into step components, wired through `WizardShell`) of three existing files: `ProductVariantsForm.tsx`, `StockPurchase.tsx`, `OrderForm.tsx`. Their external behavior (routes, API calls, final data shape submitted) is unchanged.

## Error handling

- Per-step validation blocks "Next" using the same field-level checks these forms already run today — just evaluated per step instead of only at final submit.
- Submission/API errors surface on the final Review step of each wizard (where the actual mutating calls fire), via `WizardShell`'s `submitError` prop, not silently swallowed.
- The Product wizard's existing multi-call save keeps its current error surfacing but gains the "retry remaining steps" affordance described above.
- The Order wizard's per-line FIFO/pricing-lookup errors continue to show inline on the Line Items step exactly as today — no change to that behavior.

## Testing

This plugin has no frontend test harness (confirmed: only `server/tests/*.test.ts` exist; `admin/src` has zero test files). Consistent with the established pattern for this plugin's other admin-UI features (Catalog Hub, Purity theme reskin), verification is manual:

- Click "Add New" from several different screens (Overview, inside a resource list, mid-way through an unrelated wizard) and confirm the modal opens and shows all 9 cards in the correct 3 groups.
- Confirm each of the 6 simple-resource cards navigates to and correctly submits its existing `ResourceFormPage` form, unchanged from current behavior.
- For each of the 3 wizards: step through all steps, confirm Next is blocked on invalid/missing required fields, confirm Back preserves already-entered data, confirm clicking a completed step indicator jumps back correctly, confirm the Review step accurately reflects everything entered, and confirm final submit produces the same records (verified via the existing resource list pages) as the current unstepped forms do.
- Confirm the Product wizard's partial-failure retry path by simulating a failure on the second save call (e.g., temporarily invalid variant data) and confirming "Retry remaining steps" completes the save without re-entering product info.
- Confirm Order wizard behavior is unchanged after Review & Save Draft: navigation to `orders/:id`, confirm action, and payment recording all work exactly as they do today.
- No backend changes means no new/changed server tests are needed; existing `server/tests/*.test.ts` continue to pass untouched.

## Future extensibility

Adding a new creatable type to the picker later requires only one new entry in `admin/src/config/addNewConfig.ts` (`kind: 'simple'` if it just needs a route to an existing form, or `kind: 'wizard'` plus building step content components for `WizardShell` if it needs guided multi-step entry). No changes to `AddNewModal.tsx`, `WizardShell.tsx`, or `AppSidebar.tsx` are needed for either case.
