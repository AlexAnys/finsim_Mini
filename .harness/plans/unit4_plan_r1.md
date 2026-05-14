# Unit 4 Plan — 任务总览页全 config 可见可改 + 高危改动拦截

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 4
> Bugs: B-TASK-04 (P0) + B-TASK-05 (P0) + B-DEMO-02 (P1)

## 关键发现（grep + 代码勘探）

### 1. taskSnapshot 字段 — 存在但**学生 runner 不读**

- `prisma/schema.prisma` L520：`TaskInstance.taskSnapshot Json?` 字段存在 ✓
- `task-instance.service.ts` L94/L113/L142/L148：实例 publish/create 时**写**快照 ✓
- 但 `app/(student)/tasks/[id]/page.tsx` L127-167 和 `app/(simulation)/sim/[id]/page.tsx` 学生 runner **直接读 instance.task.\* 而非 taskSnapshot** ✗

**结论**：task PATCH 仍会立即影响在跑 instance。schema 字段在但未消费。

### 2. updateTask service 已支持全 config 改

`lib/services/task.service.ts:203-299` `updateTask` 已经能写：
- taskName / requirements / visibility / practiceEnabled / courseName / chapterName
- simulationConfig / quizConfig / subjectiveConfig (upsert)
- scoringCriteria (deleteMany + createMany 全量替换)
- allocationSections + items (deleteMany + 逐 section create)
- quizQuestions (deleteMany + createMany 全量替换)

PATCH route + zod schema 也全 wire 好了。

**仅缺**：UI editing 控件。

### 3. Task 表无 chapter/section/knowledge tag

- `Task` 表只有 `courseName/chapterName` 自由文本字段，无 chapter/section ID 关联
- knowledge tags 在 `TaskInstance` / `CourseKnowledgeSource` 关联表，是**实例级**配置
- B-DEMO-02 spec 提到的"任务知识点/章节展示"实际是 instance 关联 → 在 task page **只读展示 instance 的 chapter/section 汇总**，不在 task 模板上编辑

### 4. 任务编辑设计选择（coordinator 提的 4 个问题）

**Q1 — 复用 wizard 组件 vs 在 page 内重写？**

✅ 复用 `WizardStepQuiz` / `WizardStepSim` / `WizardStepSubjective`。它们接受 props + callbacks，可直接挂载在 page 内的 edit 分支。Avoid drift，单一编辑代码路径。

**Q2 — quiz 题目编辑最小粒度？**

复用 `WizardStepQuiz` 提供的能力：单题增/删/编辑/复制（粘贴新一行 + 改字段）。本 unit **不引入拖动排序**（spec 没要；wizard 也无）；用 order 字段 + ↑↓ 按钮已够，但 wizard 现有 UI 也只是按 order 渲染。如果 wizard 没"↑↓"按钮，本 unit 保持现状 — order 字段在保存时由数组下标重新赋值。

**Q3 — "复制为新任务"对话框选项 — 新 service 还是复用 task.create？**

复用现有 `createTask` service：
- 前端 dialog 三选项："直接保存 / 复制为新任务 / 取消"
- "复制为新任务" → 前端构造 createTask payload（task 字段全拷 + 改名为 "{原名} (副本)"）→ POST /api/tasks → 跳新任务详情页
- 不新增 service method（降低改动面）

**Q4 — taskSnapshot 字段已存在但学生不读**

这是历史遗留缺陷。本 unit **不动 schema**（Phase 1 硬约束）。两种应对：
- 选项 A（保守）：现状 = 改任务模板立即影响 running instance。在高危拦截 dialog 中明示该后果："已有 N 条 graded 提交，改动可能影响分数解读，建议复制为新任务"。
- 选项 B（修根）：让学生 runner 读 `instance.taskSnapshot` 优先 fallback 到 `instance.task`。需要改 2 个 runner page 的 data plumbing + 加 type guard。本 unit 范围内可做，但耦合面大。

