# Cosmetics Inventory — Phase 2: Inventory Dashboard Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Strapi admin plugin, `inventory-dashboard`, that renders a schema-auto-driven control center: an Overview screen, generic create/edit/delete for every allow-listed inventory record, an exchange-rate editor, and two bespoke flows (stock purchase, product-with-variants).

**Architecture:** The server exposes a small allow-list (`RESOURCES`) mapping URL slugs to content-type UIDs. A generic resource service does CRUD over `strapi.documents(uid)`; a metadata service turns content-type attributes into render metadata; an overview service aggregates landing data. The admin renders list tables and edit forms generically from the metadata, with only Overview and the two bespoke flows hand-written. All routes are `type: 'admin'`. `@strapi/utils` is externalized so thrown errors map correctly to HTTP status codes.

**Tech Stack:** `@strapi/sdk-plugin` (`strapi-plugin build`), React 18, `@strapi/design-system` v2, `react-router-dom` v6, `@strapi/strapi/admin` (`useFetchClient`).

## Global Constraints

- Plugin path: `src/plugins/inventory-dashboard`, enabled in `config/plugins.ts` (`enabled: true`, `resolve: './src/plugins/inventory-dashboard'`).
- Requires Phase 1 complete: content types `brand, category, variant-type, supplier, customer, price-list, product, variant, stock-batch` and the single type `system-settings` all exist.
- The allow-list `RESOURCES` is both the navigation source **and** the security boundary: any slug/UID not listed returns 404.
- `find` is paginated; `pageSize` is capped at 100.
- All plugin routes registered under `type: 'admin'` and reached at `/inventory-dashboard/<path>`.
- `@strapi/utils` MUST stay in the plugin's `peerDependencies` (externalized) so `errors.ApplicationError`/`NotFoundError` map to 400/404 instead of 500.
- Plugin quality gate (run after any plugin change): `npm run build` (plugin), `npm run lint` (plugin), `npx tsc --noEmit` (whole app) — all clean.
- Commit after each task.

---

### Task 1: Scaffold the plugin, enable it, add a health route

**Files:**
- Create: `src/plugins/inventory-dashboard/` (via sdk-plugin init)
- Modify: `src/plugins/inventory-dashboard/package.json` (peerDependencies)
- Create: `config/plugins.ts`
- Create/Modify: `src/plugins/inventory-dashboard/server/src/controllers/health.ts`, `controllers/index.ts`, `routes/index.ts`

**Interfaces:**
- Consumes: Phase 1 app.
- Produces:
  - An installed, enabled local plugin reachable at `/inventory-dashboard/*`.
  - `GET /inventory-dashboard/health` → `{ ok: true }`.
  - Server entry exporting `controllers`, `routes`, `services` maps (extended in later tasks).

- [ ] **Step 1: Generate the plugin**

```bash
cd d:/7meed/cosmtic
npx @strapi/sdk-plugin@latest init src/plugins/inventory-dashboard \
  --no-install
# answer prompts: name "inventory-dashboard", TypeScript yes, both server+admin
cd src/plugins/inventory-dashboard && npm install && cd ../../..
```

- [ ] **Step 2: Add @strapi/utils as a peer dependency (externalized)**

Edit `src/plugins/inventory-dashboard/package.json` — ensure these blocks exist:
```json
"peerDependencies": {
  "@strapi/strapi": "^5.0.0",
  "@strapi/sdk-plugin": "^5.0.0",
  "@strapi/utils": "^5.0.0",
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "react-router-dom": "^6.0.0",
  "styled-components": "^6.0.0"
}
```
> Listing `@strapi/utils` as a peer keeps `strapi-plugin build` from bundling a second copy; without this, `instanceof` error mapping breaks and guarded 400/404s become 500s.

- [ ] **Step 3: Enable the plugin**

`config/plugins.ts`:
```ts
export default () => ({
  'inventory-dashboard': {
    enabled: true,
    resolve: './src/plugins/inventory-dashboard',
  },
});
```

- [ ] **Step 4: Write the health controller**

`src/plugins/inventory-dashboard/server/src/controllers/health.ts`:
```ts
import type { Core } from '@strapi/strapi';

const health = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = { ok: true };
  },
});

export default health;
```

- [ ] **Step 5: Register the controller and route**

`src/plugins/inventory-dashboard/server/src/controllers/index.ts`:
```ts
import health from './health';

export default {
  health,
};
```
`src/plugins/inventory-dashboard/server/src/routes/index.ts`:
```ts
export default {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/health', handler: 'health.index', config: { policies: [] } },
    ],
  },
};
```

- [ ] **Step 6: Build the plugin and start the app**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npm run develop
```
Then in another shell:
```bash
curl -s http://localhost:1337/inventory-dashboard/health
```
Expected: `{"ok":true}` (you may need an authenticated admin session; if so, verify via the browser devtools network tab while logged into `/admin`). Stop the dev server after verifying.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard config/plugins.ts
git commit -m "feat(plugin): scaffold inventory-dashboard plugin with health route"
```

---

### Task 2: Resource allow-list + generic resource service

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/config/resources.ts`
- Create: `src/plugins/inventory-dashboard/server/src/services/resource.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/services/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/resource.test.ts`

**Interfaces:**
- Consumes: Phase 1 content types.
- Produces:
  - `RESOURCES: Record<string, { uid: string; populate?: string[] }>` and `resolveResource(slug): ResourceDef | null`.
  - Service `resource` with: `find(slug, { page, pageSize, search })`, `findOne(slug, documentId)`, `create(slug, data)`, `update(slug, documentId, data)`, `remove(slug, documentId)`. Unknown slug → throws `NotFoundError`. `pageSize` capped at 100.

- [ ] **Step 1: Write the allow-list**

`src/plugins/inventory-dashboard/server/src/config/resources.ts`:
```ts
export interface ResourceDef {
  uid: string;
  populate?: string[];
}

export const RESOURCES: Record<string, ResourceDef> = {
  brands: { uid: 'api::brand.brand' },
  categories: { uid: 'api::category.category' },
  'variant-types': { uid: 'api::variant-type.variant-type' },
  suppliers: { uid: 'api::supplier.supplier' },
  customers: { uid: 'api::customer.customer', populate: ['priceList'] },
  'price-lists': { uid: 'api::price-list.price-list' },
  products: {
    uid: 'api::product.product',
    populate: ['brand', 'category', 'variants', 'relatedProducts'],
  },
  variants: { uid: 'api::variant.variant', populate: ['product', 'variantType', 'batches'] },
  'stock-batches': { uid: 'api::stock-batch.stock-batch', populate: ['variant', 'supplier'] },
};

