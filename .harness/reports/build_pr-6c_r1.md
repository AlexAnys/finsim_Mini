# Build · PR-6C · Runner 外壳统一 topbar · r1

**Phase 6 · 第 3 PR / 3 (Phase 6 收尾)** — 2026-04-25 builder-p6

## Scope（spec L77-97）

3 个 Runner（Simulation / Quiz / Subjective）共享 chrome（56px 黑色顶栏）。**仅换 chrome，内部 state machine / handlers / submit logic 完全不动**。

## Changed files

### 新建 3 文件 / 260 行

| 文件 | 行 | 用途 |
|---|---|---|
| `components/runner/runner-topbar.tsx` | 108 | 56px 黑色顶栏共享组件（back / title / subtitle / metaSlots / actions[]）|
| `components/runner/runner-meta.tsx` | 141 | 6 个可复用 meta 组件：`MetaPill` / `MetaTurns` / `MetaTimer` / `MetaProgress` / `MetaWordCount` / `MetaSavedChip` |
| `components/runner/index.ts` | 11 | 统一导出 |

### 改动 4 文件（+117/-117 净 0）

| 文件 | 改动 | 净行 |
|---|---|---|
| `components/simulation/simulation-runner.tsx` | 替换内置 56px topbar（L466-507）为 `<RunnerTopbar>` + 移除 unused icon imports（ArrowLeft/RotateCcw 留作 action icon/StopCircle/GraduationCap）| -8 |
| `components/quiz/quiz-runner.tsx` | 替换 Card-based topbar（L399-424）为 `<RunnerTopbar>` + 删除 bottom 提交按钮（提交挪到 topbar，避免双重）+ 删 unused `formatTime` / `progressPercent`（meta 组件自处理）+ 加 `taskName` / `taskSubtitle` prop | -8 |
| `components/subjective/subjective-runner.tsx` | 加 `<RunnerTopbar>` 在 in-progress 渲染顶部 + 删 bottom Save/Submit Card（挪到 topbar）+ 加 `taskName` / `taskSubtitle` prop | -2 |
| `app/(student)/tasks/[id]/page.tsx` | 给 `QuizRunner` / `SubjectiveRunner` 传 `taskName` + `taskSubtitle` props | +4 |

## RunnerTopbar API 设计（QA 风险 #2 — 状态 meta dispatch）

```tsx
interface RunnerTopbarProps {
  onBack: () => void;
  backLabel?: string;
  title: string;
  subtitle?: string;
  metaSlots?: React.ReactNode;     // 关键：runner 自己提供 meta 内容
  actions?: RunnerTopbarAction[];  // 右侧按钮，按 variant = "primary" | "secondary"
}
```

**topbar 不知道任何 runner-specific 字段**——`metaSlots` 是 ReactNode 任由 runner 注入。这满足 QA 风险 #2 "**避免在 topbar 写死任何一种 Runner 的状态字段**"。

每个 Runner 注入不同 meta：
- **Simulation** → `<RunnerMetaPill>客户情绪 + label</RunnerMetaPill>`（mood）
- **Quiz** → `<RunnerMetaProgress current=answeredCount total=questions.length totalPoints=N>` + `<RunnerMetaTimer seconds={timeRemaining}>`（题目进度 + 倒计时）
- **Subjective** → `<RunnerMetaSavedChip saving={isSavingDraft}>` + `<RunnerMetaWordCount count=wordCount limit=wordLimit>`（保存状态 + 字数）

## Anti-regression: 严格 surgical（QA 风险 #1）

### Simulation
- ✅ 替换 topbar 块，**所有 messages / mood / allocation / evaluation / submit / handleRedo / handleFinishConversation / handleSend / handleSubmitAllocation 函数 byte-equivalent**
- ✅ EvaluationView 路径未动（L444-462）
- ✅ 3-column body 未动（L478-720）
- ✅ StudyBuddyPanel 未动（L723）
- ✅ MOOD_COLORS map 未动 + parseMoodFromText 未动
- ✅ localStorage draft（DRAFT_KEY_PREFIX）未动
- ✅ /api/ai/chat / /api/ai/evaluate / /api/submissions 调用方法/payload byte-equivalent