**推荐选项 A** 本 unit 内做；选项 B 是单独的工作（建议放进 Phase 4 polish 或 Unit 9 改 evaluate 时一起）。理由：本 unit 的核心需求是"让老师能改全部 config"，runner snapshot 读取是另一个独立改进，scope creep。**在 high-risk dialog 措辞中明确告知用户**。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `app/teacher/tasks/[id]/page.tsx` | 大改 | 复用 wizard step 组件，editing 模式扩到全 config |
| `lib/services/task.service.ts` | 微改 | `updateTask` 加 `submissionCount` 查询 + return；audit log `task.update` with before/after diff |
| `lib/validators/task.schema.ts` | 微改 | 加可选 `force?: boolean` 在 updateTaskSchema 里（force=true 跳过 has-graded-submissions 拒绝逻辑）|
| `app/api/tasks/[id]/route.ts` | 微改 | PATCH 前查 graded submissions count；如有且 force!=true → 抛 `TASK_HAS_GRADED_SUBMISSIONS`；force=true 走老路径 |
| `lib/api-utils.ts` | +1 case | `TASK_HAS_GRADED_SUBMISSIONS` 中文映射（400 + 信息含 count）|
| `lib/services/audit.service.ts` | 无改 | 复用 `logAuditForced` |
| `tests/e2e/unit4-verify.spec.ts` | 新 | 6-8 case |

## 关键改动思路

### 编辑模式 UI 重构

`/teacher/tasks/[id]/page.tsx` editing 分支：
- **共享字段**：taskName / requirements 输入框（保持现状）
- **simulation 任务**：当 editing=true 时挂 `<WizardStepSim>`（传入 props.scenario/openingLine/persona/dialogueStyle/constraints/strictnessLevel/...）
- **quiz 任务**：挂 `<WizardStepQuiz>`（quizMode/timeLimitMinutes/showResult/questions 全可改）
- **subjective**：挂 `<WizardStepSubjective>`
- **scoringCriteria**：简易 inline 编辑（行级增/删/maxPoints/name/description）
- **allocationSections**：仅 simulation 显示，行级增/删

读模式 UI 保持现状（只展示）。

### 高危改动拦截

`updateTask` service 加 `getGradedSubmissionCount(taskId)` 内部辅助 + return:
- Route handler PATCH 时：query graded count via `prisma.submission.count({ where: { taskId, status: "graded" } })`
- 若 count > 0 且 body 不含 `force: true` → 直接 throw `TASK_HAS_GRADED_SUBMISSIONS`（HTTP 400 携带 count）
- 前端拦到该错 → 弹 AlertDialog "该任务已有 N 条已批改提交，改动可能影响分数解读" + 3 按钮：「取消」「复制为新任务」「直接保存」
- 直接保存 → 重 fetch 同 body + `force: true`
- 复制为新任务 → POST /api/tasks 复制结构（type/configs/questions/criteria/allocations + 名字 "{原名} (副本)"）→ router.push 新任务 → 不修改原 task

### Audit log

`updateTask` 内最末加 `logAuditForced`:
```typescript
await logAuditForced({
  action: "task.update",
  actorId: creatorId,
  targetId: taskId,
  targetType: "Task",
  metadata: {
    fieldsChanged: Object.keys(input),
    hadGradedSubmissions: gradedCount > 0,
    force: !!input.force, // 是否绕过高危拦截
    // before/after diff 略简略：只记 fieldsChanged + 关键字段 diff（taskName/quizQuestions.length/scoringCriteria.length）
    before: { taskName: existing.taskName, questionCount: ... },
    after:  { taskName: input.taskName ?? existing.taskName, ... },
  },
});
```

不写完整 before/after JSON（防止 audit 表膨胀）。

## 风险点

