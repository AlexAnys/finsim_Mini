# Course AI Settings / Context / Study Buddy QA - 2026-05-02

## Scope

Branch/worktree: `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim` on local `main`.

This pass covered:

- AI setting resolution for Simulation chat/grading.
- Course outline upload as course-level knowledge context.
- Unified material ingestion for course context / AI assistant / task draft.
- Task draft progress display and reopen flow.
- Course analytics abnormal score handling.
- Study Buddy preview permissions and course-level Study Buddy analytics.
- Simulation speech-to-text entry point.

## Implementation Notes

- `AiToolSetting` now stores `provider`; AI calls resolve by `course/task owner settings > environment defaults`.
- Simulation settings are split into `simulationChat` and `simulationGrading`; legacy `simulation` rows are still read as fallback.
- `AiRun` records effective `provider`, `model`, `toolKey`, and `settingsUserId` for each AI call.
- `CourseKnowledgeSource` now has `sourceType`, `tags`, and `structuredData`; course outline uploads use `sourceType=syllabus`.
- Course outline parsing creates an AI directory draft only; it does not automatically overwrite chapters/sections.
- Study Buddy preview posts are marked `isPreview=true` and excluded from formal student analytics.
- Course analytics now uses normalized scores and data quality flags; abnormal raw scores are not included in normal averages.

## Real App QA

### Course Outline Upload

- Opened `/teacher/courses/e6fc049c-756f-4442-86da-35a6cdbadd6e`.
- Used the hero action `上传大纲`.
- Uploaded a text outline sample: `/tmp/lingxi-course-outline.txt`.
- Result: upload succeeded, course context tab shows the file as `可用`, `课程大纲`, tags `课程大纲 / 课程结构`.
- Result: AI generated a structured outline draft with 3 chapters.

### Task Draft Reopen

- Clicked a draft card under course structure.
- Result: task wizard reopened with the original course/chapter/section/slot and draft data loaded.
- Draft cards now show status/progress/error fields when linked job data exists.

### Course Analytics

- Opened the course `数据分析` tab.
- Previous abnormal `均分 14698858` is gone.
- Current UI shows normalized average `58 /100`, plus chapter/section diagnostic rows.
- Abnormal score values are flagged and excluded from normal KPI averages.

### Study Buddy Preview

- Opened Simulation preview: `/sim/2e700d5e-fa7e-4f13-b000-03f660414b89?preview=true`.
- Submitted a teacher preview Study Buddy question.
- Result: `POST /api/study-buddy/posts` returned `201 Created`.
- Result: no permission error.
- Result: database row has `isPreview=true`.
- Result: AI reply was generated successfully for the preview question.

### Study Buddy Analytics

- Called `/api/lms/study-buddy/analytics?courseId=940bbe23-6172-40bf-bc7f-b22a1840a1de`.
- Result: response returned deterministic grouped statistics.
- Preview question is not included in official Study Buddy statistics.

### Simulation AI Settings

- Initial teacher setting selected `mimo / mimo-v2.5-pro`.
- With token-plan config, AI call recorded effective provider/model as `mimo / mimo-v2.5-pro` but failed with invalid key.
- With MiMo OpenAI endpoint config, the call reached MiMo but failed with `Insufficient account balance`.
- Switched the current teacher's Simulation chat/grading settings to `qwen / qwen3-max` for local QA continuity.
- Re-tested Simulation preview conversation.
- Result: `/api/ai/chat` returned `200 OK`.
- Result: page showed a customer reply.
- Result: latest `AiRun` recorded `toolKey=simulationChat`, `provider=qwen`, `model=qwen3-max`, `status=succeeded`.

### Speech-to-Text Entry

- Simulation input now shows a `语音` button.
- The button uses browser speech recognition when available and only fills the input box.
- Cloud STT adapter endpoint exists at `/api/ai/speech-to-text`, but cloud provider capability still needs a funded/valid audio provider before full server-side STT can be verified.

## Environment Notes

- Local `.env` was updated for MiMo/OpenAI-compatible smoke tests and is intentionally not committed.
- MiMo service reached the provider, but the account currently cannot complete chat due to insufficient balance.
- Qwen remains usable for local AI QA.

## Verification Commands

- `npx prisma generate` passed.
- `npx prisma db push` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npx vitest run` passed: 66 files, 782 tests.
- `npm run build` passed. Turbopack emitted one existing NFT trace warning around dynamic filesystem tracing from `document-ingestion.service.ts`, but compilation, TypeScript, and route generation completed successfully.

## Follow-up QA: MiMo Token Plan, Material Management, STT

Date: 2026-05-03 Asia/Shanghai.

### MiMo Token Plan

- Updated local-only `.env` to use the MiMo token-plan key and `https://token-plan-cn.xiaomimimo.com/v1`.
- Direct smoke test against `/chat/completions` with `mimo-v2.5-pro` returned HTTP 200.
- Re-tested Simulation preview conversation from `/sim/2e700d5e-fa7e-4f13-b000-03f660414b89?preview=true`.
- Result: page generated a customer reply.
- Result: latest `AiRun` recorded `toolKey=simulationChat`, `provider=mimo`, `model=mimo-v2.5-pro`, `status=succeeded`.

### Course Material Management

- Opened `/teacher/courses/e6fc049c-756f-4442-86da-35a6cdbadd6e`, switched to `教学上下文`.
- Result: material cards expose `查看解析` and `删除`.
- Opened `个人理财-课程标准-编码表.xls`.
- Result: detail dialog shows status/type/tags, AI summary, concept tags, structured course outline draft, objectives/knowledge points, task suggestions, and extracted text preview.
- Opened `编辑课程`.
- Result: dialog includes `AI 解析大纲管理`, listing syllabus/Excel sources and AI directory draft counts without overwriting the live course structure.

### Speech-to-Text

- Confirmed Simulation input exposes `语音` / `停止` / `识别中` states.
- Tested `/api/ai/speech-to-text` with an authenticated request and a valid silent WAV payload.
- Result: request reached MiMo `mimo-v2-omni`; the provider returned a prompt echo for silence.
- Fix added: prompt echoes and empty audio outputs are normalized to an empty transcription with a clear fallback message, so invalid output is not inserted into the input box.

### Verification Commands

- `npx vitest run tests/ai-provider.test.ts tests/ai-tool-settings.test.ts` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