export function resolveResource(slug: string): ResourceDef | null {
  return RESOURCES[slug] ?? null;
}
```

- [ ] **Step 2: Write the failing resource-service test**

`src/plugins/inventory-dashboard/server/tests/resource.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('resource');

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('resource service', () => {
  it('throws NotFound for an unknown slug', async () => {
    await expect(svc().find('not-a-resource', {})).rejects.toThrow(/unknown resource/i);
  });

  it('creates, finds, and removes a brand by slug', async () => {
    const created = await svc().create('brands', { name: `RS-${Date.now()}` });
    expect(created.documentId).toBeTruthy();

    const one = await svc().findOne('brands', created.documentId);
    expect(one.documentId).toBe(created.documentId);

    const page = await svc().find('brands', { page: 1, pageSize: 5 });
    expect(Array.isArray(page.results)).toBe(true);
    expect(page.pagination.pageSize).toBeLessThanOrEqual(100);

    await svc().remove('brands', created.documentId);
    const gone = await svc().findOne('brands', created.documentId);
    expect(gone).toBeNull();
  });

  it('caps pageSize at 100', async () => {
    const page = await svc().find('brands', { page: 1, pageSize: 9999 });
    expect(page.pagination.pageSize).toBe(100);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/resource.test.ts --runInBand --forceExit; cd ../../..`
Expected: FAIL — service `resource` is not registered.

> If Jest is not configured inside the plugin, add a `jest.config.js` in the plugin dir mirroring the app's (preset `ts-jest`, `testMatch: ['**/tests/**/*.test.ts']`, `maxWorkers: 1`). The test imports the shared helper from the app's `tests/helpers/strapi.ts`.

- [ ] **Step 4: Write the resource service**

`src/plugins/inventory-dashboard/server/src/services/resource.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { resolveResource } from '../config/resources';

const MAX_PAGE_SIZE = 100;

function requireDef(slug: string) {
  const def = resolveResource(slug);
  if (!def) {
    throw new errors.NotFoundError(`Unknown resource: ${slug}`);
  }
  return def;
}

const resource = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(slug: string, opts: { page?: number; pageSize?: number; search?: string }) {
    const def = requireDef(slug);
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(opts.pageSize) || 25));

    const results = await strapi.documents(def.uid as any).findMany({
      ...(def.populate ? { populate: def.populate } : {}),
      ...(opts.search ? { filters: { name: { $containsi: opts.search } } } : {}),
      page,
      pageSize,
      sort: 'createdAt:desc',
    } as any);

    const total = await strapi.documents(def.uid as any).count(
      opts.search ? ({ filters: { name: { $containsi: opts.search } } } as any) : ({} as any)
    );

    return {
      results,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  },

  async findOne(slug: string, documentId: string) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).findOne({
      documentId,
      ...(def.populate ? { populate: def.populate } : {}),
    } as any);
  },

  async create(slug: string, data: Record<string, unknown>) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).create({
      data,
      ...(def.populate ? { populate: def.populate } : {}),
    } as any);
  },

  async update(slug: string, documentId: string, data: Record<string, unknown>) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).update({
      documentId,
      data,
      ...(def.populate ? { populate: def.populate } : {}),
    } as any);
  },

  async remove(slug: string, documentId: string) {
    const def = requireDef(slug);
    return strapi.documents(def.uid as any).delete({ documentId } as any);
  },
});

export default resource;
```

- [ ] **Step 5: Register the service**

`src/plugins/inventory-dashboard/server/src/services/index.ts`:
```ts
import resource from './resource';

