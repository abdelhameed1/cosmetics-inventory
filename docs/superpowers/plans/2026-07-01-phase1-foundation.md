# Cosmetics Inventory — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a clean Strapi v5 application with the full inventory data model — all reference, core-inventory, settings, and pricing content types, their lifecycle business rules, an idempotent seed, and a Jest test suite that proves the rules.

**Architecture:** A fresh Strapi v5 (TypeScript, CommonJS) app on MySQL 8. Every collection type is `draftAndPublish: false`. All business rules live in per-model `lifecycles.ts` files so they apply regardless of caller (admin, API, or the later dashboard plugin). Reference data is seeded idempotently on bootstrap. Jest + ts-jest boot a real Strapi instance against a dedicated test database to exercise the lifecycle rules end-to-end.

**Tech Stack:** Strapi `5.49.0` (TypeScript, CommonJS), MySQL 8 via `mysql2`, Jest + `ts-jest`.

## Global Constraints

- App root: `d:\7meed\cosmtic` (this is the clean build; ignore `d:\7meed\3mto` entirely).
- Strapi version pinned: `5.49.0`. Node 18–22.
- Language: TypeScript, module system CommonJS (Strapi default).
- Runtime database name: `cosmetics`. Test database name: `cosmetics_test`. Never reuse the old `3mto`/`3mto_test` databases.
- DB credentials come only from `.env` / environment — never hardcoded in committed files.
- All collection types: `"draftAndPublish": false`.
- All business rules live in `src/api/<type>/content-types/<type>/lifecycles.ts`, never in controllers.
- Errors thrown from lifecycles use `@strapi/utils` `errors.ApplicationError` so Strapi maps them to HTTP 400.
- Costs are stored in USD only on stock batches; EGP is always derived as `costPriceUsd × exchangeRate`. Never store EGP.
- Commit after every green test cycle. This repo starts as non-git; Task 1 initializes git.

---

### Task 1: Scaffold the clean Strapi app

**Files:**
- Create: whole Strapi skeleton in `d:\7meed\cosmtic\`
- Create: `d:\7meed\cosmtic\.env`
- Modify: `d:\7meed\cosmtic\config\database.ts`
- Create: `d:\7meed\cosmtic\config\env\test\database.ts`
- Preserve: `d:\7meed\cosmtic\docs\implementation.md` (moved into `docs/`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Strapi app; `config/database.ts` reads `DATABASE_*` env vars; a `test` environment DB config pointing at `cosmetics_test`.

- [ ] **Step 1: Preserve the spec, then scaffold Strapi into the directory**

`create-strapi` requires a near-empty target, so move the spec out first, scaffold, then restore it under `docs/`.

```bash
cd d:/7meed/cosmtic
mv implementation.md ../implementation.md.keep
npx create-strapi@5.49.0 . \
  --no-run --skip-cloud --use-npm --typescript \
  --dbclient mysql --dbhost 127.0.0.1 --dbport 3306 \
  --dbname cosmetics --dbusername root --dbpassword "" --dbssl false
mkdir -p docs
mv ../implementation.md.keep docs/implementation.md
```

If the CLI still refuses the non-empty directory, scaffold into `d:/7meed/cosmtic-tmp` with the same flags and move its contents (including dotfiles) into `d:/7meed/cosmtic`.

- [ ] **Step 2: Verify the scaffold installed**

Run: `npm ls @strapi/strapi`
Expected: prints `@strapi/strapi@5.49.0` (no "missing" / "unmet" errors).

- [ ] **Step 3: Pin the runtime DB and add a test DB config**

Confirm `.env` contains the runtime DB name and overwrite `config/database.ts` with an env-driven config:

`.env` must contain:
```
HOST=0.0.0.0
PORT=1337
APP_KEYS=toBeModified1,toBeModified2
API_TOKEN_SALT=toBeModified
ADMIN_JWT_SECRET=toBeModified
TRANSFER_TOKEN_SALT=toBeModified
JWT_SECRET=toBeModified
DATABASE_CLIENT=mysql
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=cosmetics
DATABASE_USERNAME=root
DATABASE_PASSWORD=
DATABASE_SSL=false
```

`config/database.ts`:
```ts
import path from 'path';

