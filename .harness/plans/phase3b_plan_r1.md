# Phase3-B Plan — .doc OLE2 上传友好提示

## 改动

| 文件 | 改动 |
|---|---|
| `lib/services/storage.service.ts` | `validateFile` 在通用 `不支持的文件类型` 之前先 check `contentType === "application/msword"` → 返回 `{valid:false, error: "暂不支持旧版 .doc 格式，请先在 Word/Pages 里另存为 .docx 后再上传（操作步骤：文件 → 另存为 → 选 .docx）", code: "LEGACY_DOC_UNSUPPORTED"}`；返回 type 扩 optional `code` 字段 |
| `lib/api-utils.ts` | 新增 `validationErrorWithCode(code, message, status=400)` helper 或扩 `validationError` 接受 code；callers (5 处) 改 `validation.code ? validationErrorWithCode(validation.code, validation.error) : validationError(validation.error)` |
| `components/course/context-sources-panel.tsx:135` | catch `json.error?.code === "LEGACY_DOC_UNSUPPORTED"` → `toast.error(json.error.message, { description: "查看帮助文档", action: {label: "查看", href: "#"} })` (richer toast) 或 `alert()` 也可；当前 sonner `toast.error` 已支持 description |
| `tests/storage-validate.test.ts` (新) | unit: validateFile(`application/msword`) 返回 `LEGACY_DOC_UNSUPPORTED` + 中文文案精确 |
| `tests/e2e/phase3b-verify.spec.ts` (新) | e2e: POST /api/lms/course-knowledge-sources 用 .doc mock (Content-Type `application/msword`) → 400 + body `error.code === "LEGACY_DOC_UNSUPPORTED"` + message 含 "另存为 .docx" |

## 决策

- **错误码命名 `LEGACY_DOC_UNSUPPORTED`** — coordinator 字面要求
- **不引入 antiword/mammoth 依赖** — 留 backlog
- **callers 5 处**：course-knowledge-sources / outline-import / import-jobs / work-assistant / files-upload，全用统一 helper
- **friendly toast 不强求 link**：当前 sonner `toast.error(msg, {description: "..."})` 即可；mock placeholder href="#" 不真用

## 风险

- 🟢 schema 0 改动
- 🟢 callers 改 5 处但都是同款 `validation.code ? withCode : default`
- 🟢 既有 .docx / .pdf 上传路径不变

预计 ~50 prod + ~80 e2e / r1 即收概率高。
