module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/utils/**/*.js',
    '!src/utils/logger.js',
  ],
  coverageDirectory: 'coverage',
};
