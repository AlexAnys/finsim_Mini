# QA Report — PR-codex-fix-2 r1

Unit: PR-FIX-2 · Codex Batch B · AI 实现 + 数据模型 7 条（含 schema → Prisma 三步）
Round: 1
Reviewer: qa-fix
Date: 2026-04-26
Builder report: `.harness/reports/build_pr-codex-fix-2_r1.md`

## Spec
B1 hint 节流服务端推导 + B2 mood_label z.enum + label 重写 + B3 aggregateSchema default + AI 失败降级 + B4 evaluate assets schema 复用 + B5 snapshots/allocations max(20) + B6 AnalysisReport @@unique + upsert + B7 SET NULL（UX1 拍板，schema 不动）

> 注：PR-codex-fix-1 r2 的 tsc 修复也包含在本 PR 的 working tree（tests/pr-fix-1-batch-a.test.ts L73,80 widening role 字面量类型）。

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 10 文件 / +251/-167 与 builder 报告一致 |
| 2. tsc --noEmit | PASS | 0 输出（含 r2 fail 的 2 个 TS2367 已修） |
| 3. vitest run | PASS | 39 files / **415 tests**（baseline 396 + 19 新 + 9 改写零回归） |
| 4. npm run build | PASS | 25 routes / 5.4s |
| 5. Prisma 三步 | PASS | migration 20260426112144 应用 / `_prisma_migrations` 时间戳 03:22:02 / `\d AnalysisReport` 显示 `_taskInstanceId_key UNIQUE btree` 已加 + 旧 `_idx` 已删 + `_fkey ON DELETE SET NULL` 保留 / dev server PID 2941→84808 重启 / 登录页 200 / 教师 instances/[id] 详情 200 |
| 6. 真 curl E2E | PASS | B5 / B6 / B7 完整闭环（见下方矩阵） |
| 7. Cross-module regression | PASS | 学生 5 routes（/dashboard/courses/grades/schedule/study-buddy）+ 教师 8 routes 全 200；instance 详情 200（Prisma client 真生效） |
| 8. /cso 安全 | PASS | UX1 SET NULL 保留学生历史成绩；B5 防 array 灌爆刷 token；B6 unique 防并发重复 cache；B1 服务端推导 lastHintTurn 闭环防客户端漏报刷 token；B3 AI 失败降级仍有数据持久化（不让 UI 误判"未聚合"） |
| 9. Finsim-specific | PASS | UI 中文（B5 错误"Too big: expected array..."由 zod 默认输出，不暴露给最终前端，由 handleServiceError 包装为 VALIDATION_ERROR + 中文 message "请求参数错误"）；Service 层逻辑正确；Route Handler 仍薄壳；upsert 正确返回稳定 reportId |

## 真 curl 攻击/正常路径矩阵

### B5 schema cap（3 cases · 全 PASS）
- B5.1 `assets.snapshots` 长 21 → **400 VALIDATION_ERROR**（"Too big: expected array to have <=20 items"）
- B5.2 `assets.snapshots` 长 20 → **201 created**（边界通过）
- B5.3 单 snapshot `allocations` 长 21 → **400 VALIDATION_ERROR**

### B6 AnalysisReport 唯一约束 + upsert（3 cases · 全 PASS）
- B6 prep: 真造 1 份 graded simulation submission with 20 snapshots + 2 conceptTags + evaluation feedback
- B6.1 1st POST aggregate（force=true） → 200 + reportId `8c122a92-56cf-4a3b-9940-0b54ed798f08`，AI 真返回 commonIssues + highlights + weaknessConcepts（`QA-test-tag1` count=1, `QA-test-tag2` count=1）+ allocationSnapshots（20 turn）
- B6.2 2nd POST aggregate（force=true） → 200 + **same reportId** `8c122a92...` —— **upsert 验证通过**
- B6.3 DB query: `SELECT COUNT(*) FROM AnalysisReport WHERE taskInstanceId='f504facb...'` = **1 row**（unique constraint 强制）

### B7 SET NULL（UX1）（3 cases · 全 PASS）
- B7 prep: 临时造 TaskInstance 9adcadbb / Submission 40833c8d / AnalysisReport 7e2a6f02，三者关联同一 taskInstanceId
- B7.1 DELETE TaskInstance → SUCCESS（`DELETE 1`）
- B7.2 Submission 行**仍存在**，taskInstanceId → **NULL** ✅
- B7.3 AnalysisReport 行**仍存在**，taskInstanceId → **NULL** ✅
- 与 spec L36 的"改 Cascade"字面要求**不符**，但与 UX1 决策（SET NULL，保留学生历史成绩）一致 — builder 第 7 决策 hybrid 正确识别 spec 字面误导，按 UX 决策执行

