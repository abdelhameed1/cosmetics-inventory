# Inline Quick-Create for Wizard Relation Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create a missing Brand, Category, Variant Type, Supplier, or Customer from inside the Product / Stock Purchase / Order wizard, via a "+" button next to the relevant dropdown, without losing their in-progress wizard state.

**Architecture:** A new `QuickCreateSelect` component wraps the existing `<Select>` + `FormField` pattern with a "+" `IconButton` that opens a nested Chakra `Modal` containing the already-existing `InlineResourceForm` (the same form the top-level "Add New" picker uses for these resource types). On successful create, the new record is appended to the wizard's local options list and auto-selected — nothing in the parent wizard unmounts, so its state survives untouched. Full design rationale and scope boundaries: `docs/superpowers/specs/2026-07-28-inline-quick-create-design.md`.

**Tech Stack:** React 18, TypeScript, Chakra UI v2, react-icons/fi — all already dependencies of `src/plugins/inventory-dashboard`. No new packages.

## Global Constraints

- No new npm dependencies — everything needed (`Modal`, `IconButton`, `FiPlus`, `FormField`, `InlineResourceForm`) already exists in this plugin.
- `InlineResourceForm`'s existing caller (`AddNewModal.tsx`'s `doneToList`) must keep compiling unchanged — the `onDone` signature widens, it does not change shape for existing callers.
- Scope is exactly: Brand + Category + Variant Type (Product wizard), Supplier (Stock Purchase wizard), Customer (Order wizard). Product/Variant dropdowns and `RelationSelect.tsx`/`FieldRenderer.tsx` are explicitly out of scope (see design doc's Scope section) — do not touch them.
- **Testing approach for this plan:** this plugin has no component test runner (no jest/vitest config, no `*.test.tsx` files exist under `src/plugins/inventory-dashboard`, confirmed before writing this plan) — `package.json` only provides `test:ts:front` (`tsc -p admin/tsconfig.json --noEmit`, run with `--prefix src/plugins/inventory-dashboard` from the repo root). Every task's automated verification step is this typecheck. Real behavioral verification (clicking through the wizards in a running dev server) happens once, across all three wizards together, as a final manual pass by the plan's controller after all tasks are code-reviewed — not per-task by implementer subagents, since spinning up Strapi + a database + a browser driver in every task's subagent is wasteful and flaky compared to one pass at the end. Implementer subagents should NOT attempt to start the dev server.
- All three resource-lookup lists a wizard fetches (e.g. `brands`, `categories`) are plain `useState<any[]>([])` arrays already populated once on mount — appending the newly-created record to that same array (no refetch) is the established pattern to follow.

---

### Task 1: Widen `InlineResourceForm`'s `onDone` to pass back the created record

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx:8-12` (props interface), `:28-40` (submit function)

**Interfaces:**
- Consumes: nothing new.
- Produces: `InlineResourceFormProps.onDone` becomes `(created?: any) => void` (was `() => void`). `created` is the raw POST response body (the newly-created record, including its `documentId` and every field submitted). Task 2's `QuickCreateSelect` consumes this.

- [ ] **Step 1: Change the `onDone` prop type**

In `src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx`, change:

```tsx
interface InlineResourceFormProps {
  resource: string;
  onDone: () => void;
  onCancel?: () => void;
}
```

to:

```tsx
interface InlineResourceFormProps {
  resource: string;
  onDone: (created?: any) => void;
  onCancel?: () => void;
}
```

- [ ] **Step 2: Pass the created record through in `submit()`**

Change:

```tsx
  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = serialize(values, editableFields);
      await api.post(`/resources/${resource}`, payload);
      onDone();
    } catch (e: any) {
```

to:

```tsx
  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = serialize(values, editableFields);
      const created = await api.post<any>(`/resources/${resource}`, payload);
      onDone(created);
    } catch (e: any) {
```

- [ ] **Step 3: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors. In particular, confirm `AddNewModal.tsx`'s `<InlineResourceForm resource={active.slug} onDone={doneToList} onCancel={backToGrid} />` (where `doneToList = () => {...}`, i.e. still zero-arg) still typechecks — a function typed `() => void` is assignable to a prop typed `(created?: any) => void`, so this requires no change to `AddNewModal.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx
git commit -m "Pass created record through InlineResourceForm's onDone callback"
```

---

### Task 2: Create the `QuickCreateSelect` component

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx`

**Interfaces:**
- Consumes: `InlineResourceForm` (from Task 1, `onDone: (created?: any) => void`), `FormField` (`src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx`, props `{ label: string; required?: boolean; children: ReactNode }`).
- Produces: `QuickCreateSelect` component, importable as `import { QuickCreateSelect } from './QuickCreateSelect';` (same directory) or `import { QuickCreateSelect } from '../components/QuickCreateSelect';` (from `admin/src/pages/*`). Props:
  ```ts
  interface QuickCreateSelectProps {
    resource: string;                    // e.g. 'brands' — passed to InlineResourceForm as-is
    label: string;                        // e.g. 'Brand' — used as FormField label and modal title
    value: string;                        // selected documentId
    onChange: (documentId: string) => void;
    options: any[];                       // records with at least { documentId, [mainField] }
    onCreated: (record: any) => void;     // caller appends `record` to its own options state
    required?: boolean;
    isDisabled?: boolean;
    mainField?: string;                   // display field on each option, defaults to 'name'
  }
  ```
  Tasks 3-5 consume this component and this exact prop shape.

- [ ] **Step 1: Write the component**

Create `src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx`:

```tsx
import { useState } from 'react';
import {
  HStack, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Select,
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { FormField } from './ui/FormField';
import { InlineResourceForm } from './InlineResourceForm';

interface QuickCreateSelectProps {
  resource: string;
  label: string;
  value: string;
  onChange: (documentId: string) => void;
  options: any[];
  onCreated: (record: any) => void;
  required?: boolean;
  isDisabled?: boolean;
  mainField?: string;
}

export function QuickCreateSelect({
  resource, label, value, onChange, options, onCreated, required, isDisabled, mainField = 'name',
}: QuickCreateSelectProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreated = (created?: any) => {
    if (created) {
      onCreated(created);
      onChange(created.documentId);
    }
    setIsCreateOpen(false);
  };

  return (
    <>
      <FormField label={label} required={required}>
        <HStack spacing={2}>
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            isDisabled={isDisabled}
            placeholder={`Select ${label.toLowerCase()}`}
          >
            {options.map((o) => (
              <option key={o.documentId} value={o.documentId}>
                {String(o[mainField] ?? o.documentId)}
              </option>
            ))}
          </Select>
          <IconButton
            aria-label={`Create new ${label}`}
            icon={<FiPlus />}
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
          />
        </HStack>
      </FormField>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{`New ${label}`}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <InlineResourceForm
              resource={resource}
              onDone={handleCreated}
              onCancel={() => setIsCreateOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
```

`InlineResourceForm` is imported directly (not `React.lazy`-wrapped) here: `QuickCreateSelect` is only ever used from inside `ProductVariantsForm`/`StockPurchase`/`OrderForm`, and those three are already lazy-loaded from `AddNewModal.tsx` — so this import doesn't add weight to the always-loaded base shell chunk.

- [ ] **Step 2: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/QuickCreateSelect.tsx
git commit -m "Add QuickCreateSelect: relation dropdown with inline create"
```

---

### Task 3: Wire `QuickCreateSelect` into the Product wizard (Brand, Category, Variant Type)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx:1-8` (imports), `:127-140` (Brand/Category fields), `:162-172` (per-row Variant Type field)

**Interfaces:**
- Consumes: `QuickCreateSelect` from Task 2, exact props as defined there.
- Produces: nothing new — this task only wires an existing component into existing state (`brands`, `setBrands`, `categoryId`/`setCategoryId`, etc., all already declared in this file).

- [ ] **Step 1: Import `QuickCreateSelect`**

In `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`, after the existing:

```tsx
import { WizardShell, type WizardStep } from './WizardShell';
```

add:

```tsx
import { QuickCreateSelect } from './QuickCreateSelect';
```

- [ ] **Step 2: Replace the Brand and Category fields in `productInfoStep`**

Change:

```tsx
          <GridItem colSpan={4}>
            <FormField label="Brand" required>
              <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="Select brand">
                {brands.map((b) => <option key={b.documentId} value={b.documentId}>{b.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Category" required>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Select category">
                {categories.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
```

to:

```tsx
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="brands"
              label="Brand"
              required
              value={brandId}
              onChange={setBrandId}
              options={brands}
              onCreated={(b) => setBrands((prev) => [...prev, b])}
            />
          </GridItem>
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="categories"
              label="Category"
              required
              value={categoryId}
              onChange={setCategoryId}
              options={categories}
              onCreated={(c) => setCategories((prev) => [...prev, c])}
            />
          </GridItem>
```

- [ ] **Step 3: Replace the per-row Variant Type field in `variantsStep`**

Change:

```tsx
                <GridItem colSpan={4}>
                  <FormField label="Type">
                    <Select
                      value={row.variantTypeId}
                      onChange={(e) => updateRow(i, { variantTypeId: e.target.value })}
                      placeholder="Select type"
                    >
                      {variantTypes.map((t) => <option key={t.documentId} value={t.documentId}>{t.name}</option>)}
                    </Select>
                  </FormField>
                </GridItem>
```

to:

```tsx
                <GridItem colSpan={4}>
                  <QuickCreateSelect
                    resource="variant-types"
                    label="Variant Type"
                    value={row.variantTypeId}
                    onChange={(v) => updateRow(i, { variantTypeId: v })}
                    options={variantTypes}
                    onCreated={(t) => setVariantTypes((prev) => [...prev, t])}
                  />
                </GridItem>
```

(Label changes from "Type" to "Variant Type" to match the resource's display name elsewhere in the app — e.g. `addNewConfig.ts`'s `{ slug: 'variant-types', label: 'Variant Type' }` — so the quick-create modal reads "New Variant Type" instead of the more ambiguous "New Type".)

- [ ] **Step 4: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors. `Select` and `FormField` imports must remain used elsewhere in this file (the "Add related product" picker in `relatedStep` still uses both directly) — do not remove those imports.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
git commit -m "Wire quick-create into Product wizard's Brand/Category/Variant Type fields"
```

- [ ] **Step 6: Manual verification note (for the plan controller, not this task's implementer)**

Covered in the final manual pass after Task 5 — see "Final manual verification" below. Do not start a dev server in this task.

---

### Task 4: Wire `QuickCreateSelect` into the Stock Purchase wizard (Supplier)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx:1-7` (imports), `:67-77` (`supplierStep`)

**Interfaces:**
- Consumes: `QuickCreateSelect` from Task 2, exact props as defined there.
- Produces: nothing new.

- [ ] **Step 1: Import `QuickCreateSelect`**

In `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`, after the existing:

```tsx
import { WizardShell, type WizardStep } from '../components/WizardShell';
```

add:

```tsx
import { QuickCreateSelect } from '../components/QuickCreateSelect';
```

- [ ] **Step 2: Replace `supplierStep`'s Supplier field**

Change:

```tsx
  const supplierStep = (
    <Card>
      <CardBody>
        <FormField label="Supplier" required>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
            {suppliers.map((s) => <option key={s.documentId} value={s.documentId}>{s.name}</option>)}
          </Select>
        </FormField>
      </CardBody>
    </Card>
  );
```

to:

```tsx
  const supplierStep = (
    <Card>
      <CardBody>
        <QuickCreateSelect
          resource="suppliers"
          label="Supplier"
          required
          value={supplierId}
          onChange={setSupplierId}
          options={suppliers}
          onCreated={(s) => setSuppliers((prev) => [...prev, s])}
        />
      </CardBody>
    </Card>
  );
```

- [ ] **Step 3: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors. `Select` and `FormField` imports must remain used elsewhere in this file (Product/Variant dropdowns in `productStep` still use both directly) — do not remove those imports.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
git commit -m "Wire quick-create into Stock Purchase wizard's Supplier field"
```

---

### Task 5: Wire `QuickCreateSelect` into the Order wizard (Customer)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx:1-13` (imports), `:154-160` (Customer field in `customerStep`)

**Interfaces:**
- Consumes: `QuickCreateSelect` from Task 2, exact props as defined there.
- Produces: nothing new.

- [ ] **Step 1: Import `QuickCreateSelect`**

In `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`, after the existing:

```tsx
import { WizardShell, type WizardStep } from '../components/WizardShell';
```

add:

```tsx
import { QuickCreateSelect } from '../components/QuickCreateSelect';
```

- [ ] **Step 2: Replace the Customer field in `customerStep`**

Change:

```tsx
          <GridItem colSpan={4}>
            <FormField label="Customer" required>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Select customer">
                {customers.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
```

to:

```tsx
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="customers"
              label="Customer"
              required
              value={customerId}
              onChange={setCustomerId}
              options={customers}
              onCreated={(c) => setCustomers((prev) => [...prev, c])}
            />
          </GridItem>
```

`setCustomers((prev) => [...prev, c])` feeds the existing `useEffect` at the top of `OrderForm.tsx` (`const c = customers.find((x) => x.documentId === customerId); if (c?.priceList?.documentId) setPriceListId(c.priceList.documentId);`), which is keyed on `[customerId, customers]` — so a freshly quick-created customer with a price list already set (the Customer create form has its own Price List field, via `InlineResourceForm`'s schema-driven relation rendering) will still correctly auto-fill `priceListId` once selected, exactly as it does for a customer created any other way. The `/resources/customers` create response includes the populated `priceList` relation already (`server/src/config/resources.ts`: `customers: { uid: 'api::customer.customer', populate: ['priceList'] }`), so no refetch is needed for that auto-fill to work.

- [ ] **Step 3: Typecheck**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: no errors. `Select` and `FormField` imports must remain used elsewhere in this file (Product/Variant dropdowns in `lineItemsStep`, Method select in `ConfirmedOrderView` still use both directly) — do not remove those imports.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
git commit -m "Wire quick-create into Order wizard's Customer field, verify price-list auto-fill"
```

---

## Final manual verification (controller, after all 5 tasks are reviewed)

Not a task for an implementer subagent — done by whoever is running this plan, once, after every task above is committed and reviewed:

1. Start the Strapi dev server (`npm run develop` from repo root) against a working local database.
2. Open the admin panel, click "Add New" → Product. On the Product Info step, click "+" next to Brand, create a brand with just a name, confirm it appears selected and the Name field (type something first) is untouched. Repeat for Category. Add a variant row, click "+" next to Type, create a Variant Type, confirm it's selected on that row.
3. Complete the Product wizard (Next → Next → Review → Create product) and confirm it saves successfully.
4. Click "Add New" → Stock Purchase, click "+" next to Supplier, create one, confirm it's selected, complete the wizard.
5. Click "Add New" → Order, click "+" next to Customer, create one (optionally picking an existing Price List in that nested form), confirm it's selected and — if a price list was picked — that the price list auto-fills once you're back on the Order wizard.
6. For each of the three "+" flows above, also click Cancel (or the modal's own close button) instead of Save at least once, and confirm the wizard underneath is untouched and the dropdown's value didn't change.
