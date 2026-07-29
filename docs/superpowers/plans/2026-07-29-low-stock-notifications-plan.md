# Low-Stock & Expiry In-App Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface low-stock, expired, and expiring-soon batch alerts from anywhere in the admin via a bell icon + badge in the shared sidebar, instead of requiring a visit to the Overview page.

**Architecture:** A new lightweight `GET /alerts` endpoint reuses the exact same stock-scanning logic `Overview` already has (extracted into a shared function, no behavior change to `Overview` itself), skipping the 12 resource-count queries and stock-value totals that endpoint doesn't need. A new `useAlerts()` hook polls it every 5 minutes from `AppSidebar` (shared across all 4 of the plugin's admin entry points), driving a bell badge and a `Modal` (mirroring the existing `AddNewModal` pattern) listing the three categories with links to each item's edit page.

**Tech Stack:** Strapi 5.49.0 (TypeScript), Chakra UI 2.8, react-intl, Jest against a live MySQL `cosmetics_test` database.

## Global Constraints

- No email/SMTP — in-app only (explicit product decision).
- No "mark as read"/dismissal — this is a live indicator, not a notification log; every open shows current state.
- `Overview.tsx` and its `getOverview()`/`GET /overview` behavior must not change at all — this feature adds a second, leaner read path, not a replacement.
- `admin/src/i18n/ar.ts` is typed `Record<keyof typeof en, string>` — every new key added to `en.ts` needs a matching key in `ar.ts` or the type check fails.
- Every new Chakra portal component (`Modal` content) needs an explicit `dir={locale === 'ar' ? 'rtl' : 'ltr'}` prop and `fontSize="md"` (portals don't inherit the app's anchored base font size — see `AddNewModal.tsx`'s `ModalContent` for the exact pattern to mirror).
- `npm test` requires the live `cosmetics_test` MySQL database — confirmed reachable in this environment. Run the real suite; do not skip it.
- The plugin's server AND admin bundles are pre-built into `src/plugins/inventory-dashboard/dist/` (gitignored) — this is what Strapi actually loads at runtime (both for `npm run develop` and for `npm test`'s `setupStrapi()`), not the raw TypeScript source directly. After editing plugin source (server or admin), run `npm run build --prefix src/plugins/inventory-dashboard` before the change takes effect in any subsequent Strapi boot or test run.

---

### Task 1: Extract shared alert-scanning logic + new `GET /alerts` endpoint

