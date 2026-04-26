# Build Report — PR-COURSE-3 r1 · PDF 导入进度条 + 拆题反馈

> Date: 2026-04-26
> Builder: Claude Opus 4.7 (1M context)
> Spec: `.harness/spec.md` Block C / PR-COURSE-3
> Round: r1（首次构建）

## 改动文件

| 类型 | 路径 | 行数变化 |
|---|---|---|
| 新增 | `components/task-edit/import-progress-dialog.tsx` | +247 |
| 修改 | `app/teacher/tasks/[id]/page.tsx` | +35 / -41（净 -6） |
| 新增 | `tests/import-progress-dialog.test.ts` | +71 |

## 设计要点

### `ImportProgressDialog` 组件（新）

**导出**：`ImportProgressDialog`（默认）+ `deriveStage`（pure 函数，便于测试）+ 类型 `ImportStage` / `ImportJobStatus` / `ImportProgressDialogProps`

**4 阶段 stepper**（垂直布局）：
1. **上传中**（uploading）— 文件传输到服务器 + `status === "uploaded"`
2. **分析中**（analyzing）— `status === "processing"` 但 `totalQuestions == null`（PDF 文本提取阶段）
3. **拆题中**（extracting）— `processing` + `totalQuestions` 已知（AI 拆题 + 写入 DB）
4. **完成**（completed）— `status === "completed"`

**`deriveStage` 状态机**（基于 spec 中 import-job.service.ts 的实际行为）：
- `processIimportJob` 在 PDF 解析 + AI 调用前都不更新 `totalQuestions`
- AI 返回后，`prisma.importJob.update` 一次性写入 `totalQuestions = processedQuestions = questions.length` + `status = "completed"`
- 所以 "分析中" → "拆题中" 的过渡需要在 `processing` 中通过 `totalQuestions != null` 判断（当前 worker 实现下，"拆题中"几乎不可见，仅在 questions 多时偶有；这是已知架构限制，不属于本 PR 范围）

**视觉细节**：
- 当前阶段：`bg-brand-soft/60` + `bg-brand text-brand-fg` 圆形 icon + `Loader2` spin
- 已完成阶段：`bg-success` 圆形 + 半透明 70%
- 待办阶段：`opacity-40`
- 失败阶段：`bg-danger text-white` 圆形 + `bg-danger-soft` 容器
- 进度条（Progress component）从 15%/45%/75% 过渡到 100%
- "拆题中"额外细分：75% 基础 + 25% × (processed/total)，可见单题写入进度

**轮询逻辑**：
- 在 `open && jobId` 时启动 setInterval(2s)
- 立即首次 poll（避免 2s 延迟感）
- 60s timeout（与原逻辑一致）
- 终态（completed/failed）后停止 polling
- `completedRef` 防重复触发 `onComplete`
- 受 React StrictMode 双 mount 保护：cancelled flag + useRef pattern

**用户行为**：
- ESC 关闭 = `onOpenChange(false)` → `onClose`，**后台 worker 不取消**（fire-and-forget pattern）
- 完成后 3 秒自动关闭 + toast.success（caller 的 `handleImportComplete`）
- "查看题目" / "在后台继续" / "重试" / "关闭" 4 种按钮按状态切换

### `app/teacher/tasks/[id]/page.tsx` 改动

- **删除**：原 L270-333 内的 polling setInterval + setTimeout(60s) + 5 个 toast 反馈
- **新增**：3 个 state（`importJobId` / `importFileName` / `importDialogOpen`）+ 3 个 handler（`handleImportComplete` / `handleImportClose` / `handleImportRetry`）
- **保留**：`importing` state（按钮 spinner 视觉一致），但已无业务作用（Dialog 取代了它）—— 故意保留以最小改动
- **dialog mount**：放在最外层 div 闭合前（紧跟 Task Instances Card 后），保持 layout 整洁
- **重试 flow**：onRetry → close dialog → 50ms 后再次触发 file picker click（让用户重选文件）

