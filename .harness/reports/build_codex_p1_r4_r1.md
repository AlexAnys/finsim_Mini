# Build Report — Codex-P1-r4 Round 1

> Builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/codex_p1_r4_plan_r1.md`
> Bug source: Codex r4 review 在 commit `c8b3137` 上识别 1 P1 + 1 P2

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `app/api/teacher/study-buddy/posts/route.ts` | +12/-3 | **P1**: filter OR 删除 task-level fallback `{ task: { taskInstances: { some: { courseId } } } }`，保留 `taskInstance.courseId` + `post.courseId` 双 filter，杜绝跨课程 over-match |
| `lib/services/task-build-draft.service.ts` | +21/-8 | **P2**: `markTaskBuildDraftPublished` 改为 conditional atomic update `where: { id, status: "approved" }`；P2025 映射统一 `NOT_APPROVED_FOR_PUBLISH`；增 optional tx 参数让 caller 复用 transaction |
| `lib/services/task-instance.service.ts` | +47/-37 | **P2**: 抽出 `createPublishedTaskWithInstanceInTransaction(tx, ...)` tx-aware 版本；原 wrapper 内部调用之；外部 caller 可在已开启 tx 内复用，避免嵌套 $transaction |
| `app/api/lms/task-instances/with-task/route.ts` | +51/-17 | **P2**: draft 路径走 `prisma.$transaction` — 内部先 reserve draft (conditional flip) → 再 createPublishedTaskWithInstanceInTransaction → 整体 atomic；race loser P2025 → transaction 回滚 → 不创 instance。手工 enqueue tagger job（service wrapper 才有，tx-aware 路径需 caller 自行 enqueue） |
| `tests/task-build-draft-approve.test.ts` | +24/-19 | 3 个 unit test 适配新行为：happy path conditional update / P2025 → NOT_APPROVED / 不存在 → NOT_APPROVED（统一文案） |
| `tests/e2e/codex-p1-r4-verify.spec.ts` (新) | +263 | 3 e2e case (P1-A over-match / P2-A concurrent race / P2-B regression) |
| `playwright.codex-r4.config.ts` (新) | +24 | 专用 config 跑此 spec |

**生产代码**：~131 行（service / route）
**测试**：263 (e2e) + 24 (unit 改) = 287
**Total**: ~418

## 关键决策

### P1: 删 task-level fallback OR

原 filter:
```ts
OR: [
  { taskInstance: { courseId: { in: courseIds } } },
  { task: { taskInstances: { some: { courseId: { in: courseIds } } } } }, // ← over-match 源
  { courseId: { in: courseIds } },
],
```

新 filter:
```ts
OR: [
  { taskInstance: { courseId: { in: courseIds } } }, // task-bound 直读 instance.courseId
  { courseId: { in: courseIds } },                    // free-form 或 Unit 6 反推
],
```

**安全性论证**: 
- Unit 6 之后 createPost service r2+r3 强制反推 `resolvedCourseId` 持久化，所有新 task-bound post 都有 `courseId IS NOT NULL`
- Unit 6 之前老 task-bound post 都有 `taskInstanceId IS NOT NULL`（task-bound 必经 instance 上下文），第 1 条 `taskInstance.courseId` filter 覆盖
- DB 实测：5 个 SB post，3 个 Unit 6 后有 courseId，2 个 Unit 6 前 courseId=null 但有 taskInstanceId → 全覆盖

### P2: 真原子化（嵌套 tx 重构 vs 轻量 compensating）

选了 **真原子化方案** —— 抽出 tx-aware `createPublishedTaskWithInstanceInTransaction(tx, ...)`，route 在 `prisma.$transaction` 内先 `markTaskBuildDraftPublished(draftId, tx)` reserve → 再 `createPublishedTaskWithInstanceInTransaction(tx, ...)`。`where: { id, status: "approved" }` 的 conditional update 让 status 转换 DB 层 atomic。

race loser 抛 P2025 → service 包装为 `TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH` → transaction 整体回滚 → instance 不会持久化（彻底原子）。

为什么不用轻量 compensating：
- 极端 case（step 2 crash + 回滚也失败）会留孤立残留
- 嵌套 tx 重构只 ~30 行（拆出函数 + wrapper），比 compensating 更干净

**手工 enqueue tagger job 的代价**: tx-aware 路径不带 wrapper 的 enqueue 副作用，route.ts 路径需重复一段 enqueue 逻辑（已加注释 +`needsTaggerJob` 标记）。无 draft 路径仍走 wrapper（含 enqueue）保持兼容。

### unit test 行为变化

原 `markTaskBuildDraftPublished` 区分 `NOT_FOUND` vs `NOT_APPROVED_FOR_PUBLISH`。新版本两者统一 `NOT_APPROVED_FOR_PUBLISH`：
- 因为 conditional update `where: { id, status: "approved" }` 在 DB 层无法区分"id 不存在 vs status 不匹配"，都抛 P2025
- 业务语义上 race loser 也应该得到 NOT_APPROVED（draft 已被另一请求 flip）
- 调用方（route）行为不变 — 都返回 4xx + 中文错误

## 自测结果

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests PASS (baseline 不变；3 个 unit test 适配新实现仍 PASS)
eslint: 0 new issue
playwright codex-r4: 3/3 PASS
```

