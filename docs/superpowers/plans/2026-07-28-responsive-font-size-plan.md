# Responsive Layout + Font-Size Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `inventory-dashboard` admin UI responsive from phone width through desktop, and add a user-selectable Small/Medium/Large font-size preference.

**Architecture:** Two independent feature tracks sharing one theme file. Font size: replace the single hardcoded `fontSizes` scale in `theme/index.ts` with three named scales, selected by a new `FontSizeProvider` (a structural copy of the existing `LocaleProvider` pattern: React context + `localStorage`), with a new 3-way sidebar toggle. Responsive layout: `AppShell` gains a mobile hamburger + `Drawer` (reusing `AppSidebar` unchanged) below Chakra's `md` breakpoint, and every fixed-column `SimpleGrid`/`Grid`/`GridItem colSpan` layout across the plugin's pages gets Chakra responsive `{{ base, sm, md, lg }}` props so it collapses toward one column on a phone.

**Tech Stack:** Chakra UI 2.8 (`extendTheme`, `useDisclosure`, `Drawer`, all already available — no new dependency), `react-icons/fi` (`FiMenu`, already a direct dependency).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-28-responsive-font-size-design.md` — the `fontSizes` table and file list below are copied verbatim from it; do not deviate.
- No new npm dependencies.
- Do not change any non-styling/non-layout logic, API calls, retry/state-machine logic (`ProductVariantsForm`'s `savedProductId`/`variantsCreatedCount`/`variantsSnapshot`; `OrderForm`'s `embedded ? undefined : params.id` guard), or navigation targets in any file — every task in this plan is a layout/theme-only change. If a step's "before" code block doesn't match the current file content exactly, stop and report a mismatch rather than guessing.
- No custom Chakra `breakpoints` override — use the defaults already implicitly in use (`base` <30em, `sm` 30em/480px, `md` 48em/768px, `lg` 62em/992px, `xl` 80em/1280px). `md` is the phone/tablet-vs-desktop threshold for the mobile nav drawer.
- `fontSizes` scales (from the design spec) — medium is today's shipped scale, unchanged:

  | token | small | medium (today) | large |
  |---|---|---|---|
  | xs | 0.75rem | 0.8125rem | 0.875rem |
  | sm | 0.875rem | 0.9375rem | 1rem |
  | md | 1rem | 1.0625rem | 1.125rem |
  | lg | 1.125rem | 1.1875rem | 1.25rem |
  | xl | 1.25rem | 1.375rem | 1.5rem |
  | 2xl | 1.5rem | 1.625rem | 1.75rem |
  | 3xl | 1.875rem | 2rem | 2.125rem |

- `localStorage` key for the font-size preference: `inventory-dashboard-font-size` (values: `'small' | 'medium' | 'large'`, default `'medium'`) — mirrors the existing `inventory-dashboard-locale` key used by `LocaleProvider`.
- Chakra's `Drawer` `placement` prop natively supports the logical values `'start'`/`'end'` (confirmed in `@chakra-ui/react`'s `DrawerOptions` type) — use these, not `'left'`/`'right'`, so it flips correctly for the existing RTL (Arabic) support.
- Established convention already in this codebase (commit `b50072e`, "Fix RTL direction not propagating into Chakra modal/dialog portals"): Chakra portals `ModalContent`/`AlertDialogContent` to `document.body`, outside the `dir="rtl"` wrapper `Box` in `ChakraRoot.tsx`, so each of those already sets `dir={locale === 'ar' ? 'rtl' : 'ltr'}` explicitly (see `AddNewModal.tsx`, `QuickCreateSelect.tsx`, `ResourceListPage.tsx`). `Drawer`'s `DrawerContent` uses the exact same portal mechanism (confirmed: `@chakra-ui/react`'s `drawer.d.ts` re-exports `DrawerBody`/`DrawerCloseButton`/etc. directly from the `modal` internals) — Task 3's `DrawerContent` must set the same `dir` prop, for the same reason.
- Verification command for every task in this plan (no frontend test harness exists in this plugin — this is the authoritative gate, same as every prior UI plan in this repo):
  ```bash
  cd src/plugins/inventory-dashboard && npm run test:ts:front
  ```
  Run it after every task's code changes, before committing.
- Final build check (Task 7 only): `cd src/plugins/inventory-dashboard && npm run build`.

---

### Task 1: Font-size preference provider + theme scales

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/theme/FontSizeProvider.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/theme/index.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx`

**Interfaces:**
- Produces: `FontSizePreset` type (`'small' | 'medium' | 'large'`), `FontSizeProvider` component, `useFontSizePreset()` hook returning `{ fontSizePreset, setFontSizePreset }` — Task 2's `FontSizeToggle` consumes this hook. `getTheme(locale, fontSizePreset)` (signature changed from `getTheme(locale)`) — no other file besides `ChakraRoot.tsx` calls `getTheme`.

- [ ] **Step 1: Create theme/FontSizeProvider.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/theme/FontSizeProvider.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type FontSizePreset = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'inventory-dashboard-font-size';

interface FontSizeContextValue {
  fontSizePreset: FontSizePreset;
  setFontSizePreset: (preset: FontSizePreset) => void;
}

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

function isFontSizePreset(value: string | null): value is FontSizePreset {
  return value === 'small' || value === 'medium' || value === 'large';
}

