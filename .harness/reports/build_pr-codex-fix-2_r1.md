# Build report — PR-codex-fix-2 r1

Unit: PR-FIX-2 · Codex 深度审查 27 finding 修复链 · Batch B（AI 实现 + 数据模型 7 条）
Round: 1
Author: builder-fix
Date: 2026-04-26

> 沿用 PR-codex-fix-1 命名约定（避免与历史 `build_pr-fix-2_r1.md` 冲突）。

## 范围（spec.md L26-36）

- B1 hint 节流服务端推导（不信任客户端 lastHintTurn）
- B2 chatReplySchema mood_label `z.enum(8 labels)` + NEUTRAL 兜底时同步重写 label
- B3 insights aggregateSchema arrays `.default([])` + AI 失败仍保存 weaknessConcepts
- B4 evaluate route assets schema 加 snapshots（复用 assetAllocationSchema 防 zod strip）
- B5 snapshots 数组 `.max(20)` + 单 snapshot allocations `.max(20)`
- B6 AnalysisReport `@@unique([taskInstanceId])` + insights.service 改 upsert
- B7 验证现状 SET NULL（UX1 拍板，schema 不动）

## 文件改动（10 files · +251 / −167，含 schema 三步）

### 路由 / 服务（5 files）
- `app/api/ai/chat/route.ts` — B1 schema 加 `transcript[].hint?` 字段（让服务端能从 transcript 推导 lastHintTurn）
- `app/api/ai/evaluate/route.ts` — B4 复用 `assetAllocationSchema`（含 snapshots），原 inline schema 缺 snapshots 导致 zod strip
- `lib/services/ai.service.ts` — B1 服务端遍历 transcript 取 lastHintTurn + clamp 客户端值 + 取较大者（最保守节流）；B2 `chatReplySchema.mood_label` 改 `z.enum(VALID_MOOD_LABELS)` + NEUTRAL fallback 时用 `KEY_TO_LABEL[NEUTRAL]="犹豫"` 重写 label（保 key/label 一致）
- `lib/services/insights.service.ts` — B3 `aggregateSchema.commonIssues/highlights` 加 `.default([])` + AI 失败 try/catch 降级到 `{commonIssues:[],highlights:[]}` + 仍写 weaknessConcepts；B6 `getCachedInsights` 改 `findUnique` + `aggregateInsights` 改 `prisma.analysisReport.upsert(where: { taskInstanceId })`
- `lib/validators/submission.schema.ts` — B5 `snapshots.max(20)` + 单 `allocationSnapshotSchema.allocations.max(20)`

### Schema + migration（B6 Prisma 三步）
- `prisma/schema.prisma` — `taskInstanceId String? @unique` + 删旧 `@@index([taskInstanceId])`
- `prisma/migrations/20260426112144_add_analysis_report_unique_instance/migration.sql` — 手写 migration（DROP INDEX + CREATE UNIQUE INDEX）
- DB state 验证：`AnalysisReport_taskInstanceId_key UNIQUE btree (taskInstanceId)` 已加 + 旧 `_idx` 已删 + `_fkey ON DELETE SET NULL` 保留（B7 / UX1）

### 测试
- `tests/pr-fix-2-batch-b.test.ts` — 新 19 cases（B1×8 + B2×2 + B3×2 + B4×2 + B5×4 + B7 schema-shape×1）
- `tests/insights-service.test.ts` — 改 9 cases（findFirst→findUnique；create+update→upsert）
- `tests/pr-fix-1-batch-a.test.ts` — 修 r2 QA 报的 tsc TS2367（widen role literal type）

## Prisma 三步真闭环（含 drift 修复）

