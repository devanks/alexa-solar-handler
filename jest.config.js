// jest.config.js
/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testMatch: ['<rootDir>/tests/**/*.test.mjs'],
  testEnvironment: 'node', // Ensure this is 'node'
  moduleFileExtensions: ['js', 'mjs'], // Ensure 'mjs' is present
  transform: {}, // Should be empty for native ESM
  // NO moduleNameMapper
  // NO moduleDirectories unless absolutely needed
};

export default config;
