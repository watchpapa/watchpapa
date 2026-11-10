import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    // Linted only where Prettier is enforced: the code written under the new
    // workflow. The older worker code is left out on purpose (see .prettierignore).
    ignores: [
      "node_modules",
      "coverage",
      "src/*.js",
      "src/routes",
      "src/tmdb",
      "src/lib",
      "src/import",
      "test/*.test.js",
      "!test/dates.test.js",
      "!test/streaks.test.js",
      "!test/ics.test.js",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Real mistakes: errors (they come from js.configs.recommended above).
      // Clean-code smells: warnings, so they show up without blocking a commit.
      // Each warning is either fixed in a refactor commit or documented as known.
      complexity: ["warn", 8],
      "max-lines-per-function": [
        "warn",
        { max: 30, skipBlankLines: true, skipComments: true },
      ],
      "max-params": ["warn", 3],
      "no-magic-numbers": [
        "warn",
        { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true },
      ],
      "no-shadow": "warn",
      // Naming: camelCase, but ALL_CAPS constants (MAX_LINE_OCTETS) are allowed.
      camelcase: "error",
      eqeqeq: "error",
      "prefer-const": "error",
      "no-var": "error",
      curly: "error",
    },
  },
  {
    // Tests are full of literal numbers and long `describe` blocks by design.
    files: ["test/**/*.js"],
    rules: {
      "no-magic-numbers": "off",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },
  prettier,
];
