# Spec — Review Fixes Batch 1（5 个 🔴，3 worktree 并行，1 个 PR）

> Review 总览见 `.harness/reports/review_summary_r1.md`。Batch 2（6 个 🟡）待 PR 合并后启动。

## 用户原话

> "把上面的这些都做记录，你自己制定一个详细的计划，每修一个重新验证下，执行和 QA 独立，完了前 5 个打包一个 PR 我来 review，没问题的话继续下 6 个"
> "我在想你是否能同时开多个 worktree 或怎么样并行优化和验证这些？或者并行那些适合并行的？"

## 文件冲突矩阵（决定并行分组）

| Fix | 主要改动文件 |
|---|---|
| 1 学生数 sum | `lib/utils/teacher-dashboard-transforms.ts` |
| 2 TaskInstanceAnalytics 实时 | `lib/services/dashboard.service.ts` + 同 Fix 1 文件 |
| 3 Chat 流式 | `lib/services/ai.service.ts` + `app/api/ai/chat/route.ts` + sim runner 前端 |
| 4 Provider 死代码 | `lib/services/ai.service.ts` + `lib/services/ai-tool-settings.service.ts` + AI 设置 UI |
| 5 大纲编辑 | `app/api/lms/courses/[id]/outline-apply/route.ts` + outline editor UI + 可能 schema |

→ **Fix 1+2 同文件**（串行）；**Fix 3+4 同 ai.service.ts**（串行）；**Fix 5 完全独立**。

## 并行结构

### 主 worktree（coordinator 守在这）
- 路径：`/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim`
- 分支：`claude-fix-mimo-reasoning-param`（不动）
- 留着监控 + 最终 integration

### Worktree A — 仪表盘组（Fix 1 → Fix 2）
- 路径：`/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-dashboard`
- 分支：`claude-fix-batch1-dashboard`
- Dev server 端口：**3001**
- Agents：`builder-dashboard` + `qa-dashboard`
- 预计 ~4h（Fix 1 30min + Fix 2 3-4h）

### Worktree B — AI 组（Fix 3 → Fix 4）
- 路径：`/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-ai`
- 分支：`claude-fix-batch1-ai`
- Dev server 端口：**3002**
- Agents：`builder-ai` + `qa-ai`
- 预计 ~7h（Fix 3 4-6h + Fix 4 2-3h）

### Worktree C — 大纲组（Fix 5）
- 路径：`/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim-wt-outline`
- 分支：`claude-fix-batch1-outline`
- Dev server 端口：**3003**
- Agents：`builder-outline` + `qa-outline`
- 预计 ~5h（Fix 5 4-6h）

**关键路径 = max(A, B, C) ≈ 7h**（vs 串行 15-22h，**节省 ≈ 60%**）

## 共享资源

- **Postgres**：3 worktree 共用主 docker `acc4fef29d82_finsim-postgres`（端口 5432）
- **node_modules**：3 worktree symlink 到主 worktree（已设好）
- **.env**：已 copy 到 3 worktree
- **Playwright**：装好 chromium 在 `~/Library/Caches/ms-playwright`，3 worktree 都可用
- **AI provider 配额**：mimo 共享，并发 chat 实测会增加负载但 mimo 无明确 rate limit

## 同步点 / 风险

⚠️ **Prisma schema 改动是唯一不能并行的事**（CLAUDE.md 三步铁律）。Fix 5 若发现要改 schema（如加 chapter.order 字段）：
1. **必须停下来** SendMessage coordinator
2. Coordinator 通知 worktree A/B 暂停
3. Worktree C apply migration + `npx prisma generate` + 重启 dev server
4. Worktree A/B 拉 migration（cherry-pick）+ regenerate prisma client + 继续
5. 仅在所有人都同步后 Fix 5 继续推进

如果 Fix 5 不需要改 schema（chapter 已有 order 字段就用），无需同步。Builder C 第一步先确认。