1. **🟡 taskSnapshot 未消费的根因风险**：本 unit 不修，但通过 high-risk dialog 措辞通知用户后果。建议 Phase 4 单独处理 runner 读 snapshot。
2. **🔴 page.tsx 大改影响范围**：现有 841 行 page 重构编辑分支。Mitigation：复用 wizard 组件可减少新代码量；保留 read 模式不动；e2e 覆盖 happy path + 高危拦截路径。
3. **🟡 force=true 路径绕过拦截**：前端必须正确传 force=true，否则用户连续点"直接保存"会重复进 dialog。Mitigation：前端拦到 `TASK_HAS_GRADED_SUBMISSIONS` 后第二次 PATCH 自动加 force=true。
4. **🟢 复制为新任务的 visibility/courseName 等元数据**：直接复制原任务全部字段（除 id/createdAt/updatedAt），新任务 `creatorId = current user`。
5. **🔴 wizard 组件 props 接口 drift**：wizard 当前为"创建流程"设计，部分字段可能没 init prop。我会先 trial-and-error 接通，遇问题再调整。如果 mismatch 严重，回退到 page 内部写最小化编辑控件（简化版）。
6. **🟡 audit 写入失败不阻塞主流程**：复用 `logAuditForced` (Unit 2 已用)，错误日志而非 throw。

## 自测计划

### 自动化
1. `npx tsc --noEmit`
2. `npx vitest run` 全套
3. `npx eslint <touched files>`
4. `npx playwright test tests/e2e/unit4-verify.spec.ts`

### e2e 计划（6 case）
- **A**: molly /teacher/tasks/<quiz-id> → 编辑模式可见 quiz 题目编辑控件（增删改）
- **B**: 改 quiz 题目数 → 保存（无 graded sub）→ 200 + 重 fetch 反映新数据
- **C**: 改有 graded sub 的 task → 弹 dialog with "N 条提交"文案
- **D**: dialog 点"复制为新任务" → router.push 到新任务 + 老任务未变
- **E**: dialog 点"直接保存" → 第二次 PATCH force=true → 200 + audit log 含 force:true
- **F**: API 直接 PATCH 无 force → 返回 TASK_HAS_GRADED_SUBMISSIONS + count

### 手动验证
- 浏览器 molly 改 quiz 题目 + 改 sim prompt + 改 scoring → 都能正确写库

## diff 预算

预计 600-800 行（page.tsx 200-300 + service +30 + schema +5 + audit +10 + e2e ~200 + UI 复用 wizard 减少 ~150 行）。

## 提交策略

倾向**单 commit**，理由：编辑 UI + 高危拦截是一个完整闭环，分两次会有"半完成态"在 main 上跑（如有人快速反馈/合 PR）。如 diff > 800 行可考虑拆 2 commit：
- commit 1: 高危拦截 + audit + 复制为新任务（service + route + dialog UI）— 小 + 独立
- commit 2: page.tsx editing UI 扩 (复用 wizard 组件) — 大 + 体验改进

**最终决策放到实施时**：如先 commit 1 后能跑 e2e 验证 dialog 流程，再 commit 2 加 UI，分两段更安全。

## 不做的范围（防 scope creep）

- 不做"按 chapter/section 关联任务"编辑（schema 不支持，且属 instance 级）
- 不做"按知识点关联任务"编辑（同上）
- 不做学生 runner 读 taskSnapshot 的修复（Phase 4 单独）
- 不做拖动排序（spec 没要；用 ↑↓ 也可，但当前 wizard 没实现，保持简洁）
- 不做"按 instance 单独发布新版本配置"（这是 instance-level snapshot 的下一步）

## 待 coordinator 确认的设计决策

1. **同意"taskSnapshot 不读"是已知遗留缺陷，本 unit 在 high-risk dialog 措辞中告知用户**（不修根）？
2. **同意 force=true 直接保存的设计**（用户明确点击同意后绕过拦截）？
3. **同意 quiz 题目编辑用 WizardStepQuiz 而非自写 inline 编辑**（耦合性较强但避免 drift）？
4. **同意单 commit 实施 vs 拆 2 commit**？建议实施时根据 diff 大小决定。
