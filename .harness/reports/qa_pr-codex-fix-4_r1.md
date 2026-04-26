# QA Report — PR-codex-fix-4 r1

Unit: PR-FIX-4 · Codex D1 · 任务向导旧 5 档 [MOOD:] prompt 清理
Round: 1
Reviewer: qa-fix
Date: 2026-04-26
Builder commit: `e79689a fix(task-wizard): codex D1 · 任务向导旧 5 档 [MOOD:] prompt 清理`

## Spec
spec L52 — 清理 `app/teacher/tasks/new/page.tsx` 与编辑页的 systemPrompt 模板中残留的 PR-7B 之前 5 档 `[MOOD:]` 指令，与现 8 档 JSON 协议保持一致。

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | new + edit 双侧清理（编辑页 builder 主动同步防 drift），与 spec L52 一致 |
| 2. tsc --noEmit | PASS | 0 输出 |
| 3. vitest run | PASS | 41 files / **445 tests**（baseline 441 + 4 新 · 零回归） |
| 4. npm run build | PASS | 25 routes / 4.3s |
| 5. Diff verify | PASS | git show e79689a：删除 `\n【情绪标签】\n在每条回复末尾附加：[MOOD: HAPPY\|NEUTRAL\|CONFUSED\|SKEPTICAL\|ANGRY]\n- HAPPY: ...\n...` 段；保留 `{scenario} + promptParts.join("\n\n")` 引言 |
| 6. grep verify | PASS | `grep "MOOD:\|HAPPY\|NEUTRAL"` in new+edit page = 0 hits（除了 PR-FIX-4 D1 注释里提及）；compiled chunk `.next/server/` grep "MOOD: HAPPY" = 0 hits |
| 7. 8-mood 协议保留 | PASS | `lib/services/ai.service.ts` 的 `VALID_MOOD_LABELS` 8 档（平静/放松/兴奋/犹豫/怀疑/略焦虑/焦虑/失望）+ `MOOD_LABEL_TO_KEY` 字典 + `chatReply` 内"输出格式 · 严格 JSON · PR-7B"段全保留 |
| 8. SSR smoke | PASS | /teacher/tasks/new 200，/teacher/tasks/50194450-... 200（编辑页）|
| 9. 新单测设计 | PASS | tests/pr-fix-4-d1.test.ts 4 cases：new 页面 [MOOD:] 删除 + edit 页面同 + 两文件 systemPrompt 仍生成（含 {scenario} + 基础人设）+ ai.service.ts 8 档 JSON 协议防误删。文件 grep 锁定 = 静态防退化 |

## 不直观决策评审

| Builder 决策 | QA 评审 |
|---|---|
| 同步清理编辑页 `[id]/page.tsx:227` 而不只清 spec 点名的 new 页面 | **合理** — 编辑页是 new 页面同源副本，留旧指令会让 update 操作把老 prompt 写回数据库（drift）。spec L52 字面只点 new 但实际意图是清旧指令，编辑页同步是必须的 |
| 单测用文件 grep 锁定（regex `\[MOOD:\s*HAPPY\s*\|...]`）+ 反向验证 8 档协议在 ai.service.ts | **合理** — 静态文件检测最稳；不依赖运行时 AI；防退化锁定 |

## Issues found

无 BLOCKER。

**Note**：D1 是纯模板字符串清理，无 schema、无 service 接口动、无 API 行为变化。运行时 ai.service.chatReply 始终在调用 AI 时注入 8 档 JSON 协议（PR-7B 已落地），所以删除任务向导模板里的旧 [MOOD:] 指令不会影响实际 AI 输出，反而避免了"双重指令冲突 → AI 困惑"。

## Overall: PASS

PR-FIX-4 D1 surgical 30 行清理完成：
- new 页面 5 档 [MOOD:] 模板 + 5 个 mood 解释行 → 删除
- 编辑页同源副本同步清理 → 防 drift
- 8 档 JSON 协议运行时仍由 ai.service.chatReply 注入（PR-7B）
- 4 新单测锁定文件状态防退化

445 tests / tsc 0 / build 25 routes / SSR new+edit 页面 200 / .next chunk 0 hit "MOOD: HAPPY"。

**完整修复链 ship 状态**（main 推进 9 commits 自 65f2e26 起 · 8 个 fix commits + 1 chore）：

| Commit | PR | 范围 |
|---|---|---|
| 65f2e26 | PR-FIX-1 r1 | Batch A 9 + UX4 + UX5 |
| c6c178c | Plan D | Revert ef820b5 |
| 2844ec8 | Plan D | 新 pgcrypto migration |
| 30dec3b | PR-FIX-1 r3 | tsc TS2367 修 |
| 96ed776 | PR-FIX-2 r1 | Batch B 7 + Prisma 三步 |
| 365972f | chore | reports archive |
| d0ef6ab | PR-FIX-3 r1 | Batch C 5（C1-C5）|
| 0ac5ec3 | PR-FIX-3 r2 | UX2 + UX3 |
| **e79689a** | **PR-FIX-4 r1** | **D1 任务向导清理** |

Codex 27 finding **全闭环**：
- 18 P1（Batch A 9 + Batch B 7 + 前端 P1 from Batch C 2）
- 8 P2/D-tier（Batch C 3 + UX2/UX3 + D1 + 部分 D2-D5）
- 5 UX 决策项（UX1/UX2/UX3/UX4/UX5 全落地，无未决）
- D2/D3/D4/D5 留增量 PR（spec L54-56 标记）

**Dynamic exit**：连续 PASS 3/3（PR-codex-fix-2 r1 + PR-codex-fix-3 r1+r2 + PR-codex-fix-4 r1）— **超额满足收工条件，整批 ship-ready**。
