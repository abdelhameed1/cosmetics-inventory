# Chakra UI Reskin of the Inventory Dashboard Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every UI component in the `inventory-dashboard` Strapi plugin's admin screens with Chakra UI, restyled in a Purity-UI-Dashboard-inspired look, with zero business-logic or behavior regressions.

**Architecture:** `ChakraProvider` (via a shared `ChakraRoot` wrapper, `resetCSS={false}`) is mounted at every top-level entry point the plugin registers with Strapi — there are **three**, not one (see Task 1). A small shared component library (`PageHeader`, `StatCard`, `DataTable`, `FormField`) is built once and reused by every screen. `hooks/`, `utils/api.ts`, and `utils/getTranslation.ts` are pure business logic and are not touched by any task.

**Tech Stack:** Chakra UI v2 (`@chakra-ui/react` `^2.8.2`), Emotion (`@emotion/react`/`@emotion/styled`, Chakra's peer deps), `framer-motion` (Chakra's animation peer dep), `react-icons` (icon set, `react-icons/fi` — Feather icons), React 18, react-router-dom v6 (all pre-existing, unchanged).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-chakra-ui-reskin-design.md` — every task's per-screen requirements are drawn from its §6 "behavior inventory." When a step references "the spec," this is the file.
- Use **Chakra UI v2**, not v3 — pin `@chakra-ui/react` with a `^2.x` caret range. v3 uses a different API (no `extendTheme`, no `NumberInputField`) and would invalidate every code sample in this plan.
- `ChakraProvider` must be created with `resetCSS={false}` everywhere it's instantiated (there is only one place: `ChakraRoot`, Task 1) — Chakra's default CSS reset targets `html`/`body`/form elements globally and would leak onto Strapi's own admin shell (nav, top bar, Content Manager), which is mounted in the same DOM tree.
- Never put background/color/typography defaults in the theme's `styles.global` key — that targets the real `document.body` regardless of `resetCSS`, which would leak onto Strapi's shell exactly like the CSS reset would. Any page-level background belongs on `ChakraRoot`'s own wrapping `Box`, which is scoped to the plugin's mounted subtree only.
- No automated admin/front-end test suite exists for this plugin today, and none is being added by this plan (an explicit, already-approved scope decision — see spec §8). Each task's verification is: `test:ts:front` (tsc, strict) clean → plugin `npm run build` succeeds → manual browser click-through of that task's specific behavior checklist. Treat the manual click-through as a real gate, not an optional nicety — it is the only thing standing between this rewrite and a silently-dropped business rule.
- **Strapi loads the plugin from its built `dist/`, not from `admin/src` directly.** After every task's code changes, run `npm run build` inside `src/plugins/inventory-dashboard` *before* starting/refreshing the dev server to manually verify — stale `dist/` is the #1 cause of "my change isn't showing up."
- All commands in this plan run from `d:\7meed\cosmtic` (the Strapi app root) unless a step explicitly `cd`s into `src/plugins/inventory-dashboard`.
- Out of scope, do not touch: `admin/src/hooks/*`, `admin/src/utils/api.ts`, `admin/src/utils/getTranslation.ts`, `admin/src/pluginId.ts`, `admin/src/components/Initializer.tsx`, `admin/src/components/PluginIcon.tsx`, `admin/src/translations/*`, anything under `server/`, anything under `src/api/`. `@strapi/design-system`/`@strapi/icons` stay installed (used by `Page.Error` and the plugin's own nav-menu icons in `index.ts`, both out of scope).
- Environment: Node v20.19.6, npm 10.8.2 (already installed; no version changes needed).

---

### Task 1: Foundation — Chakra dependencies, theme, ChakraRoot, wire into all 3 entry points

The plugin registers **three independent top-level components** with Strapi's admin (`admin/src/index.ts`): the main `App` router (mounted at `/plugins/inventory-dashboard`), and `StockPurchase`/`OrderForm` **each also registered standalone** (mounted at `/plugins/inventory-stock` and `/plugins/inventory-orders` — these are the actual "Stock purchase" and "New Order" left-nav links a user clicks). Strapi mounts each `addMenuLink` `Component` as its own render root — `StockPurchase`/`OrderForm` reached this way do **not** pass through `App.tsx`. If `ChakraProvider` only wrapped `App.tsx`, every Chakra component on the standalone Stock Purchase / New Order screens would render with no provider ancestor. This task creates a shared `ChakraRoot` wrapper and wires it into all three entry points via two new thin "Standalone" wrapper files, so `StockPurchase.tsx`/`OrderForm.tsx` themselves (converted to Chakra in Tasks 8 and 10) never need to know or care which entry point rendered them.

**Files:**
- Modify: `src/plugins/inventory-dashboard/package.json`
- Create: `src/plugins/inventory-dashboard/admin/src/theme/index.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/App.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchaseStandalone.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/pages/OrderFormStandalone.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/index.ts`

**Interfaces:**
- Produces: `theme` (default export, `admin/src/theme/index.ts`) — a Chakra `Theme` object built with `extendTheme`.
- Produces: `ChakraRoot({ children }: { children: React.ReactNode })` (named export, `admin/src/components/ChakraRoot.tsx`) — every later task that needs a Chakra component ancestor renders inside this.
- Consumes: nothing from other tasks (this is the first task).

- [ ] **Step 1: Add Chakra dependencies to the plugin's `package.json`**

Open `src/plugins/inventory-dashboard/package.json`. In the `dependencies` object, add (alongside the existing empty `{}` — it currently has none, so this is the first content):

```json
  "dependencies": {
    "@chakra-ui/react": "^2.8.2",
    "@emotion/react": "^11.13.3",
    "@emotion/styled": "^11.13.0",
    "framer-motion": "^11.11.17",
    "react-icons": "^5.3.0"
  },
```

In `devDependencies`, no change needed (Chakra ships its own types). In `peerDependencies`, add the same five packages at the same versions, mirroring how `@strapi/design-system` is already declared there:

```json
  "peerDependencies": {
    "@strapi/strapi": "^5.49.0",
    "@strapi/sdk-plugin": "^6.1.1",
    "@strapi/utils": "^5.49.0",
    "@strapi/design-system": "^2.2.1",
    "@strapi/icons": "^2.2.1",
    "react-intl": "^6.8.9",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.4",
    "styled-components": "^6.4.3",
    "@chakra-ui/react": "^2.8.2",
    "@emotion/react": "^11.13.3",
    "@emotion/styled": "^11.13.0",
    "framer-motion": "^11.11.17",
    "react-icons": "^5.3.0"
  },
```

- [ ] **Step 2: Install the new dependencies**

Run:
```bash
cd src/plugins/inventory-dashboard
npm install
```
Expected: install completes with no errors. `node_modules/@chakra-ui`, `node_modules/@emotion`, `node_modules/framer-motion`, `node_modules/react-icons` now exist.

- [ ] **Step 3: Create the theme file**

Create `src/plugins/inventory-dashboard/admin/src/theme/index.ts`:

```ts
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#eef4ff',
      100: '#d9e6ff',
      200: '#b3ccff',
      300: '#82adff',
      400: '#4d8bff',
      500: '#2563eb',
      600: '#1d4fc4',
      700: '#173e99',
      800: '#122e73',
      900: '#0c1f4d',
    },
  },
  fonts: {
    heading: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  },
  components: {
    Button: {
      baseStyle: { borderRadius: 'lg', fontWeight: 'semibold' },
      defaultProps: { colorScheme: 'brand' },
    },
    Badge: {
      baseStyle: { borderRadius: 'md', px: 2, py: 0.5 },
    },
    Table: {
      variants: {
        simple: {
          th: {
            color: 'gray.500',
            fontSize: 'xs',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
            borderColor: 'gray.100',
          },
          td: { borderColor: 'gray.100' },
        },
      },
    },
  },
});

export default theme;
```

Note there is deliberately no `styles.global` key — see the Global Constraints section above for why.

- [ ] **Step 4: Create the `ChakraRoot` wrapper**

Create `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`:

```tsx
import { ChakraProvider, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import theme from '../theme';

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider theme={theme} resetCSS={false}>
      <Box bg="gray.50" color="gray.800" minH="100%">
        {children}
      </Box>
    </ChakraProvider>
  );
}
```

The background/text-color styling lives on this `Box`, scoped to whatever is mounted inside it — not on `document.body` — so it cannot leak onto Strapi's own shell.

- [ ] **Step 5: Wrap `App.tsx`'s routes in `ChakraRoot`**

Modify `src/plugins/inventory-dashboard/admin/src/pages/App.tsx` to its full new contents:

```tsx
import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';
import StockPurchase from './StockPurchase';
import OrderForm from './OrderForm';
import { ChakraRoot } from '../components/ChakraRoot';

const App = () => {
  return (
    <ChakraRoot>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="stock-purchase" element={<StockPurchase />} />
        <Route path="orders/new" element={<OrderForm />} />
        <Route path="orders/:id" element={<OrderForm />} />
        <Route path="r/:resource" element={<ResourceListPage />} />
        <Route path="r/:resource/new" element={<ResourceFormPage />} />
        <Route path="r/:resource/:id" element={<ResourceFormPage />} />
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </ChakraRoot>
  );
};

export default App;
```

(This is only the `ChakraRoot` import + wrap — the route table itself is unchanged.)

- [ ] **Step 6: Create the standalone-entry wrapper for Stock Purchase**

Create `src/plugins/inventory-dashboard/admin/src/pages/StockPurchaseStandalone.tsx`:

```tsx
import { ChakraRoot } from '../components/ChakraRoot';
import StockPurchase from './StockPurchase';

export default function StockPurchaseStandalone() {
  return (
    <ChakraRoot>
      <StockPurchase />
    </ChakraRoot>
  );
}
```

- [ ] **Step 7: Create the standalone-entry wrapper for Order Form**

Create `src/plugins/inventory-dashboard/admin/src/pages/OrderFormStandalone.tsx`:

```tsx
import { ChakraRoot } from '../components/ChakraRoot';
import OrderForm from './OrderForm';

export default function OrderFormStandalone() {
  return (
    <ChakraRoot>
      <OrderForm />
    </ChakraRoot>
  );
}
```

- [ ] **Step 8: Point the standalone menu links at the new wrapper files**

In `src/plugins/inventory-dashboard/admin/src/index.ts`, change the two standalone `addMenuLink` calls' `Component` value. Find:

```ts
      Component: () => import("./pages/StockPurchase"),
```
Replace with:
```ts
      Component: () => import("./pages/StockPurchaseStandalone"),
```

Find:
```ts
      Component: () => import("./pages/OrderForm"),
```
Replace with:
```ts
      Component: () => import("./pages/OrderFormStandalone"),
```

The main `Component: () => import("./pages/App")` registration (for the "Inventory" link) is unchanged — `App.tsx` already wraps itself in `ChakraRoot` from Step 5.

- [ ] **Step 9: Type-check**

Run:
```bash
npm run test:ts:front
```
(still inside `src/plugins/inventory-dashboard`)
Expected: clean, no errors. (`StockPurchase.tsx`/`OrderForm.tsx` still export their original Strapi-DS-based components at this point — that's fine, they compile and render unchanged, just now nested one level deeper inside a `ChakraRoot` that nothing yet uses.)

- [ ] **Step 10: Build the plugin**

Run:
```bash
npm run build
```
Expected: `strapi-plugin build` completes successfully, `dist/admin` and `dist/server` are refreshed.

- [ ] **Step 11: Manual verification in the browser**

Run (from the app root `d:\7meed\cosmtic`, in a separate terminal if the dev server isn't already running):
```bash
npm run develop
```
Open the Strapi admin in a browser and check all three entry points still render (they'll still look exactly like the old Strapi-design-system UI — nothing visual changes yet, this step is purely to confirm nothing broke):
- The "Inventory" left-nav link → Overview page loads normally.
- The "Stock purchase" left-nav link → the stock purchase form loads normally.
- The "New Order" left-nav link → the order form loads normally.
- Strapi's own left nav, top bar, and the Content Manager (click any content type under "Content Manager" in the main nav) look completely unaffected — no unexpected background color, spacing, or font changes bleeding in from the newly-mounted `ChakraProvider`. This is the concrete check for the `resetCSS={false}` + scoped-`Box` risk called out in the spec.

- [ ] **Step 12: Commit**

```bash
git add src/plugins/inventory-dashboard/package.json src/plugins/inventory-dashboard/package-lock.json src/plugins/inventory-dashboard/admin/src/theme src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx src/plugins/inventory-dashboard/admin/src/pages/App.tsx src/plugins/inventory-dashboard/admin/src/pages/StockPurchaseStandalone.tsx src/plugins/inventory-dashboard/admin/src/pages/OrderFormStandalone.tsx src/plugins/inventory-dashboard/admin/src/index.ts
git commit -m "feat(plugin/admin): add Chakra UI foundation and wire into all 3 entry points"
```
(If there is no `package-lock.json` inside the plugin directory — this plugin may share the app root's lockfile — omit that path from the `git add`.)

---

### Task 2: Shared UI primitives

Builds the small component library every later screen reuses: `PageHeader`, `StatCard`, `DataTable`, `FormField`. Nothing consumes these yet — this task just needs to compile cleanly.

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx`

**Interfaces:**
- Consumes: nothing beyond `@chakra-ui/react` itself.
- Produces:
  - `PageHeader({ title, actions }: { title: string; actions?: ReactNode })`
  - `StatCard({ label, value }: { label: string; value: string })`
  - `DataTable({ columns, isEmpty, emptyLabel, children }: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode })`
  - `FormField({ label, required, children, ...rest }: { label: string; required?: boolean; children: ReactNode } & FormControlProps)`
  - All four are named exports, consumed starting in Task 3.

- [ ] **Step 1: Create `PageHeader`**

Create `src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx`:

```tsx
import { Flex, Heading, HStack } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" mb={6}>
      <Heading size="lg" color="gray.800" textTransform="capitalize">{title}</Heading>
      {actions && <HStack spacing={2}>{actions}</HStack>}
    </Flex>
  );
}
```

- [ ] **Step 2: Create `StatCard`**

Create `src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx`:

```tsx
import { Box, Text } from '@chakra-ui/react';

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="white" borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100" p={5}>
      <Text fontSize="sm" color="gray.500" fontWeight="medium">{label}</Text>
      <Text fontSize="2xl" fontWeight="bold" color="gray.800" mt={1}>{value}</Text>
    </Box>
  );
}
```

- [ ] **Step 3: Create `DataTable`**

Create `src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx`:

```tsx
import { Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function DataTable({
  columns, isEmpty, emptyLabel = 'No records found', children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
  return (
    <TableContainer bg="white" borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
      <Table variant="simple">
        <Thead bg="gray.50">
          <Tr>
            {columns.map((c) => <Th key={c}>{c}</Th>)}
          </Tr>
        </Thead>
        <Tbody>
          {isEmpty ? (
            <Tr>
              <Td colSpan={columns.length}>
                <Text color="gray.500" textAlign="center" py={6}>{emptyLabel}</Text>
              </Td>
            </Tr>
          ) : children}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
```

Caller passes `columns` (header labels) and renders its own `<Tr>`/`<Td>` rows as `children` — `DataTable` only owns the header chrome and the empty-state fallback, since each screen's row content differs too much (editable cells, badges, action buttons) for a fully generic row renderer to be worth building.

- [ ] **Step 4: Create `FormField`**

Create `src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx`:

```tsx
import { FormControl, FormLabel, type FormControlProps } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function FormField({
  label, required, children, ...rest
}: { label: string; required?: boolean; children: ReactNode } & FormControlProps) {
  return (
    <FormControl isRequired={required} {...rest}>
      <FormLabel textTransform="capitalize">{label}</FormLabel>
      {children}
    </FormControl>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 6: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ui
git commit -m "feat(plugin/admin): add shared Chakra UI primitives (PageHeader, StatCard, DataTable, FormField)"
```

---

### Task 3: RelationSelect → Chakra

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`

**Interfaces:**
- Consumes: `FormField` (Task 2, `../components/ui/FormField`).
- Produces: `RelationSelect({ field, value, onChange }: { field: FieldMeta; value: any; onChange: (v: any) => void })` — **identical signature to the original**, so `FieldRenderer` (Task 4) needs no interface changes when it switches to consuming this.

- [ ] **Step 1: Rewrite `RelationSelect.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Select } from '@chakra-ui/react';
import { FormField } from './ui/FormField';
import { useApi, type FieldMeta } from '../utils/api';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const [options, setOptions] = useState<any[]>([]);
  const targetSlug = field.relation?.resource;

  useEffect(() => {
    if (!targetSlug) return;
    api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 })
      .then((d) => setOptions(d.results))
      .catch(() => setOptions([]));
  }, [targetSlug]);

  const selected = value?.documentId ?? value ?? '';

  return (
    <FormField label={field.name} required={field.required}>
      <Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Select ${field.name}`}
        bg="white"
      >
        {options.map((o) => {
          const label = String(
            o[field.relation?.mainField ?? 'name'] ?? o.name ?? o.label ?? o.documentId ?? o.id
          );
          return (
            <option key={o.documentId} value={o.documentId}>
              {label}
            </option>
          );
        })}
      </Select>
    </FormField>
  );
}
```

Behavior preserved exactly: fetches up to 100 options for the relation's target resource on mount/when `targetSlug` changes, no search/pagination (documented existing limitation, not being fixed here), label fallback chain `mainField → name → label → documentId/id`.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean. (Nothing imports `RelationSelect` with the new signature yet since `FieldRenderer` hasn't changed — this just confirms the file itself compiles.)

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx
git commit -m "feat(plugin/admin): migrate RelationSelect to Chakra UI"
```

---

### Task 4: FieldRenderer → Chakra

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx`

**Interfaces:**
- Consumes: `RelationSelect` (Task 3, `./RelationSelect`), `FormField` (Task 2, `./ui/FormField`).
- Produces: `FieldRenderer({ field, value, onChange }: { field: FieldMeta; value: any; onChange: (v: any) => void })` — **identical signature to the original**; `ResourceFormPage` (Task 6) needs no changes to how it calls this.

- [ ] **Step 1: Rewrite `FieldRenderer.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx`:

```tsx
import {
  Input, Textarea, NumberInput, NumberInputField, Switch, Select,
} from '@chakra-ui/react';
import { FormField } from './ui/FormField';
import { RelationSelect } from './RelationSelect';
import { type FieldMeta } from '../utils/api';

export function FieldRenderer({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  if (field.hidden) return null;

  switch (field.type) {
    case 'text':
      return (
        <FormField label={field.name} required={field.required}>
          <Textarea
            bg="white"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          />
        </FormField>
      );
    case 'integer':
    case 'decimal':
    case 'biginteger':
    case 'float':
      return (
        <FormField label={field.name} required={field.required}>
          <NumberInput
            value={value ?? ''}
            onChange={(_, valueAsNumber) => onChange(Number.isNaN(valueAsNumber) ? undefined : valueAsNumber)}
          >
            <NumberInputField bg="white" />
          </NumberInput>
        </FormField>
      );
    case 'boolean':
      return (
        <FormField label={field.name} required={field.required}>
          <Switch
            isChecked={Boolean(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          />
        </FormField>
      );
    case 'date':
      return (
        <FormField label={field.name} required={field.required}>
          <Input
            bg="white"
            type="date"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value || null)}
          />
        </FormField>
      );
    case 'datetime':
      return (
        <FormField label={field.name} required={field.required}>
          <Input
            bg="white"
            type="datetime-local"
            value={value ? toDateTimeLocal(value) : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </FormField>
      );
    case 'enumeration':
      return (
        <FormField label={field.name} required={field.required}>
          <Select bg="white" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {(field.values ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </FormField>
      );
    case 'relation':
      return <RelationSelect field={field} value={value} onChange={onChange} />;
    default:
      return (
        <FormField label={field.name} required={field.required}>
          <Input
            bg="white"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          />
        </FormField>
      );
  }
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

Note the `date`/`datetime` cases now bind directly to the `yyyy-mm-dd` / `yyyy-mm-ddThh:mm` string a native `<input type="date">`/`<input type="datetime-local">` produces — the original's `formatLocalDate`/`parseLocalDate` round-trip through a `Date` object (needed for Strapi's `DatePicker`, which wanted a `Date`) is no longer needed for the `date` case and is dropped. `datetime` still needs a small local helper (`toDateTimeLocal`) to format an ISO string into what the native input expects.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx
git commit -m "feat(plugin/admin): migrate FieldRenderer to Chakra UI"
```

---

### Task 5: ResourceListPage → Chakra

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `DataTable` (Task 2).
- Produces: default export, a leaf route component — nothing else depends on its exports.

- [ ] **Step 1: Rewrite `ResourceListPage.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, IconButton, Input,
  InputGroup, InputLeftElement, InputRightElement, Text, Td, Tr,
} from '@chakra-ui/react';
import { FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { schema } = useSchema(resource);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const visibleFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden).slice(0, 6),
    [schema]
  );

  const load = () => {
    api
      .get<{ results: any[] }>(`/resources/${resource}`, { search, pageSize: 100 })
      .then((d) => setRows(d.results))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => { if (resource) load(); /* eslint-disable-next-line */ }, [resource, search]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.del(`/resources/${resource}/${toDelete.documentId}`);
      setToDelete(null);
      setError(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Delete failed');
      setToDelete(null);
    }
  };

  return (
    <Box p={8}>
      <PageHeader
        title={resource}
        actions={<Button onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/new`)}>New</Button>}
      />

      <Box pb={4}>
        <InputGroup maxW="sm">
          <InputLeftElement pointerEvents="none"><FiSearch color="gray" /></InputLeftElement>
          <Input
            aria-label="Search"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg="white"
          />
          {search && (
            <InputRightElement>
              <IconButton
                aria-label="Clear search"
                icon={<FiX />}
                size="sm"
                variant="ghost"
                onClick={() => setSearch('')}
              />
            </InputRightElement>
          )}
        </InputGroup>
      </Box>

      {error && <Text color="red.600" pb={4}>{error}</Text>}

      <DataTable
        columns={[...visibleFields.map((f) => f.name), 'Actions']}
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <Tr
            key={row.documentId}
            cursor="pointer"
            _hover={{ bg: 'gray.50' }}
            onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/${row.documentId}`)}
          >
            {visibleFields.map((f) => (
              <Td key={f.name}>{renderCell(row[f.name])}</Td>
            ))}
            <Td onClick={(e) => e.stopPropagation()}>
              <IconButton
                aria-label="Delete"
                icon={<FiTrash2 />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => setToDelete(row)}
              />
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog isOpen={!!toDelete} leastDestructiveRef={cancelRef} onClose={() => setToDelete(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Confirm delete</AlertDialogHeader>
            <AlertDialogBody>Delete this record? This cannot be undone.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

function renderCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const v: any = value;
    return v.name ?? v.label ?? v.documentId ?? JSON.stringify(v);
  }
  return String(value);
}
```

Behavior preserved exactly: columns derived dynamically from schema (first 6 non-hidden fields), search re-fetches on every keystroke (no debounce, matches original), row click navigates to edit, delete button stops propagation, delete requires `AlertDialog` confirmation (Chakra's purpose-built destructive-confirm dialog, replacing Strapi's generic `Dialog`), failed delete shows an inline error and closes the dialog, cell rendering falls back `name → label → documentId → JSON.stringify`.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx
git commit -m "feat(plugin/admin): migrate ResourceListPage to Chakra UI"
```

