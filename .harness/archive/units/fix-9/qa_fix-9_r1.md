# QA Report — Fix 9 错误码中文映射 (r1) — PASS

**QA**: claude opus 4.7 (worktree Z, qa-errdata)
**Date**: 2026-05-13
**Branch**: `claude-fix-batch2-error-data-polish`
**Commit under test**: `d8ff071 fix(api-utils): map 8 unmapped service error codes to Chinese 4xx responses`
**Result**: ✅ PASS r1（按 dynamic exit r1 PASS 即收工）

## 1. 单 commit 锁定

`git show d8ff071 --stat`：
- `lib/api-utils.ts` +16 / -0
- `tests/api-utils-error-i18n.test.ts` +104 / -0（新建文件）

无 schema 改动，无 service interface 改动，单文件单测试一一对应。

## 2. 服务层抛出点核对（grep 实证）

每个错误码在 `lib/services/` 真有 `throw new Error("CODE")` 处：

| 错误码 | service 行 |
|---|---|
| `MISSING_SIMULATION_DATA` | `grading.service.ts:183` ✓ |
| `MISSING_QUIZ_DATA` | `grading.service.ts:242` ✓ |
| `MISSING_SUBJECTIVE_DATA` | `grading.service.ts:439` ✓ |
| `TASK_BUILD_DRAFT_NOT_FOUND` | `task-build-draft.service.ts:{81,106,152}` + `question-bank.service.ts:369` ✓ |
| `TASK_BUILD_DRAFT_SCOPE_MISMATCH` | `question-bank.service.ts:370` ✓ |
| `NO_POSTS_TO_SUMMARIZE` | `study-buddy.service.ts:248` ✓ |
| `WORK_ASSISTANT_EMPTY_INPUT` | `ai-work-assistant.service.ts:113` ✓ |
| `AI_PROVIDER_NOT_FOUND` | `ai-tool-settings.service.ts:222` ✓ |

builder 报告的 service `:222` 行位置与原 spec `:213` 略有偏差，实测 grep 为准 — 仍是同函数 `upsertAiToolSetting`，对 Fix 9 无影响。

## 3. 代码 review（read-only）

`lib/api-utils.ts` 8 个 case 加在合理分组旁：
- grading 数据缺失 3 个 → 紧邻 `SUBMISSION_RETRY_NOT_ALLOWED`（grading 系列）
- task-build-draft 2 个 → 紧邻 `TASK_SCOPE_MISMATCH`（task 系列）
- AI 3 个 → 紧邻 `AI_PROVIDER_NOT_CONFIGURED`（AI 系列）
- study-buddy / work-assistant → 紧邻 `NO_CONCEPT_TAGS`（聚合 AI 业务系列）

404 类调用 `notFound()` helper（response code 统一 `NOT_FOUND`，跟现有 `COURSE_NOT_FOUND`、`SUBMISSION_NOT_FOUND` 一致），400 类直接 `error("CODE", "msg", 400)` 保留原 code 给前端做精细化。

测试用 `it.each` 表驱动 8 个 + 1 个 default fallback + 2 个 anti-regression，断言 status / response code / message contains / 中文字符（`/[一-鿿]/`）。

## 4. Static checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx vitest run` | **78 files / 933 tests passed**（baseline 922 + 11 新 case = 933 ✓） |
| `npx vitest run tests/api-utils-error-i18n.test.ts` | 11 / 11 passed（87ms 完成） |
| `npm run lint` | 0 error / 3 pre-existing warning（quiz/sim/subjective runner useCallback，与 Fix 9 无关） |

`falls back to 500` test 内 stderr `Service error: Error: THIS_CODE_DOES_NOT_EXIST` 是 `console.error` 故意打印（api-utils.ts default case 中），非测试失败。

## 5. 端到端验证策略

不需 Playwright：

1. **测试 vs route 等价性**：所有受影响 route handler 用 `try { ... } catch (err) { return handleServiceError(err); }` 标准模式（spot-check：`/api/ai/tool-settings PATCH route.ts:54`、`/api/ai/work-assistant route.ts:60` 验证 unchanged）。测试直接调 `handleServiceError(new Error(code))` 等价于路由经 catch 时的行为。
2. **响应 shape 完整断言**：测试断言 `response.status` + `body.success` + `body.error.code` + `body.error.message`（含 contains 子串 + 中文字符），即前端拿到的 JSON 完整 shape。
3. **API server live 检查**：dev server 3003 上 `curl /api/lms/task-instances/<bad-uuid>` → 401（未登录），证明 API 路由仍透过 `handleServiceError`，未被本 commit 破坏。

可选 E2E（spec 未要求）：构造合法 sim submission 但 simulationConfig=null → grading endpoint 应返回 400 + 中文「无法批改：缺少模拟对话数据，请联系老师」；本 QA 因 acceptance 标准已 covered 不展开。

## 6. Anti-regression（CLAUDE.md + spec line 192-195）

- ✅ `FORBIDDEN` → 403 不变（test 显式 assert）
- ✅ `COURSE_NOT_FOUND` → 404 + "课程不存在" 不变（test 显式 assert）
- ✅ default 500 INTERNAL_ERROR fallback 保留（test 显式 assert）
- ✅ `AI_PROVIDER_NOT_CONFIGURED` 旧映射（500 + response code `AI_NOT_CONFIGURED`）未动；与新增 `AI_PROVIDER_NOT_FOUND`（404 + response code `AI_PROVIDER_NOT_FOUND`）是两个不同错误码，无冲突
- ✅ batch 1 Fix 4 PATCH `/api/ai/tool-settings` 行为不变：service 层 provider Zod 已先拦截 invalid value（`route.ts:16` enum）→ 实际 `AI_PROVIDER_NOT_FOUND` service throw 只发生于 service 直接调用方（如内部 helper），不破坏 batch 1 真值切换 qwen/qwen-plus 路径
- ✅ vitest baseline 922 / Fix 9 后 933，11 新 case + 0 原 case 失败 → 全套现有 case 行为不变
- ✅ Fix 7 commit `d251a1e` 未被 Fix 9 改动碰到（两者文件域不重叠）

## 7. Conclusion

**Fix 9 r1 PASS**，5 项 acceptance + 6 项 anti-regression 全通过；tsc/vitest/lint 全绿；8 个错误码服务层 throw 实证 + 测试映射断言一一对应。Dynamic exit：r1 PASS 收工，不跑 r2。
