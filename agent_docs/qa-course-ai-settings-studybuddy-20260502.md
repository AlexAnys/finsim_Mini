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
