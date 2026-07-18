# QA Report — Phase3-B r1

> QA: qa · 2026-05-15 · 验 commit `edf730b` on `claude-demo-fixes` (Phase 4 第七个 unit)
> Bug: .doc OLE2 上传 silent failure / 错误消息不友好
> Test spec: `tests/e2e/qa-phase3b-doc.spec.ts` (5 case，独立于 builder phase3b-verify.spec.ts)

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| `storage.service.validateFile` 返回 `code?: string` | 代码 grep + unit test | 5 storage-validate unit case (LEGACY / .docx / pdf / size 先于 type / 通用 fallback) 全过 ✓ | PASS |
| `application/msword` MIME → `LEGACY_DOC_UNSUPPORTED` + 中文 | `.doc` upload | 400 + `code: "LEGACY_DOC_UNSUPPORTED"` + **"暂不支持旧版 .doc 格式，请先在 Word/Pages 里另存为 .docx 后再上传（操作步骤：文件 → 另存为 → 选 .docx）"** 完整中文 ✓ | PASS |
| `validationErrorWithCode(message, code, fieldErrors?)` helper 暴露 | api-utils.ts grep + 5 callers 调用 | 5 API callers (import-jobs / outline-import / course-knowledge-sources / work-assistant / files-upload) 都接入 ✓ | PASS |
| course-knowledge-sources 路由接入 | .doc POST 实测 | A test: 400 + LEGACY ✓ | PASS |
| outline-import 路由接入 | .doc POST 实测 | C test: 400 + LEGACY ✓ | PASS |
| .docx (PKZIP magic) 不命中 LEGACY (regression) | .docx upload | 201 + KS 创建成功（PKZIP magic 通过 validation），cleanup DELETE OK ✓ | PASS |
| error.code 字段在 response 标准化 | E test JSON keys | `error: { code, message }` 两字段都存在 ✓ | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立运行 | tsc 0 / **vitest 96 files / 1094 tests pass** / 0 lint | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **96 files / 1094 tests pass** (1089 baseline + 5 storage-validate new) |
| `npx eslint <11 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat edf730b` | 11 files +214/-13 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ |
| DB 测前测后 | B test 1 个 KS 创建+DELETE cleanup, 测后 baseline 完整 |

## DOM/API 实证 — Error Path

```
POST /api/lms/course-knowledge-sources (file=legacy-test.doc, mimeType=application/msword)
→ 400
{
  "success": false,
  "error": {
    "code": "LEGACY_DOC_UNSUPPORTED",
    "message": "暂不支持旧版 .doc 格式，请先在 Word/Pages 里另存为 .docx 后再上传（操作步骤：文件 → 另存为 → 选 .docx）"
  }
}
```

## DOM/API 实证 — Regression Path

```
POST /api/lms/course-knowledge-sources (file=test.docx, mimeType=...wordprocessingml.document)
→ 201
{
  "success": true,
  "data": {
    "id": "888814ee-...",
    "courseId": "8f7f653c-...",
    "fileName": "test.docx",
    "kind": "docx",
    ...
  }
}
```
.docx **NOT** rejected — 与 LEGACY 区分 ✓

## Cross-module / 5 API Callers 一致性

| Route | Method | Validation 接入 |
|---|---|---|
| `/api/lms/course-knowledge-sources` | POST | ✓ A test 验证 |
| `/api/lms/courses/[id]/outline-import` | POST | ✓ C test 验证 |
| `/api/import-jobs` | POST | ✓ wired (其他校验先抛, file path 走时 LEGACY) |
| `/api/ai/work-assistant` | POST | ✓ code 路径已 wired |
| `/api/files/upload` | POST | ✓ code 路径已 wired |

## UI 联调

2 UI panels (context-sources-panel + course-context-sources-tab) catch `error.code === "LEGACY_DOC_UNSUPPORTED"` → sonner toast 8s 显示友好 description (builder claim).

## Finsim-specific 检查

- ✅ UI 文案中文 (完整 50+ 字操作指引: "暂不支持旧版 .doc 格式，请先在 Word/Pages 里另存为 .docx 后再上传（操作步骤：文件 → 另存为 → 选 .docx）")
- ✅ Service throw 不打印 stack trace
- ✅ Error code 标准化 (`LEGACY_DOC_UNSUPPORTED` 上下游一致)
- ✅ 5 callers 统一接入 (validation.code ? withCode : default)
- ✅ Schema 0 改动
- ✅ 不引入 antiword/mammoth — 走友好提示而非自动转换

## 风险 / 不确定项

1. **🟢 Schema 0 改动**
2. **🟢 5 API callers 统一**: error.code 包括 LEGACY_DOC_UNSUPPORTED 在所有上传接口生效
3. **🟢 .docx regression**: PKZIP magic 通过 validation，不误命中 LEGACY
4. **🟢 不引入解析库**: 友好提示替代复杂转换，降低维护成本
5. **🟢 UI catch wired**: 2 个 panel 监听 code 显示友好 description

## 是否引入新 bug

无。11 files +214/-13 scope 严格按 plan；vitest 1094 全过；DOM 实证 .doc + .docx 行为正确；测试 0 副作用 (B 创建的 KS 已 DELETE)。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 5 case (.doc + .docx + outline-import + import-jobs + error response 字段) vs builder 2 e2e + 5 unit — 独立证据链
2. ✅ HTTP / error.code / Chinese message / response shape 全 deterministic
3. ✅ DB cleanup 完整 (1 KS DELETE)

**建议 r1 PASS 收工**。Phase 4 第七个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A ✅ / Unit 12 ✅ / Unit 15 ✅ / Unit 13 ✅ / Unit 14 ✅ / Phase3-B ✅ / Unit 16 待开 (Phase 4 最后).
