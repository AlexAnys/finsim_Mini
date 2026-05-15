# QA Report · Unit A1 · Round 1b (UI Sheet + Graded 警告) — Unit 收官

> qa@instance-workbench · 2026-05-15
> Build: `9c4b957 feat(unit-A1): overview-tab 编辑配置 Sheet + graded 警告（r1b）`
> Plan: `.harness/plans/unitA1_plan_r1b.md`
> Build report: `.harness/reports/build_unitA1_r1b.md`
> **A1 unit 收官 QA** — PASS 即 worktree 3 unit 全部 done

## Acceptance（r1b）

| # | Acceptance | Verdict | 证据 |
|---|---|---|---|
| 1 | overview-tab 加"编辑配置"button + onEditSnapshot prop + Pencil 图标 | **PASS** | `overview-tab.tsx`：① L4 import Pencil；② L28 `onEditSnapshot?: () => void` optional prop；③ L118-129 仅在 callback 存在时渲染按钮（向后兼容）；④ L124 `data-action="edit-snapshot"` 标记便于 E2E；⑤ L126 Pencil icon + "编辑配置" 文案 |
| 2 | `snapshot-edit-sheet.tsx` 自包含 Sheet + 3 form 分支 + AlertDialog 三按钮 | **PASS** | `snapshot-edit-sheet.tsx`：① L84-225 主组件 export；② L137-189 `<Sheet>` 容器含 SheetHeader/Content/Footer + 右侧 640px；③ L147-170 按 taskType render 三 form 分支；④ L191-222 `<AlertDialog>` 三按钮 |
| 3 | 按 taskType 渲染三 form（simulation / quiz / subjective） | **PASS** | sheet：L147-170 三 `taskType === "xxx"` 分支；<br>**SimulationForm** L336-398（scenario/openingLine/dialogueRequirements/strictnessLevel + ScoringCriteriaEditor + allocationCount 只读提示）；<br>**QuizForm** L400-488（mode/timeLimitMinutes/maxQuestions + adaptive 模式才显 startDifficulty/difficultyStep + questionCount 只读提示）；<br>**SubjectiveForm** L490-579（prompt/allowTextAnswer/allowedAttachmentTypes 多选 + strictnessLevel + ScoringCriteriaEditor）；<br>**ScoringCriteriaEditor** L581-644 共享原子 |
| 4 | 已 graded sub 时 AlertDialog 三按钮 + "复制为新任务" disabled + tooltip | **PASS** | sheet L102-108 `if (gradedCount > 0) setWarningOpen(true)` 触发 dialog；<br>L191-222 AlertDialog 三按钮：<br>① L201 `<AlertDialogCancel>` "取消"<br>② L202-209 `<Button disabled title="即将上线，敬请期待" data-action="copy-as-new">` "复制为新任务" — **正确 disabled + tooltip**<br>③ L210-219 `<AlertDialogAction onClick={preventDefault + doSave}>` "我知道，仍然保存"（preventDefault 防 Dialog 自动关闭，让 doSave finally 控制） |
| 5 | PATCH `/snapshot` 调用 + 错误 toast 中文 | **PASS** | sheet L110-133 `doSave`：① L114 `fetch("/api/lms/task-instances/${instanceId}/snapshot", PATCH)`；② L120-123 `!json.success` → `toast.error(json.error?.message \|\| "保存失败")` 透传 r1a service 错误中文消息；③ L127-128 网络错误 → `toast.error("网络错误，请稍后重试")` 中文 |
| 6 | 保存成功后 GET refresh + 关闭 Sheet + toast | **PASS** | sheet L124-126：① `toast.success("实例配置已更新")`；② `onSaved()` 调用 page 的 handleSnapshotSaved；③ `onOpenChange(false)` 关闭 Sheet；<br>page.tsx:261-269 `handleSnapshotSaved`：fetch GET `/api/lms/task-instances/{id}` → `setInstance(json.data)` 用服务端权威源刷新（不是依赖本地 patch 预测）；失败静默不阻塞 UI 关闭 |
| 7 | page.tsx state + handleSnapshotSaved + 透传 Sheet + InstanceDetail.taskSnapshot 字段 | **PASS** | `app/teacher/instances/[id]/page.tsx`：① L35 import SnapshotEditSheet；② L63 InstanceDetail 加 `taskSnapshot?: Record<string, unknown> \| null`；③ L141 `useState(false)` snapshotSheetOpen；④ L261-269 handleSnapshotSaved 用 GET refresh 服务端权威源；⑤ L702 OverviewTab `onEditSnapshot={() => setSnapshotSheetOpen(true)}`；⑥ L930-944 `<SnapshotEditSheet>` 透传 open/onOpenChange/instanceId/taskType/snapshot/gradedCount/onSaved |
| 8 | vitest ≥2 | **PASS** | `tests/instance-snapshot-edit-sheet.test.ts` **19 tests**（远超 ≥2） |