function readInitialFontSizePreset(): FontSizePreset {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isFontSizePreset(stored) ? stored : 'medium';
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSizePreset, setFontSizePresetState] = useState<FontSizePreset>(readInitialFontSizePreset);

  const setFontSizePreset = (next: FontSizePreset) => {
    setFontSizePresetState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(() => ({ fontSizePreset, setFontSizePreset }), [fontSizePreset]);

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSizePreset(): FontSizeContextValue {
  const ctx = useContext(FontSizeContext);
  if (!ctx) throw new Error('useFontSizePreset must be used within FontSizeProvider');
  return ctx;
}
```

- [ ] **Step 2: Replace theme/index.ts**

```ts
// src/plugins/inventory-dashboard/admin/src/theme/index.ts
import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { type Locale } from '../i18n/LocaleProvider';
import { type FontSizePreset } from './FontSizeProvider';

export const themeConfig: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const fontStack = `'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Roboto, sans-serif`;

const fontSizeScales: Record<FontSizePreset, Record<string, string>> = {
  small: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  medium: {
    xs: '0.8125rem',
    sm: '0.9375rem',
    md: '1.0625rem',
    lg: '1.1875rem',
    xl: '1.375rem',
    '2xl': '1.625rem',
    '3xl': '2rem',
  },
  large: {
    xs: '0.875rem',
    sm: '1rem',
    md: '1.125rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '1.75rem',
    '3xl': '2.125rem',
  },
};

const baseTheme = {
  config: themeConfig,
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
    heading: fontStack,
    body: fontStack,
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
};

export function getTheme(locale: Locale, fontSizePreset: FontSizePreset) {
  return extendTheme({
    ...baseTheme,
    fontSizes: fontSizeScales[fontSizePreset],
    direction: locale === 'ar' ? 'rtl' : 'ltr',
  });
}
```

- [ ] **Step 3: Replace ChakraRoot.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx
import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { getTheme, themeConfig } from '../theme';
import { LocaleProvider, useLocale } from '../i18n/LocaleProvider';
import { FontSizeProvider, useFontSizePreset } from '../theme/FontSizeProvider';

function ThemedShell({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const { fontSizePreset } = useFontSizePreset();

  return (
    <ChakraProvider theme={getTheme(locale, fontSizePreset)} resetCSS={false}>
      <Box bg="bg.canvas" color="text.primary" minH="100%" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </Box>
    </ChakraProvider>
  );
}

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={themeConfig.initialColorMode} />
      <LocaleProvider>
        <FontSizeProvider>
          <ThemedShell>{children}</ThemedShell>
        </FontSizeProvider>
      </LocaleProvider>
    </>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/theme/FontSizeProvider.tsx src/plugins/inventory-dashboard/admin/src/theme/index.ts src/plugins/inventory-dashboard/admin/src/components/ChakraRoot.tsx
git commit -m "feat(inventory-dashboard): add font-size preset theme scales + provider"
```

---

### Task 2: Font-size toggle UI + sidebar wiring + translations

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/FontSizeToggle.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`

**Interfaces:**
- Consumes: `useFontSizePreset()` from Task 1.
- Produces: translation key `nav.openMenuAria` — added now (unused until Task 3's mobile hamburger button) so Task 3 doesn't need to touch these two translation files itself.

- [ ] **Step 1: Create components/FontSizeToggle.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/FontSizeToggle.tsx
import { Box, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useFontSizePreset, type FontSizePreset } from '../theme/FontSizeProvider';

const PRESETS: FontSizePreset[] = ['small', 'medium', 'large'];

const PRESET_LETTER: Record<FontSizePreset, string> = { small: 'S', medium: 'M', large: 'L' };

const PRESET_LABEL_ID: Record<FontSizePreset, string> = {
  small: 'fontSize.small',
  medium: 'fontSize.medium',
  large: 'fontSize.large',
};

export function FontSizeToggle() {
  const { fontSizePreset, setFontSizePreset } = useFontSizePreset();
  const intl = useIntl();

  return (
    <Box px={3} py={2}>
      <Text fontSize="xs" color="text.secondary" pb={1}>
        {intl.formatMessage({ id: 'fontSize.label', defaultMessage: 'Text size' })}
      </Text>
      <HStack spacing={1}>
        {PRESETS.map((preset) => {
          const isActive = preset === fontSizePreset;
          return (
            <Box
              key={preset}
              as="button"
              aria-label={intl.formatMessage({ id: PRESET_LABEL_ID[preset] })}
              aria-pressed={isActive}
              flex={1}
              py={1}
              borderRadius="md"
              textAlign="center"
              bg={isActive ? 'accent.bg' : 'transparent'}
              color={isActive ? 'accent.fg' : 'text.secondary'}
              fontWeight={isActive ? 'semibold' : 'normal'}
              fontSize="sm"
              _hover={{ bg: isActive ? 'accent.bg' : 'bg.subtle' }}
              onClick={() => setFontSizePreset(preset)}
            >
              {PRESET_LETTER[preset]}
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}
```

- [ ] **Step 2: Replace AppSidebar.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';
import { AddNewModal } from './AddNewModal';
import { ColorModeToggle } from './ColorModeToggle';
import { FontSizeToggle } from './FontSizeToggle';
import { LanguageToggle } from './LanguageToggle';

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
      textAlign="start"
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
  const intl = useIntl();
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);

  return (
    <Box
      as="nav"
      w="240px"
      flexShrink={0}
      bg="bg.surface"
      borderInlineEndWidth="1px"
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
        {intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
      </Button>

      <VStack align="stretch" spacing={1} pb={6}>
        {TOP_LINKS.map((link) => (
          <NavButton
            key={link.to}
            label={intl.formatMessage({ id: link.labelId })}
            icon={link.icon}
            isActive={isLinkActive(pathname, link.to)}
            onClick={() => navigate(link.to)}
          />
        ))}
      </VStack>

      {CATALOG_GROUPS.map((group) => (
        <Box key={group.labelId} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="text.secondary" mb={2} px={3}>
            {intl.formatMessage({ id: group.labelId })}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const to = `/plugins/inventory-catalog/${item.slug}`;
              return (
                <NavButton
                  key={item.slug}
                  label={intl.formatMessage({ id: item.labelId })}
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
      <LanguageToggle />
      <FontSizeToggle />
      <ColorModeToggle />

      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
    </Box>
  );
}
```

- [ ] **Step 3: Add translation keys to i18n/en.ts**

Insert these lines right after the existing `'theme.darkMode': 'Dark mode',` line:

```ts
  'fontSize.label': 'Text size',
  'fontSize.small': 'Small',
  'fontSize.medium': 'Medium',
  'fontSize.large': 'Large',
```

Insert this line right before the existing `'nav.overview': 'Overview',` line:

```ts
  'nav.openMenuAria': 'Open menu',
```

- [ ] **Step 4: Add translation keys to i18n/ar.ts**

Insert these lines right after the existing `'theme.darkMode': 'الوضع الداكن',` line:

```ts
  'fontSize.label': 'حجم النص',
  'fontSize.small': 'صغير',
  'fontSize.medium': 'متوسط',
  'fontSize.large': 'كبير',
```

Insert this line right before the existing `'nav.overview': 'نظرة عامة',` line:

```ts
  'nav.openMenuAria': 'فتح القائمة',
```

- [ ] **Step 5: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors. (`ar.ts`'s `Record<keyof typeof en, string>` type will fail to compile if any key added to `en.ts` in Step 3 is missing from `ar.ts` — this is the mechanism that catches a forgotten translation.)

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/FontSizeToggle.tsx src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx src/plugins/inventory-dashboard/admin/src/i18n/en.ts src/plugins/inventory-dashboard/admin/src/i18n/ar.ts
git commit -m "feat(inventory-dashboard): add font-size toggle to sidebar"
```

---

### Task 3: Mobile navigation drawer + wizard stepper mobile tweak

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx`

**Interfaces:**
- Consumes: `nav.openMenuAria` translation key from Task 2. `AppSidebar` (unchanged, reused as-is — both the always-visible desktop copy and the mobile Drawer's copy are the same component).
- Produces: no new exports; `AppShell`'s `{ children: ReactNode }` prop signature is unchanged.

- [ ] **Step 1: Replace AppShell.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
import { useEffect, type ReactNode } from 'react';
import {
  Box, Drawer, DrawerBody, DrawerContent, DrawerOverlay, Flex, HStack, Icon, IconButton, useDisclosure,
} from '@chakra-ui/react';
import { FiMenu } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { AppSidebar } from './AppSidebar';

function MobileTopBar({ onOpen }: { onOpen: () => void }) {
  const intl = useIntl();

  return (
    <HStack
      display={{ base: 'flex', md: 'none' }}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      px={4}
      py={3}
      flexShrink={0}
    >
      <IconButton
        aria-label={intl.formatMessage({ id: 'nav.openMenuAria', defaultMessage: 'Open menu' })}
        icon={<Icon as={FiMenu} boxSize={5} />}
        variant="ghost"
        onClick={onOpen}
      />
    </HStack>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { locale } = useLocale();
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes (e.g. a nav link was
  // tapped) — AppSidebar's own nav buttons have no knowledge of the drawer,
  // so this is the only hook point available without modifying them.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Flex minH="100%" direction="column">
      <MobileTopBar onOpen={onOpen} />
      <Flex flex={1} minH={0}>
        <Box display={{ base: 'none', md: 'block' }}>
          <AppSidebar />
        </Box>
        <Drawer isOpen={isOpen} placement="start" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent maxW="240px" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <DrawerBody p={0}>
              <AppSidebar />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        <Box flex={1} minW={0}>{children}</Box>
      </Flex>
    </Flex>
  );
}
```

- [ ] **Step 2: Replace WizardShell.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx
import { type ReactNode } from 'react';
import {
  Box, Button, HStack, Step, StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, Text, useSteps,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';

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
  const intl = useIntl();
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
            <Box flexShrink={0} display={{ base: 'none', md: 'block' }}>
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
          <Button variant="ghost" onClick={goBack} isDisabled={isSubmitting}>
            {intl.formatMessage({ id: 'common.back', defaultMessage: 'Back' })}
          </Button>
        )}
        {!isLastStep && (
          <Button onClick={goNext} isDisabled={!canAdvance}>
            {intl.formatMessage({ id: 'common.next', defaultMessage: 'Next' })}
          </Button>
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

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx src/plugins/inventory-dashboard/admin/src/components/WizardShell.tsx
git commit -m "feat(inventory-dashboard): add mobile nav drawer, compact stepper on mobile"
```

---

### Task 4: Responsive sweep — Overview, CatalogHub, AddNewModal

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx`

**Interfaces:**
- No new exports; only style-prop values change (`p`, `columns`, `colSpan`, `size`).

- [ ] **Step 1: Replace Overview.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx
import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';

export default function Overview() {
  const intl = useIntl();
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
      setSaveError(intl.formatMessage({ id: 'overview.invalidRateError', defaultMessage: 'Enter a valid exchange rate' }));
      return;
    }
    try {
      await save(rateInput);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'overview.saveRateError', defaultMessage: 'Could not save rate' }));
    }
  };

  if (error) {
    return (
      <Box p={{ base: 4, md: 8 }}>
        <Text color="red.600">{intl.formatMessage({ id: 'overview.loadError', defaultMessage: 'Could not load overview data' })}</Text>
      </Box>
    );
  }

  if (loading || !data) {
    return <Box p={{ base: 4, md: 8 }}><Text>{intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' })}</Text></Box>;
  }

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.overview', defaultMessage: 'Overview' })} />

      <Box pb={6}>
        <HStack spacing={2} align="flex-end">
          <FormField label={intl.formatMessage({ id: 'overview.exchangeRateLabel', defaultMessage: 'Exchange rate (EGP per USD)' })} maxW="xs">
            <NumberInput value={rateInput ?? ''} onChange={(_, v) => setRateInput(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>{intl.formatMessage({ id: 'overview.saveRateButton', defaultMessage: 'Save rate' })}</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="text.secondary" pt={1}>
            {intl.formatMessage({ id: 'overview.updatedLabel', defaultMessage: 'Updated: {date}' }, { date: exchangeRateUpdatedAt })}
          </Text>
        )}
        {saveError && <Text color="red.600" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
        <StatCard label={intl.formatMessage({ id: 'overview.stat.totalStockUnits', defaultMessage: 'Total stock units' })} value={String(data.totalStockUnits)} icon={FiArchive} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.stockValueUsd', defaultMessage: 'Stock value (USD)' })} value={`$${data.stockValueUsd.toFixed(2)}`} icon={FiTrendingUp} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.stockValueEgp', defaultMessage: 'Stock value (EGP)' })} value={`E£${data.stockValueEgp.toFixed(2)}`} icon={FiPieChart} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.exchangeRate', defaultMessage: 'Exchange rate' })} value={String(data.exchangeRate)} icon={FiRepeat} />
      </SimpleGrid>

      <Box pt={8}>
        <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
          {intl.formatMessage({ id: 'overview.lowStockTitle', defaultMessage: 'Low stock' })}
        </Text>
        <DataTable
          columns={[
            intl.formatMessage({ id: 'overview.col.variant', defaultMessage: 'Variant' }),
            intl.formatMessage({ id: 'overview.col.qty', defaultMessage: 'Qty' }),
            intl.formatMessage({ id: 'overview.col.threshold', defaultMessage: 'Threshold' }),
          ]}
          isEmpty={data.lowStock.length === 0}
        >
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={8}>
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiredTitle', defaultMessage: 'Expired' })}
          </Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiringSoonTitle', defaultMessage: 'Expiring soon (90 days)' })}
          </Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