export default {
  resource,
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/resource.test.ts --runInBand --forceExit; cd ../../..`
Expected: PASS — unknown slug throws, CRUD round-trips, pageSize capped at 100.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): resource allow-list + generic CRUD service"
```

---

### Task 3: Metadata service

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/services/metadata.ts`
- Modify: `src/plugins/inventory-dashboard/server/src/services/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/metadata.test.ts`

**Interfaces:**
- Consumes: `RESOURCES`, content-type schemas.
- Produces: service `metadata` with `getSchema(slug): { resource: string; uid: string; fields: FieldMeta[] }`, where:
  ```ts
  interface FieldMeta {
    name: string;
    type: string;            // string | text | integer | decimal | boolean | date | datetime | enumeration | relation
    required: boolean;
    unique: boolean;
    hidden: boolean;
    min?: number;
    max?: number;
    values?: string[];       // enum values
    relation?: { resource: string | null; kind: string; mainField: string };
  }
  ```
  System fields (`id, documentId, createdAt, updatedAt, publishedAt, createdBy, updatedBy, locale`) are `hidden: true`. Relations whose target UID is not in `RESOURCES` are `hidden: true` with `relation.resource: null`.

- [ ] **Step 1: Write the failing metadata test**

`src/plugins/inventory-dashboard/server/tests/metadata.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('metadata');

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

describe('metadata service', () => {
  it('marks name required+unique on brands and hides system fields', () => {
    const schema = svc().getSchema('brands');
    const name = schema.fields.find((f: any) => f.name === 'name');
    expect(name.required).toBe(true);
    expect(name.unique).toBe(true);
    const created = schema.fields.find((f: any) => f.name === 'createdAt');
    expect(created?.hidden ?? true).toBe(true);
  });

  it('exposes enum values for price-list type', () => {
    const schema = svc().getSchema('price-lists');
    const type = schema.fields.find((f: any) => f.name === 'type');
    expect(type.type).toBe('enumeration');
    expect(type.values).toEqual(expect.arrayContaining(['retail', 'wholesale', 'vip']));
  });

  it('describes the variant→product relation with its target resource slug', () => {
    const schema = svc().getSchema('variants');
    const product = schema.fields.find((f: any) => f.name === 'product');
    expect(product.type).toBe('relation');
    expect(product.relation.resource).toBe('products');
    expect(product.relation.kind).toBe('manyToOne');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/metadata.test.ts --runInBand --forceExit; cd ../../..`
Expected: FAIL — service `metadata` is not registered.

- [ ] **Step 3: Write the metadata service**

`src/plugins/inventory-dashboard/server/src/services/metadata.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { RESOURCES, resolveResource } from '../config/resources';

const SYSTEM_FIELDS = new Set([
  'id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt',
  'createdBy', 'updatedBy', 'locale',
]);

export interface FieldMeta {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  hidden: boolean;
  min?: number;
  max?: number;
  values?: string[];
  relation?: { resource: string | null; kind: string; mainField: string };
}

function uidToSlug(uid: string): string | null {
  const entry = Object.entries(RESOURCES).find(([, def]) => def.uid === uid);
  return entry ? entry[0] : null;
}

const metadata = ({ strapi }: { strapi: Core.Strapi }) => ({
  getSchema(slug: string) {
    const def = resolveResource(slug);
    if (!def) throw new errors.NotFoundError(`Unknown resource: ${slug}`);

    const ct = strapi.contentType(def.uid as any);
    const fields: FieldMeta[] = [];

    for (const [name, attr] of Object.entries<any>(ct.attributes)) {
      const base: FieldMeta = {
        name,
        type: attr.type,
        required: Boolean(attr.required),
        unique: Boolean(attr.unique),
        hidden: SYSTEM_FIELDS.has(name),
      };

      if (attr.min !== undefined) base.min = attr.min;
      if (attr.max !== undefined) base.max = attr.max;
      if (attr.type === 'enumeration') base.values = attr.enum;

      if (attr.type === 'relation') {
        const targetSlug = uidToSlug(attr.target);
        base.relation = { resource: targetSlug, kind: attr.relation, mainField: 'name' };
        // hide relations whose target is not allow-listed, and *-to-many (managed from the other side)
        if (!targetSlug || attr.relation.endsWith('Many')) base.hidden = true;
      }

      fields.push(base);
    }

    return { resource: slug, uid: def.uid, fields };
  },
});

export default metadata;
```

- [ ] **Step 4: Register the service**

`src/plugins/inventory-dashboard/server/src/services/index.ts`:
```ts
import resource from './resource';
import metadata from './metadata';

export default {
  resource,
  metadata,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/metadata.test.ts --runInBand --forceExit; cd ../../..`
Expected: PASS — required/unique flags, enum values, and relation descriptor all correct.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): metadata service derives FieldMeta from schemas"
```

---

### Task 4: Resource + metadata controllers and routes

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/controllers/resource.ts`
- Modify: `controllers/index.ts`, `routes/index.ts`

**Interfaces:**
- Consumes: `resource` and `metadata` services.
- Produces these admin endpoints (all under `/inventory-dashboard`):
  - `GET /resources` → `{ resources: string[] }` (the allow-list slugs)
  - `GET /resources/:resource/schema` → metadata `getSchema` output
  - `GET /resources/:resource` → `{ results, pagination }` (query: `page`, `pageSize`, `search`)
  - `GET /resources/:resource/:documentId` → one record (404 if missing)
  - `POST /resources/:resource` → created record
  - `PUT /resources/:resource/:documentId` → updated record
  - `DELETE /resources/:resource/:documentId` → deleted record

- [ ] **Step 1: Write the resource controller**

`src/plugins/inventory-dashboard/server/src/controllers/resource.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { RESOURCES } from '../config/resources';

const svc = (strapi: Core.Strapi) => strapi.plugin('inventory-dashboard').service('resource');
const meta = (strapi: Core.Strapi) => strapi.plugin('inventory-dashboard').service('metadata');

const resource = ({ strapi }: { strapi: Core.Strapi }) => ({
  list(ctx) {
    ctx.body = { resources: Object.keys(RESOURCES) };
  },

  schema(ctx) {
    const { resource: slug } = ctx.params;
    ctx.body = meta(strapi).getSchema(slug);
  },

  async find(ctx) {
    const { resource: slug } = ctx.params;
    const { page, pageSize, search } = ctx.query;
    ctx.body = await svc(strapi).find(slug, { page, pageSize, search });
  },

  async findOne(ctx) {
    const { resource: slug, documentId } = ctx.params;
    const record = await svc(strapi).findOne(slug, documentId);
    if (!record) throw new errors.NotFoundError('Record not found');
    ctx.body = record;
  },

  async create(ctx) {
    const { resource: slug } = ctx.params;
    const data = ctx.request.body?.data ?? ctx.request.body;
    ctx.body = await svc(strapi).create(slug, data);
  },

  async update(ctx) {
    const { resource: slug, documentId } = ctx.params;
    const data = ctx.request.body?.data ?? ctx.request.body;
    ctx.body = await svc(strapi).update(slug, documentId, data);
  },

  async remove(ctx) {
    const { resource: slug, documentId } = ctx.params;
    ctx.body = await svc(strapi).remove(slug, documentId);
  },
});

export default resource;
```

- [ ] **Step 2: Register the controller**

`src/plugins/inventory-dashboard/server/src/controllers/index.ts`:
```ts
import health from './health';
import resource from './resource';

export default {
  health,
  resource,
};
```

- [ ] **Step 3: Add the routes**

`src/plugins/inventory-dashboard/server/src/routes/index.ts`:
```ts
export default {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/health', handler: 'health.index', config: { policies: [] } },
      { method: 'GET', path: '/resources', handler: 'resource.list', config: { policies: [] } },
      { method: 'GET', path: '/resources/:resource/schema', handler: 'resource.schema', config: { policies: [] } },
      { method: 'GET', path: '/resources/:resource', handler: 'resource.find', config: { policies: [] } },
      { method: 'GET', path: '/resources/:resource/:documentId', handler: 'resource.findOne', config: { policies: [] } },
      { method: 'POST', path: '/resources/:resource', handler: 'resource.create', config: { policies: [] } },
      { method: 'PUT', path: '/resources/:resource/:documentId', handler: 'resource.update', config: { policies: [] } },
      { method: 'DELETE', path: '/resources/:resource/:documentId', handler: 'resource.remove', config: { policies: [] } },
    ],
  },
};
```

- [ ] **Step 4: Build & type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): resource + schema admin endpoints"
```

---

### Task 5: Exchange-rate settings endpoint

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/controllers/settings.ts`
- Modify: `controllers/index.ts`, `routes/index.ts`

**Interfaces:**
- Consumes: `api::system-settings.system-settings` single type.
- Produces:
  - `GET /inventory-dashboard/settings` → `{ exchangeRate: number, exchangeRateUpdatedAt: string | null }`
  - `PUT /inventory-dashboard/settings` (body `{ exchangeRate }`) → updates the single type; sets `exchangeRateUpdatedAt = now`; rejects non-positive values with `ValidationError`.

- [ ] **Step 1: Write the settings controller**

`src/plugins/inventory-dashboard/server/src/controllers/settings.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const UID = 'api::system-settings.system-settings';

const settings = ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(ctx) {
    const row = await strapi.documents(UID as any).find();
    ctx.body = {
      exchangeRate: row ? Number(row.exchangeRate) : null,
      exchangeRateUpdatedAt: row?.exchangeRateUpdatedAt ?? null,
    };
  },

  async update(ctx) {
    const body = ctx.request.body?.data ?? ctx.request.body;
    const rate = Number(body?.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new errors.ValidationError('exchangeRate must be a positive number');
    }
    const updated = await strapi.documents(UID as any).update({
      data: { exchangeRate: rate, exchangeRateUpdatedAt: new Date().toISOString() },
    } as any);
    ctx.body = {
      exchangeRate: Number(updated.exchangeRate),
      exchangeRateUpdatedAt: updated.exchangeRateUpdatedAt,
    };
  },
});

export default settings;
```

- [ ] **Step 2: Register controller + routes**

`controllers/index.ts`:
```ts
import health from './health';
import resource from './resource';
import settings from './settings';

export default {
  health,
  resource,
  settings,
};
```
Add to the `admin.routes` array in `routes/index.ts`:
```ts
      { method: 'GET', path: '/settings', handler: 'settings.get', config: { policies: [] } },
      { method: 'PUT', path: '/settings', handler: 'settings.update', config: { policies: [] } },
```

- [ ] **Step 3: Build & type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): exchange-rate settings get/update endpoints"
```

---

### Task 6: Overview aggregation service + endpoint

**Files:**
- Create: `src/plugins/inventory-dashboard/server/src/services/overview.ts`
- Create: `src/plugins/inventory-dashboard/server/src/controllers/overview.ts`
- Modify: `services/index.ts`, `controllers/index.ts`, `routes/index.ts`
- Test: `src/plugins/inventory-dashboard/server/tests/overview.test.ts`

**Interfaces:**
- Consumes: all inventory content types + System Settings.
- Produces:
  - service `overview` with `getOverview()` returning:
    ```ts
    {
      counts: Record<string, number>;           // per allow-listed resource
      exchangeRate: number;
      totalStockUnits: number;                   // Σ quantityRemaining (all batches)
      stockValueUsd: number;                     // Σ quantityRemaining × costPriceUsd
      stockValueEgp: number;                     // stockValueUsd × exchangeRate
      lowStock: { variantId: string; label: string; quantity: number; threshold: number }[];
      expired: { batchId: string; variantLabel: string; expiryDate: string }[];
      expiringSoon: { batchId: string; variantLabel: string; expiryDate: string }[];
    }
    ```
  - `GET /inventory-dashboard/overview` → that object.
  - Rules: low-stock quantity **excludes expired batches**; expiry window = **90 days** from today; dates parsed at local midnight.

- [ ] **Step 1: Write the failing overview test**

`src/plugins/inventory-dashboard/server/tests/overview.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from '../../../../../tests/helpers/strapi';

let strapi: Core.Strapi;
const svc = () => strapi.plugin('inventory-dashboard').service('overview');
const docs = (uid: string) => strapi.documents(uid as any);

beforeAll(async () => { strapi = await setupStrapi(); });
afterAll(async () => { await teardownStrapi(); });

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('overview service', () => {
  it('excludes expired batches from low-stock quantity and classifies expiry', async () => {
    await strapi.documents('api::system-settings.system-settings').update({
      data: { exchangeRate: 50 },
    } as any).catch(async () =>
      strapi.documents('api::system-settings.system-settings').create({ data: { exchangeRate: 50 } } as any)
    );

    const brand = await docs('api::brand.brand').create({ data: { name: `OV-${Date.now()}` } });
    const category = await docs('api::category.category').create({ data: { name: `OVC-${Date.now()}` } });
    const product = await docs('api::product.product').create({
      data: { name: 'OV Product', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    const variant = await docs('api::variant.variant').update({
      documentId: variants[0].documentId,
      data: { lowStockThreshold: 10 },
    } as any);
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `OVS-${Date.now()}` } });

    // expired batch (should NOT count toward stock for low-stock)
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 5, quantityRemaining: 5, costPriceUsd: 2,
        purchaseDate: '2025-01-01', expiryDate: isoPlusDays(-3),
        variant: variant.documentId, supplier: supplier.documentId,
      },
    });
    // expiring-soon batch (3 units, counts toward stock)
    await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 3, quantityRemaining: 3, costPriceUsd: 2,
        purchaseDate: '2026-06-01', expiryDate: isoPlusDays(30),
        variant: variant.documentId, supplier: supplier.documentId,
      },
    });

    const ov = await svc().getOverview();
    expect(ov.exchangeRate).toBe(50);
    expect(ov.stockValueEgp).toBe(ov.stockValueUsd * 50);

    const low = ov.lowStock.find((r: any) => r.variantId === variant.documentId);
    expect(low).toBeTruthy();
    expect(low.quantity).toBe(3); // expired 5 excluded

    expect(ov.expired.length).toBeGreaterThanOrEqual(1);
    expect(ov.expiringSoon.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/overview.test.ts --runInBand --forceExit; cd ../../..`
Expected: FAIL — service `overview` is not registered.

- [ ] **Step 3: Write the overview service**

`src/plugins/inventory-dashboard/server/src/services/overview.ts`:
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

const overview = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getOverview() {
    const settingsRow = await strapi.documents('api::system-settings.system-settings' as any).find();
    const exchangeRate = settingsRow ? Number(settingsRow.exchangeRate) : 0;

    const counts: Record<string, number> = {};
    for (const [slug, def] of Object.entries(RESOURCES)) {
      counts[slug] = await strapi.documents(def.uid as any).count({} as any);
    }

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
});

export default overview;
```

- [ ] **Step 4: Write the overview controller + register everything**

`src/plugins/inventory-dashboard/server/src/controllers/overview.ts`:
```ts
import type { Core } from '@strapi/strapi';

const overview = ({ strapi }: { strapi: Core.Strapi }) => ({
  async index(ctx) {
    ctx.body = await strapi.plugin('inventory-dashboard').service('overview').getOverview();
  },
});

export default overview;
```
`services/index.ts`:
```ts
import resource from './resource';
import metadata from './metadata';
import overview from './overview';

export default {
  resource,
  metadata,
  overview,
};
```
`controllers/index.ts`:
```ts
import health from './health';
import resource from './resource';
import settings from './settings';
import overview from './overview';

export default {
  health,
  resource,
  settings,
  overview,
};
```
Add to `routes/index.ts` `admin.routes`:
```ts
      { method: 'GET', path: '/overview', handler: 'overview.index', config: { policies: [] } },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd src/plugins/inventory-dashboard && npx cross-env NODE_ENV=test jest tests/overview.test.ts --runInBand --forceExit; cd ../../..`
Expected: PASS — expired excluded from low-stock qty (3, not 8), EGP = USD × 50, expiry buckets populated.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/inventory-dashboard/server
git commit -m "feat(plugin): overview aggregation service + endpoint"
```

---

### Task 7: Admin API wrapper + data hooks

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/utils/api.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts`, `hooks/useSchema.ts`, `hooks/useOverview.ts`, `hooks/useSettings.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/pluginId.ts`

**Interfaces:**
- Consumes: all server endpoints from Tasks 4–6.
- Produces:
  - `pluginId = 'inventory-dashboard'`.
  - `useApi()` → `{ get, post, put, del }` each returning `Promise<T>`, prefixing `/inventory-dashboard`.
  - `useResources()` → `{ resources: string[], loading, error }`.
  - `useSchema(resource)` → `{ schema: SchemaMeta | null, loading, error, reload }` where `SchemaMeta = { resource, uid, fields: FieldMeta[] }`.
  - `useOverview()` → `{ data, loading, error, reload }`.
  - `useSettings()` → `{ exchangeRate, exchangeRateUpdatedAt, loading, save(rate), error }`.
  - Shared types `FieldMeta`, `SchemaMeta` exported from `utils/api.ts`.

- [ ] **Step 1: Write pluginId and the API wrapper**

`src/plugins/inventory-dashboard/admin/src/pluginId.ts`:
```ts
export const pluginId = 'inventory-dashboard';
```
`src/plugins/inventory-dashboard/admin/src/utils/api.ts`:
```ts
import { useFetchClient } from '@strapi/strapi/admin';
import { pluginId } from '../pluginId';

export interface FieldMeta {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  hidden: boolean;
  min?: number;
  max?: number;
  values?: string[];
  relation?: { resource: string | null; kind: string; mainField: string };
}

export interface SchemaMeta {
  resource: string;
  uid: string;
  fields: FieldMeta[];
}

export function useApi() {
  const { get, post, put, del } = useFetchClient();
  const base = `/${pluginId}`;

  return {
    async get<T = any>(path: string, params?: Record<string, unknown>): Promise<T> {
      const res = await get(`${base}${path}`, { params });
      return res.data as T;
    },
    async post<T = any>(path: string, data?: unknown): Promise<T> {
      const res = await post(`${base}${path}`, data);
      return res.data as T;
    },
    async put<T = any>(path: string, data?: unknown): Promise<T> {
      const res = await put(`${base}${path}`, data);
      return res.data as T;
    },
    async del<T = any>(path: string): Promise<T> {
      const res = await del(`${base}${path}`);
      return res.data as T;
    },
  };
}
```

- [ ] **Step 2: Write useResources and useSchema**

`src/plugins/inventory-dashboard/admin/src/hooks/useResources.ts`:
```ts
import { useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useResources() {
  const api = useApi();
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ resources: string[] }>('/resources')
      .then((d) => active && setResources(d.resources))
      .catch((e) => active && setError(e))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return { resources, loading, error };
}
```
`src/plugins/inventory-dashboard/admin/src/hooks/useSchema.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import { useApi, type SchemaMeta } from '../utils/api';

export function useSchema(resource?: string) {
  const api = useApi();
  const [schema, setSchema] = useState<SchemaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    if (!resource) return;
    setLoading(true);
    api
      .get<SchemaMeta>(`/resources/${resource}/schema`)
      .then(setSchema)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => { reload(); }, [reload]);

  return { schema, loading, error, reload };
}
```

- [ ] **Step 3: Write useOverview and useSettings**

`src/plugins/inventory-dashboard/admin/src/hooks/useOverview.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useOverview() {
  const api = useApi();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    setLoading(true);
    api.get('/overview').then(setData).catch(setError).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
```
`src/plugins/inventory-dashboard/admin/src/hooks/useSettings.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../utils/api';

export function useSettings() {
  const api = useApi();
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateUpdatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ exchangeRate: number; exchangeRateUpdatedAt: string | null }>('/settings')
      .then((d) => { setExchangeRate(d.exchangeRate); setUpdatedAt(d.exchangeRateUpdatedAt); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (rate: number) => {
    const d = await api.put<{ exchangeRate: number; exchangeRateUpdatedAt: string }>('/settings', {
      exchangeRate: rate,
    });
    setExchangeRate(d.exchangeRate);
    setUpdatedAt(d.exchangeRateUpdatedAt);
    return d;
  }, []);

  return { exchangeRate, exchangeRateUpdatedAt, loading, error, save };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): API wrapper and data hooks"
```

---

### Task 8: Admin router, menu link, and plugin registration

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/index.ts`
- Create: `src/plugins/inventory-dashboard/admin/src/pages/App.tsx`

**Interfaces:**
- Consumes: hooks from Task 7; pages from Tasks 9–13 (referenced now, created later — App.tsx imports them).
- Produces:
  - A menu link "Inventory" in the admin nav pointing at `/plugins/inventory-dashboard`.
  - Router (`App.tsx`) with routes: `/` (Overview), `stock-purchase`, `r/:resource` (list), `r/:resource/new` (create), `r/:resource/:id` (edit).

> To keep this task green before the pages exist, create minimal placeholder page modules in this task and replace them in Tasks 9–13. Each placeholder is a default-exported component returning a `Typography` heading.

- [ ] **Step 1: Create placeholder pages**

Create these four files, each:
```tsx
import { Typography } from '@strapi/design-system';
export default function Page() {
  return <Typography variant="alpha">Coming soon</Typography>;
}
```
At paths:
- `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`
- `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`
- `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`
- `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`

- [ ] **Step 2: Write the router**

`src/plugins/inventory-dashboard/admin/src/pages/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';
import StockPurchase from './StockPurchase';

export default function App() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="stock-purchase" element={<StockPurchase />} />
      <Route path="r/:resource" element={<ResourceListPage />} />
      <Route path="r/:resource/new" element={<ResourceFormPage />} />
      <Route path="r/:resource/:id" element={<ResourceFormPage />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Register the plugin and menu link**

`src/plugins/inventory-dashboard/admin/src/index.ts`:
```tsx
import { pluginId } from './pluginId';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: () => null,
      intlLabel: { id: `${pluginId}.menu.label`, defaultMessage: 'Inventory' },
      Component: async () => {
        const { default: App } = await import('./pages/App');
        return App;
      },
    });
    app.registerPlugin({ id: pluginId, name: pluginId });
  },
  bootstrap() {},
};
```

- [ ] **Step 4: Build the plugin and verify the nav link appears**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npm run develop
```
Open `http://localhost:1337/admin`, log in, confirm an "Inventory" link in the left nav opens the plugin with the Overview "Coming soon" placeholder. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): router, menu link, plugin registration"
```

---

### Task 9: Generic list page

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`