## 5 个 Fix 详细 spec（按 worktree 排）

---

### Worktree A · Fix 1 — dashboard 学生总数取 sum 不取 max

**Unit**：`fix-1-student-count-sum`

**问题证据**：`lib/utils/teacher-dashboard-transforms.ts:51-54` 用 `Math.max(...)`。teacher1 实际 A 班 10+B 班 2=12，dashboard 显示 10。来源：Stream C DB 对账。

**修复决策**：先看 `prisma/schema.prisma` 中 `User.classId` 是单值还是多对多。
- 单值（一个学生一班）→ `reduce sum`
- 多对多 → `User where classId in [...] count distinct`

**Acceptance**：
1. Playwright 实测 teacher1 dashboard「共 N 名学生」N === 直连 Postgres `SELECT COUNT(DISTINCT u.id) FROM "User" u WHERE u."classId" IN (...teacher1 班级 ids)` 真值
2. 加单测 case：2 个班 [10, 2] → 12（不是 10）
3. `npx tsc --noEmit` 0 error；`npx vitest run` 全过
4. Commit：`fix(dashboard): teacher student count sum across classes`

---

### Worktree A · Fix 2 — TaskInstanceAnalytics 死表 → 实时 SELECT

**Unit**：`fix-2-task-analytics-realtime`

**问题证据**：`TaskInstanceAnalytics` 表 0 行，全仓零 producer（grep `analytics.upsert|create|update` 在 `lib/services/` = 0）。但 `dashboard.service.ts:29` include 它。结果 dashboard「薄弱任务」「班级表现」「KPI avgScore」实际是死的（DB 里有 4 个均分<60 的实例没显示）。来源：Stream C SELECT 验证。

**修复方向**：参考 `lib/services/insights.service.ts`（instance 级，实测精确 67.8 vs DB 67.75），改成实时聚合 SELECT。
- 删除或保留 schema 不动（不要做 schema migration，避免触发同步点）
- `dashboard.service.ts` 的 query：用 submissions group by + AVG
- `teacher-dashboard-transforms.ts:65 buildKpiSummary` 改 source

**Acceptance**：
1. teacher1 dashboard「薄弱任务」显示有真实数据（DB 均分<60 的实例必须列出）
2. 「班级表现 模拟分均分」显示真值
3. KPI 均分对得上 DB：`SELECT AVG(s.score) FROM Submission s JOIN TaskInstance ti ON ... WHERE ti.classId IN teacher1 classes AND s.score IS NOT NULL`
4. 性能：dashboard 加载 ≤ baseline 2x（当前 0.82s，目标 < 1.7s）。退化则 build 报告标注
5. `npx tsc --noEmit` 0 / vitest 全过
6. Commit：`fix(dashboard): compute task analytics live from submissions`

**Anti-regression**：grep `analytics:` 在 `lib/services/` + `lib/utils/` + `app/` 全部用点，必须全部同步更新（CLAUDE.md 第 8 条）。

---

### Worktree B · Fix 3 — 学生 AI Chat 流式输出

**Unit**：`fix-3-chat-streaming`

**问题证据**：`lib/services/ai.service.ts` chatReply 用 `generateText`。Playwright 实测连续 3 轮 chat 18051/24101/26044 ms，无流式渲染。来源：Stream A `chat-bench.spec.ts`。

**修复方向**：
- chatReply 改 `streamObject`（保留 JSON schema 校验）或 `streamText`（流文本 + 收尾 emit metadata）
- `app/api/ai/chat/route.ts` 改 SSE / `ReadableStream` 返回
- 前端 simulation runner 接 SSE 渲染（逐 token / chunk 出现）
- 加 30 秒 AbortController 上限
- 保留 chatReply 兜底（JSON 解析失败 → `studentPerf=0.5, mood=犹豫`）— 用 degraded flag 标记降权

