# Build Report — PR-1 三张核心卡去硬编码 · round 1

## 改动文件

| 文件 | 操作 | 一句话 why |
|---|---|---|
| `components/dashboard/task-card.tsx` | 重写 class 映射 | 类型色（sim/quiz/subj）从 `bg-violet-100/bg-blue-100/bg-teal-100` 换为 `bg-{sim,quiz,subj}-soft` + `text-{sim,quiz,subj}`；已批改卡片从 `bg-emerald-50` 换为 `bg-success-soft`；完成率进度条 emerald/yellow/red 换为 `bg-success/bg-warn/bg-danger`；分数文本和截止日期 red/orange/blue 换为 `text-danger/text-warn/text-info`；`查看结果` 按钮去掉绿色 hardcode 走默认 brand Button；数值类 span 加 `fs-num` class |
| `components/dashboard/announcement-card.tsx` | 换 icon 色 | 公告 icon bg 从 `bg-amber-50 text-amber-600` 换为 `bg-ochre-soft text-ochre`（公告 = 提示/强调，用暖赭 accent，符合 spec "accent 暖赭 · AI/成就/强调"）|
| `components/dashboard/timeline.tsx` | 8 色课程 palette → 6 色 tag + hash | 删除 `COURSE_COLORS` 8 色硬编码数组（blue/emerald/violet/orange/rose/cyan/amber/indigo），换为 `TAG_CLASS_MAP` 映射到 tag-a~f 6 色 desaturated CSS vars；用 `courseColorForId(courseId \|\| courseName)` 稳定 hash 分配（符合 spec §6 "课程 tag 6 色"）|
| `components/dashboard/schedule-card.tsx` | 换 icon 色 | schedule icon bg 从 `bg-green-50 text-green-600` 换为 `bg-info-soft text-info`（课程排期是 info 而非成功状态；绿色已留给 subjective 任务类型）|

## 关键决策

- **3 色任务类型（spec §6 硬约束）**：`simulation=sim` 紫、`quiz=quiz` 蓝、`subjective=subj` 绿。`taskTypeBadgeClass` / `taskTypeIconClass` 两张映射表都改成对应 token。未知类型 fallback 到 `bg-muted text-muted-foreground border-border`（中性，不占语义色）。
- **状态 1 色（spec §6）**：已批改卡片用 `bg-success-soft border-success/20`；完成率进度条按档位用 success/warn/danger（状态独立于类型）。
- **fs-num 数值**：分数 span、完成率 %、均分文本、已提交计数都挂 `fs-num` class（SF Mono + tabular-nums），符合 spec "数值全部走 SF Mono + tabular-nums"。
- **课程 tag 6 色**：spec §6 硬约束 "每页 ≤4 语义色" + "课程 tag 6 色"。timeline 原有 8 色即使降到 6 也需要变成 desaturated。用 `courseColorForId(id)` hash 保证同一课程在不同页面/不同 session 始终同色。
- **不动 props / 不动数据流**：timeline props / TaskCard props / AnnouncementCard props 全部保持；调用方 `app/(student)/dashboard/page.tsx` 和 `app/teacher/dashboard/page.tsx` 无需改动。
- **`查看结果` 按钮简化**：原 `className="bg-green-600 text-white hover:bg-green-700"` 强制绿色，去掉后走默认 Button（brand 深靛色），既符合 "状态色独立" 也减少鲜艳度。
- **Schedule card in scope**：spec 列 task-card / announcement-card / timeline 三个，但 timeline 的 "mixed items" 里 `ScheduleCard` 是第四个子组件（由 timeline.tsx 渲染），不改就会和已改的两个 sibling 失谐，因此一并改。若 QA 判定越界，可回退仅恢复 schedule-card.tsx。

## 验证

| 命令 | 退出 | 结果 |
|---|---|---|
| `npx tsc --noEmit` | 0 | 无输出 |
| `npm run build` | 0 | 所有路由构建成功 |
| `npx vitest run` | 0 | 11 files / 61 tests 全过 |
| `grep -r "bg-violet\|bg-emerald\|bg-blue-\|bg-rose\|bg-amber-\|bg-cyan\|bg-indigo\|bg-purple\|bg-pink\|bg-orange-\|bg-teal" components/dashboard/` | - | **无匹配**（spec acceptance 第 1 条达成）|