## 自动化测试

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit`（全项目） | **0 new errors**（仅 6 pre-existing study-buddy；不变） |
| `npx vitest run tests/instance-snapshot-edit-sheet.test.ts` | ✅ **19/19 PASS** (6ms) |
| `npx vitest run`（全 suite） | ✅ **1049/1049 PASS, 88/88 files, 0 regression**（A1 r1a baseline 1030 + r1b +19） |

## 重点 grep 证据

```bash
# 1. 3 taskType 分支（render + initial state + patch body 三处都有）
$ grep -n 'taskType === "simulation"\|taskType === "quiz"\|taskType === "subjective"' components/instance-detail/snapshot-edit-sheet.tsx
147,155,163: render 分支
264,275: buildInitialState 三态
297,310: buildPatchBody 三态

# 2. AlertDialog 三按钮 + "复制为新任务" disabled
$ grep -n "AlertDialogCancel\|AlertDialogAction\|disabled\|复制为新任务" components/instance-detail/snapshot-edit-sheet.tsx
201: <AlertDialogCancel disabled={saving}>取消
204: <Button ... disabled title="即将上线，敬请期待" data-action="copy-as-new"> 复制为新任务
210: <AlertDialogAction ... disabled={saving}> 我知道，仍然保存

# 3. PATCH URL 正确
$ grep -n "PATCH\|/snapshot" components/instance-detail/snapshot-edit-sheet.tsx
114: fetch(`/api/lms/task-instances/${instanceId}/snapshot`, { method: "PATCH" })