```

- [ ] **Step 2: Replace CatalogHub.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { useEffect, useState } from 'react';
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CATALOG_GROUPS } from '../config/navConfig';

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();
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
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.catalog', defaultMessage: 'Catalog' })} />
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.labelId} pb={8}>
          <Heading size="md" color="text.primary" pb={4}>
            {intl.formatMessage({ id: group.labelId })}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {group.items.map((item) => (
              <Card
                key={item.slug}
                as="button"
                textAlign="start"
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
                        {intl.formatMessage({ id: item.labelId })}
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

- [ ] **Step 3: Modify AddNewModal.tsx's Modal size**

In `src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx`, change:

```tsx
    <Modal isOpen={isOpen} onClose={close} size={active ? '3xl' : '2xl'} scrollBehavior="inside">
```

to:

```tsx
    <Modal isOpen={isOpen} onClose={close} size={{ base: 'full', md: active ? '3xl' : '2xl' }} scrollBehavior="inside">
```

No other line in this file changes.

- [ ] **Step 4: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx
git commit -m "feat(inventory-dashboard): responsive layout for Overview, CatalogHub, Add New modal"
```

---

### Task 5: Responsive sweep — OrderForm

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx`

**Interfaces:**
- No new exports; only style-prop values change (`p`, `colSpan`). All API calls, FIFO/pricing logic, and the `embedded` guard are unchanged.

- [ ] **Step 1: Replace OrderForm.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';

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
  const intl = useIntl();
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
  const defaultVariantLabel = intl.formatMessage({ id: 'orderForm.defaultVariantLabel', defaultMessage: 'Default' });

  const addLine = async () => {
    if (!addVariantId || !priceListId) return;
    setError(null);
    // FIFO segments for the chosen variant + quantity
    const fifo = await api.get<{ segments: any[]; shortfall: number }>(
      `/fifo/${addVariantId}`, { quantity: addQty ?? 1 }
    );
    if (fifo.shortfall > 0) {
      setError(intl.formatMessage(
        { id: 'orderForm.shortfallError', defaultMessage: 'Not enough stock: short by {count} unit(s).' },
        { count: fifo.shortfall }
      ));
    }

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
        variantLabel: variant?.label ?? defaultVariantLabel,
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
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.saveDraftError', defaultMessage: 'Could not save order' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    try { await confirm(); reload(); }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.confirmError', defaultMessage: 'Could not confirm order' })); }
  };

  // ----- confirmed view (read-only lines + payments) -----
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} />;
  }

  const customerStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <QuickCreateSelect
              resource="customers"
              label={intl.formatMessage({ id: 'field.customer', defaultMessage: 'Customer' })}
              required
              value={customerId}
              onChange={setCustomerId}
              options={customers}
              onCreated={(c) => setCustomers((prev) => [...prev, c])}
            />
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'orderForm.orderDateLabel', defaultMessage: 'Order date' })}>
              <Input type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const lineItemsStep = (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">
        {intl.formatMessage({ id: 'orderForm.addProductTitle', defaultMessage: 'Add product' })}
      </Text>
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
              <FormField label={intl.formatMessage({ id: 'field.product', defaultMessage: 'Product' })}>
                <Select
                  value={addProductId}
                  onChange={(e) => { setAddProductId(e.target.value); setAddVariantId(''); }}
                  placeholder={intl.formatMessage({ id: 'orderForm.selectProductPlaceholder', defaultMessage: 'Select product' })}
                >
                  {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
              <FormField label={intl.formatMessage({ id: 'orderForm.variantFieldLabel', defaultMessage: 'Variant' })}>
                <Select
                  value={addVariantId}
                  onChange={(e) => setAddVariantId(e.target.value)}
                  isDisabled={!addProductId}
                  placeholder={intl.formatMessage({ id: 'orderForm.selectVariantPlaceholder', defaultMessage: 'Select variant' })}
                >
                  {variantsForProduct.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? defaultVariantLabel}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
              <FormField label={intl.formatMessage({ id: 'orderForm.quantityLabel', defaultMessage: 'Quantity' })}>
                <NumberInput value={addQty ?? ''} onChange={(_, v) => setAddQty(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={{ base: 12, sm: 6, md: 1 }} display="flex" alignItems="flex-end">
              <Button onClick={addLine} isDisabled={!addVariantId}>
                {intl.formatMessage({ id: 'orderForm.addButton', defaultMessage: 'Add' })}
              </Button>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      {relatedSuggestions.length > 0 && (
        <Box mt={4} bg="accent.bg" p={3} borderRadius="lg">
          <Text as="span" fontSize="sm">
            {intl.formatMessage({ id: 'orderForm.crossSellLabel', defaultMessage: 'Customers also buy:' })}&nbsp;
          </Text>
          {relatedSuggestions.map((rp: any) => (
            <Button
              key={rp.documentId}
              variant="link"
              size="sm"
              me={2}
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}
            >
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box pt={6}>
        <DataTable
          columns={[
            intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
            intl.formatMessage({ id: 'orderForm.col.batch', defaultMessage: 'Batch' }),
            intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
            intl.formatMessage({ id: 'orderForm.col.sellEgp', defaultMessage: 'Sell (EGP)' }),
            intl.formatMessage({ id: 'orderForm.col.costEgp', defaultMessage: 'Cost EGP' }),
            intl.formatMessage({ id: 'orderForm.col.flag', defaultMessage: 'Flag' }),
          ]}
          isEmpty={draftLines.length === 0}
        >
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
                    <NumberInputField aria-label={intl.formatMessage({ id: 'orderForm.sellAria', defaultMessage: 'sell' })} />
                  </NumberInput>
                </Td>
                <Td>{costEgp.toFixed(2)}</Td>
                <Td>
                  {below ? (
                    <Badge colorScheme="red">{intl.formatMessage({ id: 'orderForm.belowCostBadge', defaultMessage: 'Below cost' })}</Badge>
                  ) : null}
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={6}>
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
          <FormField label={intl.formatMessage({ id: 'orderForm.discountLabel', defaultMessage: 'Discount (EGP)' })}>
            <NumberInput value={discount ?? ''} onChange={(_, v) => setDiscount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }} display="flex" alignItems="flex-end">
          <Text>{intl.formatMessage({ id: 'orderForm.subtotalLabel', defaultMessage: 'Subtotal:' })} {subtotal.toFixed(2)} EGP</Text>
        </GridItem>
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }} display="flex" alignItems="flex-end">
          <Text fontSize="lg" fontWeight="semibold">
            {intl.formatMessage({ id: 'orderForm.totalLabel', defaultMessage: 'Total:' })} {finalTotal.toFixed(2)} EGP
          </Text>
        </GridItem>
      </Grid>
    </Box>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'orderForm.review.customerLabel', defaultMessage: 'Customer:' })}</b> {customers.find((c) => c.documentId === customerId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'orderForm.review.orderDateLabel', defaultMessage: 'Order date:' })}</b> {orderDate ?? '—'}</Text>
        <Box pt={4}>
          <DataTable
            columns={[
              intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
              intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
              intl.formatMessage({ id: 'orderForm.col.sellEgp', defaultMessage: 'Sell (EGP)' }),
            ]}
            isEmpty={draftLines.length === 0}
          >
            {draftLines.map((l, i) => (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice.toFixed(2)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Box>
        <Text pt={4}>
          <b>{intl.formatMessage({ id: 'orderForm.review.discountLabel', defaultMessage: 'Discount:' })}</b> {(discount ?? 0).toFixed(2)} EGP
        </Text>
        <Text fontSize="lg" fontWeight="semibold">
          {intl.formatMessage({ id: 'orderForm.totalLabel', defaultMessage: 'Total:' })} {finalTotal.toFixed(2)} EGP
        </Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'orderForm.step.customerDate', defaultMessage: 'Customer & Date' }),
      content: customerStep,
      isValid: () => Boolean(customerId),
    },
    {
      label: intl.formatMessage({ id: 'orderForm.step.lineItems', defaultMessage: 'Line Items' }),
      content: lineItemsStep,
      isValid: () => draftLines.length > 0,
    },
    {
      label: intl.formatMessage({ id: 'orderForm.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : { base: 4, md: 8 }}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'orderForm.pageTitle', defaultMessage: 'New order' })} />}
      {error && !isSubmitting && draftLines.length === 0 && <Text color="red.600" pb={2}>{error}</Text>}
      <WizardShell
        steps={steps}
        onSubmit={saveDraft}
        submitLabel={intl.formatMessage({ id: 'orderForm.saveDraftButton', defaultMessage: 'Save draft' })}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <HStack spacing={2} pt={4}>
        <Button
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : navigate('/plugins/inventory-dashboard/r/orders'))}
          isDisabled={isSubmitting}
        >
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
        {id && (
          <Button colorScheme="green" onClick={onConfirm}>
            {intl.formatMessage({ id: 'orderForm.confirmOrderButton', defaultMessage: 'Confirm order' })}
          </Button>
        )}
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
  const intl = useIntl();
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
    <Box p={{ base: 4, md: 8 }}>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="lg" fontWeight="bold" color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.orderTitle', defaultMessage: 'Order {id}' }, { id: order.documentId.slice(0, 8) })}
        </Text>
        <Badge fontSize="sm">{order.status}</Badge>
      </HStack>

      <DataTable
        columns={[
          intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
          intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
          intl.formatMessage({ id: 'orderForm.confirmed.col.sell', defaultMessage: 'Sell' }),
          intl.formatMessage({ id: 'orderForm.confirmed.col.costUsdSnap', defaultMessage: 'Cost USD snap' }),
          intl.formatMessage({ id: 'orderForm.col.flag', defaultMessage: 'Flag' }),
        ]}
        isEmpty={order.lines.length === 0}
      >
        {order.lines.map((l: any) => (
          <Tr key={l.documentId}>
            <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
            <Td>{l.quantitySold}</Td>
            <Td>{l.sellPrice}</Td>
            <Td>{l.costPriceUsdSnapshot}</Td>
            <Td>
              {l.belowCost ? (
                <Badge colorScheme="red">{intl.formatMessage({ id: 'orderForm.belowCostBadge', defaultMessage: 'Below cost' })}</Badge>
              ) : null}
            </Td>
          </Tr>
        ))}
      </DataTable>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.totalsTitle', defaultMessage: 'Totals' })}
        </Text>
        <Text>
          {intl.formatMessage(
            { id: 'orderForm.confirmed.totalsSummary', defaultMessage: 'Subtotal: {subtotal} | Final: {final} | Profit: {profit}' },
            { subtotal: order.totals.subtotal, final: order.totals.finalTotal, profit: order.totals.netProfit }
          )}
        </Text>
        <Text>
          {intl.formatMessage(
            { id: 'orderForm.confirmed.paymentSummary', defaultMessage: 'Paid: {paid} | Balance due: {due}' },
            { paid: order.totals.totalPaid, due: order.totals.balanceDue }
          )}
        </Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.recordPaymentTitle', defaultMessage: 'Record payment' })}
        </Text>
        <Card>
          <CardBody>
            <HStack spacing={2} align="flex-end">
              <FormField label={intl.formatMessage({ id: 'orderForm.confirmed.amountLabel', defaultMessage: 'Amount' })}>
                <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
              <FormField label={intl.formatMessage({ id: 'orderForm.confirmed.methodLabel', defaultMessage: 'Method' })}>
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">{intl.formatMessage({ id: 'orderForm.confirmed.paymentMethodCash', defaultMessage: 'cash' })}</option>
                  <option value="transfer">{intl.formatMessage({ id: 'orderForm.confirmed.paymentMethodTransfer', defaultMessage: 'transfer' })}</option>
                </Select>
              </FormField>
              <Button onClick={addPayment} isDisabled={!amount}>
                {intl.formatMessage({ id: 'orderForm.confirmed.addPaymentButton', defaultMessage: 'Add payment' })}
              </Button>
            </HStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
git commit -m "feat(inventory-dashboard): responsive layout for OrderForm"
```

