# Review — PR #13 standalone (r1)

## Reviewer charter

独立审查 PR #13 `claude-instance-workbench-fixes`（A2 inline title / C1-B AI 助手 localStorage + 4 工具差异化 / A1 instance snapshot 编辑），56 files / +5234 / -157。重点：**Zod discriminated union 设计、`use-persisted-job` 抽象成色、4 工具 UI copy-paste、IME 处理、`/snapshot` endpoint 三层契合、rebase 风险**。不写实现代码。

## Method

- 读 `gh pr view 13` PR body 与 8 commits 列表（`git log --oneline 98017c8..origin/claude-instance-workbench-fixes`）
- 读源（PR head 视角）：`snapshot-edit-sheet.tsx`（644 行）、`task-instance.service.ts` `updateTaskInstanceSnapshot`、`app/api/lms/task-instances/[id]/snapshot/route.ts`、`task.schema.ts`（discriminated union 段）、`use-persisted-job.ts`、4 个 `*-result.tsx` + `result-atoms.tsx`、`ai-assistant/page.tsx`（644 行）、`instance-header.tsx` `EditableTitle`、`overview-tab.tsx`、`app/teacher/instances/[id]/page.tsx`
- 读测试：5 新 vitest（`instance-snapshot-update.test.ts` / `instance-snapshot-edit-sheet.test.ts` / `instance-header-editable-title.test.ts` / `use-persisted-job.test.ts` / `ai-assistant-result-views.test.ts`）+ 1 E2E `tests/e2e/iw-acceptance.spec.ts`
- Rebase check：`git merge-base main origin/claude-instance-workbench-fixes` → `f2365b7`（= main HEAD）。`git diff main...origin/claude-instance-workbench-fixes --name-only` → 仅 PR #13 自己的 56 files，**没有 PR #12 残留**。**PR body 中 "base 在 98017c8" 的说法已过时**（PR 已在 worktree 中悄悄 rebase 过，merge-base 现在就是 main）
- 交叉读 `lib/utils/task-snapshot.ts`、`app/(student)/tasks/[id]/page.tsx` Unit 17 snapshot 消费侧

## Top findings（按 severity 排序）

### F-1: PATCH `/snapshot` 与 PATCH `/[id]` 两条编辑路径割裂 — Severity: P1

- **Files**: `app/api/lms/task-instances/[id]/route.ts` (PATCH, existing) ; `app/api/lms/task-instances/[id]/snapshot/route.ts` (PATCH, new) ; `lib/services/task-instance.service.ts:updateTaskInstance` vs `updateTaskInstanceSnapshot`
- **Problem**: **bad-locality** — 一个 instance 上的"教师可编辑面"现在分两条 endpoint：`PATCH /[id]` 改 title/dueAt/groupIds/status/attemptsAllowed（直接列字段），`PATCH /[id]/snapshot` 改 simulationConfig / quizConfig / scoringCriteria 等 JSON 子树。两条都需要 `isAuthorizedForInstance`、都要写 audit、都要触发 UI 刷新，但完全独立维护。Service 层 `updateTaskInstance` 和 `updateTaskInstanceSnapshot` 共享 ~10 行 auth/lookup boilerplate（独立 `findUnique({where:{id}})`、独立的 isAuthorizedForInstance 调用、独立的 throw FORBIDDEN）。
- **Why-it-bites**: 后续要加"已批改时拦截"或 audit log（spec.md 提到 force/audit），同一规则需要在两个地方独立维护；某个 endpoint 漏了 log = 安全漏洞但 vitest 不会抓。`updateTaskInstance` 已经**没有 audit log**（reopen/close/delete 都写了 audit，update 没有），新 `updateTaskInstanceSnapshot` 也**没有 audit log** — 教师悄悄改 instance 配置对学生影响巨大（已批改 sub 仍在但题面变了）却无审计。
- **Deletion test**: 删除 `/snapshot` 路由，把 patch dispatch 合并进 `PATCH /[id]`：route handler ~50 行省一份，service 共享 auth/lookup。复杂度**消失而非分散**。
- **Suggested direction**: 单 endpoint `PATCH /[id]` 受 union schema（top-level fields + 嵌套 `snapshot` 子对象），service 内分支处理。同时为 snapshot 改动加 audit log（教师改学生看到的配置是高风险动作，必须留痕，与 `task_instance.delete` / `task_instance.reopen` 同级）。
- **Tests would improve**: 单一 endpoint = 单一权限/审计测试面；audit log assertion 加一行即覆盖两类改动。