### Playwright e2e 详情

```
[P1-A] teacher2 不应在 SB 管理页看到 teacher1 课程的 post (over-match 已修) ✓ (8.2s)
  - SQL fixture: task X + teacher1's courseA + teacher2's courseB 各 instance + alex post on instance_a
  - teacher2 GET 管理页 → posts 数组中无该 postId (实测 teacher2 sees 0 posts; not leaked)
  - 反证 teacher1 GET → 看得到该 postId (positive coverage)
  - DB cleanup ✓

[P2-A] 并发 publish 同 draftId → 1 个 201 + 1 个 4xx + DB 只 1 个 instance ✓ (4.7s)
  - SQL fixture: approved draft + chapter/section
  - Promise.all 2 POST → statuses=[201, 400]
  - 400 body code=TASK_BUILD_DRAFT_NOT_APPROVED_FOR_PUBLISH
  - DB count: 1 task + 1 instance + draft status='published' (race loser 整 tx 回滚，无残留)
  - cleanup ✓

[P2-B] 单 publish flow 仍正常工作（regression） ✓ (4.0s)
  - SQL fixture: approved draft (无 chapter/section)
  - 单 POST → 201, draft status='published'
  - cleanup ✓
```

## 风险 / 不确定项

1. **🟢 schema 0 改动** — 纯 application 层重构
2. **🟢 1094 vitest 全过** — 无回归
3. **🟢 tx-aware 重构 caller 范围窄**: `createPublishedTaskWithInstance` 只 1 个 caller (with-task/route)，重构面可控
4. **🟢 over-match fix 不会丢可见性**: Unit 6 前/后所有 task-bound post 都有 taskInstanceId 或 courseId，第 1+2 条 filter 全覆盖
5. **🟡 同样的 over-match pattern 存在于 `app/api/lms/study-buddy/analytics/route.ts:33`** — 该 route 在 analytics 入口，已经 `assertCourseAccess(courseId, ...)` 锁单 courseId，over-match 影响小但仍存在；本 PR 没修，**留 follow-up**（Codex 也没提）
6. **🟢 enqueue tagger job 手工重复 in route**: 必要代价（避免嵌套 tx），加了注释 + 不阻塞 try/catch；无 draft 路径仍走 wrapper 保持兼容

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| P1 修 over-match | ✅ P1-A e2e: teacher2 sees 0 posts, teacher1 sees post |
| P2 原子化 publish | ✅ P2-A: 1 win 1 lose, DB 只 1 task+instance |
| P2 不破坏单 publish | ✅ P2-B regression PASS |
| 单 commit | ✅ 准备就绪 |
| tsc / vitest / lint 全过 | ✅ 1094 PASS / 0 new lint |
| DB cleanup deterministic | ✅ 3 case 都 try/finally 清 fixture |

## 不在本范围

- ❌ analytics route 同样的 over-match — Codex 没提，留 follow-up
- ❌ 长链路 e2e (UI 入口走 wizard publish) — 直接 API + SQL fixture 更稳定 deterministic

## 反思

1. **首次破事故**: 用 Write 重写 service file 截断 200 行内容（未 Read 完整文件就写）。立刻 `git checkout HEAD -- file` 恢复 + 改用 Python in-place replace。**lesson**: 大文件不用 Write 全替换，用 Edit 或 Python 精准替换。
2. **e2e SQL fixture 复杂度**: SubjectiveConfig.id / updatedAt 没默认值（Prisma 应用层生成）→ INSERT 需手填 `gen_random_uuid()` + `NOW()`。**lesson**: 走 raw SQL fixture 时要看 schema constraint，不能只看 Prisma model。
3. **真原子化 vs 轻量 compensating**: 选真原子，因为 30 行重构成本 vs 极端 case 孤立残留风险，前者更干净。
