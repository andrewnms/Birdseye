const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["android/", "ios/", "node_modules/", "dist/", "coverage/"],
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
]);