### F-2: Zod discriminated union 在 service 里"穿透"为 if/else 三分支，schema 类型安全没有 propagate — Severity: P1

- **Files**: `lib/validators/task.schema.ts:147-178` (3 schemas + discriminatedUnion) ; `lib/services/task-instance.service.ts:380-440` (3 if/else branches) ; `components/instance-detail/snapshot-edit-sheet.tsx:218-321` (3 form state + 3 buildPatchBody branches)
- **Problem**: **Shallow seam** — discriminatedUnion 看起来是漂亮的 schema 设计，但**没有在下游获得 leverage**。Service 写了 `if patch.taskType === "simulation" ... else if "quiz" ... else if "subjective"`，每个分支重复 `currentX = (currentSnapshot.xConfig ?? {})` + `mergedSnapshot.xConfig = { ...currentX, ...patch.xConfig }` 的 boilerplate，scoringCriteria 三次写。Sheet 内也是 3 个 Form 函数 + 3 个 `buildPatchBody` 分支 + 3 个 FormState interface — TypeScript 的 narrowing 用上了，但**代码组织没用上**。
- **Why-it-bites**: 加第 4 个 taskType（spec.md 提到的未来）= 必须改 **schema + service 一段 + Sheet 一段 + 4 个 *-result.tsx 一段**（虽然这部分跟 taskType 解耦）。每处都是平行复制，遗漏一处会 silent fail（discriminatedUnion 默认非 strict — 多余字段被 silently 接受，见 `tests/instance-snapshot-update.test.ts:96-103` 测试用例自己写出来了这个特性）。
- **Deletion test**: 把 service 三分支换成一个"按 taskType 取 mergeRules"表驱动 dispatch（rules: { simulation: ["simulationConfig","scoringCriteria","allocationSections"], quiz: [...], subjective: [...] }）：service ~60 行缩到 ~20 行，加 type 只改 rules。**复杂度消失**。
- **Suggested direction**: 服务端：用 "fields per taskType" 表驱动 merge；schema 层把 partial config 嵌套放到一个共同的 `snapshot` 字段而不是 hoist 到 top-level discriminator 上方。表面看 schema 更复杂，但 service / form / future-extension 都简化。
- **Tests would improve**: 当前 `instance-snapshot-update.test.ts` 测了 "discriminatedUnion 严格性" 的特殊语义，本身就是 schema 太靠近调用方的味道。表驱动后测试可以聚焦"rules dispatch 正确"而非每 taskType 各测一遍。

### F-3: `quizConfig.timeLimitMinutes / maxQuestions` 二态合并漏掉 "用户清空字段" 语义 — Severity: P1

- **Files**: `lib/services/task-instance.service.ts:407-413` (quiz branch) ; `components/instance-detail/snapshot-edit-sheet.tsx:230-243` (buildPatchBody quiz) ; `lib/validators/task.schema.ts:158` (quizConfig.partial())
- **Problem**: **Leaky abstraction** — service 用 `{...currentQuiz, ...patch.quizConfig}` 浅合并 quizConfig；Sheet 的 `buildPatchBody` 会把 undefined 值也塞进 patch（`timeLimitMinutes: q.timeLimitMinutes` 当 q.timeLimitMinutes === undefined 时 JSON.stringify 会**丢字段**，符合预期）。但表单 UI 上 `value={state.timeLimitMinutes ?? ""}` + `onChange => undefined`：教师把"限时 30 分钟"输入框**清空** → state.timeLimitMinutes = undefined → JSON body 不含字段 → service spread 合并 → currentQuiz.timeLimitMinutes **仍然是 30**。**清空操作无效**，UI 显示空但落库还是旧值。
- **Why-it-bites**: 教师反馈"我已经把限时清掉了为什么学生还有限时"——demo bug, 极易回归。同样的问题在 maxQuestions / startDifficulty / difficultyStep 4 处都有。simulation 的 `dialogueRequirements` 也是同款（textarea 清空时 `s.dialogueRequirements || undefined` 把空串转 undefined → 不发字段 → 不更新）。
- **Deletion test**: 不能 delete — 业务上需要"清空"语义。但需要把语义明确为：`null` = clear（service 显式 delete from snapshot），`undefined` = keep（service 不动）。当前是把两种都映射到 undefined → keep。
- **Suggested direction**: schema 允许 `null`（z.union([..., z.null()]).optional()）；service 显式 `if (patch.quizConfig?.timeLimitMinutes === null) delete merged.timeLimitMinutes`。UI 上"清空"显式发 `null`。
- **Tests would improve**: 加一条 service 单测："清空字段后再 GET，字段从 snapshot 消失"——目前 5 测里全是 happy path，没有 clear 语义测试。