export default ({ env }) => {
  const client = env('DATABASE_CLIENT', 'mysql');

  const connections = {
    mysql: {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'cosmetics'),
        user: env('DATABASE_USERNAME', 'root'),
        password: env('DATABASE_PASSWORD', ''),
        ssl: env.bool('DATABASE_SSL', false) && {
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
      },
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
```

`config/env/test/database.ts` (Strapi loads this when `NODE_ENV=test`, overriding only the DB name):
```ts
export default ({ env }) => ({
  connection: {
    client: 'mysql',
    connection: {
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: env.int('DATABASE_PORT', 3306),
      database: env('DATABASE_TEST_NAME', 'cosmetics_test'),
      user: env('DATABASE_USERNAME', 'root'),
      password: env('DATABASE_PASSWORD', ''),
      ssl: false,
    },
    pool: { min: 0, max: 5 },
  },
});
```

- [ ] **Step 4: Create both databases**

Run:
```bash
mysql -h 127.0.0.1 -u root -e "CREATE DATABASE IF NOT EXISTS cosmetics CHARACTER SET utf8mb4; CREATE DATABASE IF NOT EXISTS cosmetics_test CHARACTER SET utf8mb4;"
```
Expected: returns with no error. (Adjust `-u`/`-p` to your MySQL credentials.)

- [ ] **Step 5: Verify the app boots, then stop it**

Run: `npm run build`
Expected: ends with "Building build context" … and exits 0 (admin builds successfully).

- [ ] **Step 6: Initialize git and commit the scaffold**

```bash
cd d:/7meed/cosmtic
git init
git add -A
git commit -m "chore: scaffold clean Strapi v5 app on MySQL (cosmetics db)"
```

---

### Task 2: Reference content types — Brand & Category (with deletion guards)

**Files:**
- Create: `src/api/brand/content-types/brand/schema.json`
- Create: `src/api/brand/controllers/brand.ts`, `src/api/brand/services/brand.ts`, `src/api/brand/routes/brand.ts`
- Create: `src/api/brand/content-types/brand/lifecycles.ts`
- Create: `src/api/category/content-types/category/schema.json`
- Create: `src/api/category/controllers/category.ts`, `src/api/category/services/category.ts`, `src/api/category/routes/category.ts`
- Create: `src/api/category/content-types/category/lifecycles.ts`
- Create: `tests/helpers/strapi.ts`
- Test: `tests/master-types.test.ts`
- Modify: `jest.config.js`, `package.json` (test script)

**Interfaces:**
- Consumes: app from Task 1.
- Produces:
  - Content type `api::brand.brand` — attributes `name: string (required, unique)`, `notes: text`, `products: relation oneToMany → api::product.product (mappedBy "brand")`.
  - Content type `api::category.category` — same shape, relation `products` mappedBy `category`.
  - `beforeDelete` guard on both: blocks deletion when products reference the record.
  - `tests/helpers/strapi.ts` exporting `setupStrapi(): Promise<Core.Strapi>` and `teardownStrapi(): Promise<void>`.

> Note: the `products` relation targets `api::product.product`, which is created in Task 5. Strapi will not boot cleanly until every relation target exists, so this task does **not** run a boot test. It produces the schemas, the deletion guards, and the shared test helper; the first real boot happens in Task 5's `npm test`, where the Brand/Category deletion-guard behaviour is exercised (see Task 5 Step 5). Verify this task only with `npx tsc --noEmit` plus the commit — no Strapi boot here.

- [ ] **Step 1: Write the test helper**

`tests/helpers/strapi.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { createStrapi } from '@strapi/strapi';

let instance: Core.Strapi | null = null;

export async function setupStrapi(): Promise<Core.Strapi> {
  if (!instance) {
    instance = await createStrapi().load();
    await instance.server.mount();
  }
  return instance;
}

export async function teardownStrapi(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
```

- [ ] **Step 2: Write the Brand schema**

`src/api/brand/content-types/brand/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "brands",
  "info": { "singularName": "brand", "pluralName": "brands", "displayName": "Brand" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "notes": { "type": "text" },
    "products": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::product.product",
      "mappedBy": "brand"
    }
  }
}
```

- [ ] **Step 3: Write the Brand factory files**

`src/api/brand/controllers/brand.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::brand.brand');
```
`src/api/brand/services/brand.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::brand.brand');
```
`src/api/brand/routes/brand.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::brand.brand');
```

- [ ] **Step 4: Write the Brand deletion guard**

`src/api/brand/content-types/brand/lifecycles.ts`:
```ts
import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::product.product')
      .count({ where: { brand: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this brand: ${count} product(s) still reference it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::product.product')
        .count({ where: { brand: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a brand that still has products.'
        );
      }
    }
  },
};
```

- [ ] **Step 5: Write the Category schema, factories, and guard (mirror of Brand)**

`src/api/category/content-types/category/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "categories",
  "info": { "singularName": "category", "pluralName": "categories", "displayName": "Category" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "notes": { "type": "text" },
    "products": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::product.product",
      "mappedBy": "category"
    }
  }
}
```
`src/api/category/controllers/category.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::category.category');
```
`src/api/category/services/category.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::category.category');
```
`src/api/category/routes/category.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::category.category');
```
`src/api/category/content-types/category/lifecycles.ts`:
```ts
import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::product.product')
      .count({ where: { category: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this category: ${count} product(s) still reference it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::product.product')
        .count({ where: { category: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a category that still has products.'
        );
      }
    }
  },
};
```

- [ ] **Step 6: Configure Jest**

`jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 60000,
  globalSetup: undefined,
  // Strapi boots once per suite; run suites serially to share the test DB.
  maxWorkers: 1,
};
```
Add to `package.json` scripts:
```json
"test": "cross-env NODE_ENV=test jest --runInBand --forceExit"
```
Install dev deps:
```bash
npm i -D jest ts-jest @types/jest cross-env
```

- [ ] **Step 7: Commit (schemas + guards + helper; boot test deferred to Task 5)**

```bash
git add src/api/brand src/api/category tests/helpers jest.config.js package.json package-lock.json
git commit -m "feat: add Brand and Category types with deletion guards"
```

---

### Task 3: Reference content types — Variant Type & Supplier

**Files:**
- Create: `src/api/variant-type/content-types/variant-type/schema.json` + controller/service/route + `lifecycles.ts`
- Create: `src/api/supplier/content-types/supplier/schema.json` + controller/service/route

**Interfaces:**
- Consumes: app from Task 1.
- Produces:
  - `api::variant-type.variant-type` — `name: string (required, unique)`, `variants: oneToMany → api::variant.variant (mappedBy "variantType")`; `beforeDelete` guard blocking deletion when variants reference it.
  - `api::supplier.supplier` — `name: string (required)`, `phone: string`, `notes: text`, `batches: oneToMany → api::stock-batch.stock-batch (mappedBy "supplier")`.

- [ ] **Step 1: Write the Variant Type schema**

`src/api/variant-type/content-types/variant-type/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "variant_types",
  "info": { "singularName": "variant-type", "pluralName": "variant-types", "displayName": "Variant Type" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "variants": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::variant.variant",
      "mappedBy": "variantType"
    }
  }
}
```

- [ ] **Step 2: Write the Variant Type factories**

`src/api/variant-type/controllers/variant-type.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::variant-type.variant-type');
```
`src/api/variant-type/services/variant-type.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::variant-type.variant-type');
```
`src/api/variant-type/routes/variant-type.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::variant-type.variant-type');
```

- [ ] **Step 3: Write the Variant Type deletion guard**

`src/api/variant-type/content-types/variant-type/lifecycles.ts`:
```ts
import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::variant.variant')
      .count({ where: { variantType: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this variant type: ${count} variant(s) still use it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::variant.variant')
        .count({ where: { variantType: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a variant type that still has variants.'
        );
      }
    }
  },
};
```

- [ ] **Step 4: Write the Supplier schema and factories**

`src/api/supplier/content-types/supplier/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "suppliers",
  "info": { "singularName": "supplier", "pluralName": "suppliers", "displayName": "Supplier" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true },
    "phone": { "type": "string" },
    "notes": { "type": "text" },
    "batches": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::stock-batch.stock-batch",
      "mappedBy": "supplier"
    }
  }
}
```
`src/api/supplier/controllers/supplier.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::supplier.supplier');
```
`src/api/supplier/services/supplier.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::supplier.supplier');
```
`src/api/supplier/routes/supplier.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::supplier.supplier');
```

- [ ] **Step 5: Commit**

```bash
git add src/api/variant-type src/api/supplier
git commit -m "feat: add Variant Type (with guard) and Supplier types"
```

---

### Task 4: Pricing & settings types — Price List, Customer, System Settings

**Files:**
- Create: `src/api/price-list/...` (schema + factories + `lifecycles.ts`)
- Create: `src/api/customer/...` (schema + factories)
- Create: `src/api/system-settings/...` (single-type schema + factories)

**Interfaces:**
- Consumes: app from Task 1.
- Produces:
  - `api::price-list.price-list` — `name: string (required, unique)`, `type: enumeration [retail, wholesale, vip]`, `marginPercent: decimal`, `wholesaleMinQty: integer`, `vipDiscountPercent: decimal`, `notes: text`, `customers: oneToMany → api::customer.customer (mappedBy "priceList")`; `beforeDelete` guard blocking deletion when customers reference it.
  - `api::customer.customer` — `name: string (required)`, `phone`, `address`, `notes: text`, `priceList: manyToOne → api::price-list.price-list (inversedBy "customers")`.
  - `api::system-settings.system-settings` — **single type** — `exchangeRate: decimal (required)`, `exchangeRateUpdatedAt: datetime`.

- [ ] **Step 1: Write the Price List schema**

`src/api/price-list/content-types/price-list/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "price_lists",
  "info": { "singularName": "price-list", "pluralName": "price-lists", "displayName": "Price List" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "type": { "type": "enumeration", "enum": ["retail", "wholesale", "vip"], "required": true },
    "marginPercent": { "type": "decimal" },
    "wholesaleMinQty": { "type": "integer" },
    "vipDiscountPercent": { "type": "decimal" },
    "notes": { "type": "text" },
    "customers": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::customer.customer",
      "mappedBy": "priceList"
    }
  }
}
```

- [ ] **Step 2: Write Price List factories and guard**

`src/api/price-list/controllers/price-list.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::price-list.price-list');
```
`src/api/price-list/services/price-list.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::price-list.price-list');
```
`src/api/price-list/routes/price-list.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::price-list.price-list');
```
`src/api/price-list/content-types/price-list/lifecycles.ts`:
```ts
import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::customer.customer')
      .count({ where: { priceList: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this price list: ${count} customer(s) are assigned to it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::customer.customer')
        .count({ where: { priceList: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a price list assigned to customers.'
        );
      }
    }
  },
};
```

- [ ] **Step 3: Write the Customer schema and factories**

`src/api/customer/content-types/customer/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "customers",
  "info": { "singularName": "customer", "pluralName": "customers", "displayName": "Customer" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true },
    "phone": { "type": "string" },
    "address": { "type": "string" },
    "notes": { "type": "text" },
    "priceList": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::price-list.price-list",
      "inversedBy": "customers"
    }
  }
}
```
`src/api/customer/controllers/customer.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::customer.customer');
```
`src/api/customer/services/customer.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::customer.customer');
```
`src/api/customer/routes/customer.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::customer.customer');
```

- [ ] **Step 4: Write the System Settings single type**

`src/api/system-settings/content-types/system-settings/schema.json`:
```json
{
  "kind": "singleType",
  "collectionName": "system_settings",
  "info": { "singularName": "system-settings", "pluralName": "system-settings-list", "displayName": "System Settings" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "exchangeRate": { "type": "decimal", "required": true },
    "exchangeRateUpdatedAt": { "type": "datetime" }
  }
}
```
`src/api/system-settings/controllers/system-settings.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::system-settings.system-settings');
```
`src/api/system-settings/services/system-settings.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::system-settings.system-settings');
```
`src/api/system-settings/routes/system-settings.ts`:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::system-settings.system-settings');
```

