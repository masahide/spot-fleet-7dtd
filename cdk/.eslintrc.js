module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  //  "standard",
  ],
  //root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 11,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  /*
  rules: {
    quotes: ["warn", "double"],
    semi: ["warn", "always"],
    //"comma-dangle": ["warn", "always"],
  },
  */
};
