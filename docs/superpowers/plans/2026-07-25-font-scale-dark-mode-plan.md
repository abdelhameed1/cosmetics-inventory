# Larger Font Scale + Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the plugin's global text size and add a working dark mode (manual toggle, persisted) to the `inventory-dashboard` admin UI.

**Architecture:** Bump Chakra's `fontSizes` theme tokens one notch (single-file change, works everywhere because the codebase already uses named size tokens, not raw pixels). Add Chakra `config` + `semanticTokens.colors` (light/dark pairs) to `theme/index.ts`, consolidate the ~25 redundant per-instance `bg="white"` form-field props into the `Input`/`NumberInput`/`Select`/`Textarea` component `baseStyle`, then sweep every remaining hardcoded color literal (`gray.*`, `white`, `brand.50/600/700`) across the plugin's admin files to the new semantic tokens. Add a sidebar toggle using Chakra's `useColorMode()`.

**Tech Stack:** Chakra UI 2.10 (`extendTheme`, `semanticTokens`, `useColorMode`, `ColorModeScript` — all already available, no new dependency), `react-icons/fi` (`FiSun`/`FiMoon`, already a direct dependency).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-25-font-scale-dark-mode-design.md` — semantic token names/values and the `fontSizes` table below are copied verbatim from it; do not deviate.
- No new npm dependencies.
- Do not touch `red.600`/`orange.600`/`colorScheme="red"`/`colorScheme="green"` status colors, or the `var(--chakra-colors-gray-400)` search-icon color in `ResourceListPage.tsx` — out of scope per the design; Chakra's own built-in components (`Modal`, `AlertDialog`, `Badge`, `Button` colorScheme) are already dark-mode aware out of the box and need no changes.
- Do not change any non-styling logic, JSX structure, prop values other than color/bg literals, or component behavior in any file — every task in this plan is a visual-only change. If a step's "before" code block doesn't match the current file content exactly, stop and report a mismatch rather than guessing.
- `fontSizes` token table (from the design spec):

  | token | old | new |
  |---|---|---|
  | xs | 0.75rem | 0.8125rem |
  | sm | 0.875rem | 0.9375rem |
  | md | 1rem | 1.0625rem |
  | lg | 1.125rem | 1.1875rem |
  | xl | 1.25rem | 1.375rem |
  | 2xl | 1.5rem | 1.625rem |
  | 3xl | 1.875rem | 2rem |

- Semantic color tokens (from the design spec) — `{ default: <light>, _dark: <dark> }` pairs:

  | token | light | dark |
  |---|---|---|
  | `bg.canvas` | `gray.50` | `gray.900` |
  | `bg.surface` | `white` | `gray.800` |
  | `bg.subtle` | `gray.50` | `gray.700` |
  | `border.default` | `gray.100` | `gray.700` |
  | `text.primary` | `gray.800` | `gray.100` |
  | `text.secondary` | `gray.500` | `gray.400` |
  | `accent.bg` | `brand.50` | `rgba(77, 139, 255, 0.16)` |
  | `accent.fg` | `brand.600` | `brand.300` |

- Verification command for every task in this plan (no frontend test harness exists — this is the authoritative type-check gate):
  ```bash
  cd src/plugins/inventory-dashboard && npm run test:ts:front
  ```
  Run it after every task's code changes, before committing.
- Final build check (Task 5 only): `cd src/plugins/inventory-dashboard && npm run build`.

---

### Task 1: Theme foundation (font scale, color-mode config, semantic tokens) + root background

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/theme/index.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`

**Interfaces:**
- Produces: semantic color tokens `bg.canvas`, `bg.surface`, `bg.subtle`, `border.default`, `text.primary`, `text.secondary`, `accent.bg`, `accent.fg` — every later task references these exact string names as `bg`/`color`/`borderColor` prop values. Also produces the bumped `fontSizes` scale (consumed automatically by every existing `fontSize`/`size` prop — no other file needs to change for the font-size half of this plan). `Input`/`NumberInput`/`Select`/`Textarea` now default `bg` to `bg.surface` in their `baseStyle.field` (or `baseStyle` for `Textarea`, which has no `field` part) — later tasks rely on this to justify deleting per-instance `bg="white"` props.