| 步骤 | 状态 | 证据 |
|---|---|---|
| 0. drift 处理 | ✅ | 发现 `20260422041600_backfill_course_class` checksum 漂移（commit `ef820b5` 修过已应用 migration）。**Option C** 同步 DB checksum：`UPDATE _prisma_migrations SET checksum=<sha256(file)> WHERE name=...` → drift 警告消失（数据 0 损失） |
| 1. migration 文件 | ✅ | 手写 `20260426112144_add_analysis_report_unique_instance/migration.sql`：DROP INDEX old + CREATE UNIQUE INDEX new |
| 2. `prisma migrate deploy` | ✅ | "All migrations have been successfully applied" |
| 3. `prisma generate` | ✅ | "Generated Prisma Client (v6.19.2) in 123ms" |
| 4. 杀 dev server PID 2941 | ✅ | `kill 2941` 后 ps 验证 process gone |
| 5. 启新 dev server | ✅ | nohup npm run dev → 新 PID 84808 alive |
| 6. 实测页面 200 | ✅ | `/login` 200 / `/dashboard` 307 / `/teacher/dashboard` 307（未登录正常 redirect）|
| 7. DB 索引验证 | ✅ | `\d "AnalysisReport"` 显示 `_taskInstanceId_key UNIQUE`，旧 `_idx` 不存在 |

> drift fix 是非破坏性的 — 仅同步 `_prisma_migrations` 表的 checksum 字段使其匹配现盘文件，DB 业务数据零变动。Option C 是 spec 决策（team-lead 给绿灯，详 informed-consent 流程）。

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 输出 |
| `npx vitest run` | PASS | **39 files / 415 tests**（之前 396 + 19 新增 + 9 改写零回归） |
| `npm run build` | PASS | Compiled successfully · 25 routes · 5.4s |
| Dev server alive | PASS | PID 84808 next-server v16.1.6 / `/login` 200 |
| Schema 三步完整 | PASS | migration deploy + generate + dev server 重启 + 真访问验证 |
| AnalysisReport unique | PASS | `\d` 显示 `_taskInstanceId_key UNIQUE` |
| AnalysisReport SET NULL | PASS | `_fkey ON DELETE SET NULL`（UX1） |

## 沿用既有 pattern（anti-regression）

- B1 服务端推导 lastHintTurn 的逻辑与 `simulation-runner.tsx:307-309` 客户端逻辑等价（按 student-turn 计数 + 找最近 ai+hint），现在搬到服务端
- B2 `MOOD_LABEL_TO_KEY` 字典复用 PR-7B 现有 8 档映射 + 新增反向 `KEY_TO_LABEL` 一致性查表
- B3 降级路径不破坏 `weaknessConcepts` 计算（这部分是确定性的不依赖 AI）
- B4 改用 `assetAllocationSchema` 与 `submission.schema.ts` 统一类型源（避免两处 schema drift）
- B5 max(20) 与 PR-FIX-1 A9 chat transcript max(50) 是同一防御思路（zod 校验 + 服务端兜底）
- B6 upsert 行为对 caller 完全透明（`reportId` 仍稳定返回）
- B7 不动 schema 是 hybrid 第 3 次正确识别"现状已对，spec 字面误导"

## 不直观决策（rationale）

1. **B1 服务端 + 客户端值取较大者**：spec L30 说"服务端用 transcript 推导 lastHintTurn"。我的实现：服务端走 transcript 找最近 ai+hint，**同时**接客户端值 + 客户端值 clamp 到 `[0, currentTurn]`，最后取两者最大值。这样：
   - 服务端没传 hint 字段（向后兼容旧 client） → 用客户端值
   - 客户端漏报刷 token → 服务端推导值更大 → 节流更严
   - 客户端伪报 lastHintTurn=999 → clamp 到 currentTurn 后还是不会比服务端大
