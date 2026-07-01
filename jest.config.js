module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 60000,
  globalSetup: undefined,
  // Strapi boots once per suite; run suites serially to share the test DB.
  maxWorkers: 1,
};
