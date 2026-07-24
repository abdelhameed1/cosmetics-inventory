# Larger Font Scale + Dark Mode — Design

**Status:** Approved
**Scope:** `src/plugins/inventory-dashboard` admin UI only.

## Problem

1. Text across the plugin reads too small — most components use Chakra's default `fontSizes` scale directly (`xs`/`sm`/`md`/`lg`/`2xl`), and that scale (12/14/16/18/24px) is on the small side for a data-dense admin UI viewed on modern displays.
2. There is no dark mode. Colors are hardcoded literals (`bg="white"`, `color="gray.800"`, `borderColor="gray.100"`, `bg="brand.50"`, etc.) directly on ~21 files instead of theme tokens, so nothing would respond to a color-mode switch even if one were wired up. There's also no `ColorMode` config on `ChakraProvider` and no toggle UI.

## Approach

### 1. Font scale

Bump Chakra's `fontSizes` theme tokens up one notch in `admin/src/theme/index.ts`. Because the codebase already uses named tokens (`fontSize="sm"`, `size="lg"` on `Heading`, table cell styles referencing `xs`) almost everywhere rather than raw pixel values, this single edit raises text consistently app-wide with no per-component changes needed.

| token | old | new |
|---|---|---|
| xs | 12px | 13px |
| sm | 14px | 15px |
| md | 16px | 17px |
| lg | 18px | 19px |
| xl | 20px | 22px |
| 2xl | 24px | 26px |
| 3xl | 30px | 32px |

Spacing/sizing tokens (`space`, `sizes`) are untouched — only text sizing shifts, so padding/heights don't move and layouts don't need rework.

### 2. Dark mode

**Color mode config.** Add to `theme/index.ts`:
```ts
config: { initialColorMode: 'light', useSystemColorMode: false }
```
Defaults to light; a manual toggle (below) switches and Chakra persists the choice to `localStorage` (`chakra-ui-color-mode`) automatically — this is shared across all 4 admin entry points since they all mount through the single `ChakraRoot`.

**Semantic tokens.** Add to `theme/index.ts`, replacing the raw literals used today:

| token | light | dark | replaces |
|---|---|---|---|
| `bg.canvas` | `gray.50` | `gray.900` | page background (`ChakraRoot`) |
| `bg.surface` | `white` | `gray.800` | card/sidebar/input backgrounds |
| `bg.subtle` | `gray.50` | `gray.700` | hover rows, table head bg |
| `border.default` | `gray.100` | `gray.700` | card/sidebar/table borders |
| `text.primary` | `gray.800` | `gray.100` | headings, values |
| `text.secondary` | `gray.500` | `gray.400` | labels, muted text (collapses existing `gray.500`/`600`/`700` usages — those were all muted-text tier already, just inconsistently numbered) |
| `accent.bg` | `brand.50` | `rgba(77, 139, 255, 0.16)` | icon badge backgrounds, active nav row |
| `accent.fg` | `brand.600` | `brand.300` | icon color, active nav text/icon (collapses `brand.600`/`brand.700`) |

**Component-level consolidation.** `Input`/`NumberInput`/`Select`/`Textarea` currently rely on ~25 individual `bg="white"` props scattered across form files instead of a theme default. Move `bg: 'bg.surface'` into each component's `baseStyle` in `theme/index.ts` and delete the now-redundant per-instance props — this both fixes dark mode for every form field in one place and removes duplication.

**Sweep.** Replace remaining raw color literals with the semantic tokens above in: `ChakraRoot.tsx`, `AppSidebar.tsx`, `AddNewModal.tsx`, `CatalogHub.tsx`, `Overview.tsx`, `OrderForm.tsx`, `StockPurchase.tsx`, `ProductVariantsForm.tsx`, `ResourceListPage.tsx`, `FieldRenderer.tsx`, `RelationSelect.tsx`, `ui/StatCard.tsx`, `ui/FormField.tsx`, `ui/PageHeader.tsx`, `ui/DataTable.tsx`, and the `Card`/`Table` entries already in `theme/index.ts`.

**Toggle.** New small component (e.g. `ColorModeToggle.tsx`) using Chakra's `useColorMode()` hook, rendered at the bottom of `AppSidebar`, matching the existing `FiSun`/`FiMoon` icon set (`react-icons/fi`) and the sidebar's nav-button visual style (icon + label, hover state via `bg.subtle`).

## Out of scope

- Per-user server-persisted theme preference (browser `localStorage` is sufficient — matches how Chakra apps normally do this).
- Auto (system-preference) mode — deferred; can be added later by flipping `useSystemColorMode` without touching the token work.
- Any change to the Strapi core admin UI (outside this plugin) — not touched, not feasible to theme from a plugin.

## Testing

- `npm run test:ts:front` / `npm run test:ts:back` (existing typecheck gates).
- `npm run build` — confirm no bundle regressions.
- Manual: toggle dark mode, click through Overview, CatalogHub, a Resource list/form, the Add New modal (all 9 flows), Stock Purchase, Order form/confirm view — check no illegible text (e.g. dark text on dark bg) in either mode. No dev server was available during planning, so this must happen at implementation/verification time.