### F-4: `use-persisted-job` hook 是真的抽象 — 4 caller 全删抽象会让本来一致的语义分散 — Severity: P2 (anti-finding-leaning)

- **Files**: `lib/hooks/use-persisted-job.ts` (210 行) ; `app/teacher/ai-assistant/page.tsx` (单一 caller)
- **Problem**: **Borderline — 但偏向 "real abstraction"**。表面看"只有 1 个 caller"（page.tsx），像 over-abstraction。但更仔细看：caller 内 4 种 toolKey 每个共享同一套 schemaVersion + TTL + storage-event + SSR-safe + activeTool 偏好。**复杂度真正在的地方是"localStorage + JSON + TTL + version + cross-tab"协议**，hook 把这套协议抽出来。
- **Why-it-bites (反方向)**: 删 hook → page.tsx 多 ~150 行 localStorage / 反序列化 / TTL / storage event 代码 + 4 个 toolKey 各自重复同一逻辑（或者 caller 自己再造一个内部 helper，回到 hook）。删除测试不通过：复杂度**留在原地**。
- **Deletion test 结论**: 复杂度不会消失，hook 抽象成立。
- **Suggested direction**: 不动；可考虑 (a) hook 内 `// eslint-disable-next-line react-hooks/set-state-in-effect` 加更准确的注释（当前注释提到"cascading renders intentional"但 hook 的 `useEffect → setSlice → onToolKey change` 链没有 bound 检查的代码痕迹），(b) `clearPersistedJob` + `reset` 现在 2 个 API 做同一件事，可以合并。
- **Tests would improve**: hook 测试当前是 "静态 grep + 4 个纯函数运行时 mock" — 缺一个对 `usePersistedJob` 主流程的 React rendering 测试（写 / 读 / 跨 toolKey 切换 / TTL 过期 drop），让 hook 行为有 deletion-safe 的契约。

### F-5: 4 个 `*-result.tsx` 组件高度重复，`result-atoms.tsx` 抽象不足 — Severity: P1

- **Files**: `components/ai-assistant/lesson-polish-result.tsx` (41 行) / `ideology-mining-result.tsx` (90 行) / `question-analysis-result.tsx` (53 行) / `exam-check-result.tsx` (98 行) / `result-atoms.tsx` (374 行)
- **Problem**: **Shallow abstraction at boundary** — atoms 把 read/edit 双模式都收进了 atom 内部（TitleAndSummary / SectionEditor / ActionItemsAndCautions 都接 `viewMode` 并双分支），caller 看起来很薄（lessonPolish 41 行），但代价是：
  - **`stripTail` helper 在 atoms 内、4 caller 不知情**（把"建议（一行一条）" 截短成"建议"）—— atoms 在做 caller 看不见的字符串改造。
  - **`examplesHighlight` flag** 只有 ideologyMining 用，但 atom 接 prop；exam-check 把 sections 自己包 `<details>` 折叠**而不用 atom 的折叠能力**（atom 没有），是 atom 抽象边界不齐的信号。
  - **每个 caller 的 "我是 read 还是 edit" 分支都重复**：ideology-mining-result 自己又写 `const isRead = viewMode === "read"`、自己写一个"育人目标"块的 read/edit 双模式（不复用 atom 的 ActionItemsAndCautions，因为 label 不同），与 atom 内部 read/edit 分支**双重维护**。exam-check 同款。
