# QA: Analytics V2 Phase 2 OCR

Date: 2026-05-01

## Scope

- Added Qwen/DashScope OCR as the preferred OCR provider.
- Added scanned-PDF page rendering through `pdftoppm`.
- Kept MiMo OCR as an explicit fallback when `OCR_PROVIDER=mimo`.
- Added environment and Docker runtime configuration for OCR.

## Checks

- `which pdftoppm` -> `/opt/homebrew/bin/pdftoppm`
- `npm run typecheck` -> passed
- `npx vitest run tests/document-ingestion.test.ts tests/course-knowledge-source.service.test.ts` -> passed, 11 tests

## Notes

- Real Qwen OCR calls require local `QWEN_API_KEY`; no key was committed.
- Missing OCR key now returns `ocr_required` with a provider-specific message instead of a generic parse failure.
- Text PDF extraction remains the first path; OCR is only attempted when PDF text is not readable.
