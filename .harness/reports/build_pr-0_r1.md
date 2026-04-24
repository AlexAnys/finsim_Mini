# Build Report — PR-0 Design Tokens 落地 · round 1

## 改动文件

| 文件 | 操作 | 一句话 why |
|---|---|---|
| `app/globals.css` | 全量重写 | 浅色/深色 `:root` 改成 FinSim canonical tokens，shadcn token 全部映射到 `--fs-*`，`@theme inline` 追加 brand/ochre/sim/quiz/subj/tag-a~f/ink/paper/surface/semantic + shadow-fs 系列给 Tailwind 4 激活 |
| `lib/design/tokens.ts` | 新建 | 给 JS 层（inline SVG chart / inline style）提供 tokens + `tagColors` + `courseColorForId(id)` hash helper + `taskTypeColors` 映射 |

## 关键决策

- **Tailwind 4 写法确认**：项目无 `tailwind.config.*`，走 `@theme inline` 块里的 `--color-*`。所有 FS tokens 同时以 `--fs-*`（源）和 `--color-*` 别名（Tailwind 激活）两种方式写入。
- **shadcn token 全量映射**：`--primary` / `--accent` / `--sidebar-*` / `--chart-*` / `--border` / `--ring` 等全部转写为 `var(--fs-*)`，这样现有 shadcn 组件（Button、Card、Sidebar）自动获得新品牌色，无需改组件代码。
- **Dark mode 适配**（设计师原稿未出深色）：
  - 画布 `#0F1118`（深中性，不是蓝紫色）
  - primary 从 `#1E2A5E` lift 到 `#7B8CD9`（对比度足够且保留深靛 DNA）
  - accent 从 `#C48A3C` 轻微上提到 `#D9A257`
  - ink 全量反转到象牙色系（`#F3F0E8` → `#6B7186`）
  - tag-a~f 在深模下 bg 变深、fg 用浅色版
- **`.fs-num` utility**：保留 spec 要求的 `font-variant-numeric: tabular-nums` + SF Mono stack，数值类元素挂 class 即生效。
- **不做清理**：本 PR 不动任何 `bg-violet-100` / `bg-emerald-100` 硬编码 class（spec 明确要求留给 PR-1）。

## 验证

| 命令 | 退出 | 结果 |
|---|---|---|
| `npx tsc --noEmit` | 0 | 无输出（全通过）|
| `npm run build` | 0 | 成功构建所有路由（static + dynamic）|
| `npx vitest run` | 0 | 11 test files / 61 tests 全过 |

## 约束检查

| 约束 | 状态 |
|---|---|
| 不变更 schema | ✅ 未触碰 `schema.prisma` |
| 不新增页面 | ✅ 无新路由 |
| 不移除 API | ✅ 未动 `app/api/` |
| 不改状态机 | ✅ 未动 services / lib |
| 中文 UI | ✅ 纯 CSS/token 改动，无用户可见文本 |
| 任务类型 3 色 | ✅ `sim`/`quiz`/`subj` 三色 token |
| AI 就地 | N/A（本 PR 不动 AI） |
| 克制 | ✅ 只新增 token，不触碰 JSX |

## 遗留问题 / 注意

1. **硬编码紫/绿色仍在**：`bg-violet-100` / `bg-emerald-100` 等在 TaskCard / AnnouncementCard / Timeline 里仍会显示原紫绿色，与新深靛品牌不协调。**这是 spec 里明确说的预期中间状态**，PR-1 清理，**不是 regression**。
2. **浏览器刷新**：运行中的 dev server（如果 QA 有开）需要硬刷（`Cmd+Shift+R`）才能看到新色。本 PR 未动 `schema.prisma`，无需重启 server。
3. **`shadcn/tailwind.css` 内置样式**：保持 `@import "shadcn/tailwind.css"` 未动；若它内部重新定义了被我们覆盖的变量需要 QA 在浏览器里确认实际取值。
4. **对比度**：浅色模式的 `fs-ink` `#0F1623` on `fs-bg` `#F7F4EC` WCAG AAA 通过；深色 `fs-ink` `#F3F0E8` on `fs-bg` `#0F1118` 也通过。brand `#1E2A5E` on `#F7F4EC` 约 12:1，安全。
5. 测试套件数量（61）与上 commit（42+）已对齐当前仓库实际数，不是新增也非回归。

## 请求 QA 验证

- `/dashboard` 在浅色/深色下整页背景变米象牙（浅）/ 深中性（深），不是纯白/纯黑
- `/teacher/dashboard` 侧边栏激活项底色从旧的 `oklch(0.96 0.02 262)` 蓝紫色 soft 变成 `#E7EAF3` 深靛 soft
- 按钮 primary 变深靛，accent（暖赭）出现在任何用 `bg-accent` 的位置
- `bg-violet-100` 这类仍然显示原紫色 — **这是预期的**，不是 bug
- 切换主题（若 UI 有开关）深浅模式都不瞎眼
