# HANDOFF

> 会话结束前由 coordinator 更新. SessionStart hook 自动显示.

## 当前状态 (2026-05-16)

🎯 **PR #14 全绿 + MERGEABLE/CLEAN, 等用户 staging 兜底 10min + merge**

URL: https://github.com/AlexAnys/finsim_Mini/pull/14
Branch: `claude-codequality-pr1` (commit c86f996)
CI: core-change-label ✅ / quality ✅ (1m32s) / staging-deploy ✅ (10m1s 16/16 tests)
Staging: https://staging.finsim.anlanai.cn

## PR-1 交付总览

源于 7 路 codebase review 综合 10 numbered candidates, 本 PR 做 4 (剩 4 进 PR-2, 1 长期 backlog).

| 候选 | 状态 | 净 diff |
|---|---|---|
| A test infra (playwright + smoke + 30 route 三角 + 14 grep 守删 + fixtures) | ✅ r2 PASS | +2347/-3511 |
| D audit default-on (env gate 删 + logAuditEvent + actorRole + 补漏) | ✅ r1 PASS | ~+800/-150 |
| E AI prompt registry (lib/ai/prompts/ 23 文件 + 35 inline 抽 + basePromptPreview 派生) | ✅ r1 PASS | ~+2000/-700 |
| I+J schema bloat (TaskInstanceAnalytics 死表删 + Visibility/Task.courseName/chapterName/Class.departmentName 删 + Course.classId nullable + backfill + 5 OR 收敛) | ✅ r1 PASS | ~+200/-300 |

**净 code +6767/-4472** (净 +2295, test churn 大). harness docs +1641 separate.

## QA 证据

- vitest baseline: **1099/1099 PASS** (105 files, 6.5s)
- tsc --noEmit: **0 errors**
- npm run lint: **0 errors** (33 warnings 来自 e2e qa-* 一次性 spec, 不阻塞)
- qa-pr1-smoke r2 staging: **5/5 PASS** (Run 1 19.5s, Run 2 idempotent 15.0s)
- qa-pr1-regression r1 staging: **4 候选全 PASS** (D audit + E preview + I+J 加载 + guard 中文)
- CI staging-deploy 16/16 tests 2.8min GREEN
- 6/6 Playwright smoke I+J 自测 (teacher dashboard/courses/instances/tasks + student dashboard + register)

## ⚠️ Prod merge 前必做

1. **pg_dump prod DB → 备份**
2. migration 自动跑 (含 backfill SQL idempotent ON CONFLICT DO NOTHING)
3. 重启 web container

### Migration: `20260516064500_drop_dead_schema_pr1`

- 补 backfill 6 缺失 CourseClass 行 (dev DB 测出, prod 大概率类似)
- ALTER Course.classId DROP NOT NULL
- DROP TABLE TaskInstanceAnalytics CASCADE
- DROP COLUMN Task.visibility/courseName/chapterName + DROP TYPE Visibility
- DROP COLUMN Class.departmentName

### Course.classId 状态

保留 column (留迁移期, 后续 PR drop):
- DB nullable
- Writer 收敛: 只写 CourseClass
- Reader 收敛: 5 处 OR pattern → CourseClass-only

## Backlog (PR-1 后)

### PR-2 (4 候选, PR-1 merge 后开)

- **B** JSON 边界 (6 个 Json 字段加 zod schema + read 处 parse + versioned snapshot)
- **F** AI 安全 (prompt injection boundary + rate limit 用 AiRun 数据源 + 6 处 catch 统一 classifyAiErrorSummary)
- **G** 权限合并 (assertTaskInstanceWritable 合 isAuthorizedForInstance + assertScopeHierarchy 抽 + JWT 改密码不轮转修复)
- **H** PR #13 followup (PATCH /[id] + /[id]/snapshot 合并 endpoint + 4 *-result.tsx 收 config 表 + 清空字段语义修)

### 长期 backlog C

- Route handler 偷业务 (26 个 route 直接 prisma): 分 5-10 个小 PR, 每个 ≤ 200 行, 每月 1-2 个推进

### P2 (本 PR-1 已知 minor 不阻塞)

- smoke-01 偶发留 1 task — `task.service.ts:407` count + delete race, qa-smoke r2 自动清完. 建议后续 transaction 包

## 持续保留的知识

- **r1 即收 4 条件 (schema 版)**: 独立证据链 + deterministic acceptance + DB cleanup + Prisma 三步合规
- **行为底线 (CLAUDE.md 顶部)**: 不走捷径, < 100% acceptance 必须先 ask
- **Plan approval 边界**: coordinator 批准的方案 = 那个方案, 备选 ≠ 备选被批准
- **isolation worktree gotcha**: Agent tool `isolation: "worktree"` 在某些情况下不生效 → builder 直接改 main worktree (PR-1 4 builder 同享 main, 没撞但风险存在). 未来 spawn 多 builder 注意 verify worktree 真生效.
- **Builder 强制本地真跑**: smoke spec / e2e 类工作必须 builder 本地 `BASE_URL=... npx playwright test ...` 真跑过再交 (PR-1 A r1 走捷径出 4/5 FAIL, r2 强制后立刻 5/5)

## 下次开干怎么开始

1. **如果 PR #14 merge 完**: 开 PR-2 (B+F+G+H 4 候选, 同 PR-1 workflow)
2. **如果 PR #14 还没 merge**: 等用户 staging 兜底测 + comment "OK to merge" → squash merge
3. **如果用户 staging 测发现 bug**: 派回对应 builder r3

## 历史归档

- `spec-codereview-archive.md` 7 路 review 综合 + 10 numbered candidates
- `spec-phase4-archive.md` Phase 4 spec
- `reports/review_{arch,recent,pr13,test,security,data,ai}_r1.md` 7 reviewer 报告
- `reports/build_pr1_{test-infra,audit,ai-prompts,schema-cleanup}_r1.md` + `build_pr1_test-infra_r2.md`
- `reports/qa_pr1_{smoke,regression}_r1.md` + `qa_pr1_smoke_r2.md`
- `dev-db-backup-2026-05-16.sql` (gitignored, local I+J 备份 1MB)
- `migrations/20260516064500_drop_dead_schema_pr1/migration.sql`
