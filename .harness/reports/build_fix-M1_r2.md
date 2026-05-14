# Build Report — Fix M1 r2 (ready+empty outline guard)

**Builder**: claude opus 4.7 (1M context, worktree finsim-wt-molly-be)
**Branch**: `claude-fix-molly-backend`
**Commit**: `9cfdf8d fix(course-knowledge-source): guard against ready+empty outline (M1 r2)`
**Trigger**: team-lead 反馈 edge case — partial parse 后 schema.parse 返回 chapters=[] 时 r1 会标 status=ready，老师拿到空目录。

## Root cause (r1 遗漏)

`tryRepairTruncatedJSON` 修复后 JSON.parse 成功 → outlineDraftSchema 用 zod
的 `.default([])` 把缺字段填回空数组 → `aiGenerateJSON` 返回合法 schema 对象
但 chapters 长度 0 → `processCourseKnowledgeSource` 不区分 "AI 拿回真实 outline"
和 "AI 拿回空骨架"，统一写 status=ready。

实际影响：老师面板看到 source `ready`，但点开「编辑课程目录草稿」是空的；
更糟的是「重新 AI 解析」按钮只在 retryable status 显示（ready 不显示），
老师卡在死路上。

r1 跑 Molly 真实 source 之所以没暴露，是因为那次 token=16384 + Molly 5163 字
extract 实际 AI 一次成功，没走 partial parse 路径。Edge case 只在 AI 第一次
吐截断 JSON 触发 repair 后才显现。

## Fix strategy

只动 `processCourseKnowledgeSource` 业务层（不动 ai.service.ts 通用层 —
"empty 算不算成功"是业务定义，不是 JSON parse 责任）。

把 try/catch 重构成显式 firstError + firstOutline 状态变量：

```
1. firstOutline = await runOutlineAi(compact=false)        // throw 时 firstError 接住
2. if firstOutline && chapters.length > 0  → ready (走 r1 happy path)
3. else (throw 了 || chapters===0):
   a. retried = await runOutlineAi(compact=true)
   b. if retried.chapters.length > 0  → ready (走 r1 compact retry path)
   c. else (retry 也空):
      - 有 firstError → aiError = "课程大纲解析暂不可用：" + firstError.message（保留 JSON 截断 detail）
      - firstError===null（两次都空）→ aiError = "课程大纲解析暂不可用：AI 未能从素材中提取出章节结构，请检查素材内容或重试。"
   d. retried 自己 throw → aiError = "课程大纲解析暂不可用：" + retryErr.message
```

抽 `runOutlineAi(compact, parserTag)` helper 消除两份重复 aiGenerateJSON 配置。

## Changes

2 files, +165 / -30:

### 1. `lib/services/course-knowledge-source.service.ts`
- syllabus 分支重构（见上）
- helper `runOutlineAi(compact, parserTag)` 私有内联 closure
- 全部路径都过 `chapters.length > 0` 守门

### 2. `tests/fix-m1-outline-json-resilience.test.ts`
- 既有 "第一次 outline 使用 16384 maxOutputTokens" 用例：mock chapters 改成非空
  数组（否则被新 guard 触发 retry，违反"第一次成功"语义）
- 新增 3 用例：
  - 第一次 outline 解出 chapters=[] → 走 compact retry（断言 calls=3, parser
    tag=syllabus-outline-compact-retry, 最终 ready + structuredData 指向 retry 结果）
  - 两次都空 → ai_summary_failed + 中文 "AI 未能" 文案
  - 第一次 throw + retry 空 → ai_summary_failed + 原 SyntaxError "Expected"
    message 透传（不是静态文案）

## Verification

```
$ npx tsc --noEmit       # 0 errors
$ npx vitest run tests/fix-m1-outline-json-resilience.test.ts
Test Files  1 passed (1)
Tests       14 passed (14)
$ npx vitest run         # 全测
Test Files  83 passed (83)
Tests       980 passed (980)   (r1 977 → r2 +3)
```

## Anti-regression

- r1 的 11 用例继续 PASS（含 "第一次 outline 使用 16384" 在 mock 更新后语义不变）
- course-knowledge-source.service.test.ts（9） PASS
- fix-8-retry-knowledge-source.test.ts（9） PASS
- ai-provider / pr-mimo-reasoning-param / fix-3-chat-streaming 全 PASS
- 不动 ai.service.ts tryRepairTruncatedJSON 函数 — 它的契约（修复尽量多的合法
  JSON 前缀，让 caller 决定是否够用）正确，问题只在业务层没用好

## Files touched

- `lib/services/course-knowledge-source.service.ts` (r1 r2 累计 +203 / -50)
- `tests/fix-m1-outline-json-resilience.test.ts` (r1 r2 累计 +362, new file)

r1 的 `lib/services/ai.service.ts` 不需要再改。

## Dynamic exit

r2 PASS — 单 commit 完成 edge case guard，单测覆盖三条新路径，全测过。

## Handoff (continued)

发给 team-lead + qa-molly-be 双方 update。QA 之前如果已经基于 r1 commit
06a297d 跑了，现在需要锁到 r2 commit 9cfdf8d 重跑：
- `git show 9cfdf8d --stat` 单 commit
- `npx vitest run tests/fix-m1-outline-json-resilience.test.ts`（14 PASS）
- 核心场景验证仍可用 Molly source 778e76c6 重解
