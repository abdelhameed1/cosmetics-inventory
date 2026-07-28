# i18n Support + Arabic Translation — Design

**Goal:** Every screen inside the `inventory-dashboard` plugin — wizards, list pages, modals, forms, navigation — is fully translated into Arabic, with the layout mirroring to right-to-left, switchable from a toggle in the app's own sidebar without reloading or losing state, and defaulting to English.

## Problem

The plugin (`src/plugins/inventory-dashboard/admin/src/`, ~27 `.tsx` files, hundreds of UI strings) has zero working i18n today. `react-intl` is listed as a dependency but never imported anywhere in JSX. The only existing translation scaffolding — `translations/en.json` (currently `{}`) plus `registerTrads` in `index.ts` — feeds Strapi's own core `IntlProvider` for exactly 4 sidebar menu-link labels ("Inventory", "Stock purchase", "New Order", "Catalog"); it has no reach into anything the plugin itself renders. Every other label, button, heading, table column, empty state, and validation message is a hardcoded English string literal directly in JSX. The layout has no RTL handling anywhere — no `dir` attribute, and a handful of physical-direction style props (`textAlign="left"`, `borderRightWidth`, a directional arrow icon) that would render backwards under RTL.

## Scope

**In scope** — everything rendered inside the plugin's own component tree (mounted under `<ChakraRoot><AppShell>...` and the three `*Standalone.tsx` pages):
- All wizard steps (Product/Variant, Stock Purchase, Order), all list/form pages, `CatalogHub`, `Overview`, `AppSidebar` nav, `AddNewModal`, `InlineResourceForm`, `QuickCreateSelect`, shared `ui/` components (`DataTable`, `FormField`, `PageHeader`, `StatCard`), and `config/navConfig.ts` / `config/addNewConfig.ts` display labels.
- Full RTL layout mirroring when Arabic is active.
- A language toggle in `AppSidebar`, next to the existing dark-mode toggle.

**Out of scope** — deliberately not touched:
- **Data localization.** Product/category/brand/customer/supplier names and notes stay single-language, exactly as entered. `@strapi/plugin-i18n` is not installed and no content-type schema is flagged `pluginOptions.i18n.localized`. Translating *stored records* is a materially bigger feature (schema changes, backend API changes, locale-aware CRUD on every wizard) and wasn't asked for.
- **Strapi's own core admin chrome** — the raw Content Manager, Media Library, Roles/Settings screens, and login page. These are rarely visited (the plugin already covers day-to-day work per the earlier Purity-theme/Catalog-hub work) and translating them means opting into Strapi's own core i18n system, a separate, pre-existing mechanism this design doesn't touch.
- **The 4 Strapi-core sidebar menu labels** registered via `app.addMenuLink({ intlLabel })` in `index.ts`. These render inside Strapi's own outer chrome, driven by the Strapi user's core profile "Interface language" setting — not by anything this design builds. They stay English. `translations/en.json` and `registerTrads` are left completely untouched.
- **Locale-aware number/date formatting.** See Assumptions below.

## Architecture

### Two independent i18n systems, kept separate

Strapi's own `registerTrads` → core `IntlProvider` mechanism (menu labels only) is left exactly as-is. Everything the plugin itself renders gets its own, independent system, invisible to and unaffected by Strapi's core locale:

```
admin/src/i18n/
  en.ts        — const en = { 'wizard.back': 'Back', ... } as const
  ar.ts        — const ar: Record<keyof typeof en, string> = { 'wizard.back': 'رجوع', ... }
  LocaleProvider.tsx
```

`ar.ts`'s type — `Record<keyof typeof en, string>` — means adding a key to `en.ts` without adding the matching key to `ar.ts` is a **TypeScript compile error**. Since `tsc -p admin/tsconfig.json --noEmit` is the only test gate this project has, this turns "missing Arabic translation" from a silent runtime gap into a build failure, at zero runtime cost.

### `LocaleProvider`

New context, modeled on Chakra's existing color-mode pattern:
- State: `locale: 'en' | 'ar'`, initialized from `localStorage` (key `inventory-dashboard-locale`), defaulting to `'en'` when unset.
- `setLocale(next)` updates state and `localStorage`.
- Wraps its children in `react-intl`'s `<IntlProvider locale={locale} messages={locale === 'ar' ? ar : en}>`.
- Renders its children inside a root element carrying `dir={locale === 'ar' ? 'rtl' : 'ltr'}`.
- Exposes `useLocale()` returning `{ locale, setLocale }`.

Mounted once, in `ChakraRoot.tsx`, wrapping the existing `<Box bg="bg.canvas" ...>` — so `dir` lands on the same element that already wraps every page and modal.

### RTL mirroring

Chakra's `Flex`/`HStack`/`VStack` already lay out along the CSS inline axis, which is direction-aware natively — `AppShell`'s sidebar-then-content `Flex` mirrors automatically the moment an ancestor carries `dir="rtl"`, no layout code changes needed. The full physical-direction-prop audit of the plugin found only 6 spots needing conversion to logical equivalents:

| File | Physical prop | Logical replacement |
|---|---|---|
| `AddNewModal.tsx`, `AppSidebar.tsx`, `CatalogHub.tsx`, `ColorModeToggle.tsx` | `textAlign="left"` (×4) | `textAlign="start"` |
| `AppSidebar.tsx` | `borderRightWidth="1px"` | `borderInlineEndWidth="1px"` |
| `AddNewModal.tsx` | `<FiArrowLeft />` "Back" button icon | swap to `<FiArrowRight />` when `locale === 'ar'` |