---

### Task 6: ResourceFormPage → Chakra

This is the first task with a full manual CRUD verification pass, since `ResourceFormPage` + `ResourceListPage` (Task 5) + `FieldRenderer` (Task 4) + `RelationSelect` (Task 3) together form the complete generic CRUD loop used by every non-bespoke resource (brands, categories, suppliers, customers, price lists, variants, stock-batches, payments).

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2), `FieldRenderer` (Task 4). Still renders `ProductVariantsForm` (unchanged Strapi-DS component until Task 9) for the `products`-create special case — this is fine; the two component trees don't share Chakra context requirements, they're just conditionally rendered alternatives.
- Produces: default export, a leaf route component.

- [ ] **Step 1: Rewrite `ResourceFormPage.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';

export default function ResourceFormPage() {
  const { resource = '', id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
  const { schema } = useSchema(resource);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const editableFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden),
    [schema]
  );

  useEffect(() => {
    if (isEdit && resource) {
      api.get(`/resources/${resource}/${id}`).then((rec) => setValues(normalize(rec)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, resource, id]);

  const setField = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    try {
      const payload = serialize(values, editableFields);
      if (isEdit) {
        await api.put(`/resources/${resource}/${id}`, payload);
      } else {
        await api.post(`/resources/${resource}`, payload);
      }
      navigate(`/plugins/inventory-dashboard/r/${resource}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Save failed');
    }
  };

  // Bespoke product-with-variants flow on create
  if (resource === 'products' && !isEdit) {
    return <ProductVariantsForm onDone={() => navigate('/plugins/inventory-dashboard/r/products')} />;
  }

  return (
    <Box p={8}>
      <PageHeader title={isEdit ? `Edit ${resource}` : `New ${resource}`} />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        {editableFields.map((f) => (
          <GridItem key={f.name} colSpan={6}>
            <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
          </GridItem>
        ))}
      </Grid>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit}>Save</Button>
        <Button variant="ghost" onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}`)}>Cancel</Button>
      </HStack>
    </Box>
  );
}

function normalize(rec: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(rec ?? {})) {
    out[k] = v && typeof v === 'object' && 'documentId' in (v as any) ? (v as any).documentId : v;
  }
  return out;
}

function serialize(values: Record<string, any>, fields: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (values[f.name] === undefined) continue;
    out[f.name] = values[f.name];
  }
  return out;
}
```

