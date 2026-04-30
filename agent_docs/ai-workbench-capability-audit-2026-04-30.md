# AI Workbench Capability Audit - 2026-04-30

## Scope

Branch: `codex/analytics-diagnosis-v2`

This audit records the baseline capabilities for the AI workbench, course material ingestion, and OCR path before completing the implementation.

## Capability Matrix

| Capability | Current implementation | Result |
| --- | --- | --- |
| Text PDF extraction | `pdf-parse` extracts embedded text | Supported |
| Scanned PDF OCR | No PDF page renderer is installed, so scanned PDFs cannot be OCRed page by page yet | Returns `ocr_required` with explicit provider/setup guidance |
| Image OCR | MiMo multimodal adapter is available through `mimo-v2-omni` when `MIMO_API_KEY` is configured | Provider-dependent |
| DOCX extraction | `mammoth` extracts raw text | Supported |
| TXT/MD extraction | UTF-8 text decode | Supported |
| ZIP batch extraction | `jszip` iterates supported nested documents and combines results | Supported |
| Search/research | No search provider key is configured in this project | Provider slot only; UI must not claim live web research without config |
| AI JSON generation | Existing `aiGenerateJSON` now accepts teacher tool settings | Supported |
| Teacher model settings | `AiToolSetting` stores per-tool model, thinking, style, search, and prompt suffix | Supported |

## OCR Notes

The previous failure mode labeled every extraction failure as OCR failure. The new ingestion layer separates:

- `extracting`: file text extraction is running.
- `ocr_required`: file is likely scanned/image-only or OCR provider is unavailable.
- `ocr_processing`: reserved for asynchronous OCR providers.
- `ai_summary_failed`: text was extracted, but AI summarization failed.
- `ready`: extracted and summarized successfully.
- `failed`: unrecoverable ingestion error.

## Model Choices

Teacher-friendly labels in the UI map to these MiMo models:

- High quality: `mimo-v2.5-pro`
- Balanced: `mimo-v2.5`
- Fast: `mimo-v2-flash`
- Multimodal recognition: `mimo-v2-omni`

Thinking is disabled by default and can be enabled only for deeper teacher tools.