**Files:**
- Modify: `src/plugins/inventory-dashboard/server/src/services/overview.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/controllers/overview.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/routes/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/overview.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `strapi.plugin('inventory-dashboard').service('overview').getAlerts(): Promise<{ lowStock: any[]; expired: any[]; expiringSoon: any[] }>`; `GET /alerts` admin route returning that same shape. Task 2's `useAlerts()` hook consumes this route.

- [ ] **Step 1: Write the failing test**

In `src/plugins/inventory-dashboard/server/tests/overview.test.ts`, add this test inside the existing `describe('overview service', ...)` block, after the existing test, before the closing `});`:

```ts
  it("getAlerts matches getOverview's lowStock/expired/expiringSoon and omits counts/totals", async () => {
    const brand = await docs('api::brand.brand').create({ data: { name: `AL-${Date.now()}` } });
    const category = await docs('api::category.category').create({ data: { name: `ALC-${Date.now()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'Alerts Product', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    const variant = await docs('api::variant.variant').update({
      documentId: variants[0].documentId,
      data: { lowStockThreshold: 10 },
    } as any);
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `ALS-${Date.now()}` } });

    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 2, quantityRemaining: 2, costPriceUsd: 2,
        purchaseDate: '2026-06-01', expiryDate: isoPlusDays(30),
        variant: variant.documentId, supplier: supplier.documentId,
      },
    });

    const ov = await svc().getOverview();
    const alerts = await svc().getAlerts();

    expect(alerts.lowStock).toEqual(ov.lowStock);
    expect(alerts.expired).toEqual(ov.expired);
    expect(alerts.expiringSoon).toEqual(ov.expiringSoon);
    expect(alerts).not.toHaveProperty('counts');
    expect(alerts).not.toHaveProperty('stockValueUsd');
    expect(alerts).not.toHaveProperty('exchangeRate');
    expect(alerts).not.toHaveProperty('totalStockUnits');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPatterns="overview\.test"`
Expected: FAIL — `svc().getAlerts is not a function`.

- [ ] **Step 3: Extract `computeStockAlerts` and add `getAlerts()`**

Replace the entire contents of `src/plugins/inventory-dashboard/server/src/services/overview.ts` with:

```ts
import type { Core } from '@strapi/strapi';
import { RESOURCES } from '../config/resources';

const EXPIRY_WINDOW_DAYS = 90;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDate(value: string): Date {
  // value is "YYYY-MM-DD"; parse at local midnight
  const [y, m, day] = value.split('-').map(Number);
  return new Date(y, m - 1, day);
}

async function computeStockAlerts(strapi: Core.Strapi) {
  const batches = await strapi.documents('api::stock-batch.stock-batch' as any).findMany({
    populate: { variant: true },
    pageSize: 100000,
  } as any);

  const today = startOfLocalDay(new Date());
  const soonCutoff = new Date(today);
  soonCutoff.setDate(soonCutoff.getDate() + EXPIRY_WINDOW_DAYS);

  let totalStockUnits = 0;
  let stockValueUsd = 0;
  const perVariantQty: Record<string, number> = {};
  const expired: any[] = [];
  const expiringSoon: any[] = [];

  for (const b of batches) {
    const remaining = Number(b.quantityRemaining) || 0;
    const cost = Number(b.costPriceUsd) || 0;
    totalStockUnits += remaining;
    stockValueUsd += remaining * cost;

    let isExpired = false;
    if (b.expiryDate) {
      const exp = parseLocalDate(b.expiryDate);
      const variantLabel = b.variant?.label ?? 'Variant';
      if (exp < today) {
        isExpired = true;
        expired.push({ batchId: b.documentId, variantLabel, expiryDate: b.expiryDate });
      } else if (exp <= soonCutoff) {
        expiringSoon.push({ batchId: b.documentId, variantLabel, expiryDate: b.expiryDate });
      }
    }

    // low-stock quantity excludes expired batches
    if (!isExpired && b.variant?.documentId) {
      perVariantQty[b.variant.documentId] = (perVariantQty[b.variant.documentId] ?? 0) + remaining;
    }
  }

  const variants = await strapi.documents('api::variant.variant' as any).findMany({
    pageSize: 100000,
  } as any);

  const lowStock: any[] = [];
  for (const v of variants) {
    const threshold = Number(v.lowStockThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) continue;
    const qty = perVariantQty[v.documentId] ?? 0;
    if (qty < threshold) {
      lowStock.push({
        variantId: v.documentId,
        label: v.label ?? 'Variant',
        quantity: qty,
        threshold,
      });
    }
  }

  return { lowStock, expired, expiringSoon, totalStockUnits, stockValueUsd };
}

const overview = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getOverview() {
    const settingsRow = await strapi.documents('api::system-settings.system-settings' as any).findFirst();
    const exchangeRate = settingsRow ? Number(settingsRow.exchangeRate) : 0;

    const counts: Record<string, number> = {};
    for (const [slug, def] of Object.entries(RESOURCES)) {
      counts[slug] = await strapi.documents(def.uid as any).count({} as any);
    }

    const { lowStock, expired, expiringSoon, totalStockUnits, stockValueUsd } = await computeStockAlerts(strapi);

    return {
      counts,
      exchangeRate,
      totalStockUnits,
      stockValueUsd,
      stockValueEgp: stockValueUsd * exchangeRate,
      lowStock,
      expired,
      expiringSoon,
    };
  },

  async getAlerts() {
    const { lowStock, expired, expiringSoon } = await computeStockAlerts(strapi);
    return { lowStock, expired, expiringSoon };
  },
});

export default overview;
```

This is a pure refactor of `getOverview()` (same queries, same return shape, same values) plus one new method — it should not change any existing test's result.

- [ ] **Step 4: Add the controller handler**

In `src/plugins/inventory-dashboard/server/src/controllers/overview.ts`, add an `alerts` method alongside the existing `index`:

```ts
import type { Core } from '@strapi/strapi';

const overview = ({ strapi }: { strapi: Core.Strapi }) => ({
  async index(ctx) {
    ctx.body = await strapi.plugin('inventory-dashboard').service('overview').getOverview();
  },
  async alerts(ctx) {
    ctx.body = await strapi.plugin('inventory-dashboard').service('overview').getAlerts();
  },
});

export default overview;
```

- [ ] **Step 5: Add the route**

In `src/plugins/inventory-dashboard/server/src/routes/index.ts`, add this line immediately after the `/overview` route:

```ts
      { method: 'GET', path: '/alerts', handler: 'overview.alerts', config: { policies: [requireAccess] } },
```

- [ ] **Step 6: Rebuild the plugin, then run tests to verify they pass**

Run: `npm run build --prefix src/plugins/inventory-dashboard`
Run: `npm test -- --testPathPatterns="overview\.test"`
Expected: PASS — 2/2 tests (1 existing + 1 new).

Then run the full suite to check for regressions:
Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard/server/src/services/overview.ts src/plugins/inventory-dashboard/server/src/controllers/overview.ts src/plugins/inventory-dashboard/server/src/routes/index.ts src/plugins/inventory-dashboard/server/tests/overview.test.ts
git commit -m "feat: add lightweight GET /alerts endpoint sharing overview's stock-scan logic"
```

---

### Task 2: Notification bell, modal, and sidebar wiring

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/hooks/useAlerts.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/components/NotificationBell.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/NotificationsModal.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`
- Modify: `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`

**Interfaces:**
- Consumes: `GET /alerts` from Task 1.
- Produces: `useAlerts(): { data: { lowStock, expired, expiringSoon } | null; loading: boolean; error: unknown }` — consumed by both `NotificationBell` (for the badge count) and `NotificationsModal` (for its list content), both instantiated once in `AppSidebar` and passed data as props (not each calling the hook independently, to avoid two separate poll timers).

- [ ] **Step 1: Add i18n strings**

In `src/plugins/inventory-dashboard/admin/src/i18n/en.ts`, add these lines right after `'ordersList.showingCount': 'Showing the {shown} most recent of {total} orders.',` (still inside the object, before the closing `} as const;`):

```ts
  'notifications.bellAria': 'Notifications',
  'notifications.modalTitle': 'Notifications',
  'notifications.empty': 'No alerts right now.',
```

In `src/plugins/inventory-dashboard/admin/src/i18n/ar.ts`, add the matching keys right after `'ordersList.showingCount': 'يتم عرض أحدث {shown} طلب من إجمالي {total}.',` (before the closing `};`):

```ts
  'notifications.bellAria': 'الإشعارات',
  'notifications.modalTitle': 'الإشعارات',
  'notifications.empty': 'لا توجد تنبيهات حاليًا.',
```

- [ ] **Step 2: Create the `useAlerts` hook**

Create `src/plugins/inventory-dashboard/admin/src/hooks/useAlerts.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface AlertsData {
  lowStock: any[];
  expired: any[];
  expiringSoon: any[];
}

export function useAlerts() {
  const api = useApi();
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    api.get<AlertsData>('/alerts').then(setData).catch(setError).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload]);

  return { data, loading, error };
}
```

- [ ] **Step 3: Create `NotificationBell`**

Create `src/plugins/inventory-dashboard/admin/src/components/NotificationBell.tsx`:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/NotificationBell.tsx
import { Box, IconButton } from '@chakra-ui/react';
import { FiBell } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { type AlertsData } from '../hooks/useAlerts';

export function NotificationBell({ data, onOpen }: { data: AlertsData | null; onOpen: () => void }) {
  const intl = useIntl();
  const count = data ? data.lowStock.length + data.expired.length + data.expiringSoon.length : 0;

  return (
    <Box position="relative">
      <IconButton
        aria-label={intl.formatMessage({ id: 'notifications.bellAria', defaultMessage: 'Notifications' })}
        icon={<FiBell />}
        variant="ghost"
        onClick={onOpen}
      />
      {count > 0 && (
        <Box
          position="absolute"
          top="-2px"
          insetInlineEnd="-2px"
          minW="16px"
          h="16px"
          px="3px"
          borderRadius="full"
          bg="red.500"
          color="white"
          fontSize="10px"
          lineHeight="16px"
          textAlign="center"
          fontWeight="bold"
        >
          {count}
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Create `NotificationsModal`**

Create `src/plugins/inventory-dashboard/admin/src/components/NotificationsModal.tsx`:

```tsx
// src/plugins/inventory-dashboard/admin/src/components/NotificationsModal.tsx
import {
  Box, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Text,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { type AlertsData } from '../hooks/useAlerts';

export function NotificationsModal({
  isOpen, onClose, data,
}: { isOpen: boolean; onClose: () => void; data: AlertsData | null }) {
  const intl = useIntl();
  const { locale } = useLocale();
  const navigate = useNavigate();

  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  const isEmpty = !data || (data.lowStock.length === 0 && data.expired.length === 0 && data.expiringSoon.length === 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <ModalHeader>{intl.formatMessage({ id: 'notifications.modalTitle', defaultMessage: 'Notifications' })}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {isEmpty && (
            <Text color="text.secondary">{intl.formatMessage({ id: 'notifications.empty', defaultMessage: 'No alerts right now.' })}</Text>
          )}

          {data && data.expired.length > 0 && (
            <Box pb={4}>
              <Text fontSize="sm" fontWeight="semibold" pb={2} color="text.primary">
                {intl.formatMessage({ id: 'overview.expiredTitle', defaultMessage: 'Expired' })}
              </Text>
              {data.expired.map((b: any) => (
                <Text
                  key={b.batchId}
                  as="button"
                  display="block"
                  w="100%"
                  textAlign="start"
                  color="red.600"
                  py={1}
                  onClick={() => goTo(`/plugins/inventory-catalog/stock-batches/${b.batchId}`)}
                >
                  {b.variantLabel} — {b.expiryDate}
                </Text>
              ))}
            </Box>
          )}

          {data && data.expiringSoon.length > 0 && (
            <Box pb={4}>
              <Text fontSize="sm" fontWeight="semibold" pb={2} color="text.primary">
                {intl.formatMessage({ id: 'overview.expiringSoonTitle', defaultMessage: 'Expiring soon (90 days)' })}
              </Text>
              {data.expiringSoon.map((b: any) => (
                <Text
                  key={b.batchId}
                  as="button"
                  display="block"
                  w="100%"
                  textAlign="start"
                  color="orange.600"
                  py={1}
                  onClick={() => goTo(`/plugins/inventory-catalog/stock-batches/${b.batchId}`)}
                >
                  {b.variantLabel} — {b.expiryDate}
                </Text>
              ))}
            </Box>
          )}

          {data && data.lowStock.length > 0 && (
            <Box pb={2}>
              <Text fontSize="sm" fontWeight="semibold" pb={2} color="text.primary">
                {intl.formatMessage({ id: 'overview.lowStockTitle', defaultMessage: 'Low stock' })}
              </Text>
              {data.lowStock.map((r: any) => (
                <Text
                  key={r.variantId}
                  as="button"
                  display="block"
                  w="100%"
                  textAlign="start"
                  py={1}
                  onClick={() => goTo(`/plugins/inventory-catalog/variants/${r.variantId}`)}
                >
                  {r.label} — {r.quantity}/{r.threshold}
                </Text>
              ))}
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
```

- [ ] **Step 5: Wire into `AppSidebar`**

In `src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx`:

Add imports — change:
```ts
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
```
to:
```ts
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text, useDisclosure } from '@chakra-ui/react';
```

Add these new imports alongside the existing `AddNewModal`/`ColorModeToggle`/etc. imports:
```ts
import { NotificationBell } from './NotificationBell';
import { NotificationsModal } from './NotificationsModal';
import { useAlerts } from '../hooks/useAlerts';
```

Inside the `AppSidebar` component, add the hook and disclosure state — change:
```ts
export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const intl = useIntl();
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);
```
to:
```ts
export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const intl = useIntl();
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);
  const { data: alertsData } = useAlerts();
  const { isOpen: isNotificationsOpen, onOpen: onNotificationsOpen, onClose: onNotificationsClose } = useDisclosure();
```

Change the "Add new" button block — change:
```tsx
      <Button
        leftIcon={<Icon as={FiPlus} boxSize={4} />}
        w="100%"
        mb={4}
        onClick={() => setIsAddNewOpen(true)}
      >
        {intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
      </Button>
```
to:
```tsx
      <HStack mb={4} spacing={2}>
        <Button
          leftIcon={<Icon as={FiPlus} boxSize={4} />}
          flex={1}
          onClick={() => setIsAddNewOpen(true)}
        >
          {intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
        </Button>
        <NotificationBell data={alertsData} onOpen={onNotificationsOpen} />
      </HStack>
```

Add the modal render, right next to the existing `<AddNewModal ... />` line at the bottom of the component — change:
```tsx
      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
```
to:
```tsx
      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
      <NotificationsModal isOpen={isNotificationsOpen} onClose={onNotificationsClose} data={alertsData} />
```

- [ ] **Step 6: Type-check**

Run: `npm run test:ts:front --prefix src/plugins/inventory-dashboard`
Expected: PASS, no errors — this also catches any `en`/`ar` key mismatch from Step 1.

- [ ] **Step 7: Rebuild and manually verify (dev server)**

Run: `npm run build --prefix src/plugins/inventory-dashboard`

This plugin has no frontend component test setup, so this task's UI is verified manually:
```bash
npm run develop
```
- Seed a low-stock variant (set a `lowStockThreshold` above its current stock) and an expired batch (an `expiryDate` in the past).
- Confirm the bell badge shows the correct total count on the Overview page, then navigate to Stock Purchase and New Order (separate top-level admin entries) and confirm the same badge/count appears there too.
- Click the bell, confirm the modal lists both items under the right section with the right color, click each, confirm it navigates to the right edit page (`/plugins/inventory-catalog/stock-batches/:id` for expired/expiring, `/plugins/inventory-catalog/variants/:id` for low stock) and the modal closes.
- Clear both conditions (raise stock above threshold, remove/extend the expiry date) and confirm the badge disappears entirely (not "0") after the next poll or a manual page reload.
- Switch to Arabic (RTL) and dark mode, reopen the modal, confirm it renders mirrored/dark correctly; cycle the Small/Medium/Large text-size toggle with the modal open and confirm its text resizes.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/inventory-dashboard/admin/src/hooks/useAlerts.ts src/plugins/inventory-dashboard/admin/src/components/NotificationBell.tsx src/plugins/inventory-dashboard/admin/src/components/NotificationsModal.tsx src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx src/plugins/inventory-dashboard/admin/src/i18n/en.ts src/plugins/inventory-dashboard/admin/src/i18n/ar.ts
git commit -m "feat: add low-stock/expiry notification bell to the sidebar"
```
