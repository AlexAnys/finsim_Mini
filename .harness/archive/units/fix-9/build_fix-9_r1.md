# Build Report — Fix 9 错误码中文映射 (r1)

**Builder**: claude opus 4.7 (worktree Z)
**Branch**: `claude-fix-batch2-error-data-polish`
**Commit**: `d8ff071 fix(api-utils): map 8 unmapped service error codes to Chinese 4xx responses`

## Problem (recap)

Source: Stream E `review_quality_r1.md` 🔴 R2。
8 个 service-layer 抛出的错误码在 `lib/api-utils.ts` `handleServiceError` 没 case，全部走 default → 500 INTERNAL_ERROR "服务器内部错误"。学生看到模糊英文/中文 5xx，无法行动。

确认 8 个错误码在 service 层抛出（`grep -rn` 验证）：
- `MISSING_SIMULATION_DATA` → `lib/services/grading.service.ts:183`
- `MISSING_QUIZ_DATA` → `lib/services/grading.service.ts:242`
- `MISSING_SUBJECTIVE_DATA` → `lib/services/grading.service.ts:439`
- `TASK_BUILD_DRAFT_NOT_FOUND` → `lib/services/task-build-draft.service.ts:{81,106,152}` + `question-bank.service.ts:369`
- `TASK_BUILD_DRAFT_SCOPE_MISMATCH` → `lib/services/question-bank.service.ts:370`
- `NO_POSTS_TO_SUMMARIZE` → `lib/services/study-buddy.service.ts:248`
- `WORK_ASSISTANT_EMPTY_INPUT` → `lib/services/ai-work-assistant.service.ts:113`
- `AI_PROVIDER_NOT_FOUND` → `lib/services/ai-tool-settings.service.ts:222`

## Changes

2 files, +120 / 0：

### 1. `lib/api-utils.ts` — 加 8 个 case (+16 lines)

| 错误码 | HTTP | message |
|---|---|---|
| `MISSING_SIMULATION_DATA` | 400 | "无法批改：缺少模拟对话数据，请联系老师" |
| `MISSING_QUIZ_DATA` | 400 | "无法批改：缺少测验作答数据，请联系老师" |
| `MISSING_SUBJECTIVE_DATA` | 400 | "无法批改：缺少主观题作答数据，请联系老师" |
| `TASK_BUILD_DRAFT_NOT_FOUND` | 404 | "任务草稿不存在" (response code = NOT_FOUND, 跟现有 helper 约定一致) |
| `TASK_BUILD_DRAFT_SCOPE_MISMATCH` | 400 | "任务草稿不属于当前课程" |
| `NO_POSTS_TO_SUMMARIZE` | 400 | "暂无可总结的讨论帖，先发布一些再试" |
| `WORK_ASSISTANT_EMPTY_INPUT` | 400 | "请输入需要 AI 协助的内容" |
| `AI_PROVIDER_NOT_FOUND` | 404 | "AI 服务商未配置" |

新 case 插入到现有逻辑分组旁边（grading 数据放 SUBMISSION 附近、task-build-draft 放 task 系列附近、AI 系列放 AI 一起），保持代码可读。

### 2. `tests/api-utils-error-i18n.test.ts` — 新建测试 (+104 lines)

- 11 个 test：8 个新映射 case + 1 个 default fallback (`THIS_CODE_DOES_NOT_EXIST` → 500) + 2 个 anti-regression（FORBIDDEN → 403、COURSE_NOT_FOUND → 404）
- 用 `it.each` 表驱动，避免重复
- 中文 assertion：`/[一-鿿]/.test(message)` 保证 message 含中文字符（防止英文 fallback 回归）

## Anti-regression

- ✅ 现有所有 case 行为不变（FORBIDDEN / COURSE_NOT_FOUND 测试覆盖）
- ✅ default 500 fallback 保留（unknown code test 覆盖）
- ✅ `AI_PROVIDER_NOT_CONFIGURED` 旧映射（500 + AI_NOT_CONFIGURED）未动；`AI_PROVIDER_NOT_FOUND` 是不同错误码（404 + AI_PROVIDER_NOT_FOUND）
- ✅ `getAIProviderError` AI provider runtime error 处理路径未动

## Verification

- `npx tsc --noEmit` ：0 错（清理 `.next/dev/types/` stale cache 后）
- `npx vitest run tests/api-utils-error-i18n.test.ts` ：11 / 11 通过
- `npx vitest run` ：78 files / 933 tests 全过（比 Fix 7 时多 1 test file + 11 tests，即本次新增）

## Acceptance Coverage

1. 每个错误码 ≥1 个 test case 触发并断言中文 message + 正确状态码 ✓
2. 前端拿到的 error.message 是中文，不是 "Internal Server Error" ✓ (通过 `/[一-鿿]/` 测试断言)
3. 不破坏现有错误码映射 ✓ (FORBIDDEN / COURSE_NOT_FOUND 回归测试)
4. tsc 0 / vitest 全过 ✓
5. Commit message 符合 spec 模板 ✓

## Notes for QA

- 不需要 Playwright 实测（单元层错误码映射已 covered by 表驱动测试）
- 如需端到端验证某条 case，最容易的：构造一个 sim submission 但 simulationConfig=null，调 `/api/lms/submissions/{id}/grade` 应该看到 400 + 中文 "无法批改：缺少模拟对话数据"

## Next

继续 Fix 11（dashboard 完成率 tooltip + analytics-v2 tooltip）。