**Interfaces:**
- Consumes: `useSchema`, `useApi`, `useResources`.
- Produces: a searchable table for `:resource` built from `SchemaMeta`; "New" button → `r/:resource/new`; row click → `r/:resource/:id`; delete with confirmation that surfaces guard errors.

- [ ] **Step 1: Write the list page**

`src/plugins/inventory-dashboard/admin/src/pages/ResourceListPage.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Flex, Searchbar, Table, Thead, Tbody, Tr, Th, Td,
  Typography, IconButton, Dialog, DialogBody, DialogFooter,
} from '@strapi/design-system';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { schema } = useSchema(resource);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <Box padding={8}>
      <Flex justifyContent="space-between" paddingBottom={4}>
        <Typography variant="alpha">{resource}</Typography>
        <Button onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/new`)}>New</Button>
      </Flex>

      <Box paddingBottom={4}>
        <Searchbar name="search" value={search} onChange={(e: any) => setSearch(e.target.value)}
          onClear={() => setSearch('')} placeholder="Search by name">Search</Searchbar>
      </Box>

      {error && <Box paddingBottom={4}><Typography textColor="danger600">{error}</Typography></Box>}

      <Table colCount={visibleFields.length + 1} rowCount={rows.length}>
        <Thead>
          <Tr>
            {visibleFields.map((f) => (<Th key={f.name}><Typography variant="sigma">{f.name}</Typography></Th>))}
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr key={row.documentId} onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/${row.documentId}`)}>
              {visibleFields.map((f) => (
                <Td key={f.name}><Typography>{renderCell(row[f.name])}</Typography></Td>
              ))}
              <Td onClick={(e: any) => e.stopPropagation()}>
                <IconButton onClick={() => setToDelete(row)} label="Delete">✕</IconButton>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Dialog onClose={() => setToDelete(null)} title="Confirm delete" isOpen={!!toDelete}>
        <DialogBody>Delete this record? This cannot be undone.</DialogBody>
        <DialogFooter
          startAction={<Button onClick={() => setToDelete(null)} variant="tertiary">Cancel</Button>}
          endAction={<Button onClick={confirmDelete} variant="danger-light">Delete</Button>}
        />
      </Dialog>
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

- [ ] **Step 2: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0. (If a design-system import name differs in your installed v2, adjust the import — the build error names the missing export.)

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): generic searchable list page with guarded delete"
```