- [ ] **Step 1: Replace the theme file**

```ts
// src/plugins/inventory-dashboard/admin/src/theme/index.ts
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
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
  fontSizes: {
    xs: '0.8125rem',
    sm: '0.9375rem',
    md: '1.0625rem',
    lg: '1.1875rem',
    xl: '1.375rem',
    '2xl': '1.625rem',
    '3xl': '2rem',
  },
  shadows: {
    card: '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
    cardHover: '0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.06)',
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: 'gray.50', _dark: 'gray.900' },
      'bg.surface': { default: 'white', _dark: 'gray.800' },
      'bg.subtle': { default: 'gray.50', _dark: 'gray.700' },
      'border.default': { default: 'gray.100', _dark: 'gray.700' },
      'text.primary': { default: 'gray.800', _dark: 'gray.100' },
      'text.secondary': { default: 'gray.500', _dark: 'gray.400' },
      'accent.bg': { default: 'brand.50', _dark: 'rgba(77, 139, 255, 0.16)' },
      'accent.fg': { default: 'brand.600', _dark: 'brand.300' },
    },
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
            color: 'text.secondary',
            fontSize: 'xs',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
            borderColor: 'border.default',
            py: 3,
          },
          td: { borderColor: 'border.default', py: 3 },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'bg.surface',
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'border.default',
          boxShadow: 'card',
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    NumberInput: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    Select: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { borderRadius: 'lg', bg: 'bg.surface' },
    },
  },
});

export default theme;
```

- [ ] **Step 2: Replace ChakraRoot.tsx**

```tsx
import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import theme from '../theme';

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme} resetCSS={false}>
        <Box bg="bg.canvas" color="text.primary" minH="100%">
          {children}
        </Box>
      </ChakraProvider>
    </>
  );
}
```

`ColorModeScript` matters here specifically because each of the 4 admin entry points (`App.tsx`, `StockPurchaseStandalone.tsx`, `OrderFormStandalone.tsx`, `CatalogStandalone.tsx`) mounts its own fresh `ChakraRoot` when Strapi's own router swaps top-level plugin pages — without it, switching from one to another could show a one-frame flash of the wrong color mode before `useColorMode` settles from `localStorage`.

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/theme/index.ts src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx
git commit -m "feat(inventory-dashboard): bump font scale, add dark-mode theme tokens"
```

---

### Task 2: Dark-mode toggle + AppSidebar sweep

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx`

**Interfaces:**
- Consumes: semantic tokens from Task 1 (`bg.surface`, `bg.subtle`, `border.default`, `text.secondary`, `accent.bg`, `accent.fg`).
- Produces: `ColorModeToggle` component (no props), rendered once inside `AppSidebar` — nothing outside this task needs it.

- [ ] **Step 1: Create ColorModeToggle.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx
import { Box, HStack, Icon, Text, useColorMode } from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  return (
    <Box
      as="button"
      w="100%"
      textAlign="left"
      px={3}
      py={2}
      borderRadius="lg"
      _hover={{ bg: 'bg.subtle' }}
      onClick={toggleColorMode}
    >
      <HStack spacing={3}>
        <Icon as={isDark ? FiSun : FiMoon} boxSize={4} color="text.secondary" />
        <Text fontSize="sm" color="text.secondary">
          {isDark ? 'Light mode' : 'Dark mode'}
        </Text>
      </HStack>
    </Box>
  );
}
```

The label names the mode you'd switch *to* (shows "Light mode" + sun icon while currently dark), matching common toggle conventions.

- [ ] **Step 2: Replace AppSidebar.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';
import { AddNewModal } from './AddNewModal';
import { ColorModeToggle } from './ColorModeToggle';

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
      bg={isActive ? 'accent.bg' : 'transparent'}
      _hover={{ bg: isActive ? 'accent.bg' : 'bg.subtle' }}
      onClick={onClick}
    >
      <HStack spacing={3}>
        <Icon as={IconComp} boxSize={4} color={isActive ? 'accent.fg' : 'text.secondary'} />
        <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'accent.fg' : 'text.secondary'}>
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
    <Box
      as="nav"
      w="240px"
      flexShrink={0}
      bg="bg.surface"
      borderRightWidth="1px"
      borderColor="border.default"
      minH="100%"
      py={6}
      px={4}
      display="flex"
      flexDirection="column"
    >
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
          <Heading size="xs" textTransform="uppercase" color="text.secondary" mb={2} px={3}>
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

      <Box flex={1} />
      <ColorModeToggle />

      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
    </Box>
  );
}
```

