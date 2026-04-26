# PR-SIM-4 · Codex Task Package

> 你是 finsim（灵析）项目的工程师。这是一个明确 scope 的小 PR：D5 mood label 简化 + D4 Study Buddy panel 可拖拽。两个改动相互独立，可一起做。

## 项目上下文

- Next.js 15 + Prisma + Tailwind + shadcn/ui
- 三层架构：Route Handler → Service → Prisma（详见 CLAUDE.md）
- 所有 UI 文案中文
- 严格遵守 design tokens（不引入新硬编码色）

## 任务 1：D5 · Mood label 简化（用户反馈：去掉"情绪"前缀）

**文件**：`components/simulation/simulation-runner.tsx`

**当前**（约 L1083-1084 处）：
```tsx
<span aria-hidden>●</span>
<span>情绪 {moodInfo.label}</span>
```

**改为**：
```tsx
<span aria-hidden>●</span>
<span>{moodInfo.label}</span>
```

**只改这一处**。

### 严禁改动（独立守护）

- L696-700 处的 topbar `客户情绪` meter（那是 meter 的 title，不是单条消息的 chip）
- `MOOD_BANDS / MOOD_COLORS / moodKeyFromLabel` 三个常量/函数（mood 8 档计算逻辑）
- 任何 mood 类型定义或 ai.service.ts

## 任务 2：D4 · Study Buddy panel 可拖拽

**文件**：`components/simulation/study-buddy-panel.tsx`

**当前**：
- L192：未打开时 button 固定 `fixed bottom-6 right-6 z-50`
- L200：打开后 panel 也是 `fixed bottom-6 right-6 z-50`

**改为**：
- button + panel **可鼠标拖拽**
- 拖拽位置 persist 到 `localStorage` key = `finsim_studybuddy_pos`
- 拖拽时 `cursor: move`
- 边界保护：不超出视口（`Math.max(0, Math.min(x, window.innerWidth - elementWidth))` 类）
- 默认位置：右下角（`x = innerWidth - 80, y = innerHeight - 80`），首次访问无 localStorage 时
- 关闭 panel 后重新打开应**记得位置**（即 button 和 panel 用同一 position state）

### 实现建议（自由选择）

- 用 `useState` 存 `{ x: number, y: number }`
- 拖拽用 `onMouseDown` + `onMouseMove`（document 级）+ `onMouseUp` 三事件
- 用 `useEffect` 同步到 localStorage（debounce 不必要）
- SSR 安全：首次 render 用默认值，`useEffect` 里读 localStorage
- 用 react ref 拿 element 尺寸做边界

### 严禁改动

- 任何 `lib/services/` 文件
- 任何 `app/api/` 文件
- `prisma/schema.prisma`
- `study-buddy-panel.tsx` 内部的业务逻辑（fetchPosts / handleSubmit / mode / anonymous 等所有现有功能必须保留 byte-equivalent）

## Acceptance（必须全过）

```bash
npx tsc --noEmit          # 必须 0 errors
npm run lint              # 必须 0 errors（warnings OK）
npx vitest run            # 必须 450 PASS（与现状一致；本 PR 不要求新 tests，因为是纯 UI）
```

## 报告格式

完成后**不要 git commit**。直接报告：

1. 改了哪几个文件（路径 + 行号区间）
2. 关键改动说明（≤ 5 句）
3. 上述 3 个 acceptance 命令的输出 tail（确认全过）
4. 可能的潜在风险（如有）

我来 review diff、commit、push。

## 验证 Tips

- mood 简化：在 sim runner 跑一次模拟对话，看每条 AI 消息下方的 mood chip 文字是否仅显示 "犹豫" 而不是 "情绪 犹豫"
- study buddy 拖拽：触发学习伙伴 hint 时，按住按钮拖动到屏幕左上、刷新页面，按钮应在新位置