---

### Task 6: Responsive sweep — StockPurchase, ProductVariantsForm

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`

**Interfaces:**
- No new exports; only style-prop values change. All API calls and the retry state machine (`savedProductId`, `variantsCreatedCount`, `variantsSnapshot`) in `ProductVariantsForm` are unchanged.

- [ ] **Step 1: Replace StockPurchase.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';

interface StockPurchaseProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function StockPurchase({ onDone, onCancel, embedded = false }: StockPurchaseProps = {}) {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();
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

  const defaultVariantLabel = intl.formatMessage({ id: 'stockPurchase.defaultVariantLabel', defaultMessage: 'Default' });

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
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'stockPurchase.saveError', defaultMessage: 'Could not record purchase' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplierStep = (
    <Card>
      <CardBody>
        <QuickCreateSelect
          resource="suppliers"
          label={intl.formatMessage({ id: 'field.supplier', defaultMessage: 'Supplier' })}
          required
          value={supplierId}
          onChange={setSupplierId}
          options={suppliers}
          onCreated={(s) => setSuppliers((prev) => [...prev, s])}
        />
      </CardBody>
    </Card>
  );

  const productStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'field.product', defaultMessage: 'Product' })} required>
              <Select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={intl.formatMessage({ id: 'stockPurchase.selectProductPlaceholder', defaultMessage: 'Select product' })}
              >
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.variantFieldLabel', defaultMessage: 'Variant' })} required>
              <Select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                isDisabled={!productId}
                placeholder={intl.formatMessage({ id: 'stockPurchase.selectVariantPlaceholder', defaultMessage: 'Select variant' })}
              >
                {variants.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? defaultVariantLabel}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.quantityPurchasedLabel', defaultMessage: 'Quantity purchased' })} required>
              <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.costPriceLabel', defaultMessage: 'Cost price (USD)' })} required>
              <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }} display={{ base: 'none', md: 'block' }} />
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.purchaseDateLabel', defaultMessage: 'Purchase date' })} required>
              <Input type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.productionDateLabel', defaultMessage: 'Production date' })}>
              <Input type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.expiryDateLabel', defaultMessage: 'Expiry date' })}>
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
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.supplierLabel', defaultMessage: 'Supplier:' })}</b> {suppliers.find((s) => s.documentId === supplierId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.productLabel', defaultMessage: 'Product:' })}</b> {products.find((p) => p.documentId === productId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.variantLabel', defaultMessage: 'Variant:' })}</b> {variants.find((v) => v.documentId === variantId)?.label ?? defaultVariantLabel}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.quantityLabel', defaultMessage: 'Quantity:' })}</b> {qty ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.costPriceLabel', defaultMessage: 'Cost price (USD):' })}</b> {cost ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.purchaseDateLabel', defaultMessage: 'Purchase date:' })}</b> {purchaseDate ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.productionDateLabel', defaultMessage: 'Production date:' })}</b> {productionDate ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.expiryDateLabel', defaultMessage: 'Expiry date:' })}</b> {expiryDate ?? '—'}</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'field.supplier', defaultMessage: 'Supplier' }),
      content: supplierStep,
      isValid: () => Boolean(supplierId),
    },
    {
      label: intl.formatMessage({ id: 'stockPurchase.step.productQuantity', defaultMessage: 'Product & Quantity' }),
      content: productStep,
      isValid: () => Boolean(productId && variantId && qty && cost && purchaseDate),
    },
    {
      label: intl.formatMessage({ id: 'stockPurchase.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : { base: 4, md: 8 }}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'stockPurchase.pageTitle', defaultMessage: 'Record stock purchase' })} />}
      <WizardShell
        steps={steps}
        onSubmit={submit}
        submitLabel={intl.formatMessage({ id: 'stockPurchase.recordButton', defaultMessage: 'Record purchase' })}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      {onCancel && (
        <Button variant="ghost" mt={4} onClick={onCancel} isDisabled={isSubmitting}>
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
      )}
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
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';
import { WizardShell, type WizardStep } from './WizardShell';
import { QuickCreateSelect } from './QuickCreateSelect';

interface VariantRow { label: string; variantTypeId: string; lowStockThreshold?: number; }

interface ProductVariantsFormProps {
  onDone: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function ProductVariantsForm({ onDone, onCancel, embedded = false }: ProductVariantsFormProps) {
  const api = useApi();
  const intl = useIntl();
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
      setError(intl.formatMessage({ id: 'productWizard.variantNeedsTypeError', defaultMessage: 'Each variant needs a type.' }));
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
          (productId
            ? intl.formatMessage({
                id: 'productWizard.partialSaveError',
                defaultMessage: 'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.',
              })
            : intl.formatMessage({ id: 'productWizard.createError', defaultMessage: 'Could not create product' }))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const nameLabel = intl.formatMessage({ id: 'field.name', defaultMessage: 'Name' });
  const brandLabel = intl.formatMessage({ id: 'field.brand', defaultMessage: 'Brand' });
  const categoryLabel = intl.formatMessage({ id: 'field.category', defaultMessage: 'Category' });
  const rowLabelLabel = intl.formatMessage({ id: 'field.label', defaultMessage: 'Label' });
  const variantTypeLabel = intl.formatMessage({ id: 'field.variantType', defaultMessage: 'Variant Type' });
  const lowStockThresholdLabel = intl.formatMessage({ id: 'field.lowStockThreshold', defaultMessage: 'Low-stock Threshold' });

  const productInfoStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={nameLabel} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <QuickCreateSelect
              resource="brands"
              label={brandLabel}
              required
              value={brandId}
              onChange={setBrandId}
              options={brands}
              onCreated={(b) => setBrands((prev) => [...prev, b])}
            />
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <QuickCreateSelect
              resource="categories"
              label={categoryLabel}
              required
              value={categoryId}
              onChange={setCategoryId}
              options={categories}
              onCreated={(c) => setCategories((prev) => [...prev, c])}
            />
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const variantsStep = (
    <Box>
      <HStack justify="space-between" pb={2}>
        <Text fontSize="sm" color="text.secondary">
          {intl.formatMessage({ id: 'productWizard.variantsHint', defaultMessage: 'Optional — leave empty to keep a single default variant.' })}
        </Text>
        <Button variant="outline" onClick={addRow}>
          {intl.formatMessage({ id: 'productWizard.addVariantButton', defaultMessage: 'Add variant' })}
        </Button>
      </HStack>
      {rows.length > 0 && (
        <Card>
          <CardBody>
            {rows.map((row, i) => (
              <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={i === 0 ? 0 : 4}>
                <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
                  <FormField label={rowLabelLabel}>
                    <Input value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
                  </FormField>
                </GridItem>
                <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
                  <QuickCreateSelect
                    resource="variant-types"
                    label={variantTypeLabel}
                    value={row.variantTypeId}
                    onChange={(v) => updateRow(i, { variantTypeId: v })}
                    options={variantTypes}
                    onCreated={(t) => setVariantTypes((prev) => [...prev, t])}
                  />
                </GridItem>
                <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
                  <FormField label={lowStockThresholdLabel}>
                    <NumberInput
                      value={row.lowStockThreshold ?? ''}
                      onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                    >
                      <NumberInputField />
                    </NumberInput>
                  </FormField>
                </GridItem>
                <GridItem colSpan={{ base: 12, sm: 6, md: 1 }} display="flex" alignItems="flex-end">
                  <IconButton
                    aria-label={intl.formatMessage({ id: 'productWizard.removeVariantAria', defaultMessage: 'Remove' })}
                    icon={<FiTrash2 />}
                    onClick={() => removeRow(i)}
                  />
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
        <FormField label={intl.formatMessage({ id: 'productWizard.addRelatedProductLabel', defaultMessage: 'Add related product' })}>
          <Select
            value=""
            onChange={(e) => setRelatedIds((ids) => (ids.includes(e.target.value) ? ids : [...ids, e.target.value]))}
            placeholder={intl.formatMessage({ id: 'productWizard.selectProductPlaceholder', defaultMessage: 'Select product' })}
          >
            {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
          </Select>
        </FormField>
        <Box pt={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Text key={id} display="inline-block" pe={2}>{p?.name ?? id}</Text>;
          })}
        </Box>
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'productWizard.review.nameLabel', defaultMessage: 'Name:' })}</b> {name || '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'productWizard.review.brandLabel', defaultMessage: 'Brand:' })}</b> {brands.find((b) => b.documentId === brandId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'productWizard.review.categoryLabel', defaultMessage: 'Category:' })}</b> {categories.find((c) => c.documentId === categoryId)?.name ?? '—'}</Text>
        <Text pt={2}>
          <b>{intl.formatMessage({ id: 'productWizard.review.variantsLabel', defaultMessage: 'Variants:' })}</b>{' '}
          {explicitVariants.length === 0
            ? intl.formatMessage({ id: 'productWizard.review.singleDefaultVariant', defaultMessage: 'Single default variant' })
            : explicitVariants
                .map((r) => r.label || intl.formatMessage({ id: 'productWizard.review.unnamed', defaultMessage: '(unnamed)' }))
                .join(', ')}
        </Text>
        <Text pt={2}>
          <b>{intl.formatMessage({ id: 'productWizard.review.relatedProductsLabel', defaultMessage: 'Related products:' })}</b>{' '}
          {relatedIds.length === 0
            ? intl.formatMessage({ id: 'productWizard.review.none', defaultMessage: 'None' })
            : relatedIds.map((id) => products.find((p) => p.documentId === id)?.name ?? id).join(', ')}
        </Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'productWizard.step.productInfo', defaultMessage: 'Product Info' }),
      content: productInfoStep,
      isValid: () => Boolean(name && brandId && categoryId),
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.variants', defaultMessage: 'Variants' }),
      content: variantsStep,
      isValid: () => explicitVariants.every((r) => r.variantTypeId),
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.relatedProducts', defaultMessage: 'Related Products' }),
      content: relatedStep,
      isValid: () => true,
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : { base: 4, md: 8 }}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'productWizard.pageTitle', defaultMessage: 'New product' })} />}
      <WizardShell
        steps={steps}
        onSubmit={save}
        submitLabel={
          savedProductId
            ? intl.formatMessage({ id: 'productWizard.retryButton', defaultMessage: 'Retry remaining steps' })
            : intl.formatMessage({ id: 'productWizard.createButton', defaultMessage: 'Create product' })
        }
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <Button variant="ghost" mt={4} onClick={onCancel ?? onDone} isDisabled={isSubmitting}>
        {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
      </Button>
    </Box>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
git commit -m "feat(inventory-dashboard): responsive layout for StockPurchase, ProductVariantsForm"
```

