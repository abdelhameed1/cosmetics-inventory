# Data Entry Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single global "Add New" entry point to the `inventory-dashboard` plugin, and restructure the three complex creation flows (Product, Stock Purchase, Order-draft-creation) into true multi-step wizards with a progress indicator.

**Architecture:** A shared `WizardShell` component wraps Chakra UI's `Stepper`/`useSteps` and owns step navigation, per-step validation gating, and the final submit action. Three existing pages (`ProductVariantsForm.tsx`, `StockPurchase.tsx`, `OrderForm.tsx`) keep their routes and all existing state/API-call logic, but their JSX is split into step content passed to `WizardShell`. A new "Add New" button in `AppSidebar.tsx` opens a type-picker modal that navigates to the (unchanged) route for whichever type was picked.

**Tech Stack:** React, TypeScript, Chakra UI v2 (`@chakra-ui/react@2.10.10`, confirmed installed with `Stepper`/`useSteps` support), React Router v6. No backend changes.

**Source spec:** `docs/superpowers/specs/2026-07-24-data-entry-wizard-design.md`

## Global Constraints

- No backend changes. No new content-types, no new API routes, no changes to any file under `src/plugins/inventory-dashboard/server/`.
- No frontend test harness exists in this plugin (confirmed: zero `*.test.*`/`*.spec.*` files anywhere under `admin/src`; only `server/tests/*.test.ts` exist). Every task's verification is `npm run test:ts:front` / `npm run test:ts:back` (tsc, no emit) plus manual dev-server click-through — do not add a Jest/RTL setup as part of this work.
- This plugin loads from a pre-built `dist/` (per root `config/plugins.ts`'s `resolve: './src/plugins/inventory-dashboard'`), not live `src/`. Every task must end with `npm run build` (run from `src/plugins/inventory-dashboard`) before manual verification is possible; the Strapi dev server must be restarted afterward to pick up the rebuilt bundle.
- Preserve all existing state management, API call sequences, payload shapes, and validation logic in `ProductVariantsForm.tsx`, `StockPurchase.tsx`, and `OrderForm.tsx` exactly as they are today — only the JSX presentation changes (single scrolling screen → stepped). This includes preserving `OrderForm.tsx`'s existing behavior where the "Confirm order" button appears only when `id` is present (i.e. only when continuing an existing, not-yet-confirmed draft at `orders/:id`) — do not add, remove, or fix any behavior around that beyond changing its layout position.
- `ConfirmedOrderView` (the `isConfirmed` branch of `OrderForm.tsx`, i.e. payment recording) is out of scope — do not touch it.
- Reuse the exact icons already assigned to each entity in `admin/src/config/navConfig.ts` (`CATALOG_GROUPS`/`TOP_LINKS`) wherever the same entity appears in the new `addNewConfig.ts` — do not introduce different icons for the same entity.
- Chakra UI Stepper primitives (`Stepper`, `Step`, `StepIndicator`, `StepStatus`, `StepIcon`, `StepNumber`, `StepTitle`, `StepSeparator`, `useSteps`) are confirmed present in the installed `@chakra-ui/react@2.10.10` — import them directly, no version bump needed.
- `Button`'s Chakra theme default (`src/plugins/inventory-dashboard/admin/src/theme/index.ts`) already sets `colorScheme: 'brand'` — do not pass `colorScheme="brand"` explicitly on plain `<Button>` elements (redundant); do pass it explicitly on `<Stepper>` and `<Badge>` elements, which have no such default.

---

## File Structure

**New files:**
- `admin/src/components/WizardShell.tsx` — shared step-navigation shell (Stepper header, Back/Next/Submit buttons, per-step validation gating, submit error display).
- `admin/src/config/addNewConfig.ts` — `ADD_NEW_GROUPS` config: the 9 creatable types, grouped, each with slug/label/icon/kind/path.
- `admin/src/components/AddNewModal.tsx` — type-picker modal, card grid reusing `CatalogHub.tsx`'s visual pattern (icon badge + label), grouped by `ADD_NEW_GROUPS`.

**Modified files:**
- `admin/src/components/AppSidebar.tsx` — add "Add New" button above `TOP_LINKS`, wire up `AddNewModal` open/close state.
- `admin/src/components/ProductVariantsForm.tsx` — restructure into a 4-step `WizardShell` flow (Product Info → Variants → Related Products → Review).
- `admin/src/pages/StockPurchase.tsx` — restructure into a 3-step `WizardShell` flow (Supplier → Product & Quantity → Review).
- `admin/src/pages/OrderForm.tsx` — restructure the draft-creation branch into a 3-step `WizardShell` flow (Customer & Date → Line Items → Review); `ConfirmedOrderView` untouched.

---

### Task 1: WizardShell shared component

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx`

**Interfaces:**
- Produces: `WizardShell` component and `WizardStep` interface, both exported from `admin/src/components/WizardShell.tsx`:
  ```ts
  export interface WizardStep {
    label: string;
    content: React.ReactNode;
    isValid: () => boolean;
  }
  export interface WizardShellProps {
    steps: WizardStep[];
    onSubmit: () => Promise<void>;
    submitLabel: string;
    isSubmitting: boolean;
    submitError: string | null;
  }
  export function WizardShell(props: WizardShellProps): JSX.Element;
  ```
  Tasks 3, 4, and 5 import `{ WizardShell, type WizardStep }` from this file and build a `steps: WizardStep[]` array to pass in.

- [ ] **Step 1: Write `WizardShell.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx
import { type ReactNode } from 'react';
import {
  Box, Button, HStack, Step, StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, Text, useSteps,
} from '@chakra-ui/react';

export interface WizardStep {
  label: string;
  content: ReactNode;
  isValid: () => boolean;
}

export interface WizardShellProps {
  steps: WizardStep[];
  onSubmit: () => Promise<void>;
  submitLabel: string;
  isSubmitting: boolean;
  submitError: string | null;
}

export function WizardShell({ steps, onSubmit, submitLabel, isSubmitting, submitError }: WizardShellProps) {
  const { activeStep, setActiveStep } = useSteps({ index: 0, count: steps.length });
  const isLastStep = activeStep === steps.length - 1;
  const canAdvance = steps[activeStep]?.isValid() ?? false;

  const goBack = () => setActiveStep(activeStep - 1);
  const goNext = () => setActiveStep(activeStep + 1);
  const jumpTo = (i: number) => {
    if (i < activeStep) setActiveStep(i);
  };

  return (
    <Box>
      <Stepper index={activeStep} colorScheme="brand" size="sm" mb={8}>
        {steps.map((step, i) => (
          <Step key={step.label} onClick={() => jumpTo(i)} cursor={i < activeStep ? 'pointer' : 'default'}>
            <StepIndicator>
              <StepStatus
                complete={<StepIcon />}
                incomplete={<StepNumber>{i + 1}</StepNumber>}
                active={<StepNumber>{i + 1}</StepNumber>}
              />
            </StepIndicator>
            <Box flexShrink={0}>
              <StepTitle>{step.label}</StepTitle>
            </Box>
            <StepSeparator />
          </Step>
        ))}
      </Stepper>

      <Box>{steps[activeStep]?.content}</Box>

      {submitError && isLastStep && (
        <Text color="red.600" pt={4}>{submitError}</Text>
      )}

      <HStack spacing={2} pt={6}>
        {activeStep > 0 && (
          <Button variant="ghost" onClick={goBack} isDisabled={isSubmitting}>Back</Button>
        )}
        {!isLastStep && (
          <Button onClick={goNext} isDisabled={!canAdvance}>Next</Button>
        )}
        {isLastStep && (
          <Button onClick={onSubmit} isDisabled={!canAdvance || isSubmitting} isLoading={isSubmitting}>
            {submitLabel}
          </Button>
        )}
      </HStack>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Build and smoke-check the plugin still loads**

Run (from `src/plugins/inventory-dashboard`): `npm run build`
Expected: build succeeds (Vite admin + server bundles). `WizardShell` is not yet imported anywhere, so this step only confirms the new file doesn't break compilation.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx
git commit -m "feat(inventory-dashboard): add shared WizardShell stepper component"
```

---

### Task 2: "Add New" picker (config + modal + sidebar button)

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx` (full file)

**Interfaces:**
- Consumes: `type IconComponent` from `admin/src/config/navConfig.ts` (existing).
- Produces: `ADD_NEW_GROUPS` (exported from `admin/src/config/addNewConfig.ts`) and `AddNewModal` component (exported from `admin/src/components/AddNewModal.tsx`, props `{ isOpen: boolean; onClose: () => void }`). No other task consumes these — this task is self-contained and does not depend on Task 1.

- [ ] **Step 1: Write `addNewConfig.ts`**

```ts
// src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts
import { FiBox, FiSliders, FiGrid, FiTag, FiTruck, FiUsers, FiDollarSign, FiBriefcase, FiShoppingCart } from 'react-icons/fi';
import { type IconComponent } from './navConfig';

export interface AddNewItem {
  slug: string;
  label: string;
  icon: IconComponent;
  kind: 'simple' | 'wizard';
  path: string;
}

export interface AddNewGroup {
  label: string;
  items: AddNewItem[];
}

export const ADD_NEW_GROUPS: AddNewGroup[] = [
  {
    label: 'Catalog',
    items: [
      { slug: 'products', label: 'Product', icon: FiBox, kind: 'wizard', path: '/plugins/inventory-catalog/products/new' },
      { slug: 'variant-types', label: 'Variant Type', icon: FiSliders, kind: 'simple', path: '/plugins/inventory-catalog/variant-types/new' },
      { slug: 'categories', label: 'Category', icon: FiGrid, kind: 'simple', path: '/plugins/inventory-catalog/categories/new' },
      { slug: 'brands', label: 'Brand', icon: FiTag, kind: 'simple', path: '/plugins/inventory-catalog/brands/new' },
    ],
  },
  {
    label: 'Partners & Pricing',
    items: [
      { slug: 'suppliers', label: 'Supplier', icon: FiTruck, kind: 'simple', path: '/plugins/inventory-catalog/suppliers/new' },
      { slug: 'customers', label: 'Customer', icon: FiUsers, kind: 'simple', path: '/plugins/inventory-catalog/customers/new' },
      { slug: 'price-lists', label: 'Price List', icon: FiDollarSign, kind: 'simple', path: '/plugins/inventory-catalog/price-lists/new' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { slug: 'stock-purchase', label: 'Stock Purchase', icon: FiBriefcase, kind: 'wizard', path: '/plugins/inventory-stock' },
      { slug: 'order', label: 'Order', icon: FiShoppingCart, kind: 'wizard', path: '/plugins/inventory-orders' },
    ],
  },
];
```

Note: `stock-purchase` and `order` navigate to the standalone entry points (`/plugins/inventory-stock`, `/plugins/inventory-orders`, registered in `admin/src/index.ts`) rather than `App.tsx`'s nested `stock-purchase`/`orders/new` routes — both render the identical `StockPurchase`/`OrderForm` components, and this matches the exact paths `TOP_LINKS` in `navConfig.ts` already uses for the same destinations.

- [ ] **Step 2: Write `AddNewModal.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx
import {
  Badge, Box, Card, CardBody, Heading, HStack, Icon, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, SimpleGrid, Text, VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { ADD_NEW_GROUPS } from '../config/addNewConfig';

export function AddNewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add new</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {ADD_NEW_GROUPS.map((group) => (
            <Box key={group.label} pb={6}>
              <Heading size="xs" textTransform="uppercase" color="gray.500" pb={3}>
                {group.label}
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {group.items.map((item) => (
                  <Card
                    key={item.slug}
                    as="button"
                    textAlign="left"
                    cursor="pointer"
                    transition="box-shadow 0.15s, border-color 0.15s"
                    _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                    onClick={() => go(item.path)}
                  >
                    <CardBody>
                      <HStack justify="space-between">
                        <HStack spacing={3}>
                          <VStack align="center" justify="center" bg="brand.50" borderRadius="lg" boxSize={9} flexShrink={0}>
                            <Icon as={item.icon} boxSize={4} color="brand.600" />
                          </VStack>
                          <Text fontSize="sm" fontWeight="semibold" color="gray.800">{item.label}</Text>
                        </HStack>
                        {item.kind === 'wizard' && <Badge colorScheme="brand">Guided</Badge>}
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
```

- [ ] **Step 3: Rewrite `AppSidebar.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';
import { AddNewModal } from './AddNewModal';

function isLinkActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavButton({
  label, icon: IconComp, isActive, onClick,
}: { label: string; icon: IconComponent; isActive: boolean; onClick: () => void }) {
  return (
    <Box
      as="button"
      w="100%"
      textAlign="left"
      px={3}
      py={2}
      borderRadius="lg"
      bg={isActive ? 'brand.50' : 'transparent'}
      _hover={{ bg: isActive ? 'brand.50' : 'gray.50' }}
      onClick={onClick}
    >
      <HStack spacing={3}>
        <Icon as={IconComp} boxSize={4} color={isActive ? 'brand.700' : 'gray.500'} />
        <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'brand.700' : 'gray.700'}>
          {label}
        </Text>
      </HStack>
    </Box>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);

  return (
    <Box as="nav" w="240px" flexShrink={0} bg="white" borderRightWidth="1px" borderColor="gray.100" minH="100%" py={6} px={4}>
      <Button
        leftIcon={<Icon as={FiPlus} boxSize={4} />}
        w="100%"
        mb={4}
        onClick={() => setIsAddNewOpen(true)}
      >
        Add new
      </Button>

      <VStack align="stretch" spacing={1} pb={6}>
        {TOP_LINKS.map((link) => (
          <NavButton
            key={link.to}
            label={link.label}
            icon={link.icon}
            isActive={isLinkActive(pathname, link.to)}
            onClick={() => navigate(link.to)}
          />
        ))}
      </VStack>

      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="gray.500" mb={2} px={3}>
            {group.label}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const to = `/plugins/inventory-catalog/${item.slug}`;
              return (
                <NavButton
                  key={item.slug}
                  label={item.label}
                  icon={item.icon}
                  isActive={isLinkActive(pathname, to)}
                  onClick={() => navigate(to)}
                />
              );
            })}
          </VStack>
        </Box>
      ))}

      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
    </Box>
  );
}
```

- [ ] **Step 4: Typecheck**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 5: Build and manually verify**

Run (from `src/plugins/inventory-dashboard`): `npm run build`, then restart the Strapi dev server.

Manual check: open any of the plugin's 4 entry points (Inventory, Stock purchase, New Order, Catalog). Confirm the "Add new" button appears at the top of the sidebar in all of them. Click it — confirm the modal opens showing 3 groups (Catalog, Partners & Pricing, Operations) with 9 cards total, and that `products`, `stock-purchase`, and `order` show a "Guided" badge while the other 6 don't. Click each card once and confirm it navigates to and renders the expected existing form (unchanged at this point — wizards aren't built yet, so `products`/`stock-purchase`/`order` still render as single-screen forms).

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/config/addNewConfig.ts src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
git commit -m "feat(inventory-dashboard): add global Add New picker to sidebar"
```

---

### Task 3: Product creation wizard

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx` (full file)

**Interfaces:**
- Consumes: `{ WizardShell, type WizardStep }` from `./WizardShell` (Task 1).
- Produces: no change to `ProductVariantsForm`'s own exported signature (`export default function ProductVariantsForm({ onDone }: { onDone: () => void })`) — `ResourceFormPage.tsx:48-50`'s existing usage (`<ProductVariantsForm onDone={() => navigate('..', { relative: 'path' })} />`) needs no changes.

- [ ] **Step 1: Rewrite `ProductVariantsForm.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
import { useEffect, useState } from 'react';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, IconButton, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';
import { WizardShell, type WizardStep } from './WizardShell';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once product creation succeeds, so a retry after a later failure
  // (variant creation / default-variant cleanup) does not re-create the product.
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  // How many explicit variants have been successfully created so far, so a
  // retry resumes from the next one instead of re-creating earlier ones.
  const [variantsCreatedCount, setVariantsCreatedCount] = useState(0);
  // Frozen at the moment the product is first created, so a retry after the
  // user navigates back and edits variant rows still resumes against exactly
  // what was decided at that point, not whatever `rows` currently contains.
  const [variantsSnapshot, setVariantsSnapshot] = useState<VariantRow[] | null>(null);

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

  const explicitVariants = rows.filter((r) => r.label.trim() || r.variantTypeId);

  const save = async () => {
    setError(null);
    // Only submit rows the user actually filled in. A non-default variant must
    // have a variant type (enforced by the variant lifecycle), so reject any
    // partially-filled row up front — otherwise the POST would throw mid-loop,
    // after the product and earlier variants are already persisted, leaving a
    // half-built product behind with no rollback.
    if (explicitVariants.some((r) => !r.variantTypeId)) {
      setError('Each variant needs a type.');
      return;
    }
    setIsSubmitting(true);
    // Plain local var (not React state) so the catch block below sees the real,
    // synchronously-updated value from this call — reading the `savedProductId`
    // state directly in catch would see the stale pre-update closure value.
    let productId = savedProductId;
    try {
      // 1) create product (auto-creates one default variant) — skipped on retry
      if (!productId) {
        const product = await api.post<any>('/resources/products', {
          name, brand: brandId, category: categoryId,
          relatedProducts: relatedIds,
        });
        productId = product.documentId;
        setSavedProductId(productId);
        setVariantsSnapshot(explicitVariants);
      }

      // 2) create explicit variants — on retry, resume after the ones already created,
      // against the snapshot taken when the product was created (not live `rows`)
      const toCreate = variantsSnapshot ?? explicitVariants;
      const remaining = toCreate.slice(variantsCreatedCount);
      for (const row of remaining) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: productId,
        });
        setVariantsCreatedCount((n) => n + 1);
      }

      // 3) if explicit variants exist, delete the auto-created default
      // (idempotent: if already deleted by a prior attempt, `auto` is simply not found)
      if (toCreate.length > 0) {
        const all = await api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 });
        const auto = all.results.find(
          (v) => v.product?.documentId === productId && v.isDefault
        );
        if (auto) await api.del(`/resources/variants/${auto.documentId}`);
      }

      onDone();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ??
          (productId ? 'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.' : 'Could not create product')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const productInfoStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label="Name" required>
              <Input bg="white" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Brand" required>
              <Select bg="white" value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="Select brand">
                {brands.map((b) => <option key={b.documentId} value={b.documentId}>{b.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Category" required>
              <Select bg="white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Select category">
                {categories.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const variantsStep = (
    <Box>
      <HStack justify="space-between" pb={2}>
        <Text fontSize="sm" color="gray.600">Optional — leave empty to keep a single default variant.</Text>
        <Button variant="outline" onClick={addRow}>Add variant</Button>
      </HStack>
      {rows.length > 0 && (
        <Card>
          <CardBody>
            {rows.map((row, i) => (
              <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={i === 0 ? 0 : 4}>
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
          </CardBody>
        </Card>
      )}
    </Box>
  );

  const relatedStep = (
    <Card>
      <CardBody>
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
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>Name:</b> {name || '—'}</Text>
        <Text><b>Brand:</b> {brands.find((b) => b.documentId === brandId)?.name ?? '—'}</Text>
        <Text><b>Category:</b> {categories.find((c) => c.documentId === categoryId)?.name ?? '—'}</Text>
        <Text pt={2}>
          <b>Variants:</b>{' '}
          {explicitVariants.length === 0 ? 'Single default variant' : explicitVariants.map((r) => r.label || '(unnamed)').join(', ')}
        </Text>
        <Text pt={2}>
          <b>Related products:</b>{' '}
          {relatedIds.length === 0 ? 'None' : relatedIds.map((id) => products.find((p) => p.documentId === id)?.name ?? id).join(', ')}
        </Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    { label: 'Product Info', content: productInfoStep, isValid: () => Boolean(name && brandId && categoryId) },
    { label: 'Variants', content: variantsStep, isValid: () => explicitVariants.every((r) => r.variantTypeId) },
    { label: 'Related Products', content: relatedStep, isValid: () => true },
    { label: 'Review', content: reviewStep, isValid: () => true },
  ];

  return (
    <Box p={8}>
      <PageHeader title="New product" />
      <WizardShell
        steps={steps}
        onSubmit={save}
        submitLabel={savedProductId ? 'Retry remaining steps' : 'Create product'}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <Button variant="ghost" mt={4} onClick={onDone} isDisabled={isSubmitting}>Cancel</Button>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Build and manually verify**

Run (from `src/plugins/inventory-dashboard`): `npm run build`, then restart the Strapi dev server.

Manual check: navigate to `/plugins/inventory-catalog/products/new` (or via the Add New picker → Product). Confirm:
- 4 steps show in the stepper: Product Info, Variants, Related Products, Review.
- "Next" is disabled on step 1 until Name, Brand, and Category are all filled.
- Adding a variant row without a Type, then trying to advance past step 2, is blocked; filling the Type unblocks it.
- Step 3 (Related Products) has no blocking validation.
- Step 4 shows an accurate read-only summary of everything entered.
- Clicking a completed step's indicator jumps back to it with data preserved; clicking "Create product" submits and behaves identically to the old single-screen form (product created, explicit variants created, default auto-variant deleted if explicit variants exist, then navigates away via `onDone`).
- "Cancel" at any step navigates away without submitting.
- Partial-failure retry: add one variant row with a valid type, then temporarily break the second POST (e.g. briefly stop the Strapi server between the product-create and variant-create calls, or add an invalid `variantTypeId` via devtools) so product creation succeeds but variant creation fails. Confirm the error message mentions the product was saved, the submit button now reads "Retry remaining steps", and clicking it again completes the save without re-creating the product (verify only one product with that name exists afterward).

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
git commit -m "feat(inventory-dashboard): restructure product creation into a stepped wizard"
```

---

### Task 4: Stock Purchase wizard

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx` (full file)

**Interfaces:**
- Consumes: `{ WizardShell, type WizardStep }` from `../components/WizardShell` (Task 1).
- Produces: no change to `StockPurchase`'s exported signature (`export default function StockPurchase()`) — both `StockPurchaseStandalone.tsx` and `App.tsx`'s `stock-purchase` route render it unchanged.

- [ ] **Step 1: Rewrite `StockPurchase.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardBody, Grid, GridItem, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { WizardShell, type WizardStep } from '../components/WizardShell';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplierStep = (
    <Card>
      <CardBody>
        <FormField label="Supplier" required>
          <Select bg="white" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
            {suppliers.map((s) => <option key={s.documentId} value={s.documentId}>{s.name}</option>)}
          </Select>
        </FormField>
      </CardBody>
    </Card>
  );

  const productStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label="Product" required>
              <Select bg="white" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Select product">
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Variant" required>
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
            <FormField label="Quantity purchased" required>
              <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField bg="white" />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Cost price (USD)" required>
              <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField bg="white" />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4} />
          <GridItem colSpan={4}>
            <FormField label="Purchase date" required>
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
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>Supplier:</b> {suppliers.find((s) => s.documentId === supplierId)?.name ?? '—'}</Text>
        <Text><b>Product:</b> {products.find((p) => p.documentId === productId)?.name ?? '—'}</Text>
        <Text><b>Variant:</b> {variants.find((v) => v.documentId === variantId)?.label ?? 'Default'}</Text>
        <Text><b>Quantity:</b> {qty ?? '—'}</Text>
        <Text><b>Cost price (USD):</b> {cost ?? '—'}</Text>
        <Text><b>Purchase date:</b> {purchaseDate ?? '—'}</Text>
        <Text><b>Production date:</b> {productionDate ?? '—'}</Text>
        <Text><b>Expiry date:</b> {expiryDate ?? '—'}</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    { label: 'Supplier', content: supplierStep, isValid: () => Boolean(supplierId) },
    {
      label: 'Product & Quantity',
      content: productStep,
      isValid: () => Boolean(productId && variantId && qty && cost && purchaseDate),
    },
    { label: 'Review', content: reviewStep, isValid: () => true },
  ];

  return (
    <Box p={8}>
      <PageHeader title="Record stock purchase" />
      <WizardShell steps={steps} onSubmit={submit} submitLabel="Record purchase" isSubmitting={isSubmitting} submitError={error} />
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Build and manually verify**

Run (from `src/plugins/inventory-dashboard`): `npm run build`, then restart the Strapi dev server.

Manual check: navigate to `/plugins/inventory-stock` (or via Add New → Stock Purchase). Confirm:
- 3 steps: Supplier, Product & Quantity, Review.
- "Next" on step 1 is disabled until a Supplier is picked.
- "Next" on step 2 is disabled until Product, Variant, Quantity, Cost, and Purchase date are all filled (Production/Expiry date remain optional, matching current behavior).
- Step 3 shows an accurate read-only summary.
- "Record purchase" submits and behaves identically to the old single-screen form (posts to `/resources/stock-batches`, navigates to `/plugins/inventory-dashboard/r/stock-batches`).

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
git commit -m "feat(inventory-dashboard): restructure stock purchase into a stepped wizard"
```

---

### Task 5: Order creation wizard

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx` (full file)

**Interfaces:**
- Consumes: `{ WizardShell, type WizardStep }` from `../components/WizardShell` (Task 1).
- Produces: no change to `OrderForm`'s exported signature (`export default function OrderForm()`) — `OrderFormStandalone.tsx` and `App.tsx`'s `orders/new`/`orders/:id` routes render it unchanged. `ConfirmedOrderView` (the `ìsConfirmed` branch) is untouched, still defined in the same file, still receiving `{ order, reload, api }`.

- [ ] **Step 1: Rewrite `OrderForm.tsx`**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';
import { WizardShell, type WizardStep } from '../components/WizardShell';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
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

  const customerStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label="Customer" required>
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
      </CardBody>
    </Card>
  );

  const lineItemsStep = (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" pb={2} color="gray.800">Add product</Text>
      <Card>
        <CardBody>
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
        </CardBody>
      </Card>

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
    </Box>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>Customer:</b> {customers.find((c) => c.documentId === customerId)?.name ?? '—'}</Text>
        <Text><b>Order date:</b> {orderDate ?? '—'}</Text>
        <Box pt={4}>
          <DataTable columns={['Variant', 'Qty', 'Sell (EGP)']} isEmpty={draftLines.length === 0}>
            {draftLines.map((l, i) => (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice.toFixed(2)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Box>
        <Text pt={4}><b>Discount:</b> {(discount ?? 0).toFixed(2)} EGP</Text>
        <Text fontSize="lg" fontWeight="semibold">Total: {finalTotal.toFixed(2)} EGP</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    { label: 'Customer & Date', content: customerStep, isValid: () => Boolean(customerId) },
    { label: 'Line Items', content: lineItemsStep, isValid: () => draftLines.length > 0 },
    { label: 'Review', content: reviewStep, isValid: () => true },
  ];

  return (
    <Box p={8}>
      <PageHeader title="New order" />
      {error && !isSubmitting && draftLines.length === 0 && <Text color="red.600" pb={2}>{error}</Text>}
      <WizardShell steps={steps} onSubmit={saveDraft} submitLabel="Save draft" isSubmitting={isSubmitting} submitError={error} />
      <HStack spacing={2} pt={4}>
        <Button variant="ghost" onClick={() => navigate('/plugins/inventory-dashboard/r/orders')} isDisabled={isSubmitting}>
          Cancel
        </Button>
        {id && <Button colorScheme="green" onClick={onConfirm}>Confirm order</Button>}
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
        <Text fontSize="lg" fontWeight="semibold" color="gray.800">Totals</Text>
        <Text>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Text>
        <Text>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="gray.800">Record payment</Text>
        <Card>
          <CardBody>
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
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
```

Note on the `{error && !isSubmitting && draftLines.length === 0 && ...}` line above the wizard: this surfaces `addLine`'s FIFO-shortfall error (set on the Line Items step, outside `WizardShell`'s own submit flow) without duplicating `WizardShell`'s own `submitError` display, which only renders on the final Review step. Once a line is successfully added (`draftLines.length > 0`), this line stops rendering; `WizardShell`'s `submitError` display takes over for any `saveDraft` failure on the Review step.

- [ ] **Step 2: Typecheck**

Run (from `src/plugins/inventory-dashboard`): `npm run test:ts:front`
Expected: no errors.

- [ ] **Step 3: Build and manually verify**

Run (from `src/plugins/inventory-dashboard`): `npm run build`, then restart the Strapi dev server.

Manual check: navigate to `/plugins/inventory-orders` (or via Add New → Order). Confirm:
- 3 steps: Customer & Date, Line Items, Review.
- "Next" on step 1 is disabled until a Customer is picked.
- On step 2, adding a product/variant/qty behaves exactly as before (FIFO lookup, price suggestion, cross-sell suggestions, editable sell price per line, discount/subtotal/total). "Next" is disabled until at least one line has been added.
- Step 3 shows an accurate read-only summary of customer, date, lines, discount, and total.
- "Save draft" behaves identically to before: posts the order header, posts each line, navigates to `/plugins/inventory-dashboard/orders/:id`.
- On that resulting `orders/:id` page (status still `draft`), confirm the same 3-step wizard renders again (now with `id` set) and a "Confirm order" button appears next to Cancel; clicking it behaves identically to before (calls `confirm()`, then shows `ConfirmedOrderView`).
- `ConfirmedOrderView` (payment recording) is visually and functionally unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
git commit -m "feat(inventory-dashboard): restructure order draft creation into a stepped wizard"
```
