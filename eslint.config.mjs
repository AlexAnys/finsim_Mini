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
    // Harness 内 design mockup .jsx（仅供设计参考，不进 build）
    ".harness/**",
    // Claude Code agent 配置 + git worktrees + 缓存（含 worktree 内 .next）
    ".claude/**",
  ]),
]);

export default eslintConfig;
