# QA Report — pr-5a r1

**Unit**: `pr-5a`
**Round**: `r1`
**Date**: 2026-04-24
**QA agent**: qa-p5

## Spec

Phase 5 · PR-5A — 实例详情页 Shell + Overview tab 重写（参考 `mockups/design/teacher-instance-detail.jsx`）：
- 新 header：面包屑 4 级 / 类型+状态 badge / 大标题 / meta / 右上 actions
- 4 tabs 导航（overview / submissions / insights / analytics，insights 带 AI badge + submitted counter）
- Overview tab：交付漏斗 4 卡 + 关键动作面板 + 截止倒计时 + 任务说明 + 预览学生视角
- submissions 原 table 保留（fallback），insights/analytics 占位到 PR-5B/C/D

## Verification matrix

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 3 新组件（instance-header/tabs-nav/overview-tab）+ 1 纯 util（overview-utils）+ page.tsx 整体重写，设计稿 4 块（header/tabs/funnel/action-panel）全落地。漏斗数值 `assigned = classMembers.length ?? total`，4 卡颜色按 spec `assigned:ink-4 / submitted:brand / grading:warn / graded:success` 分层。倒计时 4 档 `已截止(danger) / <24h(warn) / <3天(warn) / >=3天(ink)` 在 `overview-utils.ts` 抽纯函数。 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | **300 passed / 0 failed / 31 files**（288 baseline + 12 new for overview-utils：pctLabel NaN/Infinity、buildFunnel div-by-zero、formatCountdown 4 档 tone 边界） |
| 4. Browser / 真 curl E2E | PASS | teacher1 真登录（authjs.session-token 有值）：`/teacher/instances/f504facb-...-simulation` 200 / 40200 byte；`/teacher/instances/9201ff97-...-quiz` 200；`/teacher/instances/a5d8f119-...-subjective` 200；API 返回 `course/chapter/section/_count` 4 新字段全有值（course="个人理财规划"/chapter="风险与资产配置"/class="金融2024A班"/_count.submissions=0）。SSR HTML 仅含 "加载中"（CSR mode，baseline 同行为，非 regression）。 |
| 5. Cross-module regression | PASS | `grep getTaskInstanceById` 仅 1 处真 caller（`app/api/lms/task-instances/[id]/route.ts:20`），additive include（+4 字段）零 downstream 破坏。9 回归路由 `/teacher/{dashboard,courses,instances,tasks,tasks/new}` `/dashboard` `/schedule` `/courses` `/grades` 全 200。 |
| 6. Security (/cso) | PASS | 无 auth/权限模块改动；teacher2 跨户 GET `/api/lms/task-instances/f504facb-...` → 403 `FORBIDDEN"权限不足"`（PR-SEC2 `assertTaskInstanceReadable` guard 仍生效）；insights sub-endpoint 跨户 403；未登录 API 401。无需触发 /cso 深审。 |
| 7. Finsim-specific | PASS | UI 全中文（总览/提交列表/AI 洞察/数据分析/需要你处理/催交/开始批改/已截止/剩余 N 天/班级全员/到交率/完成批改）；Route Handler 无业务逻辑变更；Service `getTaskInstanceById` include 扩展是 additive；Prisma 无 schema 改动，无需三步（builder 确认）。API response 格式未改，仍 `{success,data}`。 |
| 8. Code patterns | PASS | 0 硬编码色（grep tailwind 原色 + `#xxx` / `rgb()` 全 0），token 色齐（`bg-surface/border-line/text-ink/bg-sim-soft/text-sim/bg-success-soft/text-success-deep/bg-warn-soft/text-warn/bg-danger-soft/text-danger/bg-paper-alt`）；组件 ARIA tabs 结构正确（role=tablist / role=tab / aria-selected / aria-controls / id=tab-{key} + tabpanel-{key}）；CSV BOM 二进制确认为真 3-byte UTF-8 EF BB BF（build report L38 的担心实为正确实现）；handler 中文提示齐（"催交通知已记录" / "导出成功"）。 |

## Issues found

**无阻塞**。

### Pre-existing（不归本 PR）

- `/teacher/instances/[id]` 页面 SSR 无 role guard（student 直接 curl 返回 200 "加载中"）；teacher layout.tsx 只 getSession 不 requireRole。Baseline commit `c262835` 同行为。如要修，应作为独立 security PR 修 layout 而非混进本 PR。API 层 `requireRole(["teacher","admin","student"])` + `assertTaskInstanceReadable`（spec 场景下 student 可读自己被指派实例符合业务语义）已在 PR-SEC2 做过。

### 观察（非 FAIL）

- `_count: { select: { submissions: true } }` 已 include，但 overview-tab 未消费（漏斗 submitted 仍从 submissions.items.length 算）。符合 build report L44 "submission.total 只能算 submitted" 的设计。PR-5B 接表格后可改用 `_count` 减一次 query。

## Phase 5 敏感点预检（非本 PR 范围，提早标记）

- PR-5C schema 改动：本 PR **未**动 schema，Prisma 三步未触发，dev server PID 59187 仍有效。
- conceptTags 隐性工作：本 PR 不涉及 AI evaluation。

## Overall: **PASS**

- 300/300 tests · tsc 0 · build 25 routes 0 warnings
- 真登录 3 instance types 全 200 · API 新字段全命中 · 9 回归路由 200
- 0 硬编码色 · 中文齐 · ARIA 正确 · CSV BOM 正确
- SEC2/SEC3 守护全保留（跨户 403 + 未登录 401）
- Additive change 零 caller 破坏

Ship 建议：可 commit。下一 PR-5B（Submissions tab + 批改 drawer）可启动。