- [ ] **Step 5: Commit**

```bash
git add src/api/price-list src/api/customer src/api/system-settings
git commit -m "feat: add Price List (with guard), Customer, and System Settings types"
```

---

### Task 5: Core inventory types — Product, Variant, Stock Batch (+ first boot test)

**Files:**
- Create: `src/api/product/...` (schema + factories + `lifecycles.ts`)
- Create: `src/api/variant/...` (schema + factories + `lifecycles.ts`)
- Create: `src/api/stock-batch/...` (schema + factories + `lifecycles.ts`)
- Test: `tests/master-types.test.ts`

**Interfaces:**
- Consumes: Brand/Category/Variant-Type/Supplier from Tasks 2–3; the test helper from Task 2.
- Produces:
  - `api::product.product` — `name: string (required)`, `brand: manyToOne → brand (inversedBy "products", required)`, `category: manyToOne → category (inversedBy "products", required)`, `relatedProducts: manyToMany → product (self, one-sided)`, `variants: oneToMany → variant (mappedBy "product")`; `afterCreate` auto-creates one default variant when the product has none.
  - `api::variant.variant` — `label: string`, `lowStockThreshold: integer (min 0)`, `isDefault: boolean (default false)`, `product: manyToOne → product (inversedBy "variants", required)`, `variantType: manyToOne → variant-type (inversedBy "variants")`, `batches: oneToMany → stock-batch (mappedBy "variant")`; `beforeCreate`/`beforeUpdate` enforce "non-default variant must have a variant type."
  - `api::stock-batch.stock-batch` — `quantityPurchased: integer (min 0, required)`, `quantityRemaining: integer (min 0)`, `costPriceUsd: decimal (min 0, required)`, `purchaseDate: date (required)`, `productionDate: date`, `expiryDate: date`, `notes: text`, `variant: manyToOne → variant (inversedBy "batches", required)`, `supplier: manyToOne → supplier (inversedBy "batches", required)`; `beforeCreate` seeds `quantityRemaining` from `quantityPurchased` when omitted.