- **Why-it-bites**: 加第 5 个 tool（例如"知识点抽取"）= 第 5 份 result.tsx，每次都要看 4 个现有看哪个最像、复制、改 label。Read mode 字段标签变化（"诊断" → "判断"）— 4 处独立改。同时 atom 接的 prop 已经 6+ 个 (`labels`, `examplesHighlight`, `actionLabel`, `showActionItems`, `summaryRows`, `summaryLabel`) — atom 在退化为"上帝组件"。
- **Deletion test**: 删 4 个 *-result.tsx，把 differentiation 收进单一 component + config object（key: toolKey, value: { sectionLabels, examplesHighlight, hideGradingTable, customCallout? }）：单文件 ~150 行，新增 tool 加一行 config。复杂度**消失**。
- **Suggested direction**: 单一 `ToolResult` 组件 + per-tool config table；examCheck 的 `<details>` 折叠和 ideologyMining 的"育人目标 callout"用 config 字段（renderTopOverride / preSection / extraCalloutLabel）控制。
- **Tests would improve**: 当前 `ai-assistant-result-views.test.ts` 全是 "文件存在 + grep 关键字" 的静态测试。改 config table 后，测 "config[toolKey].sections.labels.diagnosis === '知识点定位'" 一行 = 整个差异化覆盖。

### F-6: A2 inline edit IME composition 处理正确但 onBlur 没拦 — Severity: P2

- **Files**: `components/instance-detail/instance-header.tsx:165-178` (EditableTitle keydown handling)
- **Problem**: **Adapter 漏了一面** — composition 处理本身**正确**（`composingRef.current` 在 compositionStart/End 间为 true，Enter 在 composing 期被忽略 = 不会提前提交未完成的拼音），这是 PR 做对的地方。但**没有处理 onBlur 提交**（实际生产中很多用户点击"保存"按钮**之外的位置**期望保存）—— 当前只有 click 保存按钮 / Enter 提交 / Escape 取消。
  - 此外，**焦点抢夺**：`useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing])` 没有 cleanup；如果父组件在 input 已经 focus 后 re-mount，会再次抢焦点（虽然 isEditing 只在用户手动开/关时变，但 React Strict Mode 双调用会触发）。
- **Why-it-bites**: 用户改标题不点 Enter 直接点别处 → 标题不保存且没有"未保存"提示 → 数据丢失。中文输入法本身的 composition 边界 OK；问题是"用户行为模型"未对齐。
- **Deletion test**: 删 EditableTitle 子组件 → 把 inline edit 内联回 InstanceHeader：编辑态状态机 7 个 hooks 散到父组件里，比单独 ~85 行清晰度差。子组件抽得合理。
- **Suggested direction**: 加 onBlur handler 决策"自动保存 vs 警告未保存"；现状最低成本是 onBlur === cancel（与 Escape 等价）以避免悄悄丢数据。
- **Tests would improve**: vitest 当前只测 Zod schema 边界（200 字符 / 中文多字节 / 空字符串），**完全没测 React 行为**。React Testing Library 加一个 "compositionend 后 Enter 触发 save / composition 中 Enter 不触发 / blur 行为" — 三条断言 = IME bug 永远不回归。

### F-7: AlertDialog "复制为新任务"按钮 disabled 但占位 — UX 假承诺 — Severity: P2

- **Files**: `components/instance-detail/snapshot-edit-sheet.tsx:142-149` (AlertDialog 三按钮)
- **Problem**: **Shallow UI** — 按钮文本"复制为新任务"+ `disabled` + `title="即将上线，敬请期待"`。教师在被 graded 拦截时看到三个按钮但中间的不能点。这是把**未实现功能**作为视觉信号塞进对话框 — UI 在向用户承诺一个不存在的功能。
- **Why-it-bites**: (a) 用户预期"上线"是周内/下个 sprint，实际可能永远不来；(b) 已经 PR-merge 的 UI 内容会被 demo 视频录到，后续删除按钮 = 砍 demo 承诺。同时 service 层 `updateTaskInstanceSnapshot` **不写 audit log**（见 F-1），"我知道，仍然保存" + graded > 0 这个高危场景**没有审计**。
- **Deletion test**: 删按钮，AlertDialog 改两按钮（取消 / 我知道，仍然保存）：清爽，audit log 加一行 `force_with_graded: true`。
- **Suggested direction**: 移除"复制为新任务"按钮直到实际功能交付；同步给 snapshot update 写 audit log 记录 `gradedCount + force`。
- **Tests would improve**: audit log assertion = "调用 updateTaskInstanceSnapshot 且 gradedCount>0 时，logAuditForced 被调用 with action 'task_instance.snapshot_update_force'" — 行为契约固定。