Chakra's theme also gets a `direction` field matching the active locale (`extendTheme({ ...base, direction: locale === 'ar' ? 'rtl' : 'ltr' })`), so Chakra-internal components that consult `theme.direction` (e.g. `Menu`, `Drawer` default placement) stay consistent. No new dependency (`stylis-plugin-rtl`) is needed — everything above works through native CSS logical properties and the `dir` attribute.

Font stack (`theme/index.ts`) gets `'Noto Sans Arabic'` and `Tahoma` appended as fallbacks ahead of the final generic `sans-serif`, so Arabic glyphs render cleanly on whichever OS-installed font is available — no webfont loading, no new dependency.

### `LanguageToggle`

New component, `admin/src/components/LanguageToggle.tsx`, structurally identical to the existing `ColorModeToggle.tsx`: a full-width button in `AppSidebar`, rendered directly above `ColorModeToggle` (locale is the more consequential setting; appearance follows), showing the language you'd switch **to** (e.g. "العربية" while in English, "English" while in Arabic) — same convention `ColorModeToggle` already uses for "Light mode"/"Dark mode".

### String extraction

Every hardcoded string literal in JSX across the in-scope files becomes `useIntl().formatMessage({ id, defaultMessage })` or `<FormattedMessage id="..." defaultMessage="..." />`, with a matching entry added to both `en.ts` (English, matches the current literal exactly — zero visible change in English mode) and `ar.ts` (Arabic translation). IDs are flat, dotted, and namespaced by area, e.g. `orderForm.title`, `wizard.back`, `nav.overview`, `addNew.backButton.ariaLabel`. `config/navConfig.ts` and `config/addNewConfig.ts` currently export plain label strings consumed by `AppSidebar`/`AddNewModal`; these become message IDs resolved at render time in the consuming component (the config files themselves stay locale-agnostic data, not JSX).

## Data flow

1. Plugin mounts. `LocaleProvider` reads `localStorage`, defaults to `'en'` if unset.
2. Every in-plugin component renders using `en.ts` messages, `dir="ltr"`, standard Chakra theme.
3. User clicks the sidebar `LanguageToggle`.
4. `LocaleProvider.setLocale('ar')` fires: `IntlProvider`'s `messages` prop swaps to `ar.ts`, root `dir` flips to `"rtl"`, Chakra theme's `direction` flips, `localStorage` is updated.
5. React re-renders the current page in place — no navigation, no state loss (wizard step position, form field values, etc. are untouched; this only changes text/layout, same as the existing dark-mode toggle already does for color).
6. Layout mirrors immediately via native RTL flow; the handful of converted logical props and the flipped arrow icon follow suit.
7. Reload: `LocaleProvider` reads the persisted `'ar'` from `localStorage` and starts in Arabic/RTL immediately.

## Error handling

`react-intl` falls back to `defaultMessage` (the English string, always present at the call site) if a message ID is missing from the active catalog — but since `ar.ts`'s type forces every `en.ts` key to have a matching Arabic value, this fallback path is unreachable for anything actually wired through the catalogs; it only protects against a call site whose `id` doesn't exist in the catalog file at all (a typo), which also fails visibly in dev via `react-intl`'s console warning.

## Assumptions (flag if wrong)

- **Numbers, currency, and dates stay in Western digits (0-9) and the existing formatting**, even in Arabic mode — only surrounding text and labels translate. This matches common convention for Arabic business/inventory software and avoids `Intl.NumberFormat`'s default Eastern Arabic-Indic digit behavior for `ar` locales, which would be confusing for pricing/quantity fields.
- **Translation quality:** Arabic strings are AI-generated Modern Standard Arabic (MSA) — natural and correct, chosen for broad regional readability in a business/inventory context. Good to ship internally; worth a native-speaker review pass before this reaches external customers.

## Testing

No component test runner exists for this plugin (confirmed by prior features in this repo) — verification is `tsc -p admin/tsconfig.json --noEmit` (which now also enforces catalog key parity, per above) plus manual verification via the running dev server:
- Toggle language from the sidebar on every page (Overview, each resource list/form, Product wizard, Stock Purchase wizard, Order wizard, CatalogHub, AddNewModal, InlineResourceForm, QuickCreateSelect's nested modal) and confirm: text is Arabic, layout has mirrored (sidebar on the right, text right-aligned, the AddNewModal back arrow points the correct way), and no leftover English strings remain.
- Reload the page after switching to Arabic and confirm it starts in Arabic/RTL (localStorage persistence).
- Confirm Strapi's own outer sidebar menu labels ("Inventory", "Stock purchase", etc.) remain English regardless of the in-plugin toggle state — the scope boundary held.
- Spot-check that mid-wizard state (selected step, filled fields) survives a language toggle.

## Implementation note

Given the scale (~27 files, hundreds of strings), the implementation plan will likely execute in two phases: infrastructure first (i18n directory, `LocaleProvider`, `LanguageToggle`, theme/RTL plumbing, `AppShell`/`AppSidebar` conversion), then string extraction across the remaining files in reviewable clusters (wizards, list/form pages, modals, shared `ui/` components) — each cluster its own task(s) in the SDD execution.
