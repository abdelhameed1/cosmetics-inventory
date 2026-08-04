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
    '^.+\\.ts$': 'ts-jest',
  },
  // Strapi boots once per suite; run suites serially to share the test DB.
  maxWorkers: 1,
};
