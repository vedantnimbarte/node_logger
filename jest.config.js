const { resolve } = require('path'); // eslint-disable-line @typescript-eslint/no-var-requires

module.exports = {
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleDirectories: ['node_modules'],
  modulePathIgnorePatterns: ['/dist/'],
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts', '!tests/**/*.{ts}'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageReporters: ['json', 'json-summary', 'lcov', 'text', 'text-summary', 'html'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended']
};
