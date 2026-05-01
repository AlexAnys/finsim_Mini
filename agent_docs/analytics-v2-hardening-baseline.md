# Analytics V2 Hardening Baseline

Date: 2026-05-01
Branch: `codex/analytics-diagnosis-v2`
Baseline commit: `c8853a3 Split AI tool settings and fix workbench layout`

## Current Capability Matrix

| Area | Current state | Gap to close |
| --- | --- | --- |
| Text PDF ingestion | `pdf-parse` extracts selectable text. | Scanned/image-only PDF still returns `ocr_required`. |
| DOCX ingestion | `mammoth` extracts raw text. | No async progress or retry. |
| TXT/MD ingestion | UTF-8 text extraction. | No encoding fallback. |
| ZIP ingestion | Processes up to 30 child documents. | Nested ZIP skipped; OCR failures only bubble as warnings. |
| Image OCR | MiMo image call exists. | OCR priority should move to Qwen/Bailian; status needs provider-specific error. |
| Course knowledge source | Course/chapter/section scoped, processed synchronously. | Needs task/taskInstance scope and async processing. |
| Task creation | Atomic publish endpoint avoids partial task/template state. | Needs draft-in-section workflow while AI/PDF is processing. |
| Submission grading | Submission route calls grading service in request path. | Needs async job queue, visible grading progress, retry. |
| AI settings | Tool-level settings exist; simulation chat/grading split. | Need AiRun logs and full wrapper usage. |
| AI workbench | Four teacher tools exist. | Needs async execution, editable result workflow, saved outputs. |
| Analytics V2 | Deterministic scope API/UI exists. | Needs data quality flags, abnormal value hints, async recompute. |
| Study Buddy context | Task/course filters exist and knowledge sources are included by scope. | Needs task/taskInstance source priority and visible citation list. |

## Existing Important Safeguards

- File downloads require auth and resource access checks.
- Task discussion and Study Buddy posts check task/taskInstance readability.
- Student submissions no longer accept client-provided evaluation payloads.
- Task wizard publishes through a single transactional `with-task` endpoint.
- Course knowledge source scope currently validates course/chapter/section consistency.

## Implementation Checkpoints

- Do not commit real Qwen/MiMo API keys.
- Keep old `/teacher/analytics` unchanged.
- Prefer service-layer business logic; route handlers stay thin.
- After schema changes run Prisma migrate/generate and restart the dev server before final validation.
- Every phase should add a short QA note under `agent_docs/qa-analytics-v2-<phase>.md`.
