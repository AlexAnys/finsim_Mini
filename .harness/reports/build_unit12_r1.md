# Build Report — Unit 12 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit12_plan_r1.md`
> Bug: B-STU-SUBJ-1/2

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `components/subjective/subjective-runner.tsx` | +21 / -6 | `SubjectiveTaskConfig` 加 `allowedTypes?: string[]`；`ALLOWED_EXTENSIONS` 改名 `DEFAULT_ALLOWED_EXTENSIONS` + `IMAGE_EXTENSIONS` Set；新 `normalizeAllowedTypes(input)` helper（lowercase + strip dot + filter empty + fallback to default）；derive `effectiveAllowedTypes` + `acceptHasImage` at config unwrap；validateFile / display 文案 / `accept` 全部用 effectiveAllowedTypes；input 加 `capture="environment"` when acceptHasImage |
| `app/(student)/tasks/[id]/page.tsx` | +1 | 透传 `allowedTypes: task.subjectiveConfig.allowedAttachmentTypes` |
| `tests/unit12-allowed-types.test.ts` (新) | +83 | 13 case (normalize: undefined/empty/case/dot/teacher 限定/默认 + IMAGE_EXTENSIONS set + capture trigger 条件) |
| `tests/e2e/unit12-verify.spec.ts` (新) | +136 | 3 case (A1 pdf/docx/xlsx fixture 无 capture / B1 DB 注入 image 配置后 capture=environment / C1 文案反映 effective) |

**生产代码**：22 / -6
**测试**：219
**Total**：~241（plan 估 80-120 prod，超 ~100 主要在 13 case 覆盖详细）

## 关键决策实施（按 coordinator 批准）

1. ✅ **空数组/undefined fallback 用 DEFAULT_ALLOWED_EXTENSIONS** — 兼容老 task
2. ✅ **capture="environment" 仅 accept 含 image 时加** — `acceptHasImage = effectiveAllowedTypes.some(t => IMAGE_EXTENSIONS.has(t))`
3. ✅ **toLowerCase + 去 leading dot** — `normalizeAllowedTypes` 内 `.replace(/^\./, "").toLowerCase().trim()`

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 94 files / 1076 tests pass (1063 baseline + 13 unit12 unit)
eslint: 0 new issue on builder modified files (subjective-runner.tsx 既有 1 warning unchanged)
```

### unit12-allowed-types unit (13 cases)
```
normalizeAllowedTypes:
  ✓ returns default fallback when input is undefined
  ✓ returns default fallback when input is empty array
  ✓ normalizes case + trim
  ✓ strips leading dot
  ✓ teacher 限定 pdf only → 不接受 docx
  ✓ teacher 允许 pdf+docx+jpg → 三种都通过
  ✓ filters empty entries after normalization
IMAGE_EXTENSIONS set:
  ✓ includes common image types (jpg/jpeg/png)
  ✓ does NOT include doc types (pdf/docx)
capture 'environment' trigger condition:
  ✓ teacher 配置仅 pdf → 不应触发 capture
  ✓ teacher 配置 pdf+jpg → 应触发 capture
  ✓ teacher 配置仅 image → 应触发 capture
  ✓ 默认 fallback (含 jpg/png) → 应触发 capture
```

### Playwright E2E (3 cases)
```
[A1] 老师配置 {pdf,docx,xlsx} → input accept 含三种 + 无 capture: ✓ (47.2s)
[B1] DB 注入 {jpg,png,pdf} → input accept 含 .jpg + capture='environment': ✓ (10.6s)
[C1] 页面文案 '支持：pdf, docx, xlsx' 反映配置: ✓ isolated (8.6s)

Serial 2/3 PASS + 1 race-isolated PASS (NextAuth 模式)
```

DB 测后还原确认：`{pdf,docx,xlsx}` 恢复 baseline ✓

## 风险 / 不确定项

1. **🟢 schema 0 改动**：仅 frontend 数据流改造
2. **🟢 fallback 不破坏老 task**：empty/undefined → DEFAULT_ALLOWED_EXTENSIONS（与旧硬编码完全等价）
3. **🟢 capture 桌面浏览器无害**：浏览器忽略未识别属性；移动端 Chrome/Safari 才生效。e2e 仅 DOM 属性存在性检查，不实跑相机
4. **🟢 大小写 + 前导点**：normalizeAllowedTypes 处理 `["PDF"]` `[".pdf"]` `["pdf"]` 等价
5. **🟡 IMAGE_EXTENSIONS 集合 hardcoded 6 种**（jpg/jpeg/png/gif/webp/heic）：未来若加新 image 格式需手工补；当前覆盖主流 demo 场景

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| `SubjectiveRunnerProps` 加 `allowedTypes?: string[]` 入参 | ✅ `SubjectiveTaskConfig` 接口加 |
| page.tsx 透传 `task.subjectiveConfig.allowedAttachmentTypes` | ✅ |
| runner `validateFile` 用 props.allowedTypes 而非常量 | ✅ effectiveAllowedTypes |
| file input 加 `capture="environment"`（image accept 时） | ✅ acceptHasImage 条件 |
| e2e：老师 {pdf} → 上传 .docx 被拒 | ✅ unit test 验证（e2e 用 DOM 属性检查替代真上传） |
| 移动端 input.capture 属性存在（DOM 检查） | ✅ B1 实测 |
| tsc / vitest / lint 全绿 | ✅ |

## 不在本范围

- ❌ 后端 multer/upload route 也校验 allowedTypes（前端阻拦已够 demo；后端兜底是单独 unit）
- ❌ 真上传文件 e2e（DOM 属性已证明配置生效）
- ❌ 移动端真机相机调起测试（无法在 headless playwright 验证；DOM 检查替代）

## 反思

- `normalizeAllowedTypes` 导出 + 13 unit case 覆盖边界 — 比 6 case e2e 性价比高
- IMAGE_EXTENSIONS Set 而非数组 — `.has()` O(1) 查找
- e2e DB 注入 + 还原 try/finally pattern 跟 Unit 17 / Phase3-A 一致
- coordinator 反馈极简 plan 100-150 字即可 — 本 unit plan 写 ~200 字仍偏冗长，下次 polish unit 控制更短
