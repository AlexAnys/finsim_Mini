# Build Report · Unit B1 · Round 1 (AI 工作台合并 + sidebar 整合)

> builder@instance-workbench · 2026-05-16
> Plan: `.harness/plans/unitB1_plan_r1a.md`
> 单 commit 完成（r1a/r1b 合并）

## 范围

把 sidebar 9 项缩到 7 项（删"学生提问"/"AI 用量"/"AI 设置"，加"AI 工作台"），新建 `/teacher/ai-workbench` Tabs 容器（用量/设置 双 tab + URL `?tab=` 同步），旧路径改为 server-side redirect 兼容书签。

## 改动文件

| 文件 | 改/新 | 净行 |
|---|---|---|
| `app/teacher/ai-workbench/page.tsx` | 新 | +95 |
| `components/ai-workbench/usage-tab.tsx` | 新（搬迁 ai-usage 内容） | +260 |
| `components/ai-workbench/settings-tab.tsx` | 新（搬迁 ai-settings 内容） | +315 |
| `app/teacher/ai-usage/page.tsx` | 改：thin redirect wrapper | +5 / -267 |
| `app/teacher/ai-settings/page.tsx` | 改：thin redirect wrapper | +5 / -319 |
| `components/sidebar.tsx` | 改：9 项 → 7 项 + 调整 lucide imports | +1 / -4 |
| `tests/ai-workbench-tabs.test.ts` | 新：9 测试 | +95 |
| `tests/fix-4-provider-deadcode.test.ts` | 改：3 个测试的 `readFile` 路径从 ai-settings/page.tsx 改为 ai-workbench/settings-tab.tsx | +6 / -3 |
| `tests/low-conflict-production-guards.test.ts` | 改：1 个测试的 `readFile` 路径同上 | +2 / -1 |

合计：产线代码净变化 ≈ 0（纯搬迁 / 重构）；测试 +95 / -4。

## Sidebar 调整详细

```
旧 9 项 (teacher) → 新 7 项:
- 仪表盘 ✓
- 课程管理 ✓
- 数据洞察 ✓
- 学生提问 ❌ (删，B2 搬到课程详情 SB tab)
- 课表管理 ✓
- 班级管理 ✓
- AI 助手 ✓
- AI 用量 ❌ (合到 AI 工作台 ?tab=usage)
- AI 设置 ❌ (合到 AI 工作台 ?tab=settings)
+ AI 工作台 (新，icon: SlidersHorizontal)

admin extra: 审计中心 ✓ 不变
```

lucide imports 清理：删 `MessageSquareText` / `Activity` / `Settings2`（teacherNav 不再用），新增 `SlidersHorizontal`。

## URL `?tab=` 同步机制

- `useSearchParams` 读初始 tab → 默认 `usage`
- `router.replace(?tab=${value}, { scroll: false })` 切 tab 时更新 URL（不污染 history）
- 后退/外链场景：`useEffect([searchParams])` 反向同步 state
- Suspense 包裹（Next.js 要求 useSearchParams 在 suspense boundary 内）

## tab unmount 自动清 testResult

`SettingsTab.testResult` 是组件本地 `useState`。切到 usage tab → Radix Tabs `unmount` `TabsContent value="settings"` 子树 → React 自动清 state。无需特殊处理。

## 旧路径 redirect

`app/teacher/ai-usage/page.tsx` + `app/teacher/ai-settings/page.tsx` 改为 server component，body 仅 `redirect("/teacher/ai-workbench?tab=...")`。优势：
- SEO friendly（301 永久重定向）
- 已发邮件 / 书签 / 外链不破
- 不需要 client hydration

## 自测结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（B1 文件） | 0 error |
| `npx tsc --noEmit`（全项目） | 0 error（rebase 后已清 study-buddy baseline）|
| `npx vitest run tests/ai-workbench-tabs.test.ts` | 9 / 9 PASS |
| `npx vitest run`（全 suite） | **102 files / 1171 tests PASS** / 0 regression（baseline 1162 + B1 +9）|
| `npx eslint <touched files>` | 0 error / 0 warning |

## 测试路径修复决策

`tests/fix-4-provider-deadcode.test.ts` 与 `tests/low-conflict-production-guards.test.ts` 中 4 个测试 `readFile("app/teacher/ai-settings/page.tsx")` 因文件搬迁失败。这 4 个测试的 **契约（"AI 设置 UI 含 provider Select / 测试连接 button / 中文 search-disabled 文案"）完全保留**，仅断言对象的文件路径变了。

按 CLAUDE.md TDD 原则「never modify tests to accommodate implementation」严格解读，**这不是修改实现而修测试**——是 refactor 移动文件，测试需跟随文件位置。决策：仅更新 `readFile()` 调用的路径参数，**所有 assert 表达式 0 改动**，加注释 `// Unit B1: 抽离到 components/ai-workbench/settings-tab.tsx` 留痕。

如你认为这违反原则，可让 qa 验证测试断言强度未削弱（diff 仅 `app/teacher/ai-settings/page.tsx` → `components/ai-workbench/settings-tab.tsx`）。

## 关键决策

- **单 commit 完成**：r1a/r1b 合并。抽 tab 组件 + 整合 sidebar + 旧路径 redirect 是一个原子重构，拆开反而要 r1a 临时 hack 跨页 import
- **保留 `/teacher/ai-assistant`**：那是 AI 工作助手页面（教师粘贴材料 → 4 工具生成 result），与 AI 工作台是两个独立功能；本 unit 不动
- **`Bot` icon 留给 AI 助手** + `SlidersHorizontal` 给 AI 工作台：避免视觉混淆

## Anti-regression

- API endpoints `/api/lms/ai-usage` / `/api/ai/tool-settings` / `/api/ai/tool-settings/test-connection` 0 改动
- 组件内 state / fetch / UI 完整搬，不重写
- A1 / A2 / C1-B 改动 0 触碰
- 学生 sidebar 不变（B1 只动 teacherNav）

## 范围外（下一步）

- B2：学生提问搬课程 SB 统计 tab（sidebar 已删入口，本 commit 处理；剩 SB tab section + API courseId filter）

## 下一步

QA 验收 B1。然后开 B2。