---

### Task 10: Field renderer, relation select, and generic form page

**Files:**
- Create: `src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`
- Create: `src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`

**Interfaces:**
- Consumes: `useSchema`, `useApi`, `FieldMeta`.
- Produces:
  - `RelationSelect({ field, value, onChange })` — loads up to 100 options from the related resource and renders a single-select (by `mainField`, default `name`).
  - `FieldRenderer({ field, value, onChange })` — maps each `FieldMeta.type` to the right input (string/text/integer/decimal/boolean/date/datetime/enumeration/relation). Skips `field.hidden`.
  - `ResourceFormPage` — create/edit form built from schema; on submit POSTs/PUTs and navigates back to the list; surfaces validation/guard errors.

- [ ] **Step 1: Write RelationSelect**

`src/plugins/inventory-dashboard/admin/src/components/RelationSelect.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { SingleSelect, SingleSelectOption } from '@strapi/design-system';
import { useApi, type FieldMeta } from '../utils/api';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const [options, setOptions] = useState<any[]>([]);
  const targetSlug = field.relation?.resource;
  const mainField = field.relation?.mainField ?? 'name';

  useEffect(() => {
    if (!targetSlug) return;
    api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 })
      .then((d) => setOptions(d.results))
      .catch(() => setOptions([]));
  }, [targetSlug]);

  const selected = value?.documentId ?? value ?? '';

  return (
    <SingleSelect
      label={field.name}
      value={selected}
      onChange={(v: string) => onChange(v)}
      placeholder={`Select ${field.name}`}
    >
      {options.map((o) => (
        <SingleSelectOption key={o.documentId} value={o.documentId}>
          {o[mainField] ?? o.label ?? o.documentId}
        </SingleSelectOption>
      ))}
    </SingleSelect>
  );
}
```

