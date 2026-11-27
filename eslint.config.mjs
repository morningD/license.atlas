// SPDX-License-Identifier: MulanPSL-2.0

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "out */**",
    "build/**",
    "next-env.d.ts",
    ".serena/**",
    "process_emails.py",
    "src/app/tracker/tracker-client 2.tsx",
  ]),
  {
    rules: {
      // This app intentionally uses client-only effects for hydration-safe
      // language/theme/search-state synchronization. Next's production build
      // type-checks these paths; this React Compiler lint is too broad for the
      // current codebase and flags established patterns as errors.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