- [ ] **Step 1: Write the Product schema**

`src/api/product/content-types/product/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "products",
  "info": { "singularName": "product", "pluralName": "products", "displayName": "Product" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "name": { "type": "string", "required": true },
    "brand": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::brand.brand",
      "inversedBy": "products"
    },
    "category": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::category.category",
      "inversedBy": "products"
    },
    "relatedProducts": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::product.product"
    },
    "variants": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::variant.variant",
      "mappedBy": "product"
    }
  }
}
```

> Note: `brand`/`category` "required" is enforced by the dashboard form and seed usage; Strapi does not mark manyToOne required in schema reliably, so the requirement is a UI/validation rule (Phase 2). The data model keeps the relation optional at the DB layer.

- [ ] **Step 2: Write the Variant schema**

`src/api/variant/content-types/variant/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "variants",
  "info": { "singularName": "variant", "pluralName": "variants", "displayName": "Variant" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "label": { "type": "string" },
    "lowStockThreshold": { "type": "integer", "min": 0 },
    "isDefault": { "type": "boolean", "default": false },
    "product": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::product.product",
      "inversedBy": "variants"
    },
    "variantType": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::variant-type.variant-type",
      "inversedBy": "variants"
    },
    "batches": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::stock-batch.stock-batch",
      "mappedBy": "variant"
    }
  }
}
```