- [ ] **Step 2: Write FieldRenderer**

`src/plugins/inventory-dashboard/admin/src/components/FieldRenderer.tsx`:
```tsx
import {
  TextInput, Textarea, NumberInput, ToggleInput, DatePicker,
  SingleSelect, SingleSelectOption,
} from '@strapi/design-system';
import { type FieldMeta } from '../utils/api';
import { RelationSelect } from './RelationSelect';

export function FieldRenderer({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  if (field.hidden) return null;

  switch (field.type) {
    case 'text':
      return <Textarea label={field.name} name={field.name} value={value ?? ''}
        onChange={(e: any) => onChange(e.target.value)} required={field.required} />;
    case 'integer':
    case 'decimal':
    case 'biginteger':
    case 'float':
      return <NumberInput label={field.name} name={field.name} value={value ?? undefined}
        onValueChange={(v: number) => onChange(v)} required={field.required} />;
    case 'boolean':
      return <ToggleInput label={field.name} name={field.name} checked={Boolean(value)}
        onChange={(e: any) => onChange(e.target.checked)} onLabel="Yes" offLabel="No" />;
    case 'date':
      return <DatePicker label={field.name} name={field.name}
        onChange={(d: Date) => onChange(d ? d.toISOString().slice(0, 10) : null)}
        selectedDate={value ? new Date(value) : undefined} />;
    case 'datetime':
      return <DatePicker label={field.name} name={field.name}
        onChange={(d: Date) => onChange(d ? d.toISOString() : null)}
        selectedDate={value ? new Date(value) : undefined} />;
    case 'enumeration':
      return (
        <SingleSelect label={field.name} value={value ?? ''} onChange={(v: string) => onChange(v)}>
          {(field.values ?? []).map((opt) => (
            <SingleSelectOption key={opt} value={opt}>{opt}</SingleSelectOption>
          ))}
        </SingleSelect>
      );
    case 'relation':
      return <RelationSelect field={field} value={value} onChange={onChange} />;
    default:
      return <TextInput label={field.name} name={field.name} value={value ?? ''}
        onChange={(e: any) => onChange(e.target.value)} required={field.required} />;
  }
}
```

- [ ] **Step 3: Write the generic form page**

`src/plugins/inventory-dashboard/admin/src/pages/ResourceFormPage.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Flex, Grid, GridItem, Typography } from '@strapi/design-system';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';

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
    <Box padding={8}>
      <Typography variant="alpha">{isEdit ? `Edit ${resource}` : `New ${resource}`}</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}
      <Box paddingTop={6}>
        <Grid gap={4}>
          {editableFields.map((f) => (
            <GridItem key={f.name} col={6}>
              <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
            </GridItem>
          ))}
        </Grid>
      </Box>
      <Flex gap={2} paddingTop={6}>
        <Button onClick={submit}>Save</Button>
        <Button variant="tertiary" onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}`)}>Cancel</Button>
      </Flex>
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