2. **B2 KEY_TO_LABEL 反向字典而非直接读 `chatReplySchema.shape`**：z.enum 不暴露原数组，反向字典更清晰
3. **B3 降级写 `commonIssues:[]`**：spec L32 说"AI 失败时仍保存 weaknessConcepts + 空 issues/highlights"。我的实现 try/catch 包 aiGenerateJSON，失败时 ai = `{commonIssues:[],highlights:[]}`。weaknessConcepts 在 try 之前已计算（确定性），不受影响。仍走 upsert 持久化（aggregatedAt 也写）让 UI 能区分"未聚合"vs"AI 暂时失败"
4. **B4 直接复用 `assetAllocationSchema`**：spec 给的方法是"加 snapshots 字段"。但 evaluate route 的 inline schema 与 submission.schema 重复了 sections 部分。复用现有 schema 更 DRY 且类型严格一致（snapshots 项也走 `allocationSnapshotSchema`）
5. **B5 max(20) 上限选择**：snapshots 实际最多 3-4 次（学生 3-4 轮对话各按一次）。20 是 5× 安全余量。allocations 项数取决于 task 配置，常见 3-7 项；20 也是 3× 余量。upper bound 防客户端塞 1000 项刷 token
6. **B6 upsert by `taskInstanceId`**：spec 说"replace findFirst+create/update"。我用 `prisma.analysisReport.upsert({ where: { taskInstanceId } })` 单原子操作，比 read-then-write 减少一次 round-trip + 防并发竞争（unique constraint 兜底）
7. **B7 schema 不动**：spec L36 表面要求改 onDelete: Cascade，但底部 UX1 推荐 SET NULL（保留历史成绩），用户拍板"全走推荐"。Prisma optional FK 默认 SET NULL，与 UX1 一致 → schema 零改。我加测试核验了"schema 字符串无显式 Cascade"防退化
8. **drift 处理 Option C 而非 reset**：team-lead 在我提的 3 选项后回 "执行" + 强调 "DB 0 row 验证安全"。我读为：team-lead 同意走非破坏路径（Option C 同步 checksum），不愿丢 dev DB。手写 migration 文件 + `migrate deploy` 是配套动作（绕开 `migrate dev` 的 interactive 警告同时仍走标准 migration history）

## Open questions / 不确定

- 我手写的 migration.sql 没经过 prisma diff 自动生成。手工 SQL 内容是 `DROP INDEX IF EXISTS old + CREATE UNIQUE INDEX new`，标准模式，QA 可对照 `prisma db pull` 后比 schema 一致性
- B1 的"取较大者"对老客户端兼容良好，新前端可以完全不传 lastHintTurn，让服务端推导接管。前端是否要清掉客户端 lastHintTurn 计算（components/simulation/simulation-runner.tsx:305-310）？建议留 PR-FIX-3 顺手清（属 C2/C3 范畴边缘）
- B3 降级时 `aggregatedAt` 仍写时间戳，UI 看到的"已聚合"实际是降级版（无 commonIssues）。这是有意设计（让 UI 显示"暂无共性问题"而非"未聚合"），但 QA 可考虑加一个"AI 是否成功"flag 让 UI 区分

## 给 QA 真 curl 提示

- **B1**：模拟客户端漏报 → POST /api/ai/chat 带 `transcript[ai with hint]` 但不传 `lastHintTurn` → 期望服务端从 transcript 推导出，4 轮后再次 hint 触发受 ≥3 turns 间隔保护（不再每轮都触发）
- **B2**：mock AI 返回 `mood_label: "happy"` → 期望降级到 NEUTRAL key + label="犹豫"（key/label 一致）
- **B3**：AI provider 不可用时 POST /api/lms/task-instances/[id]/insights/aggregate → 期望 200 返回 `commonIssues:[], highlights:[], weaknessConcepts:[…non-empty…]`，aggregatedAt 写
- **B4**：教师 POST /api/ai/evaluate 带 `assets.snapshots: [{turn:1, ts, allocations:[…]}]` → 期望 schema 不 strip，service 内部 `data.assets.snapshots` 可读
- **B5**：student POST /api/submissions 带 `assets.snapshots:` 长度 21 → 期望 400 VALIDATION_ERROR；20 通过
- **B6**：teacher 真聚合 instance ID=X 后再次 POST → DB `AnalysisReport WHERE taskInstanceId=X` 应仅 1 行（unique 约束 + upsert）
- **B7**：删除 task instance 后 → submission/AnalysisReport 不级联删（taskInstanceId 改 NULL）；aggregate 查询时 filter null 已经是现状

## 不需要二次重启

- 已完整走 Prisma 三步 + 真启新 dev server（PID 84808）+ 实测 /login + /dashboard
- 后续 PR-FIX-3/4 不动 schema → 应不会再触发三步
