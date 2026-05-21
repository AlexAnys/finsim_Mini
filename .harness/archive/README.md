# Archive

Trigger-based archiving — 写新内容时同步收拾旧的。所有归档文件进 git，保留 diff 能力。

## 归档规则

| 主文件 | 触发 | 阈值 | 归档到 | 谁执行 |
|---|---|---|---|---|
| `../HANDOFF.md` | coordinator update 前 | >8KB 或 >2 个 session 段 | `handoff/{YYYY-MM}.md`（追加） | coordinator prompt |
| `../progress.tsv` | qa append 后 | >30 行 | `progress.tsv`（追加） | `../scripts/prune.sh` |
| `../reports/` | unit 整体 r2+ PASS 且 commit 非 `-` | unit 收工 | `units/{unit}/` | `../scripts/prune.sh` |
| `../lessons.md` | coordinator append 新条目前 | status: superseded 或 6 月未复发 | `lessons-archive.md` | coordinator prompt |

## 文件作用

- `progress.tsv` — 老 progress 行累积，单文件追加式。schema 与主文件同。
- `lessons-archive.md` — superseded/deprecated lessons 移入。保留原 L-NNN 编号。
- `handoff/{YYYY-MM}.md` — 按月聚合的老 session handoff 段。
- `units/{unit}/` — 已收工 unit 的 build/qa 报告。
- `manifest.tsv` — 总索引：何时何 unit 因何 commit 被归到何处。

## 触发命令

```bash
# 手动归档
bash .harness/scripts/prune.sh

# 自动（建议）：.claude/settings.json PostToolUse hook
```

## 不归档什么

- spec.md / spec-*-archive.md（spec 自己有归档命名约定）
- SESSION_LOG_*.md（已是历史档案）
- PROJECT_AUDIT.md / CODEX_DEEP_REVIEW.md（一次性产物）

## Verify

每月用户手动 spot-check：抽 3 行 `archive/progress.tsv` + 3 个 `units/` 目录，确认归档内容可独立理解（即"归档不等于丢失上下文"）。
