# Spec — Codebase Quality Review (2026-05-15)

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户，结果立刻写进 `.harness/spec.md` + commit。

> Coordinator: claude (main agent) · Team: `codebase-review` · 7 个独立 reviewer 并行
> Branch: main（read-only review，不改代码）
> 时间预算：用户授权 ~6 小时深度 review
> 输出语言：reports 中文；架构词汇用 LANGUAGE.md 英文术语（Deep/Shallow/Seam/Adapter/Locality/Leverage）

## 用户意图（原话）

> "开启 agent teams 帮我完整 review 下这个 codebase 的质量，尤其是最近的更新，并包含还没有合并的 PR。深度，你有 6 个小时来深度 review。我很久没有 review 了，尤其是关于代码质量和 structure。"

补充确认（2026-05-15 conversation）：
1. **PR #13 只 review，不 rebase**（另一个 session 在 rebase）
2. CONTEXT.md / ADR 由 coordinator 决定 → **lazy 创建**（在后续 grilling 阶段如某候选确实需要给概念命名时再补）
3. 加 explorer-security + coordinator 决定其他有帮助的角度

## 范围（7 个独立 reviewer 并行）

每个 reviewer 用 general-purpose agent（有 Read/Grep/Bash/Write 全工具），独立工作（不互相沟通），产出一份 `.harness/reports/review_{name}_r1.md`。

| # | Reviewer name | 视角 | 主要文件区 |
|---|---|---|---|
| 1 | review-arch | 整体三层架构 + 模块深度 | `app/api/`、`lib/services/`、`components/`、`lib/api-utils.ts`、`lib/auth/` |
| 2 | review-recent | PR #12 合并的 12 unit 新增模块 | chapter slot / structuredData / IRT 引擎 / SB excerpt / TaskBuildDraft 状态机 / AiRun / hiddenAt / taskSnapshot 等 |
| 3 | review-pr13 | PR #13 56 files / +5234 行独立 review | `git diff main...claude-instance-workbench-fixes` |
| 4 | review-test | 测试覆盖 + testability | `tests/`、可测性分析（哪些 service 单测打不进） |
| 5 | review-security | auth / authorization / IDOR / 数据隔离 / 上传 / XSS | `lib/auth/`、所有 route handler、`storage.service.ts`、Prisma scope |
| 6 | review-data | Prisma schema + migrations + 查询模式 | `prisma/schema.prisma`、`prisma/migrations/`、`lib/db/`、include 树 + N+1 |
| 7 | review-ai | AI 主线（provider 抽象 + simulation/evaluation/SB/TaskBuildDraft/IRT） | `lib/ai/`、`lib/services/{simulation,grading,study-buddy,task-build-draft,weekly-insight,quiz-adaptive,quiz-question-tagger}.service.ts`、`components/*/runner.tsx` |

## Acceptance criteria

1. ✅ 7 份 `.harness/reports/review_{name}_r1.md` 全部产出
2. ✅ 每份报告格式遵守 [Report Format](#report-format)（下文）
3. ✅ coordinator 综合 7 份后输出**编号候选清单**给用户（每候选含 Files / Problem / Why-it-bites / Suggested-direction / Tests-improvement，**不含实现代码**）
4. ✅ candidates 使用 LANGUAGE.md 词汇（Deep/Shallow/Seam/Adapter/Locality/Leverage/Deletion-test）
5. ✅ candidates 应用 deletion test（删掉这个模块复杂度是消失还是分散到 N 个 caller？）
6. ✅ 用户选择候选 → 进 grilling loop（不写代码）

## Report Format（每个 reviewer 必须遵守）

```markdown
# Review — {scope name} (r1)

## Reviewer charter
[1-2 sentences: 你在 review 什么，scope 边界]

## Method
[读了哪些文件 / 跑了哪些 grep / Bash 命令 — 让 coordinator 能追溯]

## Top findings（按 severity 排序）

### F-{N}: {一句话标题} — Severity: P0/P1/P2

- **Files**: `path/a.ts` (lines X-Y), `path/b.ts`
- **Problem**: 用 LANGUAGE.md 词汇描述（Shallow / no-seam / leaky-abstraction / bad-locality 等）
- **Why-it-bites**: 这个问题在现实中怎么咬人 — 具体场景，不是抽象担心
- **Deletion test**: 删除这个模块会怎样？复杂度消失还是分散？
- **Suggested direction**: 一句话方向（**不写代码、不指定函数签名**）
- **Tests would improve**: 修了之后哪些测试会变好（interface = test surface）

### F-{N+1}: ...
[继续按 severity 排序，每份报告 ≥5 个 finding，可多]

## Anti-findings（看起来像但不是问题）
[对照 finsim 现状澄清的"假阳性"，比如某模式看起来 shallow 但有合理理由]

## Cross-cutting hunches
[本 reviewer 怀疑跨 scope 的问题，给其他 reviewer / coordinator 参考]
```

## 不在 review 范围（明确排除）

- 演示数据正确性（molly 真实数据已建好，HANDOFF 已交付）
- 中文 UI 文案细节（除非整片 hard-coded 中文常量集中度等架构问题）
- 部署 / docker / nginx（属 ops，不在 codebase quality）
- 已 archive 的旧 spec（spec-batch1/batch2/insights-phase1/2/3-archive.md）

## 风险登记

- **scope 巨大**：366 ts/tsx + 24 migration + 5234 行未合并 diff — 每 reviewer 必须 ruthless prioritize（top 5-10 findings 而非 50 个 nit-pick）
- **PR #13 rebase 风险**：base 是 PR #11 的 `98017c8`，PR #12 (f2365b7) merge 后未 rebase — review-pr13 必须标注「合到 main 后哪些文件会和 PR #12 的改动冲突」
- **过度建议风险**：reviewer 容易给"理想架构"建议而忽视 finsim 现实约束（Demo 优先 / 教学项目 / 教师用户少）— spec 强制 deletion test 来过滤
- **审查疲劳**：6 小时预算够铺开但容易稀释 — coordinator 综合阶段必须按 severity 砍到 top candidates

## Coordinator 综合输出格式

7 份 report 收齐后，coordinator 输出给用户：

```
# Codebase Review — Numbered Candidates

候选 #1: {标题}
  - Files: ...
  - Problem (Shallow/no-seam/etc): ...
  - Why-it-bites: ...
  - Suggested direction (1 句话): ...
  - Tests would improve: ...
  - Coordinator note: 跨 reviewer 的交叉信号

候选 #2: ...
...

剔除清单（applied deletion test 后被砍）:
  - {finding A}: 删除后复杂度只会移到 1 个 caller → 不算 shallow，pass
  - ...
```

用户挑候选 → grilling loop。

## 工作流（每个 reviewer 严格遵守）

1. **入场必读**：CLAUDE.md（全文）+ HANDOFF.md（项目交付状态）+ 本 spec
2. **不互相沟通**：reviewer 之间不要 SendMessage 协调 — 独立观察才有价值
3. **完成后**：TaskUpdate 标 completed + SendMessage coordinator 1 句话 summary
4. **写报告地址**：`.harness/reports/review_{name}_r1.md`（绝对路径）
5. **时间预算**：每 reviewer 约 1 小时深度，覆盖 5-10 个 top findings；不要追求 50 个 nit-pick