### B1/B2/B3/B4 代码层验证（unit tests + 代码审查）
- B1 服务端推导 lastHintTurn（ai.service.ts:395-419）：遍历 transcript 找最近 ai+hint，取 max(server, client)，client 值 clamp 到 [0, currentTurn]。逻辑等价于客户端 simulation-runner.tsx，向后兼容。8 unit cases 通过
- B2 chatReplySchema mood_label `z.enum(VALID_MOOD_LABELS)` + NEUTRAL 兜底重写 label（ai.service.ts:391-394）。2 unit cases 通过
- B3 aggregateSchema arrays `.default([])` + try/catch aiGenerateJSON 降级（insights.service.ts:82-102, 366-379）。2 unit cases 通过 + B6 真 AI 路径完整跑通
- B4 evaluate route assets `assetAllocationSchema.optional()` 直接复用（route.ts:22）— DRY 优于 inline。2 unit cases 通过

## 不直观决策评审

| Builder 决策 | QA 评审 |
|---|---|
| B1 服务端 + 客户端取较大值（最保守节流） | 合理 — 三种攻击场景全部覆盖：旧 client 用客户端值 / 漏报用服务端推导 / 伪报 999 clamp 到 currentTurn |
| B2 KEY_TO_LABEL 反向字典 | 合理 — z.enum 不暴露原数组，反向字典更显式 |
| B3 降级写 commonIssues:[]+aggregatedAt 时间戳 | 合理 — UI 显"暂无共性问题"而非"未聚合"，降级体验明确。但建议未来加 `aiSucceeded` flag 让 UI 区分（builder 自承认） |
| B4 复用 assetAllocationSchema | 合理 — DRY + 类型源单一 |
| B5 max(20) 上限 | 合理 — snapshots 实际 ≤4 次，allocations 常 3-7 项，5×/3× 余量足够，1000 项灌爆攻击被截 |
| B6 upsert 替代 findFirst+create/update | 合理 — 单原子操作减少 round-trip + unique 约束兜底防并发竞争（实测 reportId 跨 force=true 调用稳定） |
| B7 schema 零改（UX1 SET NULL） | **决策正确** — Prisma optional FK 默认 SET NULL，与 UX1 推荐一致；spec 字面要求 Cascade 与 UX1 矛盾，hybrid 第 3 次正确识别 |
| drift Option C（同步 checksum 而非 reset） | 合理 — 非破坏性，DB 业务数据 0 变动，team-lead 已 ack；migration history 仍标准 |

## Prisma 三步真闭环

```
1. drift 处理（Option C）：UPDATE _prisma_migrations SET checksum=<new> WHERE name='20260422041600_backfill_course_class' → drift 警告消失
2. 手写 migration: prisma/migrations/20260426112144_add_analysis_report_unique_instance/migration.sql
   - DROP INDEX IF EXISTS "AnalysisReport_taskInstanceId_idx"
   - CREATE UNIQUE INDEX "AnalysisReport_taskInstanceId_key" ON "AnalysisReport"("taskInstanceId")
3. npx prisma migrate deploy → "All migrations have been successfully applied"
4. npx prisma generate → "Generated Prisma Client (v6.19.2) in 123ms"
5. kill PID 2941 → ps 验证 process gone
6. nohup npm run dev → 新 PID 84808 alive
7. 实测 /login 200 / /teacher/dashboard 200 / /teacher/instances/[id] 200
8. DB 索引验证：\d AnalysisReport 显示 `_taskInstanceId_key UNIQUE` + 旧 `_idx` 不存在
```

## Issues found

无 BLOCKER。

**Minor observations**（不影响 PASS）：
1. B3 降级时 UI 看到"已聚合（空）"vs"未聚合"难区分。Builder 自承认。建议未来增量 PR 加 `aiSucceeded` flag — 不阻塞本 PR
2. 我初次跑 B5 attack matrix 时 dev server 还没热重载 schema 变更（builder 重启后 ~3 分钟内），返回 201；retry 后即 400。**这是 next.js 热加载延迟，不是代码 bug**。所以 builder 的"`/login` 200 验证已重启"是必要的，但实测 zod schema 真生效更晚。建议未来 builder 重启后多等 30s 再 declare done

## Cleanup

- 临时 submission 6758ab3d / SimulationSubmission / AnalysisReport 8c122a92 已删
- B7 临时 TaskInstance 9adcadbb / Submission 40833c8d / AnalysisReport 7e2a6f02 已删
- DB 测试数据 0 残留

## Overall: PASS

PR-FIX-2 Batch B 7 条 finding 全部修复闭环：
- 服务端推导 lastHintTurn（B1）+ mood_label z.enum 严格 + NEUTRAL 同步重写 label（B2）
- aggregateSchema default + AI 失败降级仍持久化 weaknessConcepts（B3）
- evaluate route 复用 assetAllocationSchema（B4）
- snapshots/allocations max(20)（B5）
- AnalysisReport @@unique + insights.service upsert（B6 — DB 验证一行 + reportId 稳定）
- TaskInstance 删除 SET NULL（B7 / UX1 — 历史成绩保留）
- Prisma 三步完整 + drift 处理 + dev server 重启 + 真访问页面验证

415 tests / tsc 0 / build 25 routes / 学生 5 + 教师 8 路由回归 200 / DB 0 残留。

可推进 PR-FIX-3（Batch C 前端 5 条）。
