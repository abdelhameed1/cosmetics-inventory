# Frontend Test Coverage Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the frontend Jest coverage gap in `src/plugins/inventory-dashboard/admin` — the data-entry wizard system and every CRUD page except Overview currently have zero test coverage.

**Architecture:** Add one RTL/jsdom test file per untested component/page under `admin/tests/`, following the exact conventions already established in commit `91f8d34` (custom `render` from `./test-utils` wrapping `<ChakraRoot>`, `jest.mock('@strapi/strapi/admin')` for `useFetchClient`, `jest.mock('react-router-dom')` for `useNavigate`/`useParams` where needed). No new test infrastructure, no new libraries — this plan only adds test files (plus one small addition to the existing `hooks.test.tsx`).

**Tech Stack:** Jest 29 + ts-jest, `@testing-library/react` 14, `@testing-library/jest-dom`, jsdom. Config: `src/plugins/inventory-dashboard/admin/jest.config.js` (already exists, unchanged by this plan).

## Global Constraints

- Run the full frontend suite with `npm run test:front` from the repo root (`d:\7meed\cosmtic`). To run a single file while iterating: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/<FileName>.test.tsx`.
- New test files live in `src/plugins/inventory-dashboard/admin/tests/`, named `<ComponentOrPageName>.test.tsx`, one file per component/page — matching the existing 13 files from commit `91f8d34`.
- Always import `render`/`screen`/`fireEvent`/`waitFor`/`within` from `./test-utils` (which re-exports `@testing-library/react` and wraps `render` in `<ChakraRoot>`), never from `@testing-library/react` directly.
- Every component/hook that calls `useApi()` ultimately calls `useFetchClient()` from `@strapi/strapi/admin`. Mock it per-file with:
  ```ts
  jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
  ```
  and set the return value with `(useFetchClient as jest.Mock).mockReturnValue({ get, post, put, del })` in `beforeEach`. Never let a real network call happen.
- The plugin's REST paths are always prefixed `/inventory-dashboard` (the `pluginId`). `useApi()` calls the underlying client as `get(fullPath, { params })`, `post(fullPath, data)`, `put(fullPath, data)`, `del(fullPath)` — match this shape exactly in `toHaveBeenCalledWith` assertions (see `admin/src/utils/api.ts`).
- For any component reading `useNavigate()`, mock `react-router-dom` per-file:
  ```ts
  const mockNavigate = jest.fn();
  jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
  }));
  ```
  (this is the exact pattern already used in `admin/tests/OverviewPage.test.tsx`). For any component reading `useParams()`, additionally wrap the rendered element in a real `<MemoryRouter>`/`<Routes>`/`<Route path="...">` so the param is real, rather than mocking `useParams`.
- Chakra's `FormControl`/`FormLabel` wiring means every field rendered through `FormField` (`admin/src/components/ui/FormField.tsx`) is reachable via `screen.getByLabelText('<Label Text>')` — prefer that over `getByPlaceholderText` or test ids.
- Chakra's `AlertDialog` renders `role="alertdialog"`. When a page has more than one button with the same accessible name (e.g. a row's icon-button labeled "Delete" plus the dialog's own "Delete" button), scope the query with `within(await screen.findByRole('alertdialog'))`.
- Model tier per repo `.claude/CLAUDE.md`: implement Tasks 1–14 with a low-tier model (haiku or sonnet 4.5). The final review/integration task (Task 15) uses opus 4.8 — not 5.
- Per repo `.claude/CLAUDE.md`, once the reviewer signs off, `docs/implementation.md` must be updated to record what was added, as its own step (Task 15) — do not skip this.
- A task is only done when its new/modified file passes `npm run test:front` in full (both the `test:ts:front` tsc check and the `test:unit:front` jest run) — not just the one new test file in isolation.

---

## File Structure

**Create** (one RTL test file per component/page, all under `src/plugins/inventory-dashboard/admin/tests/`):
- `WizardShell.test.tsx` — step navigation, validity gating, submit
- `FieldRenderer.test.tsx` — one case per schema field type
- `RelationSelect.test.tsx` — async option loading + selection
- `QuickCreateSelect.test.tsx` — select + inline "create new" modal wiring
- `InlineResourceForm.test.tsx` — schema-driven form + save/error
- `AddNewModal.test.tsx` — picker grid + routing into wizards/forms
- `ProductVariantsForm.test.tsx` — multi-step create + partial-failure retry logic
- `OrdersList.test.tsx` — list + cancel-order flow
- `ResourceListPage.test.tsx` — generic list + search + delete flow
- `ResourceFormPage.test.tsx` — generic create/edit + products special-case
- `CatalogHub.test.tsx` — per-entity counts grid
- `StockPurchase.test.tsx` — 3-step wizard + submit
- `OrderForm.test.tsx` — draft-order wizard (FIFO pricing) + confirmed-order view (payments/cancel)

**Modify:**
- `admin/tests/hooks.test.tsx` — add `useOverview`/`useResources` coverage alongside the existing `useSettings`/`useSchema` blocks
- `docs/implementation.md` — record what this plan added, once the reviewer signs off (Task 15)

**Out of scope (explicitly, so nobody wonders):** `StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`, `CatalogStandalone.tsx` are trivial `<ChakraRoot><AppShell><Page /></AppShell></ChakraRoot>` compositions with no logic of their own — they are not separate test targets. `AppShell`/`AppSidebar` are out of scope for this plan (not part of the wizard/CRUD-page gap this plan closes).

---

### Task 1: WizardShell

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/WizardShell.test.tsx`

**Interfaces:**
- Consumes: `WizardShell`, `WizardStep` from `../src/components/WizardShell` — `WizardShellProps = { steps: WizardStep[]; onSubmit: () => Promise<void>; submitLabel: string; isSubmitting: boolean; submitError: string | null }`, `WizardStep = { label: string; content: ReactNode; isValid: () => boolean }`.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent } from './test-utils';
import { WizardShell, type WizardStep } from '../src/components/WizardShell';

