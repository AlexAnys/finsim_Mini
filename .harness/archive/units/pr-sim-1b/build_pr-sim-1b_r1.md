# Build Report — PR-SIM-1b r1

Unit: PR-SIM-1b · D1 防作弊 · 教师公布管理 UI
Round: r1
Builder: builder
Base commit: 546b8de（PR-SIM-1a 后端已就位）
Date: 2026-04-27

## Spec 摘要

接续 PR-SIM-1a 后端。本 PR 在教师 instance 详情页加 3 块 UI:
1. 顶部"成绩公布"配置卡片（手动/自动 toggle + datetime picker + 保存）
2. 提交列表加 analysisStatus 徽标（等待分析 / 已分析·未公布 / 已公布）
3. 提交列表加单条公布/撤回按钮 + 顶部批量公布按钮

## 改动文件清单

### 新增

- `components/instance-detail/release-config-card.tsx` (+135 行)
  - Switch toggle 手动 ↔ 自动（radix-ui Switch sm size）
  - datetime-local input（auto 模式下显示，本地时区显示便于教师对照截止时间）
  - dirty-aware 保存按钮（无变化时 disabled）
  - 父组件刷新（保存成功后）会通过 useEffect 同步本地 state

- `tests/pr-sim-1b-release-ui.test.ts` (+13 cases)
  - deriveAnalysisStatus 6 cases（4 边界 + undefined fallback + Date 类型支持）
  - normalizeSubmission 4 cases（透传 / fallback / releasedAt 字段）
  - UI 文案 grep 守护 3 cases（release-config-card / submissions-tab / page.tsx）

### 修改

- `components/instance-detail/submissions-utils.ts` (+30 行)
  - 加 `SubmissionAnalysisStatus` 类型
  - 加 `releasedAt` + `analysisStatus` 字段到 `NormalizedSubmission`
  - 加 `deriveAnalysisStatus` 客户端 fallback 派生函数（与 service 同步）
  - normalizeSubmission 优先用后端透传的 `analysisStatus`，缺失时 fallback 派生

- `components/instance-detail/submissions-tab.tsx` (+98 行)
  - 表格列从 8 → 9（加"分析"列在"状态"右）
  - grid-cols / min-width 调整：`grid-cols-[40px_180px_100px_120px_80px_80px_120px_120px_180px]` / `min-w-[940px]`
  - 行末按钮：analyzed_unreleased → "公布"主按钮；released → "撤回公布"链接；pending → "—"占位
  - Toolbar 新增"批量公布"按钮（仅候选行 = analysisStatus === analyzed_unreleased）
  - 新 props: `onRelease` / `onBatchRelease` / `releasingId` / `bulkReleasing`

- `app/teacher/instances/[id]/page.tsx` (+128 行)
  - 加 `releaseMode` + `autoReleaseAt` 到 `InstanceDetail` 接口（top-level scalar，service 已透传）
  - 3 个新 handler:
    - `handleSaveReleaseConfig` → PATCH `/api/lms/task-instances/{id}/release-config`
    - `handleReleaseSubmission` → POST `/api/submissions/{id}/release { released }`
    - `handleBatchRelease` → POST `/api/submissions/batch-release { submissionIds, released:true }`
  - 渲染 `<ReleaseConfigCard>` 在 InstanceHeader 下、Tabs 上
  - 把 4 个新 props 透传给 SubmissionsTab

- `tests/instance-detail-submissions.test.ts` (+2 行)
  - test factory 加 `releasedAt:null` + `analysisStatus:"analyzed_unreleased"` 默认值

- `tests/instance-detail-analytics.test.ts` (+2 行)
  - 同上，工厂函数加默认值

## 决策

### 1. service 层 zero touch（验证后撤回 spec L34 推测）

Spec 推测 `getTaskInstanceById` 可能需 additive include。**实测发现 `releaseMode` + `autoReleaseAt` 是 TaskInstance top-level scalar**（schema L21-22），Prisma `findUnique` 默认就会返回，不需要 service 改动。

真 curl 验证：
```
curl /api/lms/task-instances/ca3b34d3.../  → success: true, releaseMode: "manual", autoReleaseAt: null
```

### 2. analysisStatus 客户端 fallback 派生

后端 `getSubmissions` 已附 `analysisStatus`（PR-SIM-1a 加）。但为防御客户端旧响应/单测/边界，submissions-utils.ts 复制了一份 `deriveAnalysisStatus` 纯函数（与 service 同步规则）。`normalizeSubmission` 优先用后端值，缺时 fallback 派生。

### 3. UI batch release 候选过滤前移

后端 `batchReleaseSubmissions` service 内部过滤 `status === "graded"`（spec L168）。但 UI 提前算 `releasableSelectedIds` = selected ∩ analyzed_unreleased，让批量按钮的数字"更诚实"（不会显示选 50 但只能批 20 的尴尬）。Service 仍兜底过滤，双层防护。

