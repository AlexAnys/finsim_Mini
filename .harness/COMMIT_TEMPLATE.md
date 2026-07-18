# Harness commit message template

> Use this for any commit touching `.harness/` or `.claude/agents/` or `.claude/settings.json`.
>
> Why: infra changes are hard to evaluate. Writing the verification metric **at commit time** lets
> future self audit "which harness rule actually paid off" instead of arguing from feel.

## Template

```
chore(harness): <one-line summary>

What changed:
- <file>: <bullet>
- <file>: <bullet>

Why (evidence):
- <link to audit doc / progress.tsv row / report path>
- <observation that motivated this change>

Verification in N weeks:
- Metric: <quantifiable; e.g. progress.tsv last-10 median short_desc length>
- Baseline today: <number / sample>
- Target: <number / outcome>
- Where to look: <file path / command>

If verification fails:
- <fallback path; e.g. write a new lesson, revisit prompt wording>

Conforms to STYLE.md: yes | N/A
# yes = 本 commit 触及 blackboard 内容 (.harness/*.md, *.tsv, reports/) 且已按 STYLE.md 两条原则审核 (写前 grep 已有 + 归位)
# N/A = 本 commit 不触及 blackboard 内容 (仅 .claude/ 配置 / scripts/ / 模板文件)

Refs: <harness-design vX.Y commit | evidence/YYYY-MM-DD_*.md>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## When N/A applies

- Pure bug fix in `scripts/` (verify by re-running)
- Cosmetic rename (no semantic change)

Everything else: fill all sections. If you can't write a verify metric, the change probably isn't worth committing yet.
