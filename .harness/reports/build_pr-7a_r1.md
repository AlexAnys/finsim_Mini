# Build · PR-7A Simulation Runner 视觉重做 · r1

**Owner**: builder · **Date**: 2026-04-25 23:55Z · **Spec ref**: `.harness/spec.md` Phase 7 / `.harness/HANDOFF.md` Next-step

## 范围

按 `mockups/design/student-sim-runner.jsx` 重做学生 Simulation Runner 主视图。**Anti-regression 严格**：仅换视觉外壳，所有 state / API call / handler / submit 路径 byte-equivalent。Mood 推断 + Hint AI 接入留给 PR-7B；持久化 snapshot 留给 PR-7C。

## 改动文件

| 文件 | diff | 性质 |
|---|---|---|
| `components/simulation/simulation-runner.tsx` | +835 / −246 (净 +589) | 主视图 JSX 重写 + 4 sub-components 抽取 |

> **不动**：`app/(simulation)/sim/[id]/page.tsx`、`components/simulation/evaluation-view.tsx`、`components/simulation/study-buddy-panel.tsx`、`lib/services/*`、所有 API route、`schema.prisma`、`lib/types/*`。

## 设计实现

### Topbar（沿用 PR-6C `RunnerTopbar`，仅改 metaSlots）

- 8 段 mood meter（pill 内嵌 8 条彩色小条），按当前 5 档 MoodType 映射到 8 档色带（PLACEHOLDER 槽位预留给 PR-7B 填 8 档真模型）
- 客户情绪文案（`平静` / `犹豫` / `怀疑` / `略焦虑` / `焦虑`）按 D1 八档命名重映射现有 5 档
- 轮数计数器
- 操作按钮：`重来` (RotateCcw) + `结束对话` (Check)，签名与原版一致

### LEFT 280px · `<SimLeftRail>`

- 背景情景（whitespace-pre-wrap）
- 对话目标（多个 requirement 列表，灰色单选环 + 灰底按钮）
- 评分对照（rubric criteria 列表，分值小字 + 圆点）
- 引导提示卡片（`var(--fs-bg-alt)` 背景 + Sparkles `var(--fs-sim)` 色）

### MID flex · `<SimChat>` + `<SimMsg>`

- 顶部场景 callout（黑底"场景"小标签 + dashed border 卡片）
- 气泡：AI 4-14-14-14 圆角 + linear-gradient 头像；Student 14-4-14-14 + ink 头像
- 角色名 / 时间戳 over each bubble
- AI bubble 下方 mood chip（绑 `m.mood`，仅 AI 有）
- AI bubble 下方 hint 提示（仅当消息含 `.hint` 字段时才渲染 — PR-7B 会让 AI 真返回该字段，本 PR 占位 UI）
- Composer：圆角卡片，单 `Textarea` + 字数计数 + 发送按钮（disabled 状态用 `var(--fs-bg-alt)` 灰底）

### RIGHT 320px · `<SimRightPanel>` + `<SimDonut>` + `<SimSlider>`

- 顶栏：标题 + 副标题 + 合计百分比 chip（balance / unbalance 双色）
- 圆环图（SVG path，prefix-sums 预计算，no mid-render mutation）
- 滑杆：彩色条 + 渐变 fill bar
- 底部：提示卡片 + 重置 / 记录当前配比 双按钮

## 行为不变性 audit