### 4. datetime-local 用本地时区

datetime-local input 不接受 ISO with Z。我加了 `isoToLocalInput` / `localInputToIso` 转换辅助函数。教师看到的时间与"截止 4/29 14:54"一致，没有时区认知摩擦。defaultAutoReleaseAt 默认 = `instance.dueAt`（按 spec L246）。

### 5. 撤回按钮用 link-style 而非 outline button

行末空间紧（已有"复评/批改"按钮）。撤回操作低频且需突出"反向"语义，用纯文本按钮 + hover 红色，与"公布"主按钮形成视觉层级。

## 验证

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors / 21 warnings（全部 pre-existing） |
| `npx vitest run` | **589 passed**（baseline 576 + 13 新） |
| `npm run build` | 25 routes / 4.5s 编译 |
| Dev server | PID 96617 仍 alive（30+ min runtime） |
| 真 cookie session（teacher1）| HTTP 200 instance 详情页 + 43KB 内容 |
| 真 PATCH `/release-config`（auto + datetime）| 200 OK，DB 反映 `releaseMode=auto, autoReleaseAt=2026-04-30T10:00:00Z` |
| 真 PATCH `/release-config`（reset manual + null）| 200 OK，DB reset |
| 真 POST `/submissions/{id}/release` 不存在的 ID | 404 NOT_FOUND（"提交不存在"中文）|
| 真 POST `/submissions/batch-release` 不存在 IDs | 200 `{released:0, skipped:0}` |
| Chunk grep 10 个文案标记 | 全部 1+ hits（成绩公布/手动公布/自动公布/保存设置/公布时点/等待分析/已分析·未公布/已公布/撤回公布/批量公布）|

## 不需要 dev server 重启

零 schema 改动 → 无 Prisma migrate → 无 `prisma generate` → dev server PID 96617 内存里的 Prisma Client 仍然有效。`npm run dev` 的 webpack/turbopack HMR 已经把 UI 改动热载入，curl 验证页面 HTTP 200 + 43KB 内容 + chunk 含全部新文案。

## QA 提示

**真浏览器测试矩阵建议**：

1. teacher1 登录，进任意 instance（推荐 `7db59a62-e806-44c6-b102-e767f61ed8bb` PDF 导入测验，自带 0 提交可看空态；或者带 graded sub 的 instance）
2. 顶部"成绩公布"卡片显示 → 切自动 → 出现 datetime input → 改时间 → 保存 → toast 成功 → reload 仍是 auto + 新时间
3. 切回手动 → datetime input 消失 → 保存 → reload 验证 manual + autoReleaseAt=null
4. 提交列表（在 submissions tab）：
   - 看到新"分析"列徽标
   - 找一份 graded + releasedAt=null → 显示"已分析·未公布"橙色 + 行末"公布"按钮
   - 点公布 → toast → reload → 标签变"已公布"绿色 + 按钮变"撤回公布"链接
   - 撤回 → reload → 回到"已分析·未公布"
5. 批量：勾选多份 graded（含一些已公布、一些 analyzed_unreleased）→ "批量公布"数字仅算 analyzed_unreleased 的 → 点击 → toast "已公布 X 份 / 跳过 Y 份"

**已验证 spec 严禁项零触碰**：
- `prisma/schema.prisma`: `git diff` empty
- `app/api/**`: `git diff` empty
- `components/simulation/**`, `components/quiz/**`, `components/subjective/**`: `git diff` empty
- `app/(student)/**`: `git diff` empty
- `components/teacher-dashboard/**`, `components/student-dashboard/**`: `git diff` empty

## 留增量 / Open observations

1. **GradingDrawer 内的 release toggle**（spec 改动 3 标"可选 nice-to-have，本 PR 可跳过"）— 跳过。教师批改完保存可能也想立即公布，但目前用列表 → drawer → 关 → 列表 → 公布的 2 步流程也可达成。留 P3 PR-SIM-1d 优化。
2. **批量公布只支持公布、不支持撤回**：UI 没加"批量撤回"。撤回是低频应急操作，教师按 row 单点足够；batch-release endpoint 后端是支持的。如果 QA 验收认为需要再加，留增量。
3. **autoReleaseAt 时区显示**：input 用浏览器本地时区，但保存的是 ISO。如果教师服务器在不同时区，截止时间和公布时间显示一致这点很重要 — 实测我本机 UTC+8 显示一致。
4. **批量公布跳过提示**：当 releasedCount + skippedCount > 0 时分别显示。当全部跳过（释放 0）时仍显示"已公布 0 份 / 跳过 N 份"，文案稍生硬，可后续优化为"无可公布的提交"等。
