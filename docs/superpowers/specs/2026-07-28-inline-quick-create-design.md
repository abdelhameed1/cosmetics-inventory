# Inline Quick-Create for Wizard Relation Dropdowns — Design

**Goal:** Let the user create a missing Brand, Category, Variant Type, Supplier, or Customer from *inside* the Product / Stock Purchase / Order wizard, without losing their in-progress wizard state, instead of having to cancel out, use the top-level "Add New" picker, and start the wizard over.

## Problem

`ProductVariantsForm.tsx`, `StockPurchase.tsx`, and `OrderForm.tsx` each fetch lookup lists (brands, categories, variant types, suppliers, customers) once on mount and render them as plain Chakra `<Select>` dropdowns. If the option a user needs doesn't exist yet, there is no way to create it without abandoning the wizard.

`InlineResourceForm.tsx` already exists and is schema-driven — it's the form used by the top-level "Add New" picker (`AddNewModal.tsx`) for these same six "simple" resource types (brands, categories, suppliers, customers, price-lists, variant-types). This design reuses it rather than building new create forms.

## Scope

**In scope** — relation dropdowns for the six simple resources, wherever they appear as a hardcoded `<Select>` in one of the three wizards:
- Product wizard (`ProductVariantsForm.tsx`): Brand, Category (step 1); Variant Type (per row, step 2)
- Stock Purchase wizard (`StockPurchase.tsx`): Supplier (step 1)
- Order wizard (`OrderForm.tsx`): Customer (step 1)

**Out of scope** — deliberately not touched:
- Product and Variant dropdowns (Stock Purchase's/Order's Product & Variant pickers, Product wizard's Related Products picker). These target entities that are themselves multi-step wizards or dependent on another entity already being selected; quick-creating them inline is a materially bigger feature (nested nested wizard state, nothing to auto-select before the *dependency* exists).
- `RelationSelect.tsx` / `FieldRenderer.tsx`, used by `InlineResourceForm` itself for cross-references between simple resources (e.g. Customer → Price List). Adding "+" there would allow a quick-create modal to open a quick-create modal recursively. Not something the user asked for; can be revisited later if needed.

## Architecture

### New component: `QuickCreateSelect.tsx`

`src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx`

```ts
interface QuickCreateSelectProps {
  resource: string;           // e.g. 'brands' — passed straight to InlineResourceForm
  label: string;               // e.g. 'Brand' — used for FormField label and modal title
  value: string;                // selected documentId
  onChange: (documentId: string) => void;
  options: any[];               // the wizard's existing local list (already fetched)
  onCreated: (record: any) => void; // wizard appends `record` to its own options state
  required?: boolean;
  isDisabled?: boolean;
  mainField?: string;           // display field, defaults to 'name' (all six resources have one)
}
```

Renders a `FormField` (same as today) containing an `HStack` of the existing `<Select>` markup plus a small `IconButton` (`FiPlus`, `aria-label="Create new {label}"`). Clicking it sets local `isCreateOpen = true`, which renders a Chakra `Modal` (`size="md"`) on top of the current modal:

```
ModalHeader: "New {label}"
ModalBody: <InlineResourceForm resource={resource} onDone={handleCreated} onCancel={() => setIsCreateOpen(false)} />
```

`handleCreated(record)`:
1. `onCreated(record)` — parent appends it to its local options array
2. `onChange(record.documentId)` — auto-selects the new item
3. `setIsCreateOpen(false)` — closes the nested modal

Nothing about the parent wizard unmounts or resets — the nested modal is purely additive local state, so step position and every other field the user already filled in are untouched.

### Change to `InlineResourceForm.tsx`

`onDone` widens from `() => void` to `onDone: (created?: any) => void`, and `submit()` passes the POST response through: `const created = await api.post(...); onDone(created);`. This is backward-compatible — `AddNewModal.tsx`'s `doneToList = () => {...}` still type-checks against a callback that now optionally receives an argument it ignores.

### Wizard integration

In each of the three wizard files, replace the relevant `<FormField label="X" required><Select>...</Select></FormField>` block with:

```tsx
<QuickCreateSelect
  resource="brands"
  label="Brand"
  required
  value={brandId}
  onChange={setBrandId}
  options={brands}
  onCreated={(b) => setBrands((prev) => [...prev, b])}
/>
```

Same pattern for Category/Variant Type (Product wizard), Supplier (Stock Purchase), Customer (Order). The Variant Type case sits inside a per-row `.map()`, so each row gets its own independent `QuickCreateSelect` instance/nested-modal state — no shared state between rows.

## Data flow

1. User is mid-wizard (e.g. Product Info step, Brand unset).
2. Clicks "+" next to Brand → nested modal opens with `InlineResourceForm resource="brands"`.
3. Fills in Brand name, clicks Save → `POST /resources/brands` → response is the full created record (`documentId`, `name`, ...).
4. `QuickCreateSelect` appends it to the wizard's `brands` array and sets `brandId` to the new `documentId`; nested modal closes.
5. User is back on the Product Info step, Brand now shows the new value selected, Name/Category (whatever else they'd filled in) unchanged.
6. User continues the wizard normally.

No refetch of the options list is needed — the POST response is the option.

## Error handling

Unchanged from `InlineResourceForm`'s existing behavior: a failed create shows its error message inline within the nested modal (`e?.response?.data?.error?.message ?? 'Save failed'`) and the nested modal stays open for retry; the parent wizard is unaffected either way since it was never touched.

## Testing

Manual verification via the running dev server (Strapi admin doesn't have an existing component test setup for this plugin to extend):
- Open Product wizard, click "+" next to Brand, create a brand, confirm it's selected and Name/Category fields are untouched, complete the wizard.
- Repeat for Category, and for Variant Type on a variant row.
- Stock Purchase: quick-create a Supplier mid-wizard.
- Order: quick-create a Customer mid-wizard.
- Cancel out of a nested quick-create modal (via Cancel button and via the modal's own close button) and confirm the wizard underneath is untouched and the dropdown's value is unchanged.