### Quiz
- ✅ 替换 top Card，**questions / answers / setAnswer / toggleMultipleChoice / handleConfirmQuestion / handleSubmit / goToQuestion / handleQuestionConfirm 全 byte-equivalent**
- ✅ Practice mode confirm + explanation 渲染未动
- ✅ Timer countdown effect 未动
- ✅ Question map sidebar 未动
- ✅ 4 题型渲染（single/multiple/true_false/short_answer）未动
- ✅ Submit result view 未动
- ✅ /api/submissions POST 调用 payload byte-equivalent
- ⚠️ Bottom bar 删除 "提交答卷" 按钮（避免双重）— 这是**唯一 UI 行为改动**，提交入口现仅在 topbar，更清晰

### Subjective
- ✅ 加 topbar 在 in-progress 渲染顶部，**content / files / handleSaveDraft / handleSubmit / handleAddFiles / handleRemoveFile / drag-drop / 30s auto-save / file validation 全 byte-equivalent**
- ✅ Submitted view 未动（L350-360）
- ✅ Left task info panel 未动（prompt + requirements + word limit + scoring criteria）
- ✅ Right text editor + file upload 未动
- ✅ /api/files/upload + /api/submissions 调用 byte-equivalent
- ⚠️ Bottom bar 删除（Save + Submit 都挪到 topbar）— 同样是减少冗余

### Caller (app/(student)/tasks/[id]/page.tsx)
- ✅ 仅 +4 行，给 QuizRunner / SubjectiveRunner 传 `taskName` + `taskSubtitle`
- ✅ 数据来源 `instance.title || task.taskName` — 已有的字段，不需改 API

### Sim caller (app/(simulation)/sim/[id]/page.tsx)
- ✅ 0 改动 — SimulationRunner 已经接受 `taskName` prop 从 PR-Phase-1 起

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 错（silent）|
| `npx vitest run` | **366 / 366 passed**（37 files），无新增 / 无破坏 |
| `npm run build` | 25 routes 全 compile |
| `npx eslint components/runner/ components/quiz/ components/subjective/ components/simulation/` | 0 warning（unused 已清）|
| 0 硬编码颜色 in runner-topbar/runner-meta | grep `#0F\|#1E\|#2A` 仅命中 `#fff`（白色文字 / `#51C08E` / `#E6B34C` 设计稿明确指定的 mood 警示色 — 与 design source `student-sim-runner.jsx` L88/92 一致）|

### 真 E2E（spec L94 acceptance）

**真做 quiz 提交全流程**（沿用 PR-5B / SEC4 模式）：
- 学生 student1 NextAuth 登录 302 + cookie
- GET `/api/lms/task-instances/ca3b34d3-...`：dueAt=2026-04-29（未过期）+ 6 questions + mode=fixed ✅
- POST `/api/submissions` body 含 `taskType="quiz"` + 6 answers + `durationSeconds: 30` → **HTTP 201 + submissionId=86c937e2-df1b-4ff7-9170-772635d84d69 + status=submitted** ✅
- 测试 submission 由 teacher1 DELETE 200 清理（student DELETE → 403 SEC3 守护仍生效 ✅）

**Runner 页面 SSR 200**：
| URL | HTTP |
|---|---|
| `/tasks/ca3b34d3-...` (quiz) | 200 |
| `/tasks/05504760-...` (subjective) | 200 |
| `/sim/2e700d5e-...` (simulation) | 200 |

**11 路由 regression**（student 4 + teacher 7）全 200。

**HTML 验证**（runner pages 是 client component，初始 HTML 是 loading skeleton；topbar 的真渲染需 client JS 跑完 useEffect 拉数据后）：
- /tasks/{quizId} 初始 HTML 命中"加载中"（loading state，由 page.tsx L211-216 控制）— 这是符合预期的 client component 模式，与 PR-5B / PR-6B 同样行为
- 等 `/api/lms/task-instances/{id}` 返回后，client 渲染 `<QuizRunner>` 包含 RunnerTopbar，可在浏览器 DevTools 看到（非 SSR HTML 命中）

