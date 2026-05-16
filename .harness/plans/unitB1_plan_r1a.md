# Unit B1 · r1a · Mini Plan

> builder@instance-workbench · 2026-05-16
> r1a = sidebar 改 + AI Workbench page 容器 + 旧路径 redirect wrappers + tests
> r1b = 抽离 usage-tab + settings-tab 组件

## 目标（仅 r1a）

把 sidebar 9 项缩到 7 项（删 "学生提问" / "AI 用量" / "AI 设置"，加 "AI 工作台"），新建 `/teacher/ai-workbench` Tabs 容器（用量 / 设置），旧路径 redirect。

**r1a 还不抽离 tab 组件**——容器内直接 import 老 page 默认 export 重用即可（next.js client component 可直接 render）。r1b 才正式抽离 `components/ai-workbench/usage-tab.tsx` + `settings-tab.tsx`。

## 改动文件

| 文件 | 改/新 | 估行 |
|---|---|---|
| `components/sidebar.tsx` | 改：删 3 项加 1 项 | +3 / -3 |
| `app/teacher/ai-workbench/page.tsx` | 新：Tabs 容器 + URL ?tab= 同步 | +95 |
| `app/teacher/ai-usage/page.tsx` | 改：thin redirect wrapper | -267 / +5 |
| `app/teacher/ai-settings/page.tsx` | 改：thin redirect wrapper | -319 / +5 |
| `components/ai-workbench/usage-tab.tsx` | 新：搬现 ai-usage 内容（保留所有 state / fetch / UI） | +260（搬迁，非新写）|
| `components/ai-workbench/settings-tab.tsx` | 新：搬现 ai-settings 内容（保留所有 state / fetch / UI） | +315（搬迁，非新写）|
| `tests/ai-workbench-tabs.test.ts` | 新：源结构 grep（Tabs / URL ?tab= / redirect / sidebar 改动） | +80 |

合计 +763 / -589 = +174 净（搬迁不算新写）。**单 commit OK**（净不超 200 行；搬迁可视为重构，文件移动 + 路径变更）。

**决定：单 commit 处理 r1a，把抽离的 tab 组件一并完成**——拆 r1a/r1b 反而复杂（需要 r1a 临时 hack 跨页面 import）。

## 关键决策

1. **抽 tab 内容到 client component**：直接 named export 函数组件，state/fetch 完整搬，不破坏现有逻辑
2. **`/teacher/ai-workbench/page.tsx`** 用 client component + `useSearchParams` 同步 `?tab=` URL
3. **`router.replace(`?tab=${value}`)`** 切 tab 时更新 URL（不污染 history）
4. **默认 tab = `usage`**（与原 sidebar 顺序一致）
5. **旧路径 redirect**：用 Next.js `redirect()` server action（保留旧 URL 兼容书签 / 外链 / 已发邮件）。两旧路径都用 server-side redirect 而非 client-side（更可靠）
6. **sidebar 改动**：删 "学生提问" / "AI 用量" / "AI 设置" → 加 "AI 工作台" (icon `Bot` 或新 icon)；本 commit **同时**做 B1 + B2 的 sidebar 改（B2 不再动 sidebar）
7. **不动 `/teacher/ai-assistant`** sidebar 项（这是 AI 工作助手页面，与 AI 工作台是两个不同功能）

## Sidebar 改动详细

原 9 项 (teacher) / 10 项 (admin):
```
仪表盘 / 课程管理 / 数据洞察 / 学生提问 / 课表管理 / 班级管理 / AI 助手 / AI 用量 / AI 设置  [+ 审计中心 (admin)]
```

新 7 项 (teacher) / 8 项 (admin):
```
仪表盘 / 课程管理 / 数据洞察 / 课表管理 / 班级管理 / AI 助手 / AI 工作台  [+ 审计中心 (admin)]
```

净 -3 + 1 = -2

## tab unmount 时清 testResult state

ai-settings 内 testResult 是组件本地 state；当 user 切到 usage tab，settings-tab 组件 unmount → state 自动清除（React 默认行为，不需要特殊处理）。✓

## 自测计划

- 新 vitest `tests/ai-workbench-tabs.test.ts` ≥4：
  - Tabs 容器渲染 + 默认 usage tab
  - URL ?tab=settings 触发 settings tab
  - sidebar 9 项 → 7 项（grep 删除 3 个 nav entry + 加 1 个）
  - 旧 ai-usage / ai-settings page redirect 到 ai-workbench
- 全 vitest 不破

## Anti-regression

- API endpoints `/api/lms/ai-usage` / `/api/ai/tool-settings` 完全不动
- 组件内 state / fetch / UI 完整搬，不重写
- A1/A2/C1-B 改动 0 触碰
