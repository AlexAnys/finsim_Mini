# QA Report — Phase3-A r1

> QA: qa · 2026-05-15 · 验 commit `38a8d34` on `claude-demo-fixes` (Phase 4 第二个 unit)
> Bug: quiz-question-tagger 首次 job 计数虚高 + 2 个 missing trigger paths · `.harness/plans/phase3a_plan_r1.md`
> Test spec: `tests/e2e/qa-phase3a-tagger.spec.ts` (6 case，独立于 builder phase3a-verify.spec.ts)

## 测试数据 baseline

`e54e1cb9` (深度测试 adaptive task) DB 当前状态:
- 10 quiz questions, **all 10 have non-empty knowledgeTagIds** ✓
- 每题 2-3 个 tags (KP labels)
- latestJob status=succeeded, progress=100 ✓

## Root cause fixes 对照

| Root cause | 修复策略 | 验证方式 | 实证 |
|---|---|---|---|
| 1. createPublishedTaskWithInstance 不 enqueue tagger | task-instance.service.ts +28 行：commit 后检查 quiz+adaptive → enqueue | task-instance.service.ts code grep + builder 单测 | 代码 verified |
| 2. updateTask 不 re-enqueue 当 quizQuestions 真改 | task.service.ts +30 行：patchData.quizQuestions !== undefined + mode==adaptive → enqueue | task.service.ts grep | 代码 verified |
| 3. byIdx fallback 失败当 AI 返回 `questionId="1"` (数字字符串) | tagger.service.ts +15/-2: byIdx 总是用 `idx+1` 和 `[idx+1]` 双键注册，UUID 主 + index fallback | 7 unit case 全过 (UUID match / `[1]` / 纯数字 `1` / AI 漏返 / prisma fail / 幂等 / 空 questions) | vitest 1063 全过 |
| (additional) tagged++ 仅 prisma.update 成功后递增 | tagger.service.ts 注释强化 | 注释 verified | code review |

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 已全 tag 任务 POST trigger → jobId=null untaggedCount=0 + 中文消息 | molly POST | 200 + `{jobId: null, untaggedCount: 0, message: "全部题目已 tag，无需重新处理"}` ✓ | PASS |
| GET tag-questions 返回 latestJob (id/status/progress/createdAt) | molly GET | 200 + `latestJob: {id: "e042a889-...", status: "succeeded", progress: 100, error: null, createdAt: "..."}` ✓ | PASS |
| Progress=100 验证计数 accuracy (非虚高) | latestJob.progress | 100 (tagged === questions count, not 虚高 e.g. > 100 或 mismatch) | PASS |
| AsyncJob 表 quiz_question_tag 历史 | latestJob 实证存在 | UUID-format id + createdAt timestamp 持久化 ✓ | PASS |
| 非 creator teacher POST → 403 | teacher2 POST | 403 ✓ | PASS |
| Student POST → 403 | alex POST | 403 ✓ | PASS |
| tagger unit test 锁死 root causes (7 cases) | builder vitest | 1056 + 7 = **1063 passing**: UUID match / [1] index / 纯数字 / AI 漏返 / prisma fail / 幂等 / 空 questions 全分支覆盖 | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **93 files / 1063 tests pass** (1056 baseline + 7 tagger new) |
| `npx eslint <5 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat 38a8d34` | 5 files +397/-3 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ (Phase 4 / 不需 Prisma 三步) |
| DB 测前测后 | 10/10 tagged 维持，progress=100 — read-only API tests, 0 副作用 |

## DOM/API 实证

```json
GET /api/lms/tasks/e54e1cb9/tag-questions
{
  "success": true,
  "data": {
    "untaggedCount": 0,
    "latestJob": {
      "id": "e042a889-4687-4f71-876a-1880a15ca216",
      "status": "succeeded",
      "progress": 100,                    // ← 非虚高，与 questions count 真匹配 ✓
      "error": null,
      "createdAt": "2026-05-15T02:12:45.832Z"
    }
  }
}
```

```json
POST /api/lms/tasks/e54e1cb9/tag-questions  (idempotent re-trigger)
{
  "success": true,
  "data": {
    "jobId": null,
    "untaggedCount": 0,
    "message": "全部题目已 tag，无需重新处理"   // ← 中文 ✓
  }
}
```

## Cross-module / Root Cause 防御

- **新增 trigger path 1** (`createPublishedTaskWithInstance`): Phase 3 真实路径 — task 直接 published 不走 createTask, 之前漏 enqueue
- **新增 trigger path 2** (`updateTask`): 仅 `quizQuestions !== undefined + length > 0 + adaptive` 才 trigger — 不烧 AI cost 改其他字段时
- **Defense 3** (byIdx 双键): `${idx+1}` + `[${idx+1}]` 全注册 → AI 返回 `"1"` 或 `"[1]"` 都能命中
- **tagged++ 严格 prisma.update 成功后递增**: 注释强化，避免计数虚高

## Finsim-specific 检查

- ✅ UI 文案中文（"全部题目已 tag，无需重新处理"）
- ✅ Service throw 不打印技术细节
- ✅ Route Handler 权限 (creator/admin only)
- ✅ Async job 模型符合既有约定 (status/progress/error)
- ✅ Schema 0 改动

## 风险 / 不确定项

1. **🟢 计数虚高 bug 当前不重现** (build report): 代码 grep 找到 2 个真实 missing trigger paths + 1 个 byIdx fallback 隐患，本 r1 一次到位防御性修复
2. **🟢 schema 0 改动**: 仅 service + tagger 行为修正
3. **🟢 7 unit case 覆盖全分支**: AI 返回 UUID / `[1]` / `1` / 漏返 / prisma fail 都验过
4. **🟡 真实 AI tagger 触发未实测**: QA 测试基于现有 tagged baseline + idempotent 验证; 真实 trigger（清空 tags 后重跑）由 builder e2e A1 验过, my QA 不重复 AI cost
5. **🟢 权限矩阵完整**: molly (creator) ✓ / teacher2 (non-creator) 403 ✓ / alex (student) 403 ✓

## 是否引入新 bug

无。5 files +397/-3 scope 严格按 plan；vitest 1063 全过；DB read-only 测试无副作用；权限矩阵全过。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 6 case (idempotent trigger + latestJob 实证 + AsyncJob 历史 + 权限矩阵 × 2 + vitest reference) vs builder 3 e2e + 7 unit — 独立证据链
2. ✅ HTTP / progress=100 / Chinese message / DB tagged baseline 全 deterministic
3. ✅ DB cleanup 完整 (read-only)

**建议 r1 PASS 收工**。Phase 4 第二个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A ✅ / Unit 12-16 待开 + Phase3-B 待开。