### F-8: AI assistant page.tsx 内 11 个顶层 useState + 4 个 useEffect — 状态管理边界混乱 — Severity: P2

- **Files**: `app/teacher/ai-assistant/page.tsx:81-100` (state) + `:103-218` (effects)
- **Problem**: **Bad locality** — page.tsx 维护 11 个 useState（activeTool, viewMode, text, teacherRequest, files, outputStyle, strictness, enableSearch, submitting, job, result, originalResult），其中 8 个**同时也存在于** `usePersistedJob` 内的 slice.state（text/teacherRequest/outputStyle/strictness/enableSearch/job/result/originalResult/viewMode）。两个 source of truth：
  - effect#1 (`activeTool, hydrated`): 把 persisted → 8 个 setState 同步
  - effect#3 (`text, teacherRequest, outputStyle, strictness, enableSearch, job, result, originalResult, viewMode, hydrated`): 把 8 个 in-memory state → persist
  - 中间还有 effect#2 (`hydrated`) 单次 fetch 接管
  - 加上轮询 effect#4
- **Why-it-bites**: 调度顺序复杂，eslint-disable react-hooks/exhaustive-deps 出现 3 次。"切 toolKey 时 effect#1 触发 → setState 触发 effect#3 → 写 cache" — 中间有一帧旧 toolKey 的 cache 被新 state 覆盖的窗口？hook 用 `forToolKey` guard 部分挡了，但 page.tsx 自己没用 guard。
- **Deletion test**: 直接读 hook.state 作 source of truth，不在 page.tsx 维护 in-memory 镜像 → 删 8 个 useState 和 2 个 sync effect ~30 行；UI 用 hook.update(patch) 单步写。复杂度**真消失**。
- **Suggested direction**: hook 暴露 `state + update` 完整契约，page.tsx 直接消费 hook.state（不维护本地镜像）。submitting/files 仍 local（不持久）。
- **Tests would improve**: 测"切 toolKey A → 输入 → 切 B → 输入 → 切回 A" cache 不互相覆盖 — 当前 E2E `iw-acceptance.spec.ts` C1-B 测试**做了这个 manual 路径**，但要靠 React 端集成测试断言无 race window 才稳。

### F-9: snapshot deep-merge 浅一层 — scoringCriteria 总是全量替换，简单但**绕过 partial merge** — Severity: P2

- **Files**: `lib/services/task-instance.service.ts:391-431`
- **Problem**: **Inconsistent locality** — simulationConfig/quizConfig/subjectiveConfig 浅合并（spread 旧 + 新顶层），但 scoringCriteria / quizQuestions / allocationSections 是**全量替换**（`mergedSnapshot.scoringCriteria = patch.scoringCriteria`）。后端 schema 在 form 上要求 caller 发完整数组——这是合理选择（数组合并语义复杂）——但 service 没有显式注释为什么数组 != 对象，前端 buildPatchBody 也没标记"必须发完整数组"。
- **Why-it-bites**: future caller（API user / 第三方 builder）发 `{scoringCriteria: [{name:"补一条", maxPoints:10, order:5}]}` 期望 append，得到的是 silent 全替换。
- **Deletion test**: 不能 delete；行为是有意的。
- **Suggested direction**: schema 层加 `.describe()` 注释 "数组字段为全量替换"；service 层注释明确。或者把数组改名 `scoringCriteriaReplace` 信号更显式。
- **Tests would improve**: 加一条 "patch 含 scoringCriteria → snapshot.scoringCriteria 是 patch 提供的数组而非合并" — 当前测试覆盖了 success path 但语义没断言。

### F-10: A2 PATCH 不写 audit log（与 F-1 同源） — Severity: P2