- [ ] **Step 3: Write the Stock Batch schema**

`src/api/stock-batch/content-types/stock-batch/schema.json`:
```json
{
  "kind": "collectionType",
  "collectionName": "stock_batches",
  "info": { "singularName": "stock-batch", "pluralName": "stock-batches", "displayName": "Stock Batch" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "quantityPurchased": { "type": "integer", "min": 0, "required": true },
    "quantityRemaining": { "type": "integer", "min": 0 },
    "costPriceUsd": { "type": "decimal", "min": 0, "required": true },
    "purchaseDate": { "type": "date", "required": true },
    "productionDate": { "type": "date" },
    "expiryDate": { "type": "date" },
    "notes": { "type": "text" },
    "variant": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::variant.variant",
      "inversedBy": "batches"
    },
    "supplier": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::supplier.supplier",
      "inversedBy": "batches"
    }
  }
}
```

- [ ] **Step 4: Write factory files for all three**

`src/api/product/controllers/product.ts`, `services/product.ts`, `routes/product.ts` — each one line, e.g.:
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreController('api::product.product');
```
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreService('api::product.product');
```
```ts
import { factories } from '@strapi/strapi';
export default factories.createCoreRouter('api::product.product');
```
Repeat identically for `variant` (uid `api::variant.variant`) and `stock-batch` (uid `api::stock-batch.stock-batch`) in their own `controllers/`, `services/`, `routes/` folders.