`display="flex" flexDirection="column"` plus the `<Box flex={1} />` spacer are the only structural (non-color) changes in this file — they push the new toggle to the bottom of the sidebar, as the design specifies.

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
git commit -m "feat(inventory-dashboard): add dark-mode toggle to sidebar"
```

---

### Task 3: Sweep — shared UI primitives, CatalogHub, Overview, ResourceListPage, FieldRenderer, RelationSelect

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`

**Interfaces:**
- Consumes: semantic tokens from Task 1. No new exports; every component in this task keeps its existing props/signature unchanged.

- [ ] **Step 1: Replace ui/StatCard.tsx**

```tsx
import { Card, CardBody, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { type IconComponent } from '../../config/navConfig';

export function StatCard({ label, value, icon }: { label: string; value: string; icon: IconComponent }) {
  return (
    <Card>
      <CardBody>
        <HStack spacing={4} align="flex-start">
          <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={10} flexShrink={0}>
            <Icon as={icon} boxSize={5} color="accent.fg" />
          </VStack>
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="sm" color="text.secondary" fontWeight="medium">{label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="text.primary">{value}</Text>
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Replace ui/FormField.tsx**

```tsx
import { FormControl, FormLabel, type FormControlProps } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function FormField({
  label, required, children, ...rest
}: { label: string; required?: boolean; children: ReactNode } & FormControlProps) {
  return (
    <FormControl isRequired={required} {...rest}>
      <FormLabel textTransform="capitalize" fontSize="sm" fontWeight="semibold" color="text.secondary">{label}</FormLabel>
      {children}
    </FormControl>
  );
}
```

- [ ] **Step 3: Replace ui/PageHeader.tsx**

```tsx
import { Flex, Heading, HStack } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" mb={8}>
      <Heading size="lg" color="text.primary" fontWeight="bold" textTransform="capitalize">{title}</Heading>
      {actions && <HStack spacing={2}>{actions}</HStack>}
    </Flex>
  );
}
```

- [ ] **Step 4: Replace ui/DataTable.tsx**

```tsx
import { Card, CardBody, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function DataTable({
  columns, isEmpty, emptyLabel = 'No records found', children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
  return (
    <Card overflow="hidden">
      <CardBody p={0}>
        <TableContainer>
          <Table variant="simple">
            <Thead bg="bg.subtle">
              <Tr>
                {columns.map((c) => <Th key={c}>{c}</Th>)}
              </Tr>
            </Thead>
            <Tbody>
              {isEmpty ? (
                <Tr>
                  <Td colSpan={columns.length}>
                    <Text color="text.secondary" textAlign="center" py={6}>{emptyLabel}</Text>
                  </Td>
                </Tr>
              ) : children}
            </Tbody>
          </Table>
        </TableContainer>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 5: Replace FieldRenderer.tsx**

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
            <NumberInputField />
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
          <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
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

- [ ] **Step 6: Replace RelationSelect.tsx**

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

- [ ] **Step 7: Replace AddNewModal.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx
import { lazy, Suspense, useState } from 'react';
import {
  Badge, Box, Card, CardBody, Center, Heading, HStack, Icon, IconButton, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, SimpleGrid, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ADD_NEW_GROUPS, type AddNewItem } from '../config/addNewConfig';

// Lazy-loaded: AddNewModal is rendered unconditionally on every page via
// AppShell/AppSidebar, so a static import here would bundle every wizard's
// form logic (FIFO/pricing lookups, multi-step save/retry state, schema-driven
// field rendering) into the base shell chunk that loads on every page view,
// even when Add New is never opened. Loading these only once a card is picked
// keeps that shell chunk lightweight, matching how these forms were already
// code-split per-route before this modal embedded them.
const InlineResourceForm = lazy(() => import('./InlineResourceForm').then((m) => ({ default: m.InlineResourceForm })));
const ProductVariantsForm = lazy(() => import('./ProductVariantsForm'));
const StockPurchase = lazy(() => import('../pages/StockPurchase'));
const OrderForm = lazy(() => import('../pages/OrderForm'));

export function AddNewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [active, setActive] = useState<AddNewItem | null>(null);

  const backToGrid = () => setActive(null);

  // Closes the modal and resets it back to the picker grid for next time it opens.
  const close = () => {
    onClose();
    setActive(null);
  };

  // For flows with no built-in redirect of their own (the 6 simple resources +
  // Product): land on that entity's list after a successful create, then close.
  const doneToList = () => {
    if (active) navigate(`/plugins/inventory-catalog/${active.slug}`);
    close();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size={active ? '3xl' : '2xl'} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            {active && (
              <IconButton aria-label="Back" icon={<FiArrowLeft />} size="sm" variant="ghost" onClick={backToGrid} />
            )}
            <Text>{active ? `New ${active.label}` : 'Add new'}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {!active && (
            <>
              {ADD_NEW_GROUPS.map((group) => (
                <Box key={group.label} pb={6}>
                  <Heading size="xs" textTransform="uppercase" color="text.secondary" pb={3}>
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
                        onClick={() => setActive(item)}
                      >
                        <CardBody>
                          <HStack justify="space-between">
                            <HStack spacing={3}>
                              <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={9} flexShrink={0}>
                                <Icon as={item.icon} boxSize={4} color="accent.fg" />
                              </VStack>
                              <Text fontSize="sm" fontWeight="semibold" color="text.primary">{item.label}</Text>
                            </HStack>
                            {item.kind === 'wizard' && <Badge colorScheme="brand">Guided</Badge>}
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Box>
              ))}
            </>
          )}

          {active && (
            <Suspense fallback={<Center py={10}><Spinner /></Center>}>
              {active.slug === 'products' && (
                <ProductVariantsForm embedded onDone={doneToList} onCancel={backToGrid} />
              )}
              {active.kind === 'simple' && (
                <InlineResourceForm resource={active.slug} onDone={doneToList} onCancel={backToGrid} />
              )}
              {active.slug === 'stock-purchase' && (
                <StockPurchase embedded onDone={close} onCancel={backToGrid} />
              )}
              {active.slug === 'order' && (
                <OrderForm embedded onDone={close} onCancel={backToGrid} />
              )}
            </Suspense>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
```

- [ ] **Step 8: Replace CatalogHub.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { useEffect, useState } from 'react';
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CATALOG_GROUPS } from '../config/navConfig';

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const slugs = CATALOG_GROUPS.flatMap((g) => g.items.map((i) => i.slug));

    Promise.all(
      slugs.map((slug) =>
        api
          .get<{ pagination: { total: number } }>(`/resources/${slug}`, { pageSize: 1 })
          .then((d) => [slug, d.pagination.total] as const)
          .catch(() => [slug, null] as const)
      )
    ).then((entries) => {
      if (!active) return;
      setCounts(Object.fromEntries(entries) as Record<string, number>);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Box p={8}>
      <PageHeader title="Catalog" />
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} pb={8}>
          <Heading size="md" color="text.primary" pb={4}>
            {group.label}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {group.items.map((item) => (
              <Card
                key={item.slug}
                as="button"
                textAlign="left"
                cursor="pointer"
                transition="box-shadow 0.15s, border-color 0.15s"
                _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                onClick={() => navigate(item.slug)}
              >
                <CardBody>
                  <HStack spacing={4} align="flex-start">
                    <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={10} flexShrink={0}>
                      <Icon as={item.icon} boxSize={5} color="accent.fg" />
                    </VStack>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontSize="sm" color="text.secondary" fontWeight="medium">
                        {item.label}
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="text.primary">
                        {counts[item.slug] ?? '—'}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 9: Replace Overview.tsx**

```tsx
import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
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
              <NumberInputField />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>Save rate</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="text.secondary" pt={1}>Updated: {exchangeRateUpdatedAt}</Text>
        )}
        {saveError && <Text color="red.600" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={4} spacing={4}>
        <StatCard label="Total stock units" value={String(data.totalStockUnits)} icon={FiArchive} />
        <StatCard label="Stock value (USD)" value={`$${data.stockValueUsd.toFixed(2)}`} icon={FiTrendingUp} />
        <StatCard label="Stock value (EGP)" value={`E£${data.stockValueEgp.toFixed(2)}`} icon={FiPieChart} />
        <StatCard label="Exchange rate" value={String(data.exchangeRate)} icon={FiRepeat} />
      </SimpleGrid>

      <Box pt={8}>
        <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">Low stock</Text>
        <DataTable columns={['Variant', 'Qty', 'Threshold']} isEmpty={data.lowStock.length === 0}>
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={8}>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">Expired</Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">Expiring soon (90 days)</Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
```

- [ ] **Step 10: Replace ResourceListPage.tsx**

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
        actions={<Button onClick={() => navigate('new')}>New</Button>}
      />

      <Box pb={4}>
        <InputGroup maxW="sm">
          <InputLeftElement pointerEvents="none"><FiSearch color="var(--chakra-colors-gray-400)" /></InputLeftElement>
          <Input
            aria-label="Search"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            _hover={{ bg: 'bg.subtle' }}
            onClick={() => navigate(row.documentId)}
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
          <AlertDialogContent borderRadius="xl">
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

- [ ] **Step 11: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 12: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/ui/StatCard.tsx src/plugins/inventory-dashboard/admin/src/components/ui/FormField.tsx src/plugins/inventory-dashboard/admin/src/components/ui/PageHeader.tsx src/plugins/inventory-dashboard/admin/src/components/ui/DataTable.tsx src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx
git commit -m "feat(inventory-dashboard): apply dark-mode tokens to shared UI, CatalogHub, Overview, ResourceListPage"
```

---

### Task 4: Sweep — the 3 wizard forms (OrderForm, ProductVariantsForm, StockPurchase)

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`

**Interfaces:**
- Consumes: semantic tokens from Task 1. `onDone`/`onCancel`/`embedded` props and all retry/state-machine logic (`savedProductId`, `variantsCreatedCount`, `variantsSnapshot` in `ProductVariantsForm`; the `embedded ? undefined : params.id` guard in `OrderForm`) are copied through byte-for-byte unchanged from the current files — only `bg`/`color` literal props are touched.
- One accepted side effect: `OrderForm.tsx`'s inline per-row sell-price `NumberInputField` (in the line-items table) currently has no `bg` prop at all (renders transparent against the table row). Since `NumberInput`'s `baseStyle.field.bg` is now `bg.surface` (Task 1), that field will now render with a visible surface background like every other field in the app. This is an intentional, accepted consequence of consolidating the bg default — not a bug to work around.

- [ ] **Step 1: Replace OrderForm.tsx**

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

interface OrderFormProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function OrderForm({ onDone, onCancel, embedded = false }: OrderFormProps = {}) {
  const params = useParams();
  // When embedded (e.g. inside the Add New modal, which is mounted alongside
  // whatever page is currently active), useParams() would otherwise pick up an
  // unrelated `:id` from the ambient route — always force "new order" mode.
  const id = embedded ? undefined : params.id;
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
      onDone?.();
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
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Select customer">
                {customers.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Order date">
              <Input type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const lineItemsStep = (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">Add product</Text>
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label="Product">
                <Select
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
                  <NumberInputField />
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
        <Box mt={4} bg="accent.bg" p={3} borderRadius="lg">
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
              <NumberInputField />
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
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title="New order" />}
      {error && !isSubmitting && draftLines.length === 0 && <Text color="red.600" pb={2}>{error}</Text>}
      <WizardShell steps={steps} onSubmit={saveDraft} submitLabel="Save draft" isSubmitting={isSubmitting} submitError={error} />
      <HStack spacing={2} pt={4}>
        <Button
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : navigate('/plugins/inventory-dashboard/r/orders'))}
          isDisabled={isSubmitting}
        >
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
        <Text fontSize="lg" fontWeight="bold" color="text.primary">{`Order ${order.documentId.slice(0, 8)}`}</Text>
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
        <Text fontSize="lg" fontWeight="semibold" color="text.primary">Totals</Text>
        <Text>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Text>
        <Text>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">Record payment</Text>
        <Card>
          <CardBody>
            <HStack spacing={2} align="flex-end">
              <FormField label="Amount">
                <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
              <FormField label="Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
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

- [ ] **Step 2: Replace ProductVariantsForm.tsx**

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

interface ProductVariantsFormProps {
  onDone: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function ProductVariantsForm({ onDone, onCancel, embedded = false }: ProductVariantsFormProps) {
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
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </GridItem>
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
        </Grid>
      </CardBody>
    </Card>
  );

  const variantsStep = (
    <Box>
      <HStack justify="space-between" pb={2}>
        <Text fontSize="sm" color="text.secondary">Optional — leave empty to keep a single default variant.</Text>
        <Button variant="outline" onClick={addRow}>Add variant</Button>
      </HStack>
      {rows.length > 0 && (
        <Card>
          <CardBody>
            {rows.map((row, i) => (
              <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={i === 0 ? 0 : 4}>
                <GridItem colSpan={4}>
                  <FormField label="Label">
                    <Input value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
                  </FormField>
                </GridItem>
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
                <GridItem colSpan={3}>
                  <FormField label="Low-stock threshold">
                    <NumberInput
                      value={row.lowStockThreshold ?? ''}
                      onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                    >
                      <NumberInputField />
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
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title="New product" />}
      <WizardShell
        steps={steps}
        onSubmit={save}
        submitLabel={savedProductId ? 'Retry remaining steps' : 'Create product'}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <Button variant="ghost" mt={4} onClick={onCancel ?? onDone} isDisabled={isSubmitting}>Cancel</Button>
    </Box>
  );
}
```

- [ ] **Step 3: Replace StockPurchase.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { WizardShell, type WizardStep } from '../components/WizardShell';

interface StockPurchaseProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function StockPurchase({ onDone, onCancel, embedded = false }: StockPurchaseProps = {}) {
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
      onDone?.();
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
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
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
              <Select value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Select product">
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Variant" required>
              <Select
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
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Cost price (USD)" required>
              <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4} />
          <GridItem colSpan={4}>
            <FormField label="Purchase date" required>
              <Input type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Production date">
              <Input type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Expiry date">
              <Input type="date" value={expiryDate ?? ''} onChange={(e) => setExpiryDate(e.target.value || null)} />
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
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title="Record stock purchase" />}
      <WizardShell steps={steps} onSubmit={submit} submitLabel="Record purchase" isSubmitting={isSubmitting} submitError={error} />
      {onCancel && (
        <Button variant="ghost" mt={4} onClick={onCancel} isDisabled={isSubmitting}>Cancel</Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
git commit -m "feat(inventory-dashboard): apply dark-mode tokens to Order/Product/StockPurchase wizards"
```

---

### Task 5: Full build verification

**Files:** none (verification only).

- [ ] **Step 1: Full type-check (front + back) and production build**

Run:
```bash
cd src/plugins/inventory-dashboard && npm run test:ts:front && npm run test:ts:back && npm run build
```
Expected: all three exit 0. Confirm the build output doesn't show any new/unexpected chunk-size regression (compare against the pre-existing `AppShell`/`ProductVariantsForm`/`StockPurchase`/`OrderForm`/`InlineResourceForm` chunk sizes noted in `docs/superpowers/plans/2026-07-24-data-entry-wizard-plan.md`'s history — this task only changes styling, not imports, so sizes should be within a few hundred bytes of before).

- [ ] **Step 2: Report manual QA steps to the user**

No dev server is available in this execution environment. Report to the user that before considering this done, they should run `npm run develop` at the project root and manually: (1) toggle dark mode from the sidebar and confirm no illegible text (dark-on-dark or light-on-light) anywhere across Overview, CatalogHub, a resource list + form, all 9 Add New modal flows, Stock Purchase, Order form, and the confirmed-order payment view; (2) confirm the toggle's choice survives a full page reload and switching between the 4 entry points (Overview, Stock Purchase, New Order, Catalog); (3) confirm text reads noticeably larger than before across the same pages.

- [ ] **Step 3: Commit** (only if Step 1 required any fix; otherwise skip — nothing to commit)
