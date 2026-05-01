# Analytics V2 Phase 6 QA - AI Workbench + AiRun

Date: 2026-05-01
Branch: `codex/analytics-diagnosis-v2`
Scope: AI 工作助手异步化、可编辑结果、AiRun wrapper 保持接入。

## Implementation Notes

- `/api/ai/work-assistant` no longer performs document extraction + AI generation synchronously in the request.
- Uploads are saved through the existing storage provider, then an `ai_work_assistant` `AsyncJob` is created.
- `AsyncJob` runner now handles `ai_work_assistant` jobs through `runAiWorkAssistantJob`.
- Workbench processing still uses the unified document ingestion layer, so PDF/DOCX/TXT/ZIP/image status remains consistent.
- AI calls continue through `aiGenerateJSON`, so existing `AiRun` logging captures provider/model/prompt hash/status/latency.
- The teacher page now polls job status, shows progress/failure, and renders a teacher-editable result with copy/reset actions.

## Automated Checks

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npx vitest run tests/ai-tool-settings.test.ts tests/course-knowledge-source.service.test.ts` passed.

## Real App QA

Account: `teacher1@finsim.edu.cn / password123`

Flow:

1. Opened `http://localhost:3030/login`.
2. Logged in as teacher and opened `/teacher/ai-assistant`.
3. Selected default `教案完善`.
4. Pasted sample lesson content:
   - 课程：个人理财基础
   - 教学目标：预算、储蓄、风险与收益
   - 课堂活动：比较三种储蓄方案
5. Added teacher requirement: language should be more oral and include classroom questions.
6. Clicked `开始分析`.

Observed:

- Page submitted immediately and created a background job.
- Result card showed job status and then `已完成`.
- Because local MiMo key is not configured in this environment, the AI call produced the expected fallback result instead of blocking the page.
- UI displayed `AI fallback`, editable title/summary/sections/action items/cautions, and the specific provider error: `AI_PROVIDER_NOT_CONFIGURED: mimo`.
- The result area no longer overlaps with the tool cards in the tested desktop viewport.

## Residual Risk

- Real successful AI output still needs a smoke test after valid MiMo env vars are present.
- File upload path was not re-tested in this phase because OCR/document ingestion was covered in earlier phases; the async workbench now calls the same shared ingestion service.