**Acceptance**：
1. Playwright 真浏览器：首字到达 ≤ 2 秒（首 chunk，不是首完整 token），整体 ≤ 10 秒（比 baseline 18-26s 提升 ≥ 50%）
2. 流式渲染可见：字一段段出现
3. mood + studentPerf 正确传到 `evaluateSimulation`
4. 30 秒超时生效：mock 上游 ≥30s 卡顿，前端显示中文超时错误
5. 加 e2e `tests/e2e/fix-3-chat-stream.spec.ts`
6. `tsc 0 / vitest 全过 / lint ≤ 3 warning`
7. Commit：`fix(ai): stream chat replies via streamObject — 18-26s → <2s first token`

**Anti-regression**：
- `role` enum 防注入 (`chat/route.ts:31`) 保留
- `MAX_TRANSCRIPT_ENTRIES=50` / `SERVER_TRIM_RECENT_TURNS=30` 兜底保留
- 不破坏 sim runner 的退出 / 评分触发

---

### Worktree B · Fix 4 — AI Provider 死代码处理

**Unit**：`fix-4-provider-deadcode`

**问题证据**：`ai.service.ts:151` 强制改写 `requestedProviderName === "mimo" ? requestedProviderName : "mimo"`。UI 下拉只有 mimo 但 `.env.example` 列了 5 个 provider，老师 / 部署同事被误导。来源：Stream A 实测 + 代码读取。

**修复决策（coordinator 决策）**：**保留多 provider 支持**（ai.service.ts 完整 case 分支已写，fallback 健全）。
- 删 `ai.service.ts:151,168` 强制改写，让 `requestedProviderName` 生效
- 修 `ai-tool-settings.service.ts:160` schema：`enum(["mimo"])` → `enum(["mimo","qwen","deepseek","gemini","openai"])`
- UI Provider 下拉接 `getProviderOptions()` 显示真实列表
- 「测试连接」按钮真打 1 个 `aiGenerateText` ping
- Provider 选了但 .env 缺 key → 中文「XXX API key 未配置」

**Acceptance**：
1. UI Provider 下拉 ≥ 5 项，可选并保存
2. 切到 qwen 后下一次 chat 真用 qwen（AiRun 表 provider 字段验证 或 log）
3. 选了但缺 key 时中文错误
4. mimo 默认行为不变（reasoning OFF + fallback 链 + da9a505 修复不破坏）
5. `tests/ai-provider.test.ts` 加 case 验证非 mimo 不再被强制改写
6. tsc / vitest 全过
7. Commit：`fix(ai): respect provider selection (remove forced mimo rewrite)`

**Anti-regression**：mimo reasoning param（da9a505）不能再被回滚。Coordinator 已 stash 过一次 ghost revert。

---

### Worktree C · Fix 5 — 大纲编辑能改 / 删 / 重排

**Unit**：`fix-5-outline-edit`

**问题证据**：`outline-apply/route.ts:106-145` 只 add 缺失章节，不 update/delete/reorder。来源：Stream B 实测 + 代码读取。

**修复方向**：
- `outline-apply` 加 `mode: "safe-merge" | "replace"`（默认 safe-merge 向后兼容）
- "replace" 模式：按提交 chapter 数组完整覆盖（diff = create/update/delete + order）
- 安全：删除前检查关联 Task/Submission，有引用就拒绝中文「该章节有 N 个任务，请先删除任务」
- UI outline editor 加「保存编辑」按钮 + 删除 + 拖拽重排
- 章节 order 字段：**首要事 — 查 schema 有没有 `order`/`index`**。**有就直接用**，**没有才考虑 schema 改动**（触发同步点）

**Acceptance**：
1. Playwright：传大纲 → AI 错抽 → 老师改名 → 保存 → 刷新 → **改名持久化**
2. 删除：删未关联章节 → 真删；删关联了任务的章节 → 中文拒绝
3. 重排：上下拖动 → 保存 → 刷新 → 顺序持久化
4. 向后兼容：safe-merge 行为不变
5. 加 e2e case
6. tsc / vitest 全过
7. Commit：`fix(outline): support update/delete/reorder chapters via mode=replace`