> Note: `ProductVariantsForm` is created in Task 13. To keep this task's build green, create a temporary stub at `admin/src/components/ProductVariantsForm.tsx` now:
> ```tsx
> export default function ProductVariantsForm({ onDone }: { onDone: () => void }) {
>   return <button onClick={onDone}>placeholder</button>;
> }
> ```

- [ ] **Step 4: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): field renderer, relation select, generic form page"
```

---

### Task 11: Overview page

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`

**Interfaces:**
- Consumes: `useOverview`, `useSettings`.
- Produces: stat cards (counts, total stock units, stock value in USD and EGP), an exchange-rate input + Save, a low-stock table, and expired / expiring-soon panels.

- [ ] **Step 1: Write the Overview page**

`src/plugins/inventory-dashboard/admin/src/pages/Overview.tsx`:
```tsx
import { useState, useEffect } from 'react';
import {
  Box, Flex, Grid, GridItem, Typography, TextInput, Button,
  Table, Thead, Tbody, Tr, Th, Td,
} from '@strapi/design-system';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';

export default function Overview() {
  const { data, loading, reload } = useOverview();
  const { exchangeRate, exchangeRateUpdatedAt, save } = useSettings();
  const [rateInput, setRateInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeRate != null) setRateInput(String(exchangeRate));
  }, [exchangeRate]);

  const onSaveRate = async () => {
    setSaveError(null);
    try {
      await save(Number(rateInput));
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? 'Could not save rate');
    }
  };

  if (loading || !data) return <Box padding={8}><Typography>Loading…</Typography></Box>;

  return (
    <Box padding={8}>
      <Typography variant="alpha">Overview</Typography>

      <Box paddingTop={4} paddingBottom={6}>
        <Flex gap={2} alignItems="flex-end">
          <TextInput label="Exchange rate (EGP per USD)" name="rate" value={rateInput}
            onChange={(e: any) => setRateInput(e.target.value)} />
          <Button onClick={onSaveRate}>Save rate</Button>
        </Flex>
        {exchangeRateUpdatedAt && (
          <Typography variant="pi" textColor="neutral600">Updated: {exchangeRateUpdatedAt}</Typography>
        )}
        {saveError && <Typography textColor="danger600">{saveError}</Typography>}
      </Box>

      <Grid gap={4}>
        <StatCard label="Total stock units" value={String(data.totalStockUnits)} />
        <StatCard label="Stock value (USD)" value={`$${data.stockValueUsd.toFixed(2)}`} />
        <StatCard label="Stock value (EGP)" value={`E£${data.stockValueEgp.toFixed(2)}`} />
        <StatCard label="Exchange rate" value={String(data.exchangeRate)} />
      </Grid>

      <Box paddingTop={6}>
        <Typography variant="beta">Low stock</Typography>
        <Table colCount={3} rowCount={data.lowStock.length}>
          <Thead><Tr><Th>Variant</Th><Th>Qty</Th><Th>Threshold</Th></Tr></Thead>
          <Tbody>
            {data.lowStock.map((r: any) => (
              <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Grid gap={4} paddingTop={6}>
        <GridItem col={6}>
          <Typography variant="beta">Expired</Typography>
          {data.expired.map((b: any) => (
            <Typography key={b.batchId} textColor="danger600">{b.variantLabel} — {b.expiryDate}</Typography>
          ))}
        </GridItem>
        <GridItem col={6}>
          <Typography variant="beta">Expiring soon (90 days)</Typography>
          {data.expiringSoon.map((b: any) => (
            <Typography key={b.batchId} textColor="warning600">{b.variantLabel} — {b.expiryDate}</Typography>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <GridItem col={3}>
      <Box padding={4} background="neutral0" hasRadius shadow="tableShadow">
        <Typography variant="pi" textColor="neutral600">{label}</Typography>
        <Box paddingTop={2}><Typography variant="beta">{value}</Typography></Box>
      </Box>
    </GridItem>
  );
}
```

- [ ] **Step 2: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): Overview page with rate editor, low-stock, expiry panels"
```

---

### Task 12: Stock purchase flow

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`
- Modify: `src/plugins/inventory-dashboard/admin/src/index.ts` (add a second menu link)

**Interfaces:**
- Consumes: `useApi`.
- Produces: cascading **Product → Variant → Supplier** selects, then quantity, cost (USD), and three dates; on submit POSTs `/resources/stock-batches`.

- [ ] **Step 1: Write StockPurchase**

`src/plugins/inventory-dashboard/admin/src/pages/StockPurchase.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Flex, Grid, GridItem, Typography, NumberInput, DatePicker,
  SingleSelect, SingleSelectOption,
} from '@strapi/design-system';
import { useApi } from '../utils/api';

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
    <Box padding={8}>
      <Typography variant="alpha">Record stock purchase</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}
      <Box paddingTop={6}>
        <Grid gap={4}>
          <GridItem col={4}>
            <SingleSelect label="Product" value={productId} onChange={setProductId}>
              {products.map((p) => <SingleSelectOption key={p.documentId} value={p.documentId}>{p.name}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
          <GridItem col={4}>
            <SingleSelect label="Variant" value={variantId} onChange={setVariantId} disabled={!productId}>
              {variants.map((v) => <SingleSelectOption key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
          <GridItem col={4}>
            <SingleSelect label="Supplier" value={supplierId} onChange={setSupplierId}>
              {suppliers.map((s) => <SingleSelectOption key={s.documentId} value={s.documentId}>{s.name}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
          <GridItem col={4}><NumberInput label="Quantity purchased" value={qty} onValueChange={setQty} /></GridItem>
          <GridItem col={4}><NumberInput label="Cost price (USD)" value={cost} onValueChange={setCost} /></GridItem>
          <GridItem col={4}>
            <DatePicker label="Purchase date"
              onChange={(d: Date) => setPurchaseDate(d ? d.toISOString().slice(0, 10) : null)} />
          </GridItem>
          <GridItem col={4}>
            <DatePicker label="Production date"
              onChange={(d: Date) => setProductionDate(d ? d.toISOString().slice(0, 10) : null)} />
          </GridItem>
          <GridItem col={4}>
            <DatePicker label="Expiry date"
              onChange={(d: Date) => setExpiryDate(d ? d.toISOString().slice(0, 10) : null)} />
          </GridItem>
        </Grid>
      </Box>
      <Flex gap={2} paddingTop={6}>
        <Button onClick={submit} disabled={!variantId || !supplierId || !qty || !cost || !purchaseDate}>
          Record purchase
        </Button>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): stock-purchase cascading flow"
```

---

### Task 13: Product-with-variants flow

**Files:**
- Modify: `src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx` (replace the Task 10 stub)