`normalize()`/`serialize()` are unchanged (pure data transforms, not a view concern). The `resource === 'products' && !isEdit` branch to `ProductVariantsForm` is preserved exactly.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Manual verification — full generic CRUD cycle**

With `npm run develop` running (app root), in the browser:
1. Go to a simple resource, e.g. **Brands** (via Inventory → left nav or `r/brands`). Confirm the list renders with dynamic columns, "New" button, and search box (all restyled).
2. Click **New**, fill in the name, click **Save**. Confirm it navigates back to the list and the new row appears.
3. Click the new row, change a field, click **Save**. Confirm the edit persisted (revisit the list or the row again).
4. Click the delete icon on a row you don't need. Confirm the `AlertDialog` appears, **Cancel** closes it with no change, and re-opening + **Delete** removes the row.
5. Repeat steps 1–4 on a resource with at least one **relation** field, e.g. **Customers** (has a `priceList` relation) — confirm the relation dropdown loads and shows options with a sensible label, and that saving with a relation selected persists correctly.
6. Try deleting a **Brand** that has products attached (or a **Price List** assigned to a customer) — confirm the existing deletion-guard error message (from the content-type lifecycle, not this task) still surfaces inline via the error `Text`, not a blank failure.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
git commit -m "feat(plugin/admin): migrate ResourceFormPage to Chakra UI"
```

---

### Task 7: Overview → Chakra

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `StatCard`, `DataTable`, `FormField` (Task 2).
- Produces: default export, a leaf route component.

- [ ] **Step 1: Rewrite `Overview.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';