---

### Task 7: Responsive sweep — ResourceFormPage, ResourceListPage, InlineResourceForm + final verification

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx`

**Interfaces:**
- No new exports; only style-prop values change. `normalize`/`serialize` helper functions and all navigation targets are unchanged.

- [ ] **Step 1: Replace ResourceFormPage.tsx**

```tsx
// src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';
import { getResourceLabel } from '../i18n/resourceLabels';

export default function ResourceFormPage() {
  const { resource = '', id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
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
      navigate('..', { relative: 'path' });
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Save failed' }));
    }
  };

  // Bespoke product-with-variants flow on create
  if (resource === 'products' && !isEdit) {
    return <ProductVariantsForm onDone={() => navigate('..', { relative: 'path' })} />;
  }

  const resourceLabel = getResourceLabel(intl, resource);

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader
        title={
          isEdit
            ? intl.formatMessage({ id: 'resourceForm.editTitle', defaultMessage: 'Edit {label}' }, { label: resourceLabel })
            : intl.formatMessage({ id: 'addNew.newItemTitle', defaultMessage: 'New {label}' }, { label: resourceLabel })
        }
      />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            {editableFields.map((f) => (
              <GridItem key={f.name} colSpan={{ base: 12, md: 6 }}>
                <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
              </GridItem>
            ))}
          </Grid>
        </CardBody>
      </Card>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit}>{intl.formatMessage({ id: 'common.save', defaultMessage: 'Save' })}</Button>
        <Button variant="ghost" onClick={() => navigate('..', { relative: 'path' })}>
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
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