**Interfaces:**
- Consumes: `useApi`.
- Produces: a curated create flow — product name + brand + category, optional explicit variant rows (label, variantType, lowStockThreshold), optional related-product links. On save: (1) create the product (server auto-creates one default variant), (2) create each explicit variant, (3) delete the auto-created default so exactly the explicit variants remain. Calls `onDone()` when finished.

- [ ] **Step 1: Write ProductVariantsForm**

`src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx`:
```tsx
import { useEffect, useState } from 'react';
import {
  Box, Button, Flex, Grid, GridItem, Typography, TextInput, NumberInput,
  SingleSelect, SingleSelectOption, IconButton,
} from '@strapi/design-system';
import { useApi } from '../utils/api';

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
  }, []);

  const addRow = () => setRows((r) => [...r, { label: '', variantTypeId: '' }]);
  const updateRow = (i: number, patch: Partial<VariantRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = async () => {
    setError(null);
    try {
      // 1) create product (auto-creates one default variant)
      const product = await api.post<any>('/resources/products', {
        name, brand: brandId, category: categoryId,
        relatedProducts: relatedIds,
      });

      // 2) create explicit variants
      for (const row of rows) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId || undefined,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: product.documentId,
        });
      }

      // 3) if explicit variants exist, delete the auto-created default
      if (rows.length > 0) {
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
    <Box padding={8}>
      <Typography variant="alpha">New product</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}
      <Box paddingTop={6}>
        <Grid gap={4}>
          <GridItem col={4}><TextInput label="Name" name="name" value={name} onChange={(e: any) => setName(e.target.value)} /></GridItem>
          <GridItem col={4}>
            <SingleSelect label="Brand" value={brandId} onChange={setBrandId}>
              {brands.map((b) => <SingleSelectOption key={b.documentId} value={b.documentId}>{b.name}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
          <GridItem col={4}>
            <SingleSelect label="Category" value={categoryId} onChange={setCategoryId}>
              {categories.map((c) => <SingleSelectOption key={c.documentId} value={c.documentId}>{c.name}</SingleSelectOption>)}
            </SingleSelect>
          </GridItem>
        </Grid>
      </Box>

      <Box paddingTop={6}>
        <Flex justifyContent="space-between">
          <Typography variant="beta">Variants (optional)</Typography>
          <Button variant="secondary" onClick={addRow}>Add variant</Button>
        </Flex>
        {rows.map((row, i) => (
          <Grid gap={4} key={i} paddingTop={2}>
            <GridItem col={4}><TextInput label="Label" name={`label-${i}`} value={row.label}
              onChange={(e: any) => updateRow(i, { label: e.target.value })} /></GridItem>
            <GridItem col={4}>
              <SingleSelect label="Type" value={row.variantTypeId} onChange={(v: string) => updateRow(i, { variantTypeId: v })}>
                {variantTypes.map((t) => <SingleSelectOption key={t.documentId} value={t.documentId}>{t.name}</SingleSelectOption>)}
              </SingleSelect>
            </GridItem>
            <GridItem col={3}><NumberInput label="Low-stock threshold" value={row.lowStockThreshold}
              onValueChange={(v: number) => updateRow(i, { lowStockThreshold: v })} /></GridItem>
            <GridItem col={1}><IconButton label="Remove" onClick={() => removeRow(i)}>✕</IconButton></GridItem>
          </Grid>
        ))}
      </Box>

      <Box paddingTop={6}>
        <Typography variant="beta">Related products (cross-sell)</Typography>
        <SingleSelect label="Add related product"
          onChange={(v: string) => setRelatedIds((ids) => ids.includes(v) ? ids : [...ids, v])}>
          {products.map((p) => <SingleSelectOption key={p.documentId} value={p.documentId}>{p.name}</SingleSelectOption>)}
        </SingleSelect>
        <Box paddingTop={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Typography key={id}>{p?.name ?? id} </Typography>;
          })}
        </Box>
      </Box>

      <Flex gap={2} paddingTop={6}>
        <Button onClick={save} disabled={!name || !brandId || !categoryId}>Create product</Button>
        <Button variant="tertiary" onClick={onDone}>Cancel</Button>
      </Flex>
    </Box>
  );
}
```

- [ ] **Step 2: Build + type-check**

```bash
cd src/plugins/inventory-dashboard && npm run build && cd ../../..
npx tsc --noEmit
```
Expected: both exit 0.

- [ ] **Step 3: Manual verification**

```bash
npm run develop
```
In `/admin` → Inventory → products → New: create a product with two explicit variants and one related product. Confirm exactly two variants exist afterward (no leftover default) and the related link is set. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/inventory-dashboard/admin
git commit -m "feat(plugin/admin): product-with-variants curated create flow"
```

---

### Task 14: Full plugin quality gate

**Files:** none (verification only)

**Interfaces:**
- Consumes: the whole plugin.
- Produces: a clean build, lint, and whole-app type check.

- [ ] **Step 1: Run the complete gate**

```bash
cd src/plugins/inventory-dashboard
npm run build
npm run lint
cd ../../..
npx tsc --noEmit
npm test
```
Expected: plugin `build` and `lint` clean; `tsc --noEmit` exits 0; app `npm test` (Phase 1 suites + plugin service suites) all green.

- [ ] **Step 2: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(plugin): pass build/lint/typecheck quality gate"
```

---

## Phase 2 Self-Review Notes

- **Spec coverage:** allow-list `RESOURCES` (§5.1) ✓; resource service generic CRUD with pageSize cap ✓; metadata service `FieldMeta` with hidden system fields and non-allow-listed relations ✓; overview service (counts, stock units, stock value USD+EGP, low-stock excluding expired, 90-day expiry buckets, local-midnight parsing) ✓; settings GET/PUT (§5.1) ✓; all admin routes under `type: 'admin'` at `/inventory-dashboard/*` ✓; admin `useApi`, hooks, router, generic list/form, Overview, StockPurchase, ProductVariantsForm (§5.2, §6) ✓; `@strapi/utils` externalized via peerDependencies (§5.1 error note) ✓.
- **Deferred to Phase 3:** `orders`, `order-lines`, `payments` resources; `GET /fifo/:variantDocumentId`; `POST /orders/:documentId/confirm`; OrderForm UI. These are added in Phase 3 by appending to `RESOURCES`, the routes, and the admin router.
- **Type consistency:** `FieldMeta`/`SchemaMeta` defined once in `utils/api.ts` and reused by hooks and components; service method names (`find/findOne/create/update/remove`, `getSchema`, `getOverview`) match between services, controllers, and route handlers.
- **Note for executor:** `@strapi/design-system` v2 export names (e.g. `Grid`/`GridItem`, `DatePicker` props) can vary by minor version; the build step names any mismatched import to fix. Adjust to the installed version rather than guessing.