- **Files**: `lib/services/task-instance.service.ts:updateTaskInstance` (existing) ; A2 复用 existing PATCH `/[id]` 改 title
- **Problem**: **Pre-existing gap, A2 暴露** — 改 title 走 `updateTaskInstance` 老 service，没有 audit log。原本 task instance update（dueAt / groupIds 等）就没 audit；A2 把 title 编辑从"不存在"变成"一键改"——使用频率/敏感度都上升，无审计的代价变大。
- **Why-it-bites**: 协作教师 A 改了 instance title，老师 B 看到不知道谁改了（演示数据被改也无痕）。`task_instance.delete/reopen/close` 都写 audit log，update 不写 = 状态机不对称。
- **Deletion test**: 不能 delete；行为问题。
- **Suggested direction**: 给 `updateTaskInstance` 也加 `logAuditForced({action:"task_instance.update", metadata:{changedFields}})`，与 close/reopen/delete 对齐。
- **Tests would improve**: 与 F-1 audit 测试统一。

## Anti-findings（看起来像但不是问题）

- **A-1: PR base claim 在 PR body 里写错 `98017c8`** — 实际 `git merge-base = f2365b7 = main`，PR head 直接 sit on PR #12。看起来是 rebase 重大风险，**实际上零冲突**。PR body 没更新而已（builder 在 worktree 完成 rebase 后没改 PR description）。
- **A-2: `result-atoms.tsx` 374 行看起来肥** — 真要算的话 read mode + edit mode + 子组件分得清楚，**双模式合并到 atom 内是合理的**（不分裂出 ReadAtoms / EditAtoms 两文件，避免 4 个 caller 都得选 import 路径）。问题在 F-5 是"caller 仍然 boilerplate"，不是 atoms 本身。
- **A-3: `usePersistedJob` 内的 `// eslint-disable-next-line react-hooks/set-state-in-effect`** — 看起来 anti-pattern，实际是合理的 SSR-hydration（Server 给 default，Client 读 localStorage）。注释也明确写了 intent。
- **A-4: IME composition 处理** — composition handling **本身正确**，commit 写得很谨慎（`composingRef.current` ref 而非 state 避免 re-render）。F-6 是 onBlur 缺失，不是 IME bug。
- **A-5: 5 个新 vitest 都是 "静态 grep 测试"** — 看起来很弱，实际**符合本项目惯例**（HANDOFF 提到 vitest 是 node 环境无 React render，项目内多个测试都是 grep mode）。但 E2E `iw-acceptance.spec.ts` 3 个 case 在真浏览器里 cover 了用户路径，**测试覆盖整体没问题**。

## Cross-cutting hunches（建议其他 reviewer 关注）

- **(For review-arch)**: PR #13 暴露的"两条 PATCH endpoint 同改一个 resource"模式（F-1）在 finsim 其他地方有同款吗？grep `app/api/lms/**/route.ts` 内 PATCH/POST 是否还有"子路径 endpoint 改父 resource JSON 子树"的 case，是不是一个 codebase-wide 反复出现的 architectural smell。
- **(For review-security)**: F-1 / F-10 提的"snapshot/title 改动无 audit log"，请反查所有 `lib/services/*.service.ts` 中 update / patch / merge 类方法的 audit log 覆盖率（grep `logAuditForced`）。这是一个 cross-cutting authorization gap。
- **(For review-test)**: 本 PR 5 vitest 全是静态 grep，1 个 E2E 真覆盖。请评 finsim 整体"grep test vs runtime test"的比例 — 如果大量 testfile 都是 grep，覆盖率 number 是虚高。
- **(For review-ai)**: `app/teacher/ai-assistant/page.tsx` 跟 `runTool` → `enqueueAsyncJob` → `quiz_question_tag` 的 async job pipeline 有重叠（service 里 `enqueueAsyncJob({type:"quiz_question_tag"})` 在 task-instance.service createPublishedTaskWithInstance 内有出现）。AI 助手 4 工具的 async job 状态机和这套是否复用同源 polling？

## Rebase risk inventory（特别一节）

**TL;DR — 风险等级：low（实际零冲突）。PR body 的 rebase 警示已 stale。**

### 实际 merge-base 状态