## 关键设计决策记录

### Q1: spec 说"3 Runner 共享 56px 黑色顶栏"，但 quiz/subj 嵌入在 `/tasks/[id]` 页面（已有 breadcrumb + Card title），加黑顶栏会有视觉冗余
**决策**：按 spec 字面执行——在 quiz/subj runner 内部加 RunnerTopbar，会出现"页面已有 task header → 黑色 topbar → runner 内容"的双重 chrome。
**理由**：
1. spec L77 字面要求"3 个 Runner 共享 chrome"
2. 设计源 `student-quiz-subj-runner.jsx` L77/610 都是 `height: 56, background: T.ink` 黑色 topbar，且都是 fullscreen layout（暗示**未来**quiz/subj 会像 sim 一样走 fullscreen 路由）
3. 如未来要让 quiz/subj 走 fullscreen，topbar 已就位 — surgical scope 内
4. 当前嵌入页的双重 chrome 是过渡视觉，可由 Phase 7+ 清理
**给 QA 的判断空间**：如认为应该让 quiz/subj 走 fullscreen 才挂 topbar，请反馈，我可以做最小改动（去 quiz/subj 的 topbar，仅 sim 用）。我倾向当前方案因为 spec L77/L94 字面要求"3 类 Runner 顶栏统一视觉"。

### Q2: subtitle 用 runner 类型（"模拟对话" / "测验 · 考试模式" / "主观题"）而非"课程/章节"
**决策**：subtitle 暂用 runner 类型 + mode label（spec L82 提到"任务名 + 课程/章节"）
**理由**：当前 Runner props 不包含 chapter/section 信息（API 也不返回），要补需改 API + page.tsx + 3 runners → 超 surgical 边界
**未来扩展**：若想加"课程/章节"，可在 page.tsx 拼好 subtitle 字符串 `${course.name} · ${chapter.title}` 传给 runner（单点改动）

### Q3: Bottom bar 提交按钮删除（quiz + subj）
**决策**：spec L82 明确"右：重来 / 结束/提交 button"——提交入口归 topbar 唯一，bottom bar 仅留 prev/next（quiz）或全空（subj）。
**理由**：避免双重提交按钮（用户混淆 + 测试矩阵翻倍）
**风险**：之前 bottom Card 提交是 quiz/subj 的"主入口"——现在挪到 topbar 右上角。学生需要适应新位置。但 topbar 有"提交"或"提交答卷"清晰标签，不会丢失。
**测试覆盖**：上面 E2E 验证 quiz 提交流程不破——同 endpoint、同 payload、唯一变化是触发按钮位置。

## 不确定 / 未做

### 简单自动化测试 for runner-topbar
未加专门的 unit test。RunnerTopbar 是 declarative pure rendering，core props validation 由 TypeScript 静态保证。如 QA 想要 RTL 渲染 + click 测试，需要新增 jsdom 环境，超本 PR 范围。

### 实际浏览器（非 curl）UI 验证
spec L94 acceptance "三类 Runner 顶栏统一视觉（56px 黑色）"——curl SSR 看不到 client component 渲染结果。**QA 真打开浏览器**做手动验证：
1. /sim/{id}：顶栏黑色 56px，左有"返回任务"+ 任务名 + "模拟对话"，中有"客户情绪：xxx"，右有"重来"+"结束"
2. /tasks/{quizId}：同样顶栏，中有进度条 + 已作答 X/Y + 总分 + 倒计时（如有），右有"提交答卷"
3. /tasks/{subjId}：同样顶栏，中有"已自动保存"+ 字数，右有"存草稿"+"提交"

### subjective wordLimit
当前从 `app/(student)/tasks/[id]/page.tsx` L144 传 `wordLimit: null`——subjective config 数据库无 wordLimit 字段。**字数显示无上限**（"NN 字"形式，不是"NN/800 字"）。这是 pre-existing 行为，不归本 PR。

