module.exports = {
  env: {
    es2020: true,
    node: true,
    jest: true,
  },
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 11,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "standard",
  ],
  rules: {
    quotes: ["warn", "double"],
    semi: ["warn", "always"],
    "comma-dangle": ["warn", "always"],
  },
};