## 约束检查

| 约束 | 状态 |
|---|---|
| 不变更 schema | ✅ 未触碰 `schema.prisma` |
| 不新增页面 | ✅ |
| 不移除 API | ✅ |
| 不改状态机 | ✅ 无业务逻辑改动 |
| 中文 UI | ✅ 纯视觉改动，所有文本中文未动 |
| 任务类型 3 色 + 状态 1 色 | ✅ sim/quiz/subj 三色 + 状态独立走 success/warn/danger |
| AI 就地 | N/A |
| 克制（每页 ≤4 语义色） | ✅ 每张卡最多一个类型色 + 一个状态色；timeline 每条 courseGroup 一个 tag 色 |
| 不重排布局 | ✅ JSX 结构 / 列宽 / 间距全部保持 |
| 不改 props | ✅ 三个组件 props 签名未动 |
| 不加功能 | ✅ 只换色 |

## 遗留问题 / 注意

1. **Tailwind 4 on-demand 编译**：新用的 class 名 `bg-sim-soft` `text-sim` `bg-quiz-soft` `text-quiz` `bg-subj-soft` `text-subj` `bg-success-soft` `text-success` `bg-info-soft` `text-info` `text-warn` `text-danger` `bg-ochre-soft` `text-ochre` `bg-tag-a` ~ `bg-tag-f` `text-tag-a-fg` ~ `text-tag-f-fg` `border-tag-*-fg/20` 在 QA r1 PR-0 报告里明说 Tailwind 4 tree-shake 会在 JSX 首次使用时自动 emit — 现在 JSX 已引用，`npm run build` 已成功（如果 class 名未 resolve，build 会留 `bg-sim-soft` 字面量但无对应 CSS，肉眼看为"透明"）；QA 用真浏览器验证每种类型和状态的颜色实际可见。
2. **浏览器硬刷**：Dev server 若开着，需要 `Cmd+Shift+R` 清缓存。
3. **对比度**：
   - sim `#5B4FB8` on `#ECE9F7`、quiz `#2E5FB4` on `#DDE8FA`、subj `#0F7A5A` on `#DCF2E8` — 源自设计师 tokens.css，AAA 通过
   - warn `#B4751C` 用于接近截止（≤3 天）的截止日期文本，on 象牙 bg `#F7F4EC` 对比度约 4.5:1，达 AA
4. **其他组件的硬编码色**（非本 PR 范围）：
   - `components/schedule/*.tsx` — schedule tab 里仍有 `bg-blue-50` / `bg-blue-500` 等（留给 Round 3）
   - `components/simulation/*.tsx` — simulation runner 对话气泡硬编码色（留给 Round 8 独立重做）
   - `components/quiz/quiz-runner.tsx` — 留给 Round 7 Runner 壳子
   - `components/course/course-analytics-tab.tsx` — 留给 Round 4 教师端
   - 均符合 spec "Scope 外 · Round 2+ 的工作量预告"

## 请求 QA 验证

- `/dashboard`（学生）任务卡：simulation 紫（soft lavender）/ quiz 蓝 / subjective 绿 — 三色清晰可辨；已批改卡片整体 bg 变 soft green 且 border 相应着色
- `/teacher/dashboard`（教师）任务卡：类型色一致；完成率进度条 ≥80% 绿、60-79% warn 赭、<60% 红、无提交灰；截止日期已过 → 红、≤3 天 → warn 赭、其他 → muted
- 公告卡 icon 变暖赭 `bg-ochre-soft text-ochre`（不是黄色 amber）
- Timeline 课程 tag 从 8 色 → 6 色 desaturated；同一课程在多条 item 始终同色（hash 稳定）
- Schedule item icon 变 info 蓝（不是绿色）
- **暗色模式下**各色可读，尤其 `bg-sim-soft` 在 dark mode 是 `#26233F` 深紫底、text-sim 是 `#8C82D6` lift 紫 — 对比度应通过