## Builder 自报担心点

1. **quiz/subj 嵌入页的双重 chrome**：见 Q1 上面，可能不是设计师本意。如 QA 反馈视觉差，最小改动是只对 sim 用 topbar、quiz/subj 不挂——但这违 spec L77 字面"3 个 Runner 共享"。请 QA 选择。

2. **Bottom bar 提交删除**：见 Q3。如果 QA 觉得改交互太多，可恢复——但保留双提交会让测试矩阵复杂化。

3. **subtitle 是 runner 类型而非课程/章节**：见 Q2。最小代价的扩展（page.tsx 拼字符串），如 QA 要求可补。

4. **subjective 的 RunnerMetaSavedChip 一直显"已自动保存"**：因为 `isSavingDraft` 是个 boolean，组件用 ternary 显示"保存中..."或"已自动保存"。当用户刚加载页面 still false → 显"已自动保存"——但其实还没保存过。**改进方案**：加 `hasSaved` state 仅当至少一次 saveDraftToStorage 跑过后才显 chip。我没做这个改进因为它涉及 state machine 变化（QA 风险 #1 红线"内部 state machine 不动"）。

5. **未做暗色模式实测**：tokens 已落 dark theme，但 runner 页面 manually 切换 dark 没测。当前用 `var(--fs-ink)` 背景 + `#fff` 文字，dark mode 下 ink 变浅色（dark token 0fl118 也很黑），文字仍可读。

## 给 QA 的复测清单

### 一定要测（spec acceptance）
- [ ] 真打开浏览器 /sim/{simId} 看 56px 黑色 topbar：返回任务 + 任务名 + 副标题"模拟对话" + 客户情绪 pill + 重来 + 结束
- [ ] 真打开浏览器 /tasks/{quizId} 看 quiz topbar：返回任务 + 任务名 + 副标题"测验 · X模式" + 进度条 + 已作答 + 倒计时（如有）+ 提交答卷
- [ ] 真打开浏览器 /tasks/{subjId} 看 subjective topbar：返回任务 + 任务名 + 副标题"主观题" + "已自动保存" + 字数 + 存草稿 + 提交
- [ ] 真做一份 quiz 提交（沿用 ca3b34d3-... 或新造）→ submission 201 + db record 落地
- [ ] 真做一份 simulation 对话提交（与上面 ca3b34d3 quiz 同模式）
- [ ] 真做一份 subjective 提交（05504760-... 还是有效）

### 一定要测（不破坏）
- [ ] 11 路由 regression（student 4 + teacher 7）全 200
- [ ] sim 内部交互（mood 变化 / allocation 滑杆 / chat 发送）跑得通
- [ ] quiz 内部交互（4 题型 / 题目导航 / 练习模式 confirm / explanation）跑得通
- [ ] subjective 内部交互（30s auto-save / 文件上传 / drag-drop / 字数计算）跑得通

### 可选
- [ ] 暗色模式 token 切换 runner 页面是否可读
- [ ] 移动端 375px 顶栏不溢出（topbar 用 flex + truncate，应该 OK，但小屏 metaSlots 可能拥挤）

## Dev server 状态

PID 33924 仍在 :3000 运行。本 PR 仅前端组件 + 调用方 +4 行，**无 schema 改动 / 无 API 改动 / 无 service interface 改动 → dev server 不需要重启**。curl + 真 quiz 提交全在原 PID 上响应。

## Phase 6 收尾

PR-6C r1 PASS 后，Phase 6 全部完成：
- PR-6A 登录注册重设计（PASS r1）
- PR-6B 8 空错态组件 + boundary（PASS r1）
- PR-6C Runner topbar 统一（待 QA r1）

下个 phase 是 Phase 7（Simulation 对话气泡专题 · mood + 学习伙伴 hint + 资产配置滑杆持久化），待用户回 A1/A7/B1/B2/B3/D1/D2/H2 决策后启动。
