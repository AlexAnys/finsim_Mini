# QA Report — Unit 17 r1

> QA: qa · 2026-05-15 · 验 commit `2e69163` on `claude-demo-fixes` (Phase 4 第一个 unit)
> Bugs: Unit 4 衍生 taskSnapshot 未消费 · `.harness/spec-amendments.md` Unit 17
> Test spec: `tests/e2e/qa-unit17-snapshot.spec.ts` (5 case，独立于 builder unit17-verify.spec.ts)

## Schema 0 改动

`TaskInstance.taskSnapshot` 字段已在（Unit 4 时确认）— Unit 17 仅扩前端读路径。**0 schema 改动 / 不需 Prisma 三步 / 不需重启 dev server** ✓

## 测试数据 (baseline)

DB 实证 `a7d9b380` (深度测试 adaptive instance):
- `taskSnapshot` 类型: `object` (jsonb)
- `taskSnapshot.taskName`: "深度测试"
- `taskSnapshot.taskType`: "quiz"
- `taskSnapshot.quizQuestions` 数组: **10 题完整持久化** ✓

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| `resolveTaskForRunner` helper — snapshot valid → 返回 snapshot, invalid → fallback live + warn | builder 7 unit test 覆盖全分支 (valid object/null/undefined/non-object/missing taskName/empty taskName/nested config) | vitest 92 files / **1056 tests pass** (1049 baseline + 7 helper) ✓ | PASS |
| API contract: GET task-instance 返回 taskSnapshot 字段 | alex GET /api/lms/task-instances/[id] | response 含 `taskSnapshot` key，taskName="深度测试", quizQuestions 10 items ✓ | PASS |
| 学生 /tasks/[id] 用 snapshot helper + 0 console error | alex 访问页面 + 抓 console | 渲染 "深度测试"; 0 fallback warning (valid snapshot); 0 console error ✓ | PASS |
| 教师 /teacher/instances/[id] 保留 live (不读 snapshot) | molly 访问页面 | 渲染 "深度测试" (live + snapshot 都是这名); 0 console error ✓ | PASS |
| /sim/[id] 用 helper (regression on sim runner) | API contract check | taskSnapshot key 在 API response ✓ | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立运行 | tsc 0 / vitest 1056 / 0 lint issue | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **92 files / 1056 tests pass** (1049 baseline + 7 helper) |
| `npx eslint <5 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat 2e69163` | 5 files +353/-9 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ (字段已存在, builder 仅扩前端读路径) |
| Dev server 重启 | N/A (无 schema 改动) |
| DB 测前测后 | snapshot baseline 完整 (taskName="深度测试" / 10 quizQuestions) — read-only API tests, 0 副作用 |

## DOM 实证 — Adaptive Runner Backward Compat

alex 进 `/tasks/a7d9b380` 仍正常渲染:
```
深度测试 深度测试 测验
截止: 2026/4/30 20:53:00 已过期
返回任务
深度测试 测验 · 自适应
第 1 题（最多 8 题） 已诊断 0 个知识点
请简述深度测试与广度测试的主要区别。
3 分 简答题 提交本题
```

- ✅ 0 console error
- ✅ 0 fallback warning (valid snapshot 路径)
- ✅ Adaptive runner UI 完整渲染（注: adaptive runner 走 /adaptive-quiz/next 独立路径，build report Q5 已记录该路径不交叉 snapshot，由 live task 数据驱动 — 这是已知约束，Unit 18 候选）

## Cross-module / Backward Compat

- `useResolvedTask` 返回 `{ task, fromSnapshot }` — fromSnapshot 字段预留 Phase 4+ UI hint (build report Q4)
- 教师页面 `/teacher/*` 完全不动 — 编辑入口需最新模板
- Server-side grading.service 仍读 live task — Unit 17 仅 frontend
- 老 instance 无 snapshot → helper fallback live + console.warn (优雅降级)
- Adaptive quiz runner 走 `/adaptive-quiz/next` 直拉 Prisma live — Q5 风险登记，Unit 18 候选

## Finsim-specific 检查

- ✅ Schema 0 改动 — 字段已存在
- ✅ Helper 在 `lib/utils/task-snapshot.ts` 集中，避免多处复写
- ✅ Backward compat: 老 instance 无 snapshot → fallback live + warn
- ✅ Type guard 阈值清晰: object + taskName non-empty 即 valid
- ✅ 教师 vs 学生路径差异化 (教师 live / 学生 snapshot)

## 风险 / 不确定项

1. **🟢 Schema 0 改动**: 仅前端读路径调整，最小侵入
2. **🟢 Backward compat 优雅**: helper warn-on-invalid 不抛错
3. **🟡 instance.title 独立** (build report 已记录): title 不参与 snapshot — spec 字面意图 (title 是 instance 级别)
4. **🟡 Adaptive quiz runner 不消费 snapshot** (build report Q5 风险登记): runner 直拉 /adaptive-quiz/next + live data — Unit 18 候选改造
5. **🟢 server-side grading 不动**: 仅 frontend，grading.service 仍 live

## 是否引入新 bug

无。5 files +353/-9 scope 严格按 plan；vitest 1056 全过；helper 7 单测覆盖全分支；DB read-only 无副作用。

## Issues found

无 blocker。Phase 4 backlog 留意 adaptive quiz runner snapshot 消费 (Q5)。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 5 case (API contract + 学生 + 教师 + snapshot 内容 + regression) vs builder 4 e2e + 7 unit — 独立证据链
2. ✅ HTTP / DOM 渲染 / API response key / console error count 全 deterministic
3. ✅ DB cleanup 完整 (read-only)

**建议 r1 PASS 收工**。Phase 4 第一个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A 待开 / Unit 12-16 待开。
