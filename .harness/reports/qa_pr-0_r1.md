# QA Report — pr-0 Design Tokens · round 1

## Spec
把 FinSim canonical tokens (深靛 `#1E2A5E` / 米象牙 `#F7F4EC` / 暖赭 `#C48A3C`) 落地到 `app/globals.css` 的 `:root` + `.dark`，用 Tailwind 4 `@theme inline` 做 shadcn + `--fs-*` → `--color-*` 映射；新建 `lib/design/tokens.ts` JS 镜像 + `courseColorForId` hash helper。不改任何 JSX。

## 验证

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Spec compliance | PASS | `app/globals.css` 重写完整；`lib/design/tokens.ts` 新建，含 `tokens`、`tagColors`、`taskTypeColors`、`courseColorForId(id)`；未动 schema/API/services/JSX |
| 2 | `npx tsc --noEmit` | PASS | 无输出、退出 0 |
| 3 | `npx vitest run` | PASS | 11 files / 61 tests 全绿（510ms） |
| 4 | `npm run build` | PASS | 全路由编译完成（static + dynamic 皆 ✓） |
| 5 | Cross-module regression | PASS | `git diff --stat` 仅两文件 + 一新目录；26 处现有 `bg-primary/text-primary` 将自动换深靛（无需手改）；sidebar.tsx L114 `bg-primary/10 text-primary` 从蓝紫 10% → 深靛 10%，满足 acceptance #3 |
| 6 | Security (`/cso`) | N/A | 未触及 auth / session / token / payment |
| 7 | Finsim-specific | PASS | 本 PR 无 UI 文案；tokens 文件全英文符合技术层约定；Tailwind 4 `@theme inline` 写法（spec §Risks 指定）正确 |
| 8 | Code patterns | PASS | 无 drive-by refactor；未触 `bg-violet/emerald/blue-` 硬编码（spec 明确留给 PR-1） |

## 运行时校验

- **Dev server served CSS**（`/_next/static/chunks/app_globals_71f961d1.css`，5609 行）：
  - `:root { --fs-bg: #f7f4ec; ... --background: var(--fs-bg); }` ✓ → body 变米象牙
  - `--primary: var(--fs-primary); /* #1e2a5e */` ✓ → 所有 `bg-primary` 变深靛
  - `--accent: var(--fs-accent); /* #c48a3c */` ✓ → 所有 `bg-accent` 变暖赭
  - `--sidebar-accent: var(--fs-primary-soft); /* #e7eaf3 */` ✓
  - `.dark { --fs-bg: #0f1118; --fs-primary: #7b8cd9; ... }` ✓ 深色适配
  - `.fs-num`/`[data-numeric]` utility 存在 ✓
  - `.shadow-fs` Tailwind utility 已生成 ✓
- **色值 grep 命中**（served CSS 中）：`#1e2a5e`、`#f7f4ec`、`#c48a3c`、`#5b4fb8`（sim）、`#2e5fb4`（quiz）、`#0f7a5a`（subj）全部可见
- **body 背景链**：`body { background-color: var(--background); }` → `--background: var(--fs-bg); /* #f7f4ec */` — 完整链路已 compile
- **登录页 GET 200**（`/login`），HTML 含 `bg-primary text-primary-foreground` 按钮 class — 与新 token 映射耦合正确

## Acceptance 对照

| Spec Acceptance | 状态 | 说明 |
|---|---|---|
| ☑ `npm run dev` 所有页面打开不报错 | PASS | login GET 200；build 全路由通过 |
| ☑ 页面整体背景变米象牙 `#F7F4EC` | PASS | `--fs-bg: #f7f4ec` → `--background` → `body` 链完整 |
| ☑ 侧边栏激活项变深靛 | PASS | `sidebar.tsx:114` `bg-primary/10 text-primary` → `--primary: var(--fs-primary) = #1E2A5E`（10% alpha 深靛 tint） |
| ☑ 暗色模式切换后可读 | PASS | `.dark` 块完整：`--fs-bg: #0f1118`（深中性非蓝紫）+ `--fs-primary: #7b8cd9`（lift 版深靛），对比度足 |
| ☑ `tsc --noEmit` 过 | PASS | |
| ☑ `npm run build` 过 | PASS | |
| ☑ `vitest run` 全过 | PASS | 61/61 |
| ☑ 硬编码 `bg-violet`/`bg-emerald` 仍存在 | PASS | `components/dashboard/task-card.tsx`、`timeline.tsx` 10 处 hit — 预期中间状态，留给 PR-1 |

## Issues found
无。

## 备注（给 PR-1 builder 参考，不影响本轮判定）

1. `components/sidebar.tsx:114` 目前用 `bg-primary/10 text-primary`，视觉结果与 `--fs-primary-soft (#E7EAF3)` 相似但不完全等同（10% alpha on ivory vs. solid #E7EAF3）。如 PR-2 AppShell 改写想精确匹配设计稿，可改成 `bg-sidebar-accent text-sidebar-accent-foreground` 或直接用 `bg-brand-soft` token。本 PR 不做。
2. 登录页 `(auth)/login/page.tsx` 仍用 `from-blue-50 to-slate-100` 渐变硬编码 — 非本 PR 也非 PR-1 scope（login 不在 dashboard 三卡范围），留待 Round 7 登录页全局打磨。
3. Tailwind 4 tree-shaking：`bg-brand`/`bg-paper`/`bg-sim-soft` 等新 utility 当前 JSX 还没 consume，所以 served CSS 里没生成对应 class — 这是 Tailwind 4 on-demand 的正常行为，PR-1 引入使用时会自动 emit。已在 `@theme inline` 源里定义齐全 `--color-brand`、`--color-ochre`、`--color-sim`、`--color-tag-a~f` 等，可直接用。

## Overall: **PASS**