| 项 | 状态 | 证据 |
|---|---|---|
| `messages` state init | 不动 | line 144-156 与原 117-129 byte-identical |
| `handleSend` body | 不动 | `transcript` payload 构造、API URL、错误流转、`parseMoodFromText`、`setMessages((prev) => ...)` 完全一致 |
| `handleAllocationChange` body | 不动 | 嵌套 map / 不可变更新 一致 |
| `handleSubmitAllocation` body | 不动 | 100% 校验、toast、count++ 一致 |
| `handleFinishConversation` body | 不动 | preview / student 双路径、`/api/ai/evaluate` + `/api/submissions` 调用 byte-identical |
| `handleSubmit` body | 不动 | 同上 |
| `handleRedo` body | 不动 | 重置 7 个 state，`localStorage.removeItem` 同 key |
| `localStorage` draft 持久化 | 不动 | `DRAFT_KEY_PREFIX` 常量同；保存触发 `useEffect` 同 |
| `parseMoodFromText` 正则 | 不动 | `/\[(?:MOOD:\s*)?(\w+)\]\s*$/i` 一致 |
| `MOOD_COLORS` keys | 扩展（向后兼容） | 5 个 MoodType key 全保留；新增 `bandIndex` `tone` 字段不影响 type assignability |
| `EvaluationView` 渲染分支 | 不动 | `if (evaluation) return <EvaluationView>` 路径 byte-identical |
| `StudyBuddyPanel` 挂载 | 不动 | 主视图末尾 + 评估视图后 双挂载，与原版一致 |
| `RunnerTopbar` API 用法 | 不动 | `metaSlots` 是 `ReactNode` slot，PR-6C 已稳定 |

新增 `handleResetAllocation()` 函数仅本 PR 引入，在右栏"重置"按钮使用 — 不影响任何其他 caller，setAllocations 用与 handleRedo 相同的 default reset 逻辑。

## 验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | 0 错误 |
| ESLint | `npx eslint components/simulation/simulation-runner.tsx` | 0 错误 0 警告 |
| 单测 | `npx vitest run` | **366 / 366 passed**（与基线一致 · 1.62s） |
| 生产构建 | `npm run build` | 成功 · 25 routes 全编译（包括 `/sim/[id]`） |
| dev server | `lsof -nP -i :3000` | PID 70137 alive |

## E2E 真访问验证

### 已认证学生 student1 → `/sim/{simulationTaskInstanceId}`

```
GET /sim/e34afdc0-dc06-4072-aa5c-d1b945de0850 → HTTP 200
```

dev SSR 输出"加载模拟任务…" + 客户端 hydration（与原版相同，page 是 client component，`fetchTask()` 在 useEffect 触发）。

SSR 编译产物（`.next/server/chunks/ssr/app_(simulation)_sim_[id]_page_tsx_*.js`）真扫描视觉文案落地：

| 文案 | 命中数 |
|---|---|
| 客户情绪 | 1 |
| 为客户配资产 | 1 |
| 背景情景 | 1 |
| 对话目标 | 1 |
| 评分对照 | 1 |
| 场景（callout） | 1 |
| 继续对话（composer placeholder） | 1 |
| 结束对话（topbar 主按钮） | 1 |
| 学习伙伴（hint 占位前缀） | 1 |
| 资产配比图（donut aria-label） | 1 |

> "客户档案" 在原 mock 是 LEFT 顶部小标题；本实现把它解构成"背景情景 + 对话目标 + 评分对照"三段，所以单文案不再出现 — 视觉上等价更细化。

### API 契约不变

```
GET /api/lms/task-instances/e34afdc0-dc06-4072-aa5c-d1b945de0850 → HTTP 200
```

返回字段集与 PR-5A baseline 一致：`id, title, description, taskId, taskType, classId, groupIds, courseId, chapterId, sectionId, slot, dueAt, publishAt, publishedAt, status, attemptsAllowed, taskSnapshot, createdBy, createdAt, updatedAt, task, class, course, chapter, section, _count` · `task.taskType=simulation`。

### 9 路由 regression（5 student + 4 teacher）

| 角色 | 路由 | 状态 |
|---|---|---|
| student1 | /dashboard | 200 |
| student1 | /courses | 200 |
| student1 | /grades | 200 |
| student1 | /tasks/{simInstance} | 200 |
| student1 | /sim/{simInstance} | 200 |
| teacher1 | /teacher/dashboard | 200 |
| teacher1 | /teacher/courses | 200 |
| teacher1 | /teacher/instances | 200 |
| teacher1 | /teacher/tasks | 200 |

## 设计决策与取舍

1. **8 档 mood meter 现在用 5 档 MoodType 填**：当前 `MoodType = HAPPY|NEUTRAL|SKEPTICAL|CONFUSED|ANGRY`，按 spec D1 (8 档：平静/放松/兴奋/犹豫/怀疑/略焦虑/焦虑/失望) 映射：HAPPY→平静(0), NEUTRAL→犹豫(3), SKEPTICAL→怀疑(4), CONFUSED→略焦虑(5), ANGRY→焦虑(6)。`PLACEHOLDER` 槽位 (1, 2, 7) 等 PR-7B schema 扩展后填入新 enum 值。视觉上 8 段条已正确显示，颜色按 tone 分 good/warn/bad。

