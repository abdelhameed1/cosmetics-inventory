module.exports = {
  projects: [
    {
      displayName: 'backend',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/**/*.test.ts',
        '<rootDir>/src/plugins/inventory-dashboard/server/tests/**/*.test.ts',
      ],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      maxWorkers: 1,
    },
    {
      displayName: 'frontend',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/plugins/inventory-dashboard/admin/tests/**/*.test.{ts,tsx}',
      ],
      setupFilesAfterEnv: [
        '<rootDir>/src/plugins/inventory-dashboard/admin/tests/setupTests.ts',
      ],
      moduleNameMapper: {
        '\\.(css|less|sass|scss)(\\?.*)?$':
          '<rootDir>/src/plugins/inventory-dashboard/admin/tests/__mocks__/styleMock.ts',
      },
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': [
          'ts-jest',
          {
            tsconfig:
              '<rootDir>/src/plugins/inventory-dashboard/admin/tsconfig.json',
          },
        ],
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(@strapi|fractional-indexing|react-dnd|dnd-core|react-dnd-html5-backend|@react-dnd)/)',
      ],
    },
  ],
};