- [ ] **Step 5: Write the failing lifecycle tests**

`tests/master-types.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

const docs = (uid: string) => strapi.documents(uid as any);

async function makeBrandCategory() {
  const brand = await docs('api::brand.brand').create({ data: { name: `B-${Date.now()}-${Math.random()}` } });
  const category = await docs('api::category.category').create({ data: { name: `C-${Date.now()}-${Math.random()}` } });
  return { brand, category };
}

describe('Product → auto default variant', () => {
  it('creates exactly one default variant when a product is created with none', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Foundation', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    expect(variants).toHaveLength(1);
    expect(variants[0].isDefault).toBe(true);
  });
});

describe('Variant → non-default variant must have a type', () => {
  it('rejects creating a non-default variant without a variantType', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Lipstick', brand: brand.documentId, category: category.documentId },
    });
    await expect(
      docs('api::variant.variant').create({
        data: { label: 'Shade 220', isDefault: false, product: product.documentId },
      })
    ).rejects.toThrow(/non-default variant must have a variant type/i);
  });

  it('allows a non-default variant that has a variantType', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Lipstick 2', brand: brand.documentId, category: category.documentId },
    });
    const vt = await docs('api::variant-type.variant-type').create({ data: { name: `Shade-${Math.random()}` } });
    const variant = await docs('api::variant.variant').create({
      data: { label: 'Shade 300', isDefault: false, product: product.documentId, variantType: vt.documentId },
    });
    expect(variant.documentId).toBeTruthy();
  });
});

describe('Stock Batch → seed remaining quantity', () => {
  it('seeds quantityRemaining from quantityPurchased when omitted', async () => {
    const { brand, category } = await makeBrandCategory();
    const product = await docs('api::product.product').create({
      data: { name: 'Serum', brand: brand.documentId, category: category.documentId },
    });
    const variants = await docs('api::variant.variant').findMany({
      filters: { product: { documentId: product.documentId } },
    });
    const supplier = await docs('api::supplier.supplier').create({ data: { name: `S-${Math.random()}` } });
    const batch = await docs('api::stock-batch.stock-batch').create({
      data: {
        quantityPurchased: 50,
        costPriceUsd: 3.5,
        purchaseDate: '2026-07-01',
        variant: variants[0].documentId,
        supplier: supplier.documentId,
      },
    });
    expect(batch.quantityRemaining).toBe(50);
  });
});

describe('Deletion guards', () => {
  it('blocks deleting a brand that has products', async () => {
    const { brand, category } = await makeBrandCategory();
    await docs('api::product.product').create({
      data: { name: 'Guarded', brand: brand.documentId, category: category.documentId },
    });
    await expect(
      docs('api::brand.brand').delete({ documentId: brand.documentId })
    ).rejects.toThrow(/cannot delete this brand/i);
  });
});
```

- [ ] **Step 6: Run the tests to verify they FAIL**

Run: `npm test`
Expected: FAIL — `Product → auto default variant` finds 0 variants; the non-default-variant test does not throw; `quantityRemaining` is `null`; the brand-guard test was already written in Task 2 and passes only once Product exists.

- [ ] **Step 7: Write the Product `afterCreate` lifecycle**

`src/api/product/content-types/product/lifecycles.ts`:
```ts
export default {
  async afterCreate(event) {
    const { result } = event;
    const existing = await strapi.db.query('api::variant.variant').count({
      where: { product: result.id },
    });
    if (existing === 0) {
      await strapi.documents('api::variant.variant').create({
        data: {
          isDefault: true,
          label: 'Default',
          product: result.documentId,
        },
      });
    }
  },
};
```

- [ ] **Step 8: Write the Variant guard lifecycle**