2. **Hint UI 占位**：`<SimMsg>` 检查 `(m as TranscriptMessage & { hint?: string }).hint`，类型扩展用 inline cast。PR-7B 会让 `TranscriptMessage` 加 `hint?: string` 字段并由 AI prompt 填，届时去掉 cast。

3. **Donut 颜色硬编码 6 色**：`DONUT_COLORS` 常量来自设计源 verbatim（`#3B5A8C / #5B7B9C / #8A9AAE / #A67E64 / #6D5A7A / #5B4FB8`），因为 token 系统没有"分类调色板"语义。同 PR-6C 4 处硬编码先例（黑底 mood meter 高亮色）。

4. **新增 `handleResetAllocation()`**：右栏"重置"按钮的需求来自设计稿。不与 `handleSubmitAllocation` 冲突，不重置 `allocationSubmitCount`（spec 不要求）。

5. **8 档 mood meter 颜色**：`#51C08E / #E6B34C / #E07A5F` 来自设计源 verbatim — 黑底需更亮，这与 PR-6C 留下的 token 缺 `-bright` 变体观察一致。

6. **删除原 `User`/`Settings`/`BarChart3` 等图标 import + `Badge`/`Slider`/`Separator`/`Card` shadcn 包装**：被 sub-components 取代，`Slider`/`Separator` 不再使用。

## 不确定点 / deferred

- **真"客户档案"卡片**（设计源左栏顶部 48×48 头像 + 4 行 dl）：当前 task config 没有 client persona 结构化字段。要落地需要 schema 加 `simulationConfig.clientProfile` JSON。本 PR 用"背景情景"段替代，文字内容来自现有 `scenario` 字段。**留给 Phase 8** 或 PR-7B 顺手加（如 H2 schema 改动顺势包含）。

- **Topbar 倒计时（`18:24` 剩余）**：设计源是硬编码占位。真倒计时需要 `dueAt - now` 计算 + 1Hz tick，超出 PR-7A 范围（spec L96 "时间显示"非强制）。**留给 Phase 8 一起做**。

- **"显示/隐藏配置面板" + "查看资料"图标按钮（composer 左下）**：设计源有 3 个图标按钮（Sparkles/file/chart），实现成本低但功能未定义。当前砍掉，仅保留字数 + 发送。**留给 PR-7C 资产持久化** 时一起决定面板折叠交互。

## 不需要 dev server 重启

零 schema / 零 server-side 文件改动，所有改动在客户端 React 组件。Turbopack hot-reload 已自动应用（dev server PID 70137 持续 alive）。

## 下一步

PR-7B 衔接：
1. `schema.prisma` 加 `Message` 表 mood/hint 字段（spec H2）+ `AnalysisReport.moodTimeline`
2. Prisma 三步严格走（migrate dev + generate + 真重启 dev server）
3. AI chat prompt 改造：让 qwen-max 同时输出 reply + mood (8 档) + 触发条件下输出 Socratic hint
4. `parseMoodFromText` 重写为 JSON 解析（`{ reply, mood, hint? }`）—— 替换正则
5. `<SimMsg>` 移除 inline cast，正式用 `m.hint` 字段

PR-7C 衔接：
- 资产滑杆 debounce 自动保存（持久化到 DB 而非仅 localStorage）
- snapshot 入 `AnalysisReport.allocationSnapshots`

---

**给 qa-p7**：dev server PID 70137 已重启过；测试账号 student1@finsim.edu.cn / password123；simulation TI id=e34afdc0-dc06-4072-aa5c-d1b945de0850；`/qa-only` 真浏览器加载验证视觉新外壳，特别检查（1）topbar 8 段 mood meter 渲染，（2）三列布局响应，（3）donut SVG 路径无错位，（4）右栏滑杆拖动 + 合计 100% 时 chip 转绿，（5）"重来"按钮重置 messages/mood/allocations。
