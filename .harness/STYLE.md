# Blackboard Writing Style

> 每个 `.harness/` 文件最终会被未来的 Claude 自己读。token 即下次 context 成本。
> 这份文件给出**冗余判定原则**和**归位规则**，不设字符硬限。

## 两条核心原则

### 原则 1: 写前 grep — "这个事实是否已在其他文件存在?"

- 已在 `reports/{unit}_r{N}.md` → **引用路径**, 不复制细节
- 已在 `spec.md` acceptance criteria → 写 verdict (PASS/FAIL) + 偏离点, 不抄整条
- 已在 git log commit message → 引用 commit-sha, 不复制描述

冗余的本质是**跨文件复制**, 不是写太多。

### 原则 2: 归位 — "这个事实是哪个文件的职责?"

| 内容类型 | 归属文件 |
|---|---|
| Unit verdict + 关键数字快照 (tests/routes 数) + commit-sha | `progress.tsv` |
| 每步验证细节 / case 矩阵 / 接口响应 / 截图引用 | `reports/qa_*.md` |
| 架构决策 / hybrid 方案选择 / "为什么这样做" | `spec.md` 或 `lessons.md` (看是否将来防坑用) |
| Session 净 delivery 摘要 / 给下一 session 的下一步 | `HANDOFF.md` |
| 失败 → 根因 → 检测 → 预防 → commit-sha | `lessons.md` |

错位 = 冗余。

## Schema 不删

所有结构化字段保留:

- `progress.tsv` 7 列: `timestamp / unit / round / verdict / cost_usd / description / git_commit`
- `lessons.md` 5 字段 per L-NNN: `Symptom / Root cause / Detection / Prevention / Commit`
- QA report 8 个 check 表格 schema 不变

**N/A 行例外**: QA report 表格里的 N/A 行允许省略 (写 N/A 是没信息的反向信号)。

## 实证: 一行真实的冗余拆解

`progress.tsv` 2026-04-26T03:33:02Z 的 `pr-codex-fix-2 r1 PASS` 行, 1500+ 字节短描述实拆:

| 片段 | 状态 |
|---|---|
| `Batch B 7 条全闭环` | 独有 ✓ |
| `Prisma 三步真验证(migration 20260426112144 + _taskInstanceId_key UNIQUE + dev server PID 重启 + /login 200 ...)` | 复制 `reports/qa_pr-codex-fix-2_r1.md` ✗ |
| `B5 真 curl 3 cases (snapshots 21→400 / 20→201 / allocations 21→400)` | 复制 reports ✗ |
| `B6 真 AI 闭环 (graded sim sub → AI 真返回 commonIssues+highlights...)` | 复制 reports ✗ |
| `415 tests(+19 新+9 改); tsc 0; build 25 routes` | 独有: 状态快照 ✓ |
| `hybrid 第 3 决策 schema 不动正确 (UX1 SET NULL vs spec 字面 Cascade)` | 错位 → 应在 lessons.md 或 spec.md ✗ |

精简版 (独有 + 必要 ≈ 120 字符):

```
Batch B 7 条 PASS / 415 tests +19/+9 改 / migration 20260426112144 SET NULL / 详见 reports/qa_pr-codex-fix-2_r1.md
```

## Verify

不设硬指标。每月用户手动 spot-check:

1. 抽 `progress.tsv` 末 10 行, 随机选 3 行, 问"这行短描述里, 几句能在对应 reports/{unit}.md 里 grep 到?"
   - 命中率 < 30% = 改进生效
   - 命中率 ≥ 50% = 原则没贯彻, 回 `.harness/lessons.md` 写一条 + 调 agent prompt
2. 抽 `HANDOFF.md` 一个 session 摘要, 问"几段是 spec.md / progress.tsv 已有的复制?"

`scripts/prune.sh` 内含 lint: last 10 行 `description` 字段 > 500 字符则 WARN (不阻塞, 仅提示可能冗余)。

## 哲学

精简的目的是**未来回顾时获取必要信息更省力**, 不是少写字。

一行 300 字但全是独有事实 > 一行 80 字但 grep 不到关键 commit-sha。