| 检查 | 结果 |
|---|---|
| `git merge-base main origin/claude-instance-workbench-fixes` | `f2365b7` |
| `git rev-parse main` | `f2365b7` |
| `git rev-parse f2365b7` | `f2365b7` |
| **合并 branch base = main HEAD** | ✅ 一致 |

也就是说 **PR body 里 "本 PR 基于 origin/main 98017c8" 的说法是过时信息**。实际开发过程中 worktree 已经悄悄 rebase 过（commit `439cc74` 等 8 commit 的 parent chain 现在直接接在 `f2365b7` 上）。

### `git diff main...origin/claude-instance-workbench-fixes` 的文件列表

只列 PR #13 自己的 56 个文件（plans / reports / screenshots / 6 个代码文件 / 5 vitest / 1 E2E + playwright.iw.config.ts）。**没有 PR #12 的任何文件残留**。

### 假设要重新审 PR #12 重叠影响（防御性）

PR #12 触摸了 `instance-header.tsx`（status badge / 状态机入口扩充 reopen 等），如果 PR #13 base 还是 `98017c8`，那 instance-header 会冲突。但因为 PR #13 已经在 `f2365b7` 之上叠加，merge 直接来——`instance-header.tsx` 的 PR #13 diff 只在 PR #12 之上**追加** `EditableTitle` 子组件 + `onTitleSave` prop（见 `git diff main...origin/claude-instance-workbench-fixes -- components/instance-detail/instance-header.tsx`），无重叠行。

### 其他潜在的"软冲突"

| 关注点 | 说明 |
|---|---|
| `lib/api-utils.ts` | PR #13 加 case `TASK_TYPE_MISMATCH`；PR #12 已加多个 case。merge 时新 case 紧跟 `TASK_INSTANCE_SCOPE_MISMATCH` 之后，git auto-merge 应无歧义。**zero conflict**。 |
| `lib/services/task-instance.service.ts` | PR #13 只在文件末尾 append `updateTaskInstanceSnapshot` 函数。PR #12 已经包含 reopen/close。append at tail = **zero conflict**。 |
| `lib/validators/task.schema.ts` | PR #13 在 `updateTaskInstanceSchema` 后插入 3 个 discriminated schemas，**zero conflict**。 |
| `app/teacher/instances/[id]/page.tsx` | PR #13 加 `SnapshotEditSheet` import + `snapshotSheetOpen` state + 2 callback + 1 render。PR #12 也改过此文件（Unit 17 taskSnapshot 字段加入 InstanceDetail interface），从 diff 看 PR #13 的 `taskSnapshot?: Record<string, unknown> \| null` interface 字段是**新增的**（PR #12 unit 17 加的是 student 侧），合理叠加。**zero conflict**。 |

### Soft-conflict 监控点（不是冲突，但语义上要 reviewer 主动检查）

1. **`taskSnapshot` 字段类型 unification**: PR #12 内 `app/(student)/tasks/[id]/page.tsx:58` 和 `app/(simulation)/sim/[id]/page.tsx:34` 都把 `taskSnapshot: unknown`。PR #13 在 teacher 侧 page 写 `taskSnapshot?: Record<string, unknown> | null`。**两边类型不一致**——同一个 DB 字段在 teacher / student 侧用了不同的 TS 类型。一致化是 nice-to-have（low priority），但是一个**已经出现两次但被忽略**的类型形状漂移。
2. **`isAuthorizedForInstance` 函数（task-instance.service.ts:55-62）** PR #12 用过、PR #13 也用——同一个函数现在被 5 个 service 方法（publishTaskInstance / updateTaskInstance / deleteTaskInstance / reopen/close / 新的 updateTaskInstanceSnapshot）依赖，但**没有单测覆盖** auth 通过/不通过两条路径。重叠使用增加了 regression 面，但不是 PR #13 的责任。

## 一句话总评（给 team-lead）

PR #13 的 **rebase 风险 = low**（merge-base 已是 main HEAD，PR body 的 98017c8 base 描述已过时），最严重 finding 是 **F-1: PATCH `/[id]` 与 PATCH `/[id]/snapshot` 两条 endpoint 割裂且都不写 audit log**——同一资源的不同字段被人为分割维护、共享 auth/lookup boilerplate，且 snapshot 改动对学生影响巨大却完全无审计留痕（与 reopen/close/delete 的状态机审计不对称）。
