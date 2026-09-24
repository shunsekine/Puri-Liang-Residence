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
    "build/**",
    "next-env.d.ts",
    ".incoming/**",
    // GAS の検証ハーネス（Node CommonJS・Next.js のルール対象外）
    "gas-booking-automation/test/**",
    // GAS の貼り付け用の生成物（build-gs.sh の出力。src/*.ts を見る）
    "gas-booking-automation/dist/**",
    // エージェントの作業用 worktree（別ブランチの複製）
    ".claude/**",
  ]),
]);

export default eslintConfig;
