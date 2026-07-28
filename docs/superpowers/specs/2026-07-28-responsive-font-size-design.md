# Responsive Layout + Font-Size Options — Design

**Status:** Approved
**Scope:** `src/plugins/inventory-dashboard` admin UI only (all entry points: `App.tsx`'s router pages, plus the `StockPurchaseStandalone`/`OrderFormStandalone`/`CatalogStandalone` menu registrations). Strapi's own core admin screens (Content Manager, Users & Permissions, etc.) are out of scope — not ours to restyle.

## Problem

Two independent gaps in the plugin's admin UI, both raised together by the user:

1. **Not responsive.** `AppSidebar` is a fixed `w="240px"` column with no mobile handling at all. Every data-dense page uses fixed-count layouts — `SimpleGrid columns={4}` (Overview stat cards), `Grid templateColumns="repeat(12, 1fr)"` with hardcoded `colSpan={6}`/`{4}`/`{3}`/`{1}` (Overview, OrderForm, StockPurchase, ResourceFormPage, ProductVariantsForm, InlineResourceForm), and fixed `p={8}` page padding. None of this reflows below roughly 1000–1100px; on a phone or narrow tablet, content overflows or gets crushed. `CatalogHub.tsx` and `AddNewModal.tsx` are the only two places that already use Chakra's responsive `{{ base, md }}` prop syntax — that's the pattern to extend everywhere else, not a new one to invent.
2. **Font size is fixed, not a user choice.** The font-scale-dark-mode work bumped Chakra's `fontSizes` theme scale once, globally, with no way for an individual user to go smaller or larger. There's a proven precedent for a per-user, `localStorage`-persisted preference in this exact codebase: `LocaleProvider` (`i18n/LocaleProvider.tsx`) and its sidebar toggle `LanguageToggle.tsx`.

## Approach

### 1. Font-size presets

Three fixed presets — Small / Medium / Large — no continuous/custom sizing (YAGNI: nobody asked for arbitrary sizing, and 3 presets cover the "text too small/big" cases a slider would too).

**Theme scales.** Replace the single hardcoded `fontSizes` block in `theme/index.ts` with three named scales. Medium is exactly what shipped in the font-scale-dark-mode work (no regression for existing users); Small reverts to Chakra's original un-bumped defaults; Large applies one more step in the same direction as the existing bump.

| token | small (= Chakra default) | medium (today, unchanged) | large |
|---|---|---|---|
| xs | 12px | 13px | 14px |
| sm | 14px | 15px | 16px |
| md | 16px | 17px | 18px |
| lg | 18px | 19px | 20px |
| xl | 20px | 22px | 24px |
| 2xl | 24px | 26px | 28px |
| 3xl | 30px | 32px | 34px |

`getTheme(locale)` becomes `getTheme(locale, fontSizePreset)` and picks the matching scale. Spacing/sizing tokens are untouched, same as the original font-scale change — only text sizing shifts.

**Preference provider.** New `i18n`-sibling module, e.g. `theme/FontSizeProvider.tsx`, structurally a copy of `LocaleProvider`: React context, `useState` seeded from `localStorage.getItem('inventory-dashboard-font-size')` (default `'medium'` if unset/invalid), `setFontSizePreset` that updates state and persists. Exposes `useFontSizePreset()`.

**Toggle UI.** New `FontSizeToggle.tsx` in `components/`, rendered in `AppSidebar` next to `ColorModeToggle`. Unlike the boolean color-mode toggle, this is a 3-way choice: a compact segmented control (three small pill buttons, "S" / "M" / "L", each with an accessible label via `aria-label` or a tooltip spelling out "Small"/"Medium"/"Large") in an `HStack`, active preset highlighted using the same `accent.bg`/`accent.fg` tokens already used for the active nav link — so it looks native to the sidebar rather than introducing a new visual language.

**Wiring.** `ChakraRoot.tsx`'s `ThemedShell` reads both `useLocale()` and `useFontSizePreset()` and calls `getTheme(locale, fontSizePreset)`; `ChakraRoot` wraps children in `FontSizeProvider` alongside the existing `LocaleProvider`.

**Translations.** New keys in both `i18n/en.ts` and `i18n/ar.ts`: a "Text size" section label plus Small/Medium/Large labels (or tooltip text, depending on final toggle copy) — same flat key/value convention as existing `theme.lightMode`/`theme.darkMode` keys.

### 2. Responsive layout

No custom breakpoints — Chakra's defaults are already used once in this codebase (`CatalogHub.tsx`) and are adopted as the standard: `base` (phone, <30em), `sm` (30em/480px), `md` (48em/768px — the tablet/mobile-nav threshold), `lg` (62em/992px), `xl` (80em/1280px).

**Mobile navigation.** `AppSidebar` itself is unchanged — it's reused as-is, not rewritten. `AppShell.tsx` decides how to present it:
- At `md` and above: render `<AppSidebar />` inline exactly as today (same fixed 240px column).
- Below `md`: render a new slim top bar with a hamburger `IconButton`; tapping it opens a Chakra `Drawer` whose body renders the same `<AppSidebar />`. `Drawer` placement follows the active locale's reading direction (start-side for LTR/English, opposite for RTL/Arabic) so it's consistent with the rest of the RTL-aware UI.

**Grid/column sweep.** Every fixed grid becomes responsive, collapsing toward 1 column on phone and reaching its current full column count only at `md`/`lg`:

| file | today | becomes |
|---|---|---|
| `Overview.tsx` | `SimpleGrid columns={4}` (stat cards); 12-col `Grid` with two `colSpan={6}` panels (expired/expiring) | `columns={{ base: 1, sm: 2, lg: 4 }}`; grid panels stack to `colSpan={12}` below `md`, `colSpan={6}` at `md`+ |
| `OrderForm.tsx` | three 12-col `Grid`s with `colSpan={4}`/`{3}`/`{1}` field rows | each field's `colSpan` becomes `{{ base: 12, sm: 6, md: <today's value> }}` |
| `StockPurchase.tsx` | 12-col `Grid`, `colSpan={4}` fields | same `{{ base: 12, sm: 6, md: 4 }}` pattern |
| `ResourceFormPage.tsx` | 12-col `Grid`, `colSpan={6}` fields | `{{ base: 12, md: 6 }}` |
| `ProductVariantsForm.tsx` | 12-col `Grid`s (header row + per-variant rows), `colSpan={4}`/`{3}`/`{1}` | same responsive pattern as OrderForm; per-variant rows may need to wrap to two lines on phone since 4 fields won't fit even at `base: 12` stacking — acceptable, matches how the other multi-field rows behave |
| `InlineResourceForm.tsx` | 12-col `Grid`, `colSpan={6}` | `{{ base: 12, md: 6 }}` |
| `CatalogHub.tsx`, `AddNewModal.tsx` | already responsive (`{{ base: 1, md: 3 }}` / `{{ base: 1, md: 2 }}`) | no change needed — confirms the target pattern |

**Page padding.** Every page's outer `<Box p={8}>` (Overview, CatalogHub, OrderForm, ResourceFormPage, ResourceListPage, StockPurchase) becomes `p={{ base: 4, md: 8 }}` so phone screens aren't edge-to-edge.

**Tables.** No structural change — `ui/DataTable.tsx` already wraps every table in Chakra's `TableContainer`, which already scrolls horizontally on overflow. That's the chosen mobile behavior (horizontal scroll), not a card-based per-row reflow — see Out of scope.

**Wizard stepper.** `WizardShell.tsx`'s horizontal `Stepper` hides each step's `StepTitle` text below `md` (keep the numbered/checked circle + separator only) so a 3–4 step wizard doesn't overflow a phone-width screen. Stepper stays horizontal at all sizes — no vertical-orientation switch, keeping the change small and low-risk.

**Modals.** `AddNewModal.tsx` (and any other `Modal` usage) gets its `size` prop checked/capped so it doesn't overflow a phone viewport — e.g. responsive `size={{ base: 'full', md: 'lg' }}` where currently unset or too wide.

## Out of scope

- Card-based mobile table reflow (per-row cards instead of a scrolling table) — horizontal scroll is the deliberate, lower-risk choice.
- An icon-only collapsed sidebar rail at intermediate (tablet) widths — the design is binary: Drawer below `md`, full sidebar at/above `md`.
- Continuous or user-customizable font sizing (a slider, arbitrary zoom) — 3 fixed presets only.
- Any change to Strapi's own core admin UI outside this plugin.
- Server-persisted (per-account) font-size preference — `localStorage` only, matching the existing dark-mode/locale precedent.

## Testing

- `npm run test:ts:front` / `npm run test:ts:back` (existing typecheck gates) — will also catch a font-size preset value not matching the `FontSizeProvider`'s union type.
- `npm run build` — confirm no bundle regressions.
- Manual, no automated visual regression tooling exists in this repo: exercise every entry point (Overview, CatalogHub, all 8 resource list/form pairs, Stock Purchase, Order draft + confirmed views, Add New modal) at three representative widths (~375px phone, ~768px tablet, ~1280px+ desktop), in both color modes, both locales (en/ar — checking Drawer placement flips), and all three font-size presets. Mirrors the final whole-branch review convention used on the prior three UI projects in this plugin.