export default function Overview() {
  const { data, loading, error, reload } = useOverview();
  const { exchangeRate, exchangeRateUpdatedAt, save } = useSettings();
  const [rateInput, setRateInput] = useState<number | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeRate != null) setRateInput(exchangeRate);
  }, [exchangeRate]);

  const onSaveRate = async () => {
    setSaveError(null);
    if (rateInput == null || Number.isNaN(rateInput)) {
      setSaveError('Enter a valid exchange rate');
      return;
    }
    try {
      await save(rateInput);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? 'Could not save rate');
    }
  };

  if (error) {
    return (
      <Box p={8}>
        <Text color="red.600">Could not load overview data</Text>
      </Box>
    );
  }

  if (loading || !data) return <Box p={8}><Text>Loading…</Text></Box>;

  return (
    <Box p={8}>
      <PageHeader title="Overview" />

      <Box pb={6}>
        <HStack spacing={2} align="flex-end">
          <FormField label="Exchange rate (EGP per USD)" maxW="xs">
            <NumberInput value={rateInput ?? ''} onChange={(_, v) => setRateInput(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>Save rate</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="gray.500" pt={1}>Updated: {exchangeRateUpdatedAt}</Text>
        )}
        {saveError && <Text color="red.600" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={4} spacing={4}>
        <StatCard label="Total stock units" value={String(data.totalStockUnits)} />
        <StatCard label="Stock value (USD)" value={`$${data.stockValueUsd.toFixed(2)}`} />
        <StatCard label="Stock value (EGP)" value={`E£${data.stockValueEgp.toFixed(2)}`} />
        <StatCard label="Exchange rate" value={String(data.exchangeRate)} />
      </SimpleGrid>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2}>Low stock</Text>
        <DataTable columns={['Variant', 'Qty', 'Threshold']} isEmpty={data.lowStock.length === 0}>
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={6}>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={2}>Expired</Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={2}>Expiring soon (90 days)</Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
```

Behavior preserved exactly: loading state, fetch-error state, rate pre-fill + save + `exchangeRateUpdatedAt` display + save-error display, 4 stat cards, low-stock table, expired (red) / expiring-soon (orange) lists keyed by `batchId`.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Manual verification**

In the browser, open the Overview page:
1. Confirm the 4 stat cards, exchange rate input + Save, and low-stock table render with real data.
2. Change the exchange rate, click **Save rate**, confirm `exchangeRateUpdatedAt` updates and the stat cards' EGP values change on reload.
3. If there is at least one variant with stock below its `lowStockThreshold`, confirm it appears in the Low stock table. If there is at least one expired or expiring-soon batch, confirm it appears in the correct (red/orange) list.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
git commit -m "feat(plugin/admin): migrate Overview to Chakra UI"
```

---

### Task 8: StockPurchase → Chakra

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `FormField` (Task 2).
- Produces: `StockPurchase` default export — **must remain a bare component with no self-wrapping `ChakraRoot`** (it's consumed both by `StockPurchaseStandalone` and by `App.tsx`'s own `<Route>`, both already wrapped in `ChakraRoot` from Task 1 — a self-wrap here would double-nest `ChakraProvider` in the `App.tsx` case).

- [ ] **Step 1: Rewrite `StockPurchase.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, GridItem, HStack, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';

export default function StockPurchase() {
  const api = useApi();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [qty, setQty] = useState<number | undefined>();
  const [cost, setCost] = useState<number | undefined>();
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [productionDate, setProductionDate] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    api.get<{ results: any[] }>('/resources/suppliers', { pageSize: 100 }).then((d) => setSuppliers(d.results));
  }, []);

  useEffect(() => {
    if (!productId) { setVariants([]); return; }
    api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 }).then((d) =>
      setVariants(d.results.filter((v) => v.product?.documentId === productId))
    );
    setVariantId('');
  }, [productId]);

  const submit = async () => {
    setError(null);
    try {
      await api.post('/resources/stock-batches', {
        quantityPurchased: qty,
        costPriceUsd: cost,
        purchaseDate,
        productionDate,
        expiryDate,
        variant: variantId,
        supplier: supplierId,
      });
      navigate('/plugins/inventory-dashboard/r/stock-batches');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not record purchase');
    }
  };

  return (
    <Box p={8}>
      <PageHeader title="Record stock purchase" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        <GridItem colSpan={4}>
          <FormField label="Product">
            <Select bg="white" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Select product">
              {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Variant">
            <Select
              bg="white"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              isDisabled={!productId}
              placeholder="Select variant"
            >
              {variants.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</option>)}
            </Select>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Supplier">
            <Select bg="white" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
              {suppliers.map((s) => <option key={s.documentId} value={s.documentId}>{s.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Quantity purchased">
            <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Cost price (USD)">
            <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={4} />
        <GridItem colSpan={4}>
          <FormField label="Purchase date">
            <Input bg="white" type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Production date">
            <Input bg="white" type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Expiry date">
            <Input bg="white" type="date" value={expiryDate ?? ''} onChange={(e) => setExpiryDate(e.target.value || null)} />
          </FormField>
        </GridItem>
      </Grid>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit} isDisabled={!variantId || !supplierId || !qty || !cost || !purchaseDate}>
          Record purchase
        </Button>
      </HStack>
    </Box>
  );
}
```

The `formatLocalDate`/`parseLocalDate` helpers are dropped entirely — the three date fields now bind directly to the `yyyy-mm-dd` string the native date input produces, which is exactly the format the API already expects.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Manual verification — both entry points**

In the browser:
1. Click the **"Stock purchase"** left-nav link (the standalone entry, `/plugins/inventory-stock`). Confirm it renders correctly (this exercises `StockPurchaseStandalone` from Task 1 for the first time with real Chakra content).
2. Pick a product, confirm the variant dropdown populates with only that product's variants and resets when you change product.
3. Leave a required field empty, confirm **Record purchase** stays disabled; fill in variant, supplier, quantity, cost, and purchase date, confirm it enables.
4. Submit, confirm it navigates to the Stock Batches list and the new batch appears.
5. Navigate directly to `/plugins/inventory-dashboard/stock-purchase` (the nested `App.tsx` route) and confirm the same form renders correctly there too (exercises the double-entry-point path from the other direction).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
git commit -m "feat(plugin/admin): migrate StockPurchase to Chakra UI"
```

---

### Task 9: ProductVariantsForm → Chakra

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `FormField` (Task 2, note the relative path is `../components/ui/...` from `pages/` but `./ui/...` from `components/` — this file lives in `components/`, so imports are `./ui/PageHeader` etc.).
- Produces: `ProductVariantsForm({ onDone }: { onDone: () => void })` — identical signature, already consumed correctly by `ResourceFormPage` (Task 6).

- [ ] **Step 1: Rewrite `ProductVariantsForm.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Box, Button, Grid, GridItem, HStack, IconButton, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';

interface VariantRow { label: string; variantTypeId: string; lowStockThreshold?: number; }

export default function ProductVariantsForm({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [variantTypes, setVariantTypes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/brands', { pageSize: 100 }).then((d) => setBrands(d.results));
    api.get<{ results: any[] }>('/resources/categories', { pageSize: 100 }).then((d) => setCategories(d.results));
    api.get<{ results: any[] }>('/resources/variant-types', { pageSize: 100 }).then((d) => setVariantTypes(d.results));
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRow = () => setRows((r) => [...r, { label: '', variantTypeId: '' }]);
  const updateRow = (i: number, patch: Partial<VariantRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = async () => {
    setError(null);
    // Only submit rows the user actually filled in. A non-default variant must
    // have a variant type (enforced by the variant lifecycle), so reject any
    // partially-filled row up front — otherwise the POST would throw mid-loop,
    // after the product and earlier variants are already persisted, leaving a
    // half-built product behind with no rollback.
    const explicitVariants = rows.filter((r) => r.label.trim() || r.variantTypeId);
    if (explicitVariants.some((r) => !r.variantTypeId)) {
      setError('Each variant needs a type.');
      return;
    }
    try {
      // 1) create product (auto-creates one default variant)
      const product = await api.post<any>('/resources/products', {
        name, brand: brandId, category: categoryId,
        relatedProducts: relatedIds,
      });

      // 2) create explicit variants
      for (const row of explicitVariants) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: product.documentId,
        });
      }

      // 3) if explicit variants exist, delete the auto-created default
      if (explicitVariants.length > 0) {
        const all = await api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 });
        const auto = all.results.find(
          (v) => v.product?.documentId === product.documentId && v.isDefault
        );
        if (auto) await api.del(`/resources/variants/${auto.documentId}`);
      }

      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not create product');
    }
  };

  return (
    <Box p={8}>
      <PageHeader title="New product" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        <GridItem colSpan={4}>
          <FormField label="Name">
            <Input bg="white" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Brand">
            <Select bg="white" value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="Select brand">
              {brands.map((b) => <option key={b.documentId} value={b.documentId}>{b.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Category">
            <Select bg="white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Select category">
              {categories.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
      </Grid>

      <Box pt={6}>
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="semibold">Variants (optional)</Text>
          <Button variant="outline" onClick={addRow}>Add variant</Button>
        </HStack>
        {rows.map((row, i) => (
          <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={2}>
            <GridItem colSpan={4}>
              <FormField label="Label">
                <Input bg="white" value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Type">
                <Select
                  bg="white"
                  value={row.variantTypeId}
                  onChange={(e) => updateRow(i, { variantTypeId: e.target.value })}
                  placeholder="Select type"
                >
                  {variantTypes.map((t) => <option key={t.documentId} value={t.documentId}>{t.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={3}>
              <FormField label="Low-stock threshold">
                <NumberInput
                  value={row.lowStockThreshold ?? ''}
                  onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                >
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={1} display="flex" alignItems="flex-end">
              <IconButton aria-label="Remove" icon={<FiTrash2 />} onClick={() => removeRow(i)} />
            </GridItem>
          </Grid>
        ))}
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2}>Related products (cross-sell)</Text>
        <FormField label="Add related product">
          <Select
            bg="white"
            value=""
            onChange={(e) => setRelatedIds((ids) => (ids.includes(e.target.value) ? ids : [...ids, e.target.value]))}
            placeholder="Select product"
          >
            {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
          </Select>
        </FormField>
        <Box pt={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Text key={id} display="inline-block" pr={2}>{p?.name ?? id}</Text>;
          })}
        </Box>
      </Box>

      <HStack spacing={2} pt={6}>
        <Button onClick={save} isDisabled={!name || !brandId || !categoryId}>Create product</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </HStack>
    </Box>
  );
}
```

Behavior and the explanatory comment on the save-validation logic are preserved exactly.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Manual verification**

In the browser, go to Products → **New** (this is the `resource === 'products' && !isEdit` branch from `ResourceFormPage`, Task 6):
1. Fill in name/brand/category only (no variant rows), submit. Confirm the product is created with exactly one variant (the auto-created default) — check the Variants list to confirm no duplicate/extra variant exists.
2. Create another product, this time click **Add variant** twice, fill in label + type for both rows, submit. Confirm the product ends up with exactly the two explicit variants and the auto-created default was deleted (not three variants).
3. Try submitting a variant row with a label but no type selected — confirm the inline "Each variant needs a type." error appears and nothing is created.
4. Add a related product via the cross-sell picker, confirm it appears in the list below the picker, and confirm after saving that the product's `relatedProducts` was set (check via the product's edit page or the Order form's cross-sell suggestion strip once Task 10 is done).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
git commit -m "feat(plugin/admin): migrate ProductVariantsForm to Chakra UI"
```

---

### Task 10: OrderForm → Chakra (draft + confirmed modes)

The most complex screen: two very different render branches (draft entry form vs. read-only confirmed view with payments) in one file, plus the most business-rule-dense behavior in the plugin (FIFO pricing quantity argument, below-cost badges from two different sources of truth, cross-sell suggestions).

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `FormField`, `DataTable` (Task 2).
- Produces: `OrderForm` default export — **must remain a bare component with no self-wrapping `ChakraRoot`**, same reasoning as `StockPurchase` in Task 8 (consumed by both `OrderFormStandalone`, Task 1, and `App.tsx`'s two `orders/*` routes, Task 1).

- [ ] **Step 1: Rewrite `OrderForm.tsx`**

Replace the full contents of `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';

interface DraftLine {
  variantDocumentId: string;
  variantLabel: string;
  stockBatchDocumentId: string;
  costPriceUsd: number;
  quantitySold: number;
  sellPrice: number;
}

function formatLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
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
  const [orderDate, setOrderDate] = useState<string | null>(formatLocalDate(new Date()));
  const [discount, setDiscount] = useState<number | undefined>(0);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addVariantId, setAddVariantId] = useState('');
  const [addQty, setAddQty] = useState<number | undefined>(1);
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
      `/fifo/${addVariantId}`, { quantity: addQty ?? 1 }
    );
    if (fifo.shortfall > 0) setError(`Not enough stock: short by ${fifo.shortfall} unit(s).`);

    const variant = variants.find((v) => v.documentId === addVariantId);
    const newLines: DraftLine[] = [];
    for (const seg of fifo.segments) {
      // suggested sell price via the pricing endpoint (POST /pricing/suggest).
      // Pass the TOTAL requested quantity (not this segment's own quantityFromBatch)
      // so a wholesale minQty threshold is evaluated against the whole order, not
      // artificially failed when FIFO happens to split it across several batches.
      const priced = await getSuggestedPrice(api, priceListId, seg.costPriceUsd, addQty ?? 1);
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
  const finalTotal = subtotal - (discount ?? 0);

  const saveDraft = async () => {
    setError(null);
    try {
      // create order header
      const created = await api.post<any>('/resources/orders', {
        orderDate, status: 'draft', discountAmount: discount ?? 0,
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
    <Box p={8}>
      <PageHeader title="New order" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}

      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        <GridItem colSpan={4}>
          <FormField label="Customer">
            <Select bg="white" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Select customer">
              {customers.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Order date">
            <Input bg="white" type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
          </FormField>
        </GridItem>
      </Grid>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2}>Add product</Text>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label="Product">
              <Select
                bg="white"
                value={addProductId}
                onChange={(e) => { setAddProductId(e.target.value); setAddVariantId(''); }}
                placeholder="Select product"
              >
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Variant">
              <Select
                bg="white"
                value={addVariantId}
                onChange={(e) => setAddVariantId(e.target.value)}
                isDisabled={!addProductId}
                placeholder="Select variant"
              >
                {variantsForProduct.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={3}>
            <FormField label="Quantity">
              <NumberInput value={addQty ?? ''} onChange={(_, v) => setAddQty(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField bg="white" />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={1} display="flex" alignItems="flex-end">
            <Button onClick={addLine} isDisabled={!addVariantId}>Add</Button>
          </GridItem>
        </Grid>
      </Box>

      {relatedSuggestions.length > 0 && (
        <Box mt={4} bg="brand.50" p={3} borderRadius="lg">
          <Text as="span" fontSize="sm">Customers also buy:&nbsp;</Text>
          {relatedSuggestions.map((rp: any) => (
            <Button
              key={rp.documentId}
              variant="link"
              size="sm"
              mr={2}
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}
            >
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box pt={6}>
        <DataTable columns={['Variant', 'Batch', 'Qty', 'Sell (EGP)', 'Cost EGP', 'Flag']} isEmpty={draftLines.length === 0}>
          {draftLines.map((l, i) => {
            const costEgp = l.costPriceUsd * exchangeRate;
            const below = l.sellPrice < costEgp;
            return (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.stockBatchDocumentId.slice(0, 6)}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>
                  <NumberInput
                    size="sm"
                    value={l.sellPrice}
                    onChange={(_, v) =>
                      setDraftLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, sellPrice: Number.isNaN(v) ? 0 : v } : x)))}
                  >
                    <NumberInputField aria-label="sell" />
                  </NumberInput>
                </Td>
                <Td>{costEgp.toFixed(2)}</Td>
                <Td>{below ? <Badge colorScheme="red">Below cost</Badge> : null}</Td>
              </Tr>
            );
          })}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={6}>
        <GridItem colSpan={4}>
          <FormField label="Discount (EGP)">
            <NumberInput value={discount ?? ''} onChange={(_, v) => setDiscount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text>Subtotal: {subtotal.toFixed(2)} EGP</Text>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text fontSize="lg" fontWeight="semibold">Total: {finalTotal.toFixed(2)} EGP</Text>
        </GridItem>
      </Grid>

      <HStack spacing={2} pt={6}>
        <Button onClick={saveDraft} isDisabled={!customerId || draftLines.length === 0}>Save draft</Button>
        {id && <Button colorScheme="green" onClick={onConfirm}>Confirm order</Button>}
        <Button variant="ghost" onClick={() => navigate('/plugins/inventory-dashboard/r/orders')}>Cancel</Button>
      </HStack>
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
  const [amount, setAmount] = useState<number | undefined>(0);
  const [method, setMethod] = useState('cash');

  const addPayment = async () => {
    await api.post('/resources/payments', {
      amount: amount ?? 0, method, paymentDate: formatLocalDate(new Date()), order: order.documentId,
    });
    setAmount(0);
    reload();
  };

  return (
    <Box p={8}>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">{`Order ${order.documentId.slice(0, 8)}`}</Text>
        <Badge fontSize="sm">{order.status}</Badge>
      </HStack>

      <DataTable columns={['Variant', 'Qty', 'Sell', 'Cost USD snap', 'Flag']} isEmpty={order.lines.length === 0}>
        {order.lines.map((l: any) => (
          <Tr key={l.documentId}>
            <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
            <Td>{l.quantitySold}</Td>
            <Td>{l.sellPrice}</Td>
            <Td>{l.costPriceUsdSnapshot}</Td>
            <Td>{l.belowCost ? <Badge colorScheme="red">Below cost</Badge> : null}</Td>
          </Tr>
        ))}
      </DataTable>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold">Totals</Text>
        <Text>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Text>
        <Text>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2}>Record payment</Text>
        <HStack spacing={2} align="flex-end">
          <FormField label="Amount">
            <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
          <FormField label="Method">
            <Select bg="white" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">cash</option>
              <option value="transfer">transfer</option>
            </Select>
          </FormField>
          <Button onClick={addPayment} isDisabled={!amount}>Add payment</Button>
        </HStack>
      </Box>
    </Box>
  );
}
```

Every behavior from the spec's §6 "OrderForm.tsx" checklist is preserved verbatim, including the code comment on why `getSuggestedPrice` is called with the total requested quantity rather than the segment's own quantity, and the two visually-identical-but-differently-sourced "Below cost" badges (draft table: client-computed from `costPriceUsd * exchangeRate`; confirmed table: server-computed `l.belowCost`) — do not merge these into one code path.

- [ ] **Step 2: Type-check**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:front
```
Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Manual verification — full order lifecycle, both entry points**

In the browser, with at least one customer (with a price list), one product with two variants, and stock recorded across **two separate batches** for one variant (so FIFO has something to split) available (use existing seed/dev data, or create it via the flows already verified in Tasks 6, 8, 9):

1. Click the **"New Order"** left-nav link (the standalone entry, `/plugins/inventory-orders`). Confirm it renders correctly (exercises `OrderFormStandalone` from Task 1 for the first time with real Chakra content).
2. Pick a customer, confirm the price list auto-fills.
3. Add a product/variant with quantity greater than what's in its oldest batch alone (so FIFO must split across two batches) — confirm **two** draft lines appear, one per batch, each with its own suggested sell price.
4. Edit a line's sell price down below its cost (`costPriceUsd × exchangeRate` shown in the "Cost EGP" column) — confirm the "Below cost" badge appears on that line only.
5. If the product has `relatedProducts` set (from Task 9's verification), confirm the "Customers also buy" strip appears after adding it, and clicking a suggestion pre-fills the product picker.
6. Set a discount, confirm Subtotal/Total update live.
7. Click **Save draft** — confirm it navigates to `/plugins/inventory-dashboard/orders/:id` (the `App.tsx`-nested route) and still renders correctly (exercises `OrderForm` a second time, this time reached via `App.tsx`'s own `ChakraRoot`, confirming no double-provider issue).
8. Click **Confirm order** — confirm the view switches to the read-only `ConfirmedOrderView`, the lines table now shows the server-computed below-cost flag matching what you set in step 4, and the totals match what was shown in the draft.
9. Record a partial payment, confirm the balance due decreases and (if you pay the rest) the order status badge updates to `paid` on reload.
10. Try requesting more of a variant than total remaining stock across all its batches — confirm the inline "Not enough stock: short by N unit(s)." error appears, and whatever partial segments FIFO *could* resolve are still added as lines (matches the original's "add anyway" behavior on shortfall).

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
git commit -m "feat(plugin/admin): migrate OrderForm to Chakra UI (draft + confirmed modes)"
```

---

### Task 11: Final verification pass

Closes out the migration: confirms nothing outside the plugin's own gates was incidentally broken, and runs through the complete spec §8 checklist end-to-end in one sitting.

**Files:** none (verification only).

**Interfaces:** consumes everything from Tasks 1–10; produces nothing new.

- [ ] **Step 1: Whole-plugin type check and build**

```bash
cd src/plugins/inventory-dashboard
npm run test:ts:back
npm run test:ts:front
npm run build
cd ../../..
```
Expected: all three clean/succeed. (`test:ts:back` isn't touched by this plan but must still pass — confirms no accidental server-side breakage.)

- [ ] **Step 2: Whole-app checks**

```bash
npx tsc --noEmit
npm test
```
Expected: both clean — these don't cover plugin admin code today (per the docs, whole-app `tsc` excludes `src/plugins/**`, and app Jest suites are server-only), but must not be broken incidentally by any of this plan's changes (e.g. an accidental edit outside the plugin, or a plugin build artifact leaking into the app's own type-check scope).

- [ ] **Step 3: Full manual click-through, fresh eyes**

With `npm run develop` running, go through the complete spec §8 checklist in one sitting, on all three entry points:
1. Strapi's own shell (nav, top bar, login screen if you log out and back in, Content Manager) looks and behaves exactly as it did before this migration — no leaked styling.
2. Full CRUD (create → edit → delete-with-confirmation) on at least two different generic resource types (e.g. Categories and Suppliers), including one with a relation field.
3. A full stock purchase, from both the standalone "Stock purchase" link and the in-app `stock-purchase` route.
4. A full product-with-variants creation, including the case with zero explicit variants (auto-default kept) and the case with explicit variants (auto-default deleted).
5. A full order lifecycle: standalone "New Order" entry → FIFO split across two batches → a below-cost line → Save draft → Confirm → partial payment → full payment → status reaches `paid`.
6. Resize the browser window narrower — confirm nothing overflows horizontally in a way that would make a screen unusable (the spec doesn't require full responsive design, just "not broken").

- [ ] **Step 4: Commit** (only if Step 3 surfaced fixes — otherwise this task has nothing to commit)

If any fixes were needed during Step 3, commit them with a message describing what was found and fixed, e.g.:
```bash
git add -A
git commit -m "fix(plugin/admin): address issues found in final Chakra UI reskin verification pass"
```
If Step 3 found nothing to fix, skip this step — there is nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** every §6 behavior-inventory item (Overview, StockPurchase, ResourceListPage, ResourceFormPage, FieldRenderer, RelationSelect, ProductVariantsForm, OrderForm draft + confirmed, App.tsx) has a corresponding task and is called out explicitly in that task's code comments or manual-verification checklist. The spec's four-phase grouping (§7) maps onto Tasks 1–2 (foundation), 3–6 (generic screens), 7–9 (bespoke screens), 10 (OrderForm), with Task 11 added as the spec's §8 final-verification requirement.
- **Non-obvious deviation from the spec, called out explicitly to the user:** the spec's §3 architecture assumed a single `ChakraProvider` wrap in `App.tsx` would be sufficient. Reading `admin/src/index.ts` during plan-writing surfaced that `StockPurchase` and `OrderForm` are *also* each registered as independent, standalone top-level menu components — bypassing `App.tsx` entirely when reached via their own left-nav links (which is how a user normally reaches them). Task 1 accounts for this with two additional thin wrapper files (`StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`) so every entry point gets exactly one `ChakraProvider` ancestor, never zero, never double-nested. This doesn't change the spec's goals or scope, only how the already-agreed architecture is correctly wired.
- **Type consistency check:** `RelationSelect({ field, value, onChange })` (Task 3) and `FieldRenderer({ field, value, onChange })` (Task 4) keep their exact original signatures, so `ResourceFormPage` (Task 6) requires no interface-adjacent changes. `ProductVariantsForm({ onDone })` (Task 9) is unchanged and still called identically from `ResourceFormPage` (Task 6, written before Task 9 — verified the call site doesn't need to change). `StockPurchase`/`OrderForm` (Tasks 8, 10) deliberately keep bare, non-self-wrapping default exports so Task 1's wrapper files and `App.tsx`'s routes both work without double-nesting `ChakraProvider`.
