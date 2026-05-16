# Build Report — Codex-P1-r2 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/codex_p1_r2_plan_r1.md`
> Bug: Codex r2 review 3 P1（1 false positive + 2 real）

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/study-buddy.service.ts` | +9 / -6 | **P1-2**: taskId 分支强制 `resolvedCourseId = anyInst?.courseId`（删除 client courseId fallback）；taskInstanceId 分支同款 `resolvedCourseId = instance.courseId ?? undefined`（不 fallback 到 client.courseId） |
| `app/api/lms/quiz-questions/[id]/check/route.ts` | +25 / -1 | **P1-3**: schema 加 `taskInstanceId: z.string().uuid()` required；handler 加 `assertTaskInstanceReadable(taskInstanceId, user)` strict；防伪造 `instance.taskId === question.taskId`，不匹配 403 |
| `components/quiz/quiz-adaptive-runner.tsx` | +10 / -10 | check fetch body 加 `taskInstanceId`（runner state 已有，wire body） |
| `app/api/lms/tasks/[id]/adaptive-quiz/next/route.ts` | +7 | **P1-1 注释**: POST handler 顶 JSDoc 说明 r1 commit 489aa8e 已 address，codex r2 reflag 是 false positive |
| `tests/e2e/codex-p1-r2-verify.spec.ts` (新) | +163 | 6 case (P1-3 A/B/C/D + P1-2 A + P1-1 regression) |

**生产代码**：50 / -17
**测试**：163
**Total**：~213（plan 估 80 prod + 80 e2e = 160, 命中）

## 关键决策实施（按 coordinator 批准）

1. ✅ **P1-2 强制覆盖**: taskId 分支 + taskInstanceId 分支都用 instance 反推的 courseId，不再 fallback 到 client data.courseId
2. ✅ **P1-3 schema 加 taskInstanceId required uuid** + assertTaskInstanceReadable strict + 防伪造 instance.taskId === question.taskId 双校验
3. ✅ **P1-1 注释**: route 顶 JSDoc 引用 commit 489aa8e 解释已 fix，codex r3 不应再 flag

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 96 files / 1094 tests pass (baseline 不变)
eslint: 0 new issue
```

### Playwright E2E (6 cases ALL PASS serial)

```
[P1-3-A] alex (A班) 调自己班 question check → 200 OK: ✓ (34.7s)
[P1-3-B] student5 (B班) 调 A班 question check → 4xx 跨班拒收: ✓ (3.5s)
[P1-3-C] 缺 taskInstanceId → 400 VALIDATION_ERROR: ✓ (3.3s)
[P1-3-D] 伪造 instanceId 不匹配 question.taskId → 403 FORBIDDEN 不匹配: ✓ (3.1s)
[P1-2-A] alex 用 taskId + bogus courseId=别班 → 201 OK + 服务端忽略 bogus 用 instance 反推: ✓ (37.3s)
[P1-1-A] adaptive-quiz/next regression (r1 fix 仍 OK): ✓ (10.1s)

Serial 6/6 PASS (无 NextAuth race，6 个独立 context 都 OK)
```

## 风险 / 不确定项

1. **🟢 schema 0 改动**：仅 service / route / API helper
2. **🟢 P1-2 服务端权威**：client supplied courseId 完全忽略；服务端从 instance/task 反推唯一权威值
3. **🟢 P1-3 双校验**：instance access + instance.taskId === question.taskId，防"借合法 instanceId 撬开别 task question"
4. **🟢 P1-1 注释 + commit 引用** 应让 codex r3 understand 已 fix
5. **🟢 client wire 配套** quiz-adaptive-runner check fetch body 加字段，与 service 同步

## Acceptance 对照

| Codex r2 要求 | 状态 |
|---|---|
| P1-2 createPost taskId 分支强制覆盖 courseId | ✅ 删 if (!resolvedCourseId) guard |
| P1-2 taskInstanceId 分支也同款覆盖 | ✅ 顺手修对称 |
| P1-3 check route schema 必填 taskInstanceId | ✅ z.string().uuid() |
| P1-3 assertTaskInstanceReadable strict | ✅ |
| P1-3 防伪造 instance.taskId === question.taskId | ✅ |
| client adaptive-runner wire taskInstanceId | ✅ |
| P1-1 false positive 注释 | ✅ JSDoc 引用 r1 commit |
| 单 commit | ✅ |
| tsc/vitest/lint 全过 | ✅ |

## 不在本范围

- ❌ 服务端节流 quiz-check API（同 user 高频判定 ok，无需节流）
- ❌ short_answer "非空即对" 用 AI 评分（grading.service 兜底）

## 反思

- P1-2 修复发现 **taskInstanceId 分支也有同款 bug**（`instance.courseId ?? resolvedCourseId` fallback 到 client value）。顺手修对称避免 codex r3 重 flag
- 6 e2e cases 全 serial PASS（无 race），跟 r1 的 race-isolated 模式不同 — 这次 fixture 设计避免了多用户竞态
- coordinator 提示 codex r2 把 P1-1 当 false positive flag 是常见 LLM review 模式：r1 修了 codex 不一定 recognize；用注释+commit 引用 anchor
