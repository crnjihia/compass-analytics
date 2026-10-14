/**
 * Jest configuration
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
};