# 4. GET 刷新 在 page.tsx
$ grep -n "handleSnapshotSaved\|fetch.*task-instances/\$\{instanceId\}\b" app/teacher/instances/[id]/page.tsx
261-269: handleSnapshotSaved fetch GET /api/lms/task-instances/{instanceId} → setInstance
```

## 改动范围

`git show 9c4b957 --stat`：
```
.harness/plans/unitA1_plan_r1b.md                     |  +60 (new)
.harness/reports/build_unitA1_r1b.md                  | +107 (new)
.harness/progress.tsv                                 |   +2
app/teacher/instances/[id]/page.tsx                   |  +34 / 0
components/instance-detail/overview-tab.tsx           |  +15 / -1
components/instance-detail/snapshot-edit-sheet.tsx    | +460 (new)
tests/instance-snapshot-edit-sheet.test.ts            | +180 (new)
```
- 产线代码净增 +508 / -1 = +507 行（sheet 460 + page 34 + overview 14）
- 测试 +180
- 单 commit；超 plan 200 行约束，但合理（Sheet + 3 form + AlertDialog 天然耦合）

## Finsim-specific 检查

| 维度 | 结果 |
|---|---|
| UI 中文文案 | ✅ 全中文：编辑配置 / 编辑实例配置 / 修改本实例的 taskSnapshot... / 场景描述 / 开场白 / 对话要求 / 评分严格度 / 评分标准 / 题目提示 / 允许文本作答 / 允许的附件类型 / 取消 / 保存 / 本实例已有批改记录 / 已批改 N 份将不受影响... / 复制为新任务 / 我知道，仍然保存 / 实例配置已更新 / 保存失败 / 网络错误，请稍后重试 |
| Route Handler 无业务逻辑 | ✅ Sheet 在 client 端调 fetch，无新 route |
| Auth | ✅ 后端 r1a 已 requireRole teacher/admin（route handler 把关） |
| Zod | ✅ 后端 r1a 已 safeParse；前端 buildPatchBody 构造 discriminated union body |
| 响应格式 | ✅ 用 `json.success` / `json.error?.message` 标准模式 |
| Prisma | ✅ 0 改动 |

## 实现稳健性

### 🟢 良好设计

1. **不复用 task-wizard**：builder 报告说 spike 显示 `SimulationConfigStep` 需 12+ onX callbacks，独立 Sheet 360 行更可控 — 是正确决策
2. **服务端权威源 GET refresh**：`handleSnapshotSaved` 不用本地预测 state，而是 fetch GET 拿真值（deep-merge 后服务端的 mergedSnapshot 是权威）
3. **`preventDefault` 在 AlertDialogAction**：L211-214 用 `event.preventDefault()` 防 dialog 自动关闭，让 `doSave` finally L130-131 控制 dialog 状态 — UX 细节到位
4. **`useEffect(() => { if (open) setState(initial) })`**：Sheet 重新打开时重置 form state，避免上次未保存的草稿污染
5. **`buildInitialState` 容错**：`asRecord` / `asArray` / `asString` / `asNumber` 4 个 helper 处理 snapshot 可能 null/缺字段/类型异常的边缘情况
6. **`allocationCount` / `questionCount` 只读提示**：quiz questions + simulation allocationSections 这些数组型字段在 Sheet 中只读，提示"需用复制为新任务"——明智地避免误删
7. **`copy-as-new` disabled + tooltip**：为未来 unit 留入口，UI 一致性
8. **`data-action` / `data-form` / `data-section`**：3 处 data 属性标记便于 E2E selector
9. **`SubjectiveForm.toggleAttachment`**：多选 attachment 用 button group + active variant 切换，UX 良好

### 🟡 不阻塞观察

1. **vitest 仍是源 grep 测试** — 项目无 React testing-library。覆盖 19 个语义点（文件存在 / 3 表单分支 / 字段 / AlertDialog / disabled tooltip / PATCH URL / toast / overview-tab 集成 / page 集成）。**未覆盖** runtime 行为：Sheet 真打开/关闭 / form 输入真触发 onChange / 保存真发请求等 — **Final QA staging 必验**
2. **`SubjectiveForm` allowedAttachmentTypes 4 类型硬编码**：`image/pdf/docx/xlsx` 是组件内常量；如果后续 r1a service Zod schema 加新类型需同步前端常量（spec drift 风险，r1b 范畴外）
3. **error 路径未细分 400/403/404**：fetch 失败统一走 `json.error?.message` 透传 r1a 已映射的中文（包含 TASK_TYPE_MISMATCH / FORBIDDEN / INSTANCE_NOT_FOUND）— 实际可用，但前端没特殊处理（如 401 跳登录）。Plan 接受此粒度
4. **`SimulationForm.allocationCount > 0` 提示固定文案**：暂不支持编辑 — 未来扩展时需同步删除提示文案
5. **`copy-as-new` button 在 AlertDialogFooter 内但不是 AlertDialog primitive**：是 `<Button disabled>` 普通按钮，点击不会关 dialog（正常因为 disabled）；plan 已说明这是占位

### 🟢 Anti-regression

- r1a service / API / validator / 错误映射 0 改动 — grep 验证（snapshot/route.ts + service `updateTaskInstanceSnapshot` + validator schema + api-utils 错误码全保持）
- A2 EditableTitle / `instance-header.tsx` 0 改动
- C1-B AI 助手代码 0 改动
- 0 schema 改动 → dev server 不需重启
- 学生 runner / `(student)/tasks/[id]/page.tsx` 0 改动
- `(simulation)/sim/[id]/page.tsx` 0 改动

## Overall: **PASS** — **A1 整 unit 完整收官**

8/8 acceptance 全 PASS，tsc 0 new error，vitest 1049/1049 全过 + 0 regression。

## Unit A1 整体总结

| Round | Commit | Acceptance | Tests | Verdict |
|---|---|---|---|---|
| r1a | `917ec88` | 6/6 | 17 | PASS |
| r1b | `9c4b957` | 8/8 | 19 | PASS |

**A1 总改动**：~530 (r1a) + ~750 (r1b) ≈ 1280 行 / 2 commit / 36 vitest 全新测试 / tsc 0 新 error / 0 schema 改动。

---

## 🎉 Worktree `instance-workbench` 3 Unit 整体收官

| Unit | Commits | Final verdict |
|---|---|---|
| **A2** 实例标题 inline 编辑 + 全局同步 | `97ed850` | PASS |
| **C1-B** AI 助手 localStorage + 4 工具差异化 UI | `918a5d7` (r1a) + `bb0667e` (r1b) + `81a2bca` (r1c) | PASS |
| **A1** 实例配置 inline 编辑（写 taskSnapshot） | `917ec88` (r1a) + `9c4b957` (r1b) | PASS |

**总成绩**：
- **6 个 commit**（A2 + C1-B × 3 + A1 × 2）
- **vitest 988 → 1049**（**+61 net 新增**，0 regression）
- **tsc 0 new errors**（仅 6 pre-existing study-buddy baseline 不变）
- **0 schema 改动 / 0 service interface 破坏 / 0 后端 route 删改**
- **3 unit 全 r1 即收**，无 r2 兜底
- **Dynamic exit 持续保持** — 7 个 PASS 串：A2 + r1a + r1b + r1c + A1 r1a + r1b

## 建议 coordinator

1. **Task #4 标 completed**（A1 已 done — 我会执行）
2. progress.tsv 追加 `A1-iw r1b PASS` 行
3. 准备整 worktree PR：
   - 6 个 commit 直接 squash-merge 还是 stack？根据原 plan D6 "5 unit 合 1 个 PR" 决策保留（实际 6 commit 同分支，PR 标题 `claude-instance-workbench-fixes: A2 + C1-B + A1`）
   - rebase `origin/main` 处理可能的 sidebar 冲突（B1/B2 推迟，不在本 PR）
4. **Final QA staging 阶段必验清单**（A1 + A2 + C1-B 累积）：
   - **A2**: pen icon 点击 → 改名 → 5 处展示位（dashboard / `/teacher/tasks` / `/teacher/instances` / `/grades` / breadcrumb）刷新同步
   - **C1-B**: 4 工具切换 + read/edit toggle + examCheck details 折叠 + 老 cache 兼容（注入 localStorage 老格式）+ 跨 tab storage event
   - **A1**: 教师 overview 点 "编辑配置" → Sheet 弹 → 3 taskType 各自表单 → 已批改 instance dialog 警告 → 保存 → instance.taskSnapshot 更新 + **等 Unit 17 在 main 后，学生 runner 看到新配置**
   - 跨 unit 集成：A1 + A2 + C1-B 同一会话操作不冲突；3 unit 不破坏 PR #12 (Phase 4 主 session) 已修内容
5. **PR merge 前确认**：main 已含 Unit 17 (PR #12)，则 A1 E2E 闭环可在 staging 完整验

我现在 idle 等下一指令（PR 准备 / B1 / B2 任一）。
