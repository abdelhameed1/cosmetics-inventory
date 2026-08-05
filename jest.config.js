// Backend (Strapi) tests only. Frontend admin-UI tests live in
// src/plugins/inventory-dashboard/admin and run via `npm run test:front`
// (src/plugins/inventory-dashboard/admin/jest.config.js) — that plugin has
// its own node_modules (jest-environment-jsdom, @testing-library/*), which
// aren't installed at the repo root, so a frontend project here would fail.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/plugins/inventory-dashboard/server/tests/**/*.test.ts',
  ],
  transform: {
    // Dedicated tsconfig (extends the root one, adds "DOM" to `lib`) so
    // tests can import src/admin/*.tsx browser-side code — the root
    // tsconfig.json deliberately excludes src/admin/ and lacks DOM lib for
    // the Strapi server build (see tsconfig.json), which ts-jest doesn't
    // honor when a test directly imports a file from there.
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
  // Strapi boots once per suite; run suites serially to share the test DB.
  maxWorkers: 1,
  // Each suite file gets its own module registry, so helpers/strapi.ts's
  // singleton doesn't survive across files — every suite pays the full
  // compileStrapi() + createStrapi().load() cost from cold. That alone can
  // take longer than Jest's 5000ms default hook timeout, failing
  // beforeAll/afterAll before the DB is ever the bottleneck.
  testTimeout: 30000,
};
