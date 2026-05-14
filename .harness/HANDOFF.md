# HANDOFF

> 会话结束前由 coordinator 更新本文件。SessionStart hook 自动显示。
> 项目历史在 `git log` + `gh pr view <num>`（PR 描述含用户视角），不需要在这里复述。

## 当前状态（2026-05-14）

- ✅ **无未完成工作**：3 个 PR（#8 batch1 + #10 batch2 + #11 molly）全部 merge 到 main `98017c8`
- ✅ Review 报告里 11+4=15 个议题全部修完
- ✅ Molly@qq.com 密码已恢复原 hash

## 持续保留的知识（git log 找不到）

- **Pre-existing pdfjs-dist webpack ESM bug**：dev mode only，PR #10 通过 `serverExternalPackages` 兜底。生产 Docker build 不受影响。如未来加新文档解析依赖（pdf-parse / mammoth / jszip / xlsx 之类）记得加进 `next.config.ts` 的 serverExternalPackages
- **Playwright + chromium 已装**：缓存 `~/Library/Caches/ms-playwright`。复用的 e2e 配置：`playwright.review.config.ts`（review 用）+ `tests/e2e/review-*.spec.ts` 脚手架（untracked，复用方便）
- **Postgres docker 容器名**：`acc4fef29d82_finsim-postgres`，端口 5432，DB 名 `finsim`
- **Molly@qq.com 密码临时恢复脚本**：`.harness/restore-molly-password.sh`（如果未来 E2E 要改 molly 密码测试，可参考这个模式做其他账号的临时密码）
- **MiMo API 退化历史**：`reasoning_effort:"none"` 现已被 MiMo API 拒（400）；正确路径是 fetch interceptor 注入 `chat_template_kwargs:{enable_thinking:false}`（已实施于 `lib/services/ai.service.ts`）
- **Worktree node_modules symlink + Turbopack 不兼容**：跨 worktree 跑 dev server 时用 `npm run dev -- --webpack` 模式

## 下次会话快速 onboarding

1. SessionStart hook 自动显示：最近 15 commits + 最近 5 PR + progress.tsv tail + 本文件
2. 想看某 PR 用户视角细节：`gh pr view <num>`
3. 30 条 review 总结：`.harness/reports/review_summary_r1.md`
4. 项目宪法（CLAUDE.md）已自动加载

## 历史归档（按时间倒序）

| 文件 | 内容 |
|---|---|
| `HANDOFF-2026-05-pre-cleanup-archive.md` | 562 行的旧 HANDOFF（review + batch1+2 + molly fixes 全程详记） |
| `spec-batch2-archive.md` | Batch 2 计划（6 🟡） |
| `spec-batch1-archive.md` | Batch 1 计划（5 🔴） |
| `spec-review-2026-05-13-archive.md` | 全项目 review 计划 |
| `spec-insights-phase{1-9}-archive.md` | 数据洞察重构 9 阶段计划（2026-05 之前的工作） |