`src/api/variant/content-types/variant/lifecycles.ts`:
```ts
import { errors } from '@strapi/utils';

function assertTypedIfNotDefault(isDefault: boolean, variantTypeId: unknown) {
  if (!isDefault && !variantTypeId) {
    throw new errors.ApplicationError('A non-default variant must have a variant type.');
  }
}

function relId(value: any): unknown {
  if (value == null) return null;
  if (typeof value === 'object') {
    // documents API connect/set shapes, or a populated relation
    if ('id' in value && value.id) return value.id;
    if ('documentId' in value && value.documentId) return value.documentId;
    if (Array.isArray(value.connect) && value.connect.length) return value.connect[0];
    if (Array.isArray(value.set) && value.set.length) return value.set[0];
    return null;
  }
  return value;
}

export default {
  async beforeCreate(event) {
    const data = event.params.data;
    assertTypedIfNotDefault(Boolean(data.isDefault), relId(data.variantType));
  },
  async beforeUpdate(event) {
    const data = event.params.data;
    const where = event.params.where as { id: number };
    const current = await strapi.db.query('api::variant.variant').findOne({
      where,
      populate: { variantType: true },
    });
    const isDefault = 'isDefault' in data ? Boolean(data.isDefault) : Boolean(current?.isDefault);
    const variantTypeId =
      'variantType' in data ? relId(data.variantType) : current?.variantType?.id ?? null;
    assertTypedIfNotDefault(isDefault, variantTypeId);
  },
};
```

- [ ] **Step 9: Write the Stock Batch lifecycle**

`src/api/stock-batch/content-types/stock-batch/lifecycles.ts`:
```ts
export default {
  async beforeCreate(event) {
    const { data } = event.params;
    if (data.quantityRemaining === undefined || data.quantityRemaining === null) {
      data.quantityRemaining = data.quantityPurchased;
    }
  },
};
```

- [ ] **Step 10: Run the tests to verify they PASS**

Run: `npm test`
Expected: PASS — all suites in `tests/master-types.test.ts` green (auto default variant, type guard both directions, remaining-quantity seed, brand deletion guard).

- [ ] **Step 11: Commit**

```bash
git add src/api/product src/api/variant src/api/stock-batch tests/master-types.test.ts
git commit -m "feat: add Product/Variant/Stock Batch types with lifecycle rules + tests"
```

---

### Task 6: Idempotent seed

**Files:**
- Create: `src/bootstrap/seed.ts`
- Modify: `src/index.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: Category, Price List, System Settings types from Tasks 2 & 4.
- Produces: `seed(strapi)` — an idempotent function that inserts 4 categories, 3 price lists, and upserts the single System Settings row with `exchangeRate: 1`; safe to run on every boot. Called from `bootstrap` in `src/index.ts`.

- [ ] **Step 1: Write the failing seed test**

`tests/seed.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';
import seed from '../src/bootstrap/seed';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

