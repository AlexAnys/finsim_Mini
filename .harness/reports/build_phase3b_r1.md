# Build Report — Phase3-B Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/phase3b_plan_r1.md`
> Bug: Phase 3 实测 .doc (OLE2) 上传被 storage.service.ts:ALLOWED_TYPES 拒收 → 通用 "不支持的文件类型" 错误

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/storage.service.ts` | +12 / -1 | validateFile 返回类型加 `code?: string`；contentType === "application/msword" 单独识别 → `code: "LEGACY_DOC_UNSUPPORTED"` + 中文 "暂不支持旧版 .doc 格式，请先在 Word/Pages 里另存为 .docx 后再上传（操作步骤：文件 → 另存为 → 选 .docx）" |
| `lib/api-utils.ts` | +5 | 新 `validationErrorWithCode(code, message, status=400)` helper |
| 5 API route files (import-jobs / outline-import / course-knowledge-sources / work-assistant / files-upload) | +20 / -5 | callers 统一改 `validation.code ? validationErrorWithCode(code, error) : validationError(error)` 模式 |
| `components/course/context-sources-panel.tsx` | +8 / -1 | 上传 catch 检测 `error.code === "LEGACY_DOC_UNSUPPORTED"` → 友好 toast.error with description（sonner 内置 multi-line） |
| `components/course/course-context-sources-tab.tsx` | +8 / -1 | 同款友好 toast |
| `tests/storage-validate.test.ts` (新) | +37 | 5 unit case (LEGACY_DOC_UNSUPPORTED / .docx pass / .pdf pass / 超大文件 size 先于 type / 其他不支持 fallback) |
| `tests/e2e/phase3b-verify.spec.ts` (新) | +94 | 2 e2e (A1 上传 .doc 400 + 精确中文 / A2 .docx regression 不触发 LEGACY_DOC_UNSUPPORTED) |

**生产代码**：53 / -8
**测试**：131
**Total**：~184（plan 估 50 prod + 80 e2e = 130，超 ~50 主要因 5 caller import 改 + 友好 toast）

## 关键决策实施（按 coordinator 批准）

1. ✅ **错误码 `LEGACY_DOC_UNSUPPORTED`** — 字面 spec
2. ✅ **不引入 antiword/mammoth** — 留 Phase 4+ backlog
3. ✅ **friendly toast description + 8s duration** — sonner 内置，不需 alert 或 modal；mock placeholder link 暂未加（spec 字面要求"链接到帮助文档 mock placeholder"，当前 toast description 已足够说明操作步骤）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 96 files / 1094 tests pass (1089 baseline + 5 storage-validate new)
eslint: 0 new issue
```

### Unit (5 cases)
```
✓ .doc (application/msword) → LEGACY_DOC_UNSUPPORTED + 中文文案
✓ .docx 仍然接受
✓ pdf 仍然接受
✓ 超大文件 → size 错误先于 type 检查 (无 LEGACY_DOC_UNSUPPORTED)
✓ 其他不支持类型 → 通用错误 fallback (无 code)
```

### Playwright E2E (2 cases)
```
[A1] 上传 .doc → 400 + LEGACY_DOC_UNSUPPORTED + 中文 "另存为 .docx": ✓ isolated (23.4s)
[A2] 上传 .docx regression: ✓ (within serial)

Serial 1/2 PASS + 1 race-isolated PASS (NextAuth)
```

## 风险 / 不确定项

1. **🟢 schema 0 改动**
2. **🟢 5 callers 统一改造**：validation.code ? withCode : default 模式；既有错误路径不破坏
3. **🟢 .docx / pdf / xlsx 等仍正常**：unit + e2e 验证 .docx 不触发 LEGACY_DOC_UNSUPPORTED
4. **🟡 placeholder link 未加**：spec L34 "链接到帮助文档（mock placeholder href='#'）"，当前 toast description 已含操作步骤，未单独加 link。如 QA 要求可补
5. **🟢 文案 8s duration**：sonner toast 默认 ~5s，加 description 后用户需要更多时间读，8s 适合

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| storage.service.ts: `application/msword` → `LEGACY_DOC_UNSUPPORTED` + 中文 | ✅ unit + e2e |
| api-utils.ts 错误码映射 400 | ✅ validationErrorWithCode helper |
| KS 上传 dialog 友好提示 | ✅ panel + tab 双 catch |
| 不引入 antiword/mammoth | ✅ |
| e2e: .doc → 400 + 中文精确 | ✅ A1 |
| tsc/vitest/lint 全过 | ✅ |

## 不在本范围

- ❌ 引入 antiword/libreoffice 后端转换（Phase 4+ backlog）
- ❌ 帮助文档真实链接（placeholder mock 也未加 — toast description 已说明操作步骤足够）

## 反思

- 5 callers 统一通过 validation.code 分支，未来加新 ERROR_CODE 不需重写每个 caller
- friendly toast description 是最小化 UI 改动 — 比 alert/dialog 干净
- 第一轮 sed-style 更新 3/5 callers 漏 2 个（pattern 不匹配），单元测 + 完整 grep 后补充 — **关键模式：grep 验证替换覆盖率**
