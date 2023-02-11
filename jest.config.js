/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: "./tests/testEnvironment.js",
  globalSetup: "./tests/globalSetup.js",
  globalTeardown: "./tests/globalTeardown.js"
  /*moduleNameMapper : {
    '^axios$': 'axios/dist/axios.js'
  }*/
};
