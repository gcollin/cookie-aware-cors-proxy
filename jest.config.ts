module.exports = {
  displayName: 'common',

  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$',
    },
  },
  coverageDirectory: './coverage/libs/common',
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)']
};