**Anti-regression**：
- 如改 schema 必须三步铁律（migrate → generate → 重启 dev → 验证页面）
- 删除级联：不能误删带 Task 的章节
- diff key：用 chapterId / slug，不用 title

**同步点告警**：若 Builder C 发现要改 schema，**立即 SendMessage coordinator**，其他 worktree 暂停。

---

## QA 独立验证规则

每个 fix 完成时，对应 worktree 的 QA agent：
1. 读 builder `reports/build_fix-N_r{R}.md`
2. 独立读 git diff（不只信 builder 自报）
3. 真浏览器 Playwright 实测 acceptance 列出来的 case
4. 直连 Postgres 对账（Fix 1/2/5 涉及数字 / 数据持久化）
5. 跑 `npx tsc --noEmit + npx vitest run + npm run lint` 全绿
6. 检查 CLAUDE.md anti-regression（Service interface 全同步 / Prisma 三步 / 业务无关文件不动 / 中文 UI）
7. 写 `reports/qa_fix-N_r{R}.md`，PASS/FAIL + 详细证据
8. 追加一行 `progress.tsv`

QA 不许：
- 自己改业务代码
- 用 builder 写的 e2e 脚本作为唯一验证（必须独立 Playwright 跑一遍）
- 凭代码 review 通过（必须真浏览器）

## Dynamic exit per fix

- QA 2 连 PASS 即收工（不跑 r3）
- 同一 FAIL 3 连 → 回 spec 重规划（不硬磨）
- 跨 fix 没传染：组 A 的 Fix 1 r2 FAIL 不影响组 B 进展

## Integration（5 fix 全 PASS 后）

Coordinator 在主 worktree 做：
1. 检查 3 worktree 的 commit 状态
2. 合并策略：**单 PR 多 commits**（cherry-pick 3 worktree 各自 commits 到主 worktree 新分支 `claude-fix-batch1-all`）
   - 或：3 个 worktree 分支各自 PR → 用户分开 review（**不选这个**，用户明确说"打包一个 PR"）
3. 集成 QA：在主 worktree 跑一次完整 `npx tsc --noEmit + npx vitest run + npm run lint + npx playwright test`
4. 全绿则 push 分支 `claude-fix-batch1-all` 并 `gh pr create` 给用户
5. PR 描述：5 个 fix 的"用户看到的改变"中文写

## Batch 2（预告，待 PR 合并后启动）

5 个 🔴 完工 + 用户 review PR PASS 后，启动 batch 2 包含 6 个 🟡：
1. AI 评分失败给学生提示（不再默默 0 分）
2. 错误页加返回 CTA（特别 simulation 全屏）
3. 大纲/题库拆入口 + 进度条 + 重试
4. 8 个错误码补中文映射
5. 异步批改加 cron 扫 stuck job
6. dashboard vs 数据洞察完成率口径统一

## Risks 汇总

- ⚠️ Prisma schema 改动是唯一不能并行的同步点（Fix 5 风险）
- ⚠️ 3 dev server 同时跑，AI provider 配额需观察
- ⚠️ Builder/QA 共用 Postgres，测试数据互相影响（每个 fix 都读 teacher1，OK；但 Fix 5 改大纲会动 `Chapter` 表，Fix 2 不读 Chapter 所以隔离）
- ⚠️ Worktree node_modules symlink → 任何 worktree 跑 `npm install` 都会影响其他（**禁止跑 npm install**；改用 `--prefer-offline` 也不需要，除非加新依赖才说）

## 不在 batch 1 范围

- 修复 ai.service.ts 的 ghost-revert（已 stash 在主 worktree，clean state 已恢复）
- review 阶段产出的 untracked 文件（e2e 脚本、screenshots、reports）— 这些保留，单独决定是否进 PR