## 简化决策（spec 内允许）

**导入记录列表**：
- spec 给了选项："**简化方案（推荐）**：仅显示**最近一次** jobId 的状态（state 内存里），不查列表"
- 实现走推荐路线 —— 进度对话框承担"看到反馈"核心需求
- 历史导入记录列表（多次导入回看）**未实现**，留 P3。理由：
  - 现有 `GET /api/import-jobs` 是单 jobId 查询，没有 listByTask
  - 新 endpoint 涉及 service 改动 + 新 guard，违背 "严禁改动" 中的 "除非真需要新 endpoint，且必须通过 coordinator 同意"
  - 当前对话框已能完整反馈"上传/分析/拆题/完成"全周期，符合用户反馈"看不到反应"的核心痛点

## 验证

```
npx tsc --noEmit          → 0 errors
npm run lint              → 0 errors（21 warnings 全为 pre-existing）
npx vitest run            → 499/499 PASS（baseline 490 + 9 new in import-progress-dialog.test.ts）
npm run build             → 25 page routes，build OK
```

**测试覆盖**（`tests/import-progress-dialog.test.ts` 9 cases）：
- `deriveStage` 9 个分支：no jobId / jobId+null / uploaded / processing+totalQuestions=null / processing+totalQuestions known + processedQuestions=10 / processing+processedQuestions=0 / completed / failed / failed-after-partial

**真服务器验证**：
- Dev server PID running at :3000
- `curl /teacher/tasks/{quizTaskId}` → HTTP 200，42KB 响应，含 ImportProgressDialog bundle reference
- `curl /api/import-jobs/{nonexistent}` → 404（poll 端点正常工作）

## 严禁改动遵守

- ✅ `lib/services/import-job.service.ts` 零改动
- ✅ `app/api/import-jobs/**` 零改动（新需求未触发新 endpoint）
- ✅ `prisma/schema.prisma` 零改动
- ✅ simulation / dashboard 文件零改动
- ✅ task edit page 仅改 L270-333（旧 handleImportPDF）+ 新增 dialog 渲染 + 3 个 state + 3 个 handler

## 不确定/留增量

1. **"分析中"阶段视觉短暂可见**：worker 在 PDF 解析 + AI 调用前都不更新 status，只在终态一次性写入。当前 stepper 的"分析中" → "拆题中"过渡几乎瞬间发生（视长 PDF + AI 响应延迟而定）。如果用户希望"分析中"明显可见，需修 worker 在两阶段间插入 `prisma.update({ status: "processing", totalQuestions: 0 })`，但 spec **严禁动 worker**，故留 P3。
2. **导入历史列表**：未实现（spec 允许）。如果 P3 推进，建议路线：`getImportJobsByTask(taskId)` service helper + 复用 GET `/api/import-jobs?taskId=X` 端点参数（需 coordinator 同意）。
3. **dev mode worker 丢任务问题**：spec 提到"如果发现现有 PDF 导入流程在 dev mode 真的有 worker 丢失任务的 bug"，本 PR 未观察到此现象（fire-and-forget 在单进程 dev server 内是稳定的；只有 server crash / restart 时才会丢）。无附加修复。

## 是否需重启 dev server

**否**。本 PR 无 schema 改动、无 service 改动、无 env 改动 —— 纯前端组件 + page state，Next.js HMR 自动热加载新 component。

## Caller impact scan

- `ImportProgressDialog` 是新组件，无 caller 影响
- `handleImportPDF` 函数签名未变（仍 `(e: ChangeEvent<HTMLInputElement>) => void`），仅内部实现重写
- 新 handler `handleImportComplete` / `handleImportClose` / `handleImportRetry` 仅 dialog 调用
- 新 state 仅本 page 用

无 service interface 改动，无 anti-regression 风险。