- [ ] **Step 2: Modify ResourceListPage.tsx's page padding**

In `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`, change:

```tsx
  return (
    <Box p={8}>
```

to:

```tsx
  return (
    <Box p={{ base: 4, md: 8 }}>
```

No other line in this file changes.

- [ ] **Step 3: Modify InlineResourceForm.tsx's grid**

In `src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx`, change:

```tsx
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        {editableFields.map((f) => (
          <GridItem key={f.name} colSpan={6}>
```

to:

```tsx
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        {editableFields.map((f) => (
          <GridItem key={f.name} colSpan={{ base: 12, md: 6 }}>
```

No other line in this file changes.

- [ ] **Step 4: Type-check**

Run: `cd src/plugins/inventory-dashboard && npm run test:ts:front`
Expected: exits 0, no errors.

- [ ] **Step 5: Full build check**

Run: `cd src/plugins/inventory-dashboard && npm run build`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx
git commit -m "feat(inventory-dashboard): responsive layout for ResourceFormPage, ResourceListPage, InlineResourceForm"
```

- [ ] **Step 7: Manual verification pass**

No automated visual regression tooling exists in this repo, so confirm by hand (use the `run` skill or `npm run develop` from the repo root, then open the Strapi admin at the plugin's routes). At minimum, check:
- Resize the browser to ~375px (phone), ~768px (tablet), and ~1280px+ (desktop) widths.
- At phone/tablet width: the sidebar is hidden and a hamburger button opens it in a slide-out drawer; tapping a nav link inside the drawer navigates and the drawer closes itself.
- Every entry point renders without horizontal overflow at phone width: Overview, CatalogHub, each of the 8 resource list/form pairs, Stock Purchase, the New Order wizard (draft + confirmed views), the Product wizard, and the Add New modal (opens near-full-screen on phone).
- The wizard stepper (Stock Purchase, New Order, New Product) shows only numbered circles (no step-title text) below 768px, and full titles at 768px and above.
- The new "Text size" control in the sidebar (Small/Medium/Large) changes text size app-wide immediately, and the choice survives a page reload.
- Both dark mode and Arabic (RTL) still look correct at all three font-size presets and all three widths — in RTL, the mobile drawer opens from the right instead of the left.

---

## Self-Review Notes

- **Spec coverage:** font-size presets (Task 1–2), mobile nav drawer (Task 3), wizard stepper (Task 3), page-padding + grid sweep across every listed file (Tasks 4–7), Add New modal sizing (Task 4). All spec sections have a task. Out-of-scope items (card tables, tablet icon-rail, continuous sizing, Strapi core) are not implemented anywhere in this plan, consistent with the spec.
- **Type consistency:** `FontSizePreset` is defined once in `theme/FontSizeProvider.tsx` (Task 1) and imported (never redefined) everywhere else it's used — `theme/index.ts`, `FontSizeToggle.tsx`. `getTheme(locale, fontSizePreset)`'s two-argument signature is used identically in its one call site (`ChakraRoot.tsx`).
- **No placeholders:** every step shows the complete file content or an exact before/after snippet; none rely on "similar to Task N" or unshown code.