describe('seed', () => {
  it('is idempotent: running twice yields exactly the seeded counts', async () => {
    await seed(strapi);
    await seed(strapi);

    const categoryNames = ['High-End Makeup', 'Drugstore Makeup', 'Skin Care', 'Accessories'];
    for (const name of categoryNames) {
      const found = await strapi.documents('api::category.category').findMany({ filters: { name } });
      expect(found).toHaveLength(1);
    }

    const priceListNames = ['Retail', 'Wholesale', 'VIP'];
    for (const name of priceListNames) {
      const found = await strapi.documents('api::price-list.price-list').findMany({ filters: { name } });
      expect(found).toHaveLength(1);
    }

    const settings = await strapi.documents('api::system-settings.system-settings').findFirst();
    expect(settings).toBeTruthy();
    expect(Number(settings.exchangeRate)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx cross-env NODE_ENV=test jest tests/seed.test.ts --runInBand --forceExit`
Expected: FAIL — cannot find module `../src/bootstrap/seed`.

- [ ] **Step 3: Write the seed**

`src/bootstrap/seed.ts`:
```ts
import type { Core } from '@strapi/strapi';

const CATEGORIES = ['High-End Makeup', 'Drugstore Makeup', 'Skin Care', 'Accessories'];

const PRICE_LISTS = [
  { name: 'Retail', type: 'retail', marginPercent: 30 },
  { name: 'Wholesale', type: 'wholesale', marginPercent: 15, wholesaleMinQty: 6 },
  { name: 'VIP', type: 'vip', vipDiscountPercent: 10 },
];

export default async function seed(strapi: Core.Strapi): Promise<void> {
  for (const name of CATEGORIES) {
    const existing = await strapi.documents('api::category.category').findMany({ filters: { name } });
    if (existing.length === 0) {
      await strapi.documents('api::category.category').create({ data: { name } });
    }
  }

  for (const pl of PRICE_LISTS) {
    const existing = await strapi.documents('api::price-list.price-list').findMany({ filters: { name: pl.name } });
    if (existing.length === 0) {
      await strapi.documents('api::price-list.price-list').create({ data: pl as any });
    }
  }

  const settings = await strapi.documents('api::system-settings.system-settings').findFirst();
  if (!settings) {
    await strapi.documents('api::system-settings.system-settings').create({
      data: { exchangeRate: 1, exchangeRateUpdatedAt: new Date().toISOString() },
    });
  }
}
```

- [ ] **Step 4: Wire seed into bootstrap**

`src/index.ts` (replace the generated `bootstrap` body; keep `register`):
```ts
import type { Core } from '@strapi/strapi';
import seed from './bootstrap/seed';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seed(strapi);
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx cross-env NODE_ENV=test jest tests/seed.test.ts --runInBand --forceExit`
Expected: PASS — categories, price lists, and settings each present exactly once after two runs.

- [ ] **Step 6: Commit**

```bash
git add src/bootstrap/seed.ts src/index.ts tests/seed.test.ts
git commit -m "feat: idempotent reference-data seed run on bootstrap"
```

---

### Task 7: Smoke test & quality gate

**Files:**
- Test: `tests/smoke.test.ts`
- Create/Modify: `README.md` (run + quality-gate instructions)

**Interfaces:**
- Consumes: the whole app.
- Produces: a smoke test asserting the app boots and core content types are registered; documented quality gate.

- [ ] **Step 1: Write the smoke test**

`tests/smoke.test.ts`:
```ts
import type { Core } from '@strapi/strapi';
import { setupStrapi, teardownStrapi } from './helpers/strapi';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
});

afterAll(async () => {
  await teardownStrapi();
});

describe('smoke', () => {
  it('boots and registers all core content types', () => {
    const uids = [
      'api::brand.brand',
      'api::category.category',
      'api::variant-type.variant-type',
      'api::supplier.supplier',
      'api::customer.customer',
      'api::price-list.price-list',
      'api::system-settings.system-settings',
      'api::product.product',
      'api::variant.variant',
      'api::stock-batch.stock-batch',
    ];
    for (const uid of uids) {
      expect(strapi.contentType(uid as any)).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS — `smoke`, `master-types`, and `seed` suites all green.

- [ ] **Step 3: Run the whole-app type check**

Run: `npx tsc --noEmit`
Expected: exits 0 with no type errors.

- [ ] **Step 4: Document the quality gate in README**

Append to `README.md`:
```markdown
## Quality gate (Phase 1)

From the app root (`d:\7meed\cosmtic`):

    npm run develop   # start Strapi with auto-reload
    npm run build     # build the admin
    npm test          # Jest suites (require the cosmetics_test database)
    npx tsc --noEmit  # whole-app type check

Databases: runtime `cosmetics`, tests `cosmetics_test`. Create both with utf8mb4 before running.
```

- [ ] **Step 5: Commit**

```bash
git add tests/smoke.test.ts README.md
git commit -m "test: smoke suite + document Phase 1 quality gate"
```

---

## Phase 1 Self-Review Notes

- **Spec coverage:** Brand, Category, Variant Type, Supplier, Customer, Price List, System Settings, Product, Variant, Stock Batch — all created (§3.1–3.2). Lifecycles: product auto-default-variant, variant typed-guard (create+update), stock-batch remaining seed, and the Brand/Category/Variant-Type/Price-List deletion guards (§4) — all implemented. Seed: 4 categories, 3 price lists, settings row (§3.5). Tests: smoke + master-types + seed (§8). The Stock-Batch→Order-Line deletion guard and FIFO are **Phase 3** (no Order type yet) and are intentionally deferred.
- **Deferred to later phases:** all dashboard UI/endpoints (Phase 2); orders/payments/FIFO/pricing (Phase 3).
- **Type consistency:** relation `mappedBy`/`inversedBy` pairs match across both sides (brand↔products, category↔products, variant-type↔variants, supplier↔batches, price-list↔customers, product↔variants, variant↔batches). Lifecycle helper `relId` handles documents-API relation shapes.