function makeSteps(overrides?: Partial<Record<number, boolean>>): WizardStep[] {
  return [
    { label: 'Step One', content: <div>Content One</div>, isValid: () => overrides?.[0] ?? true },
    { label: 'Step Two', content: <div>Content Two</div>, isValid: () => overrides?.[1] ?? true },
  ];
}

describe('WizardShell', () => {
  it('renders first step content, no Back button, and the step indicator text', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    expect(screen.getByText('Content One')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    expect(screen.getByText('Step One — step 1 of 2')).toBeInTheDocument();
  });

  it('disables Next when the current step is invalid', () => {
    render(<WizardShell steps={makeSteps({ 0: false })} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('advances to the next step and back again', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Content Two')).toBeInTheDocument();
    expect(screen.getByText('Step Two — step 2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });

  it('shows the submit button with submitLabel on the last step and calls onSubmit', () => {
    const onSubmit = jest.fn();
    render(<WizardShell steps={makeSteps()} onSubmit={onSubmit} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders submitError only on the last step', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError="Boom" />);
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('clicking an earlier step indicator jumps back to it', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Content Two')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Step One'));
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/WizardShell.test.tsx`
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/WizardShell.test.tsx
git commit -m "test(admin): add WizardShell coverage"
```

---

### Task 2: FieldRenderer

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/FieldRenderer.test.tsx`

**Interfaces:**
- Consumes: `FieldRenderer` from `../src/components/FieldRenderer`; `FieldMeta` from `../src/utils/api` (`{ name, type, required, unique, hidden, min?, max?, values?, relation? }`).
- Mocks `RelationSelect` (own component under `../src/components/RelationSelect`, covered in Task 3) so this file only exercises `FieldRenderer`'s own type-dispatch logic.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent } from './test-utils';
import { FieldRenderer } from '../src/components/FieldRenderer';
import { type FieldMeta } from '../src/utils/api';

jest.mock('../src/components/RelationSelect', () => ({
  RelationSelect: ({ field }: { field: FieldMeta }) => <div data-testid="relation-select">{field.name}</div>,
}));

function field(overrides: Partial<FieldMeta>): FieldMeta {
  return { name: 'name', type: 'string', required: false, unique: false, hidden: false, ...overrides };
}

describe('FieldRenderer', () => {
  it('renders nothing when the field is hidden', () => {
    const { container } = render(<FieldRenderer field={field({ hidden: true })} value="" onChange={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a Textarea for type "text"', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'notes', type: 'text' })} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('renders a NumberInput for numeric types and passes a number to onChange', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'marginPercent', type: 'decimal' })} value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Margin %'), { target: { value: '12.5' } });
    expect(onChange).toHaveBeenCalledWith(12.5);
  });

  it('renders a Switch for type "boolean"', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'isDefault', type: 'boolean' })} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Default'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders a date input for type "date"', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'name', type: 'date' })} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '2026-08-04' } });
    expect(onChange).toHaveBeenCalledWith('2026-08-04');
  });

  it('renders an enumeration Select with translated option labels', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'type', type: 'enumeration', values: ['retail', 'wholesale'] })} value="" onChange={onChange} />);
    const select = screen.getByLabelText('Type');
    expect(screen.getByRole('option', { name: 'retail' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'wholesale' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'wholesale' } });
    expect(onChange).toHaveBeenCalledWith('wholesale');
  });

  it('delegates type "relation" to RelationSelect', () => {
    render(<FieldRenderer field={field({ name: 'brand', type: 'relation' })} value="" onChange={jest.fn()} />);
    expect(screen.getByTestId('relation-select')).toHaveTextContent('brand');
  });

  it('falls back to a plain text Input for an unrecognized type', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'phone', type: 'string' })} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0100' } });
    expect(onChange).toHaveBeenCalledWith('0100');
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/FieldRenderer.test.tsx`
Expected: 8 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/FieldRenderer.test.tsx
git commit -m "test(admin): add FieldRenderer coverage for every schema field type"
```

---

### Task 3: RelationSelect

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/RelationSelect.test.tsx`

**Interfaces:**
- Consumes: `RelationSelect` from `../src/components/RelationSelect`; `FieldMeta` from `../src/utils/api`.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import { RelationSelect } from '../src/components/RelationSelect';
import { type FieldMeta } from '../src/utils/api';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

const relationField: FieldMeta = {
  name: 'brand', type: 'relation', required: true, unique: false, hidden: false,
  relation: { resource: 'brands', kind: 'oneToOne', mainField: 'name' },
};

describe('RelationSelect', () => {
  const mockGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: mockGet, post: jest.fn(), put: jest.fn(), del: jest.fn() });
  });

  it('loads and renders options from the related resource', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [{ documentId: 'b1', name: 'Chanel' }, { documentId: 'b2', name: 'Dior' }] } });

    render(<RelationSelect field={relationField} value="" onChange={jest.fn()} />);

    expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', { params: { pageSize: 100 } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Dior' })).toBeInTheDocument();
  });

  it('calls onChange with the selected documentId', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [{ documentId: 'b1', name: 'Chanel' }] } });
    const onChange = jest.fn();

    render(<RelationSelect field={relationField} value="" onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'b1' } });
    expect(onChange).toHaveBeenCalledWith('b1');
  });

  it('does not fetch and renders no options when the field has no relation target', () => {
    render(<RelationSelect field={{ ...relationField, relation: undefined }} value="" onChange={jest.fn()} />);
    expect(mockGet).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('resolves the selected value from a populated relation object via documentId', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [{ documentId: 'b1', name: 'Chanel' }] } });
    render(<RelationSelect field={relationField} value={{ documentId: 'b1', name: 'Chanel' }} onChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    expect(screen.getByLabelText('Brand')).toHaveValue('b1');
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/RelationSelect.test.tsx`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/RelationSelect.test.tsx
git commit -m "test(admin): add RelationSelect coverage"
```

---

### Task 4: QuickCreateSelect

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/QuickCreateSelect.test.tsx`

**Interfaces:**
- Consumes: `QuickCreateSelect` from `../src/components/QuickCreateSelect`. Mocks the lazy-loaded `InlineResourceForm` (`../src/components/InlineResourceForm`, covered separately in Task 5) to isolate this component's own modal-open/close and callback wiring.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { QuickCreateSelect } from '../src/components/QuickCreateSelect';

jest.mock('../src/components/InlineResourceForm', () => ({
  InlineResourceForm: ({ onDone }: { onDone: (created?: any) => void }) => (
    <button onClick={() => onDone({ documentId: 'new-1', name: 'New Brand' })}>Mock create</button>
  ),
}));

describe('QuickCreateSelect', () => {
  const options = [{ documentId: 'b1', name: 'Chanel' }, { documentId: 'b2', name: 'Dior' }];

  it('renders the select with the given label and options', () => {
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={jest.fn()} options={options} onCreated={jest.fn()} />);
    expect(screen.getByLabelText('Brand')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dior' })).toBeInTheDocument();
  });

  it('calls onChange with the selected documentId', () => {
    const onChange = jest.fn();
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={onChange} options={options} onCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'b2' } });
    expect(onChange).toHaveBeenCalledWith('b2');
  });

  it('opens the create modal, forwards the created record to onCreated and onChange, and closes', async () => {
    const onChange = jest.fn();
    const onCreated = jest.fn();
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={onChange} options={options} onCreated={onCreated} />);

    fireEvent.click(screen.getByRole('button', { name: /create new brand/i }));
    const createBtn = await screen.findByRole('button', { name: /mock create/i });
    fireEvent.click(createBtn);

    expect(onCreated).toHaveBeenCalledWith({ documentId: 'new-1', name: 'New Brand' });
    expect(onChange).toHaveBeenCalledWith('new-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: /mock create/i })).not.toBeInTheDocument());
  });

  it('is disabled when isDisabled is true', () => {
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={jest.fn()} options={options} onCreated={jest.fn()} isDisabled />);
    expect(screen.getByLabelText('Brand')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/QuickCreateSelect.test.tsx`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/QuickCreateSelect.test.tsx
git commit -m "test(admin): add QuickCreateSelect coverage"
```

---

### Task 5: InlineResourceForm

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/InlineResourceForm.test.tsx`

**Interfaces:**
- Consumes: `InlineResourceForm` from `../src/components/InlineResourceForm`. Mocks `../src/hooks/useSchema` directly (same style as the existing `OverviewPage.test.tsx` mocking `useOverview`/`useSettings`) and `@strapi/strapi/admin`'s `useFetchClient`.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import { InlineResourceForm } from '../src/components/InlineResourceForm';
import { useSchema } from '../src/hooks/useSchema';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
jest.mock('../src/hooks/useSchema');

describe('InlineResourceForm', () => {
  const mockPost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: jest.fn(), post: mockPost, put: jest.fn(), del: jest.fn() });
    (useSchema as jest.Mock).mockReturnValue({
      schema: {
        resource: 'brands', uid: 'api::brand.brand',
        fields: [
          { name: 'name', type: 'string', required: true, unique: false, hidden: false },
          { name: 'notes', type: 'text', required: false, unique: false, hidden: false },
        ],
      },
      error: null, reload: jest.fn(),
    });
  });

  it('renders one field per non-hidden schema field', () => {
    render(<InlineResourceForm resource="brands" onDone={jest.fn()} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('submits only the fields the user filled in and calls onDone with the created record', async () => {
    mockPost.mockResolvedValueOnce({ data: { documentId: 'new-1', name: 'Chanel' } });
    const onDone = jest.fn();
    render(<InlineResourceForm resource="brands" onDone={onDone} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Chanel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ documentId: 'new-1', name: 'Chanel' }));
    expect(mockPost).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', { name: 'Chanel' });
  });

  it('shows the server error message and does not call onDone when the save fails', async () => {
    mockPost.mockRejectedValueOnce({ response: { data: { error: { message: 'Name already taken' } } } });
    const onDone = jest.fn();
    render(<InlineResourceForm resource="brands" onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('Name already taken')).toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked, and omits the button when onCancel is absent', () => {
    const onCancel = jest.fn();
    const { rerender } = render(<InlineResourceForm resource="brands" onDone={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<InlineResourceForm resource="brands" onDone={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/InlineResourceForm.test.tsx`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/InlineResourceForm.test.tsx
git commit -m "test(admin): add InlineResourceForm coverage"
```

---

### Task 6: AddNewModal

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/AddNewModal.test.tsx`

**Interfaces:**
- Consumes: `AddNewModal` from `../src/components/AddNewModal`. Mocks all four of its lazily-loaded children (`InlineResourceForm`, `ProductVariantsForm`, `../src/pages/StockPurchase`, `../src/pages/OrderForm`) so this file only exercises the modal's own picker/routing logic, and mocks `useNavigate`.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, within } from './test-utils';
import { AddNewModal } from '../src/components/AddNewModal';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../src/components/InlineResourceForm', () => ({
  InlineResourceForm: ({ onDone }: { onDone: (created?: any) => void }) => (
    <button onClick={() => onDone({ documentId: 'br-1' })}>Mock InlineResourceForm</button>
  ),
}));
jest.mock('../src/components/ProductVariantsForm', () => ({
  __esModule: true,
  default: () => <div>Mock ProductVariantsForm</div>,
}));
jest.mock('../src/pages/StockPurchase', () => ({
  __esModule: true,
  default: () => <div>Mock StockPurchase</div>,
}));
jest.mock('../src/pages/OrderForm', () => ({
  __esModule: true,
  default: () => <div>Mock OrderForm</div>,
}));

describe('AddNewModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when isOpen is false', () => {
    render(<AddNewModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Add new')).not.toBeInTheDocument();
  });

  it('renders the picker grid with group headings and a Guided badge only on wizard items', () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    expect(screen.getByText('Add new')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();

    const productCard = screen.getByText('Product').closest('button') as HTMLElement;
    expect(within(productCard).getByText('Guided')).toBeInTheDocument();

    const brandCard = screen.getByText('Brand').closest('button') as HTMLElement;
    expect(within(brandCard).queryByText('Guided')).not.toBeInTheDocument();
  });

  it('opens a simple resource form with a Back button and "New {label}" title', async () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Brand'));

    expect(await screen.findByText('New Brand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByText('Mock InlineResourceForm')).toBeInTheDocument();
  });

  it('Back returns to the picker grid', async () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Brand'));
    await screen.findByText('New Brand');

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Add new')).toBeInTheDocument();
  });

  it('navigates to the resource list and closes after a simple create completes', async () => {
    const onClose = jest.fn();
    render(<AddNewModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Brand'));
    const createBtn = await screen.findByRole('button', { name: /mock inlineresourceform/i });
    fireEvent.click(createBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/plugins/inventory-catalog/brands');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the guided Product wizard for the Product item', async () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Product'));
    expect(await screen.findByText('Mock ProductVariantsForm')).toBeInTheDocument();
  });

  it('opens the guided Stock Purchase and Order wizards', async () => {
    const { unmount } = render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Stock Purchase'));
    expect(await screen.findByText('Mock StockPurchase')).toBeInTheDocument();
    unmount();

    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Order'));
    expect(await screen.findByText('Mock OrderForm')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/AddNewModal.test.tsx`
Expected: 7 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/AddNewModal.test.tsx
git commit -m "test(admin): add AddNewModal coverage"
```

---

### Task 7: ProductVariantsForm

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/ProductVariantsForm.test.tsx`

**Interfaces:**
- Consumes: default export `ProductVariantsForm` from `../src/components/ProductVariantsForm`. This is the highest-risk untested file in the plugin — it has explicit partial-failure/retry state (`savedProductId`, `variantsCreatedCount`, `variantsSnapshot` in the source) that a regression could silently break. Cover the retry path for real, not just the happy path.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import ProductVariantsForm from '../src/components/ProductVariantsForm';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

const listGet = (results: any[]) => Promise.resolve({ data: { results } });

function setupFetchClient(get: jest.Mock, post: jest.Mock, del: jest.Mock = jest.fn()) {
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del });
}

describe('ProductVariantsForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a product with a single default variant when no explicit variant rows are added', async () => {
    const get = jest.fn()
      .mockImplementationOnce(() => listGet([{ documentId: 'br-1', name: 'Chanel' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'ct-1', name: 'Skincare' }]))
      .mockImplementationOnce(() => listGet([]))
      .mockImplementationOnce(() => listGet([]));
    const post = jest.fn().mockResolvedValueOnce({ data: { documentId: 'p-1', name: 'Serum' } });
    setupFetchClient(get, post);
    const onDone = jest.fn();

    render(<ProductVariantsForm onDone={onDone} />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Serum' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'br-1' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'ct-1' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i })); // -> Variants
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // -> Related Products
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // -> Review
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/products', {
      name: 'Serum', brand: 'br-1', category: 'ct-1', relatedProducts: [],
    });
  });

  it('blocks submission and shows an error when a variant row has no variant type', async () => {
    const get = jest.fn()
      .mockImplementationOnce(() => listGet([{ documentId: 'br-1', name: 'Chanel' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'ct-1', name: 'Skincare' }]))
      .mockImplementationOnce(() => listGet([]))
      .mockImplementationOnce(() => listGet([]));
    const post = jest.fn();
    setupFetchClient(get, post);

    render(<ProductVariantsForm onDone={jest.fn()} />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Serum' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'br-1' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'ct-1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '50ml' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText('Each variant needs a type.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('retries from where it left off after the product is created but variant creation fails', async () => {
    const get = jest.fn()
      .mockImplementationOnce(() => listGet([{ documentId: 'br-1', name: 'Chanel' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'ct-1', name: 'Skincare' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'vt-1', name: 'Size' }]))
      .mockImplementationOnce(() => listGet([]));
    const post = jest.fn()
      .mockResolvedValueOnce({ data: { documentId: 'p-1', name: 'Serum' } })
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Network blip' } } } })
      .mockResolvedValueOnce({ data: { documentId: 'v-1' } });
    setupFetchClient(get, post, jest.fn().mockResolvedValue({ data: {} }));
    const onDone = jest.fn();

    render(<ProductVariantsForm onDone={onDone} />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Serum' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'br-1' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'ct-1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '50ml' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Size' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant Type'), { target: { value: 'vt-1' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText(
      'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.'
    )).toBeInTheDocument();
    const retryBtn = await screen.findByRole('button', { name: /retry remaining steps/i });

    fireEvent.click(retryBtn);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    // Exactly 3 POSTs total across both submit attempts: product (once, never repeated), the
    // failed variant attempt, and the successful retry of that same variant.
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenNthCalledWith(1, '/inventory-dashboard/resources/products', {
      name: 'Serum', brand: 'br-1', category: 'ct-1', relatedProducts: [],
    });
    expect(post).toHaveBeenNthCalledWith(3, '/inventory-dashboard/resources/variants', {
      label: '50ml', variantType: 'vt-1', lowStockThreshold: undefined, isDefault: false, product: 'p-1',
    });
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/ProductVariantsForm.test.tsx`
Expected: 3 passed. If the retry test's call-count assertions don't match, log what `post.mock.calls` actually contains and adjust the expected indices/counts to match the real sequence — do not weaken the assertion into a vague "was called" check; the point of this test is that a retry must not re-POST the product.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/ProductVariantsForm.test.tsx
git commit -m "test(admin): add ProductVariantsForm coverage including partial-failure retry"
```

---

### Task 8: OrdersList

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/OrdersList.test.tsx`

**Interfaces:**
- Consumes: default export `OrdersList` from `../src/pages/OrdersList`.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import OrdersList from '../src/pages/OrdersList';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

const draftOrder = {
  documentId: 'o1', orderDate: '2026-08-01', status: 'draft',
  customer: { name: 'Jane Doe' }, discountAmount: 0,
  lines: [{ sellPrice: 100, quantitySold: 2 }],
};

describe('OrdersList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a row per order with date, customer, status badge and computed total', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 1 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('200.00')).toBeInTheDocument();
  });

  it('shows the "showing N of total" note when more orders exist than are shown', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 5 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    expect(await screen.findByText('Showing the 1 most recent of 5 orders.')).toBeInTheDocument();
  });

  it('only shows the cancel action for draft orders', async () => {
    const paidOrder = { ...draftOrder, documentId: 'o2', status: 'paid', customer: { name: 'Sam' } };
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder, paidOrder], pagination: { total: 2 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    await screen.findByText('Jane Doe');
    expect(screen.getAllByRole('button', { name: /cancel order/i })).toHaveLength(1);
  });

  it('cancels an order after confirming, then reloads the list', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 1 } } });
    const post = jest.fn().mockResolvedValueOnce({ data: {} });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    await screen.findByText('Jane Doe');

    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/inventory-dashboard/orders/o1/cancel'));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('navigates to the order detail page when a row is clicked', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 1 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    fireEvent.click(await screen.findByText('Jane Doe'));
    expect(mockNavigate).toHaveBeenCalledWith('o1');
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/OrdersList.test.tsx`
Expected: 5 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/OrdersList.test.tsx
git commit -m "test(admin): add OrdersList coverage"
```

---

### Task 9: ResourceListPage

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/ResourceListPage.test.tsx`

**Interfaces:**
- Consumes: default export `ResourceListPage` from `../src/pages/ResourceListPage` (reads `useParams().resource`, so it must be rendered inside a real `<MemoryRouter>`/`<Routes>`/`<Route path="/:resource">`).

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import ResourceListPage from '../src/pages/ResourceListPage';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

function renderAtResource(resource: string) {
  return render(
    <MemoryRouter initialEntries={[`/${resource}`]}>
      <Routes>
        <Route path="/:resource" element={<ResourceListPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const schemaResponse = {
  data: {
    resource: 'brands', uid: 'api::brand.brand',
    fields: [{ name: 'name', type: 'string', required: true, unique: false, hidden: false }],
  },
};

describe('ResourceListPage', () => {
  const mockGet = jest.fn();
  const mockDel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: mockGet, post: jest.fn(), put: jest.fn(), del: mockDel });
  });

  function mockLoads(rows: any[]) {
    mockGet.mockImplementation((url: string) =>
      url.endsWith('/schema')
        ? Promise.resolve(schemaResponse)
        : Promise.resolve({ data: { results: rows, pagination: { total: rows.length } } })
    );
  }

  it('renders columns from the schema and one row per record', async () => {
    mockLoads([{ documentId: 'b1', name: 'Chanel' }]);
    renderAtResource('brands');

    expect(await screen.findByText('Chanel')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('shows the entity-specific empty label when there is no search and no rows', async () => {
    mockLoads([]);
    renderAtResource('brands');
    expect(await screen.findByText('No brands yet.')).toBeInTheDocument();
  });

  it('re-fetches with the search term as the user types', async () => {
    mockLoads([{ documentId: 'b1', name: 'Chanel' }]);
    renderAtResource('brands');
    await screen.findByText('Chanel');

    fireEvent.change(screen.getByPlaceholderText('Search by name'), { target: { value: 'Cha' } });

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', {
        params: { search: 'Cha', pageSize: 100 },
      })
    );
  });

  it('deletes a record after confirming, then reloads the list', async () => {
    mockLoads([{ documentId: 'b1', name: 'Chanel' }]);
    mockDel.mockResolvedValueOnce({ data: {} });
    renderAtResource('brands');
    await screen.findByText('Chanel');

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDel).toHaveBeenCalledWith('/inventory-dashboard/resources/brands/b1'));
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/ResourceListPage.test.tsx`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/ResourceListPage.test.tsx
git commit -m "test(admin): add ResourceListPage coverage"
```

---

### Task 10: ResourceFormPage

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/ResourceFormPage.test.tsx`

**Interfaces:**
- Consumes: default export `ResourceFormPage` from `../src/pages/ResourceFormPage` (reads `useParams().resource`/`.id`). Mocks default-exported `ProductVariantsForm` (covered in Task 7) to isolate the `resource === 'products' && !isEdit` special case from that component's own internals.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import ResourceFormPage from '../src/pages/ResourceFormPage';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
jest.mock('../src/components/ProductVariantsForm', () => ({
  __esModule: true,
  default: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>Mock ProductVariantsForm</button>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:resource/new" element={<ResourceFormPage />} />
        <Route path="/:resource/:id" element={<ResourceFormPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const schemaResponse = {
  data: {
    resource: 'brands', uid: 'api::brand.brand',
    fields: [{ name: 'name', type: 'string', required: true, unique: false, hidden: false }],
  },
};

describe('ResourceFormPage', () => {
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockPut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: mockGet, post: mockPost, put: mockPut, del: jest.fn() });
  });

  it('renders ProductVariantsForm instead of the generic form when creating a product', async () => {
    mockGet.mockResolvedValue(schemaResponse);
    renderAt('/products/new');
    expect(await screen.findByText('Mock ProductVariantsForm')).toBeInTheDocument();
  });

  it('creates a record from the generic form and navigates back on success', async () => {
    mockGet.mockResolvedValue(schemaResponse);
    mockPost.mockResolvedValueOnce({ data: { documentId: 'b1', name: 'Chanel' } });
    renderAt('/brands/new');

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Chanel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', { name: 'Chanel' }));
    expect(mockNavigate).toHaveBeenCalledWith('..', { relative: 'path' });
  });

  it('loads and prefills an existing record in edit mode', async () => {
    mockGet.mockImplementation((url: string) =>
      url.endsWith('/schema') ? Promise.resolve(schemaResponse) : Promise.resolve({ data: { documentId: 'b1', name: 'Chanel' } })
    );
    renderAt('/brands/b1');

    expect(await screen.findByLabelText('Name')).toHaveValue('Chanel');
    expect(screen.getByRole('heading', { name: 'Edit Brands' })).toBeInTheDocument();
  });

  it('shows the server error message when saving fails', async () => {
    mockGet.mockResolvedValue(schemaResponse);
    mockPost.mockRejectedValueOnce({ response: { data: { error: { message: 'Name must be unique' } } } });
    renderAt('/brands/new');

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Chanel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Name must be unique')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/ResourceFormPage.test.tsx`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/ResourceFormPage.test.tsx
git commit -m "test(admin): add ResourceFormPage coverage"
```

---

### Task 11: CatalogHub

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/CatalogHub.test.tsx`

**Interfaces:**
- Consumes: default export `CatalogHub` from `../src/pages/CatalogHub`. Uses the real `CATALOG_GROUPS` from `../src/config/navConfig` (not mocked) — 2 groups, 8 entity slugs total (`products, variants, variant-types, categories, brands, suppliers, customers, price-lists`).

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import CatalogHub from '../src/pages/CatalogHub';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

describe('CatalogHub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders group headings and per-entity counts once loaded', async () => {
    const counts: Record<string, number> = {
      products: 12, variants: 30, 'variant-types': 4, categories: 6,
      brands: 9, suppliers: 3, customers: 20, 'price-lists': 2,
    };
    const get = jest.fn().mockImplementation((url: string) => {
      const slug = url.split('/').pop() as string;
      return Promise.resolve({ data: { pagination: { total: counts[slug] ?? 0 } } });
    });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<CatalogHub />);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('Partners & Pricing')).toBeInTheDocument();
    expect(screen.getByText('Brands')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('shows a dash for an entity whose count request fails', async () => {
    const get = jest.fn().mockRejectedValue(new Error('boom'));
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<CatalogHub />);

    await waitFor(() => expect(screen.getAllByText('—').length).toBe(8));
  });

  it('navigates to the entity slug when a card is clicked', async () => {
    const get = jest.fn().mockResolvedValue({ data: { pagination: { total: 1 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<CatalogHub />);
    const brandsCard = (await screen.findByText('Brands')).closest('button') as HTMLElement;
    fireEvent.click(brandsCard);

    expect(mockNavigate).toHaveBeenCalledWith('brands');
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/CatalogHub.test.tsx`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/CatalogHub.test.tsx
git commit -m "test(admin): add CatalogHub coverage"
```

---

### Task 12: StockPurchase

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/StockPurchase.test.tsx`

**Interfaces:**
- Consumes: default export `StockPurchase` from `../src/pages/StockPurchase`.

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import StockPurchase from '../src/pages/StockPurchase';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

function mockClient() {
  const get = jest.fn().mockImplementation((url: string) => {
    if (url.endsWith('/resources/products')) return Promise.resolve({ data: { results: [{ documentId: 'p1', name: 'Serum' }] } });
    if (url.endsWith('/resources/suppliers')) return Promise.resolve({ data: { results: [{ documentId: 's1', name: 'Acme Co' }] } });
    if (url.endsWith('/resources/variants')) return Promise.resolve({ data: { results: [{ documentId: 'v1', label: '50ml', product: { documentId: 'p1' } }] } });
    return Promise.resolve({ data: { results: [] } });
  });
  const post = jest.fn().mockResolvedValueOnce({ data: { documentId: 'sb1' } });
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });
  return { get, post };
}

describe('StockPurchase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('walks the 3-step wizard and records a stock purchase', async () => {
    const { post } = mockClient();
    render(<StockPurchase />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByRole('option', { name: 'Serum' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '50ml' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText('Quantity purchased'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Cost price (USD)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Purchase date'), { target: { value: '2026-08-04' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Acme Co')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /record purchase/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/stock-batches', {
        quantityPurchased: 10, costPriceUsd: 5, purchaseDate: '2026-08-04', productionDate: null, expiryDate: null,
        variant: 'v1', supplier: 's1',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/plugins/inventory-dashboard/r/stock-batches');
  });

  it('cannot advance past the product step until all required fields are set', async () => {
    mockClient();
    render(<StockPurchase />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('calls onCancel from the embedded flow', async () => {
    mockClient();
    const onCancel = jest.fn();
    render(<StockPurchase embedded onCancel={onCancel} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/StockPurchase.test.tsx`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/StockPurchase.test.tsx
git commit -m "test(admin): add StockPurchase coverage"
```

---

### Task 13: OrderForm — draft-order wizard

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/tests/OrderForm.test.tsx` (this file also gets Task 14's describe block — write this task's block first, Task 14 appends the second block to the same file)

**Interfaces:**
- Consumes: default export `OrderForm` from `../src/pages/OrderForm`. Mocks `../src/hooks/useOrder` directly (`{ order, reload, confirm, cancel }`) rather than the network calls it makes internally — this isolates `OrderForm`'s own draft/line-item/FIFO logic from `useOrder`'s own already-tested wiring (Task 15 extends `hooks.test.tsx` for `useOrder`... actually `useOrder` itself is not in this plan's hook-extension task; only `useOverview`/`useResources` are — `useOrder` has its own real logic (`confirm`/`cancel` calling specific endpoints) worth a quick direct check too, folded into this task's setup instead of a separate file since `OrderForm` is its only consumer).

- [ ] **Step 1: Write the test file**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import OrderForm from '../src/pages/OrderForm';
import { useOrder } from '../src/hooks/useOrder';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
jest.mock('../src/hooks/useOrder');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

function mockClient() {
  const get = jest.fn().mockImplementation((url: string) => {
    if (url.endsWith('/resources/customers')) return Promise.resolve({ data: { results: [{ documentId: 'c1', name: 'Jane Doe', priceList: { documentId: 'pl1' } }] } });
    if (url.endsWith('/resources/products')) return Promise.resolve({ data: { results: [{ documentId: 'p1', name: 'Serum' }] } });
    if (url.endsWith('/resources/variants')) return Promise.resolve({ data: { results: [{ documentId: 'v1', label: '50ml', product: { documentId: 'p1' } }] } });
    if (url.startsWith('/inventory-dashboard/fifo/')) return Promise.resolve({ data: { segments: [{ batchDocumentId: 'batch1', costPriceUsd: 2, quantityFromBatch: 1 }], shortfall: 0 } });
    return Promise.resolve({ data: { results: [] } });
  });
  const post = jest.fn().mockImplementation((url: string) => {
    if (url.endsWith('/pricing/suggest')) return Promise.resolve({ data: { sellPrice: 150 } });
    if (url.endsWith('/resources/orders')) return Promise.resolve({ data: { documentId: 'o1' } });
    return Promise.resolve({ data: {} });
  });
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });
  return { get, post };
}

describe('OrderForm — new draft order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOrder as jest.Mock).mockReturnValue({ order: null, reload: jest.fn(), confirm: jest.fn(), cancel: jest.fn() });
  });

  it('blocks advancing past the customer step until a customer is selected', async () => {
    mockClient();
    render(<OrderForm />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('adds a FIFO-priced line item and only then allows advancing', async () => {
    mockClient();
    render(<OrderForm />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await waitFor(() => expect(screen.getByRole('option', { name: 'Serum' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '50ml' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'v1' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText('50ml')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('saves the draft order and its lines, then navigates to the order detail page', async () => {
    const { post } = mockClient();
    render(<OrderForm />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByRole('option', { name: 'Serum' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '50ml' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'v1' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await screen.findByText('50ml');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/plugins/inventory-dashboard/orders/o1'));
    expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/orders', {
      orderDate: expect.any(String), status: 'draft', discountAmount: 0, customer: 'c1', priceList: 'pl1',
    });
    expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/order-lines', {
      quantitySold: 1, sellPrice: 150, order: 'o1', stockBatch: 'batch1',
    });
  });
});
```

- [ ] **Step 2: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/OrderForm.test.tsx`
Expected: 3 passed (only the "new draft order" describe block exists after this task; Task 14 adds a second block to the same file — do not run the full-file expectation count until Task 14 is done).

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/OrderForm.test.tsx
git commit -m "test(admin): add OrderForm draft-order wizard coverage"
```

---

### Task 14: OrderForm — confirmed-order view

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/tests/OrderForm.test.tsx` (append a second `describe` block below the one from Task 13, in the same file, using the same top-of-file mocks — do not duplicate the `jest.mock` calls)

**Interfaces:**
- Consumes: same `OrderForm` default export. Forces the component into its internal (unexported) `ConfirmedOrderView` branch by mocking `useOrder` to return an `order` whose `status !== 'draft'`.

- [ ] **Step 1: Append the second describe block to the same file**

Add this below the closing `});` of the `describe('OrderForm — new draft order', ...)` block from Task 13, in the same `OrderForm.test.tsx` file (reusing the `mockNavigate`/`useFetchClient`/`useOrder` mocks already declared at the top of that file):

```tsx
const confirmedOrder = {
  documentId: 'o1abcdef', status: 'confirmed',
  lines: [{ documentId: 'l1', stockBatch: { documentId: 'batch12345' }, quantitySold: 2, sellPrice: 150, costPriceUsdSnapshot: 2, belowCost: false }],
  totals: { subtotal: 300, finalTotal: 300, netProfit: 250, totalPaid: 0, balanceDue: 300 },
};

function mockConfirmedClient() {
  const get = jest.fn().mockResolvedValue({ data: { results: [] } });
  const post = jest.fn().mockResolvedValue({ data: {} });
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });
  return { get, post };
}

describe('OrderForm — confirmed order view', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders totals, payment summary, and hides the below-cost flag when not below cost', () => {
    mockConfirmedClient();
    (useOrder as jest.Mock).mockReturnValue({ order: confirmedOrder, reload: jest.fn(), confirm: jest.fn(), cancel: jest.fn() });

    render(<OrderForm />);

    expect(screen.getByText('Subtotal: 300 | Final: 300 | Profit: 250')).toBeInTheDocument();
    expect(screen.getByText('Paid: 0 | Balance due: 300')).toBeInTheDocument();
    expect(screen.queryByText('Below cost')).not.toBeInTheDocument();
  });

  it('records a payment and reloads the order', async () => {
    const { post } = mockConfirmedClient();
    const mockReload = jest.fn();
    (useOrder as jest.Mock).mockReturnValue({ order: confirmedOrder, reload: mockReload, confirm: jest.fn(), cancel: jest.fn() });

    render(<OrderForm />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /add payment/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/payments', {
        amount: 100, method: 'cash', paymentDate: expect.any(String), order: 'o1abcdef',
      })
    );
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('cancels the order after confirming in the dialog', async () => {
    mockConfirmedClient();
    const mockCancel = jest.fn().mockResolvedValue({});
    (useOrder as jest.Mock).mockReturnValue({ order: confirmedOrder, reload: jest.fn(), confirm: jest.fn(), cancel: mockCancel });

    render(<OrderForm />);
    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    await waitFor(() => expect(mockCancel).toHaveBeenCalledTimes(1));
  });

  it('hides the cancel action and payment form for a cancelled order', () => {
    mockConfirmedClient();
    (useOrder as jest.Mock).mockReturnValue({
      order: { ...confirmedOrder, status: 'cancelled' }, reload: jest.fn(), confirm: jest.fn(), cancel: jest.fn(),
    });

    render(<OrderForm />);
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add payment/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the full file and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/OrderForm.test.tsx`
Expected: 7 passed (3 from Task 13's block + 4 from this block).

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/OrderForm.test.tsx
git commit -m "test(admin): add OrderForm confirmed-order view coverage"
```

---

### Task 15: hooks.test.tsx — useOverview and useResources, then full-suite review

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/tests/hooks.test.tsx`
- Modify: `docs/implementation.md`

**Interfaces:**
- Consumes: `useOverview` from `../src/hooks/useOverview` (`{ data, error, isInitialLoading, reload }`), `useResources` from `../src/hooks/useResources` (`{ resources, error }`). Both are thin wrappers around `useAsyncResource` + `useApi` — same `wrapper`/`mockGet`/`mockPut` setup already declared at the top of the existing `hooks.test.tsx` (see `admin/tests/hooks.test.tsx` from commit `91f8d34`) is reused, no new mocking pattern needed.

- [ ] **Step 1: Add imports at the top of the existing file**

In `src/plugins/inventory-dashboard/admin/tests/hooks.test.tsx`, add to the existing import block:

```tsx
import { useOverview } from '../src/hooks/useOverview';
import { useResources } from '../src/hooks/useResources';
```

- [ ] **Step 2: Add two new `describe` blocks inside the existing `describe('Admin Custom Hooks', ...)` block**, alongside the existing `useSettings`/`useSchema` blocks (same file, same `wrapper`, same `mockGet`):

```tsx
  describe('useOverview', () => {
    it('fetches the overview payload', async () => {
      mockGet.mockResolvedValueOnce({ data: { totalStockUnits: 10 } });

      const { result } = renderHook(() => useOverview(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual({ totalStockUnits: 10 });
      });
      expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/overview', { params: undefined });
      expect(result.current.isInitialLoading).toBe(false);
    });

    it('exposes the fetch error and lets reload retry', async () => {
      mockGet.mockRejectedValueOnce(new Error('network down'));
      const { result } = renderHook(() => useOverview(), { wrapper });

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

      mockGet.mockResolvedValueOnce({ data: { totalStockUnits: 5 } });
      await act(async () => {
        result.current.reload();
      });
      await waitFor(() => expect(result.current.data).toEqual({ totalStockUnits: 5 }));
    });
  });

  describe('useResources', () => {
    it('unwraps the resources array from the response', async () => {
      mockGet.mockResolvedValueOnce({ data: { resources: ['brands', 'categories'] } });

      const { result } = renderHook(() => useResources(), { wrapper });

      await waitFor(() => {
        expect(result.current.resources).toEqual(['brands', 'categories']);
      });
    });

    it('defaults to an empty array while loading', () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useResources(), { wrapper });
      expect(result.current.resources).toEqual([]);
    });
  });
```

- [ ] **Step 3: Run and verify pass**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest --config=admin/jest.config.js tests/hooks.test.tsx`
Expected: 6 passed (2 existing `useSettings`/`useSchema` tests + 4 new).

- [ ] **Step 4: Run the full frontend suite**

Run: `npm run test:front` (from repo root `d:\7meed\cosmtic`)
Expected: all 27 test files pass (13 existing + 14 new/modified from this plan), `test:ts:front` (tsc) reports no errors.

- [ ] **Step 5: Update `docs/implementation.md`**

Per repo `.claude/CLAUDE.md`, add an entry to `docs/implementation.md` recording: which components/pages/hooks gained test coverage in this pass (list all 14 files from this plan), the total test-file/test-case count added, and that the previously-flagged gap (wizard system + CRUD pages untested) is now closed. Follow the existing formatting/section style already used in that file for prior phases.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/tests/hooks.test.tsx docs/implementation.md
git commit -m "test(admin): add useOverview/useResources coverage; update implementation.md"
```

---

## Self-Review Notes

- **Spec coverage:** every file named in the original gap (WizardShell, AddNewModal, ProductVariantsForm, InlineResourceForm, QuickCreateSelect, RelationSelect, FieldRenderer, OrdersList, OrderForm, ResourceListPage, ResourceFormPage, CatalogHub, StockPurchase, useOrder [via OrderForm's mock + its own confirm/cancel exercised in Task 14], useOverview, useResources) has a task. `*Standalone` wrappers and `AppShell`/`AppSidebar` are explicitly called out as out of scope in File Structure so no task is missing for them by omission.
- **Placeholder scan:** every task step contains complete, real test code — no "TODO"/"add appropriate assertions" placeholders.
- **Type consistency:** mock shapes (`{ get, post, put, del }` for `useFetchClient`; `{ order, reload, confirm, cancel }` for `useOrder`; `{ schema, error, reload }` for `useSchema`) match the real hook return types read from source, and are reused identically across tasks that touch the same hook.
