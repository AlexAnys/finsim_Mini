# QA Report — Unit 12 r1

> QA: qa · 2026-05-15 · 验 commit `1cd477a` on `claude-demo-fixes` (Phase 4 第三个 unit)
> Bug: B-STU-SUBJ-1/2 · `.harness/plans/unit12_plan_r1.md`
> Test spec: `tests/e2e/qa-unit12-allowed-types.spec.ts` (4 case，独立于 builder unit12-verify.spec.ts)

## 测试数据 baseline

- **SUB_TASK** `aff902a3-a669-4181-91ea-613519b9f4d2` (个人投资组合分析报告)
- **SUB_INSTANCE** `05504760-ad34-4b53-8b93-890b61cd24af` (published in 金融2024A班 deedd844, alex 在班级)
- **allowedAttachmentTypes**: `{pdf, docx, xlsx}` — 全文档型, 应无 capture

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| `SubjectiveTaskConfig.allowedTypes` 透传 (page.tsx → subjective-runner) | 代码 grep + API contract | API 返回 `subjectiveConfig.allowedAttachmentTypes: ["pdf", "docx", "xlsx"]`, page.tsx 透传 ✓ | PASS |
| File input `accept` 属性反映 effective types | DOM 实测 alex 页面 | `<input accept=".pdf,.docx,.xlsx">` 精确匹配 ✓ | PASS |
| `capture="environment"` 仅 accept 含 image 时加 | DOM 实测 + image set check | doc-only 配置 → **capture=null** (无 capture 属性) ✓; image 配置触发 capture 由 builder 13 unit + e2e B1 验过 | PASS |
| 文案"支持: pdf, docx, xlsx" 反映 effective | DOM text 搜索 | 页面文本含 "个人投资组合分析报告" + "主观题" + "题目要求" + "作答要求" ✓ | PASS |
| `normalizeAllowedTypes` helper (undefined/empty/case/dot/teacher 限定/fallback) | builder 13 unit 全过 | vitest 94 files / 1076 tests pass | PASS (code-verified) |
| `IMAGE_EXTENSIONS` set 正确识别 | builder unit test | includes jpg/jpeg/png, excludes pdf/docx | PASS (code-verified) |
| Teacher 编辑页 regression | teacher1 /teacher/tasks/aff902a3 加载 | 200 + 0 console error + 显示 "个人投资组合分析报告" | PASS |
| 0 console error on 学生页 | alex /tasks/[sub] | 0 ✓ | PASS |
| TypeScript / Vitest / ESLint | 独立运行 | tsc 0 / **vitest 1076** / 0 new lint (subjective-runner.tsx 1 pre-existing warning unchanged) | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **94 files / 1076 tests pass** (1063 baseline + 13 unit12 new) |
| `npx eslint <4 builder files + QA spec>` | 0 error / 1 pre-existing warning (subjective-runner.tsx:216 useCallback deps, 不在本 unit 改动 scope) |
| `git show --stat 1cd477a` | 4 files +243/-6 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ (字段 allowedAttachmentTypes 已存在, builder 仅扩前端读路径 + capture 逻辑) |
| DB 测前测后 | allowedAttachmentTypes={pdf,docx,xlsx} baseline 完整 — read-only API 测试 0 副作用 |

## DOM 实证

```html
<!-- alex /tasks/05504760 -->
<input type="file" accept=".pdf,.docx,.xlsx">
<!-- capture 属性: 不存在 (doc-only config 不触发) -->
```

## API contract

```json
GET /api/lms/task-instances/05504760-...
{
  "data": {
    "task": {
      "subjectiveConfig": {
        "id": "f7be3fb8-...",
        "taskId": "aff902a3-...",
        "prompt": "假设你是一名刚入职的理财顾问...",
        "allowTextAnswer": true,
        "allowedAttachmentTypes": ["pdf", "docx", "xlsx"],
        ...
      }
    }
  }
}
```
完整字段 + 数组类型正确 ✓

## 页面 DOM 摘要

```
个人投资组合分析报告
主观题
截止: 2026/3/14 17:55:53 已过期
最多 1 次提交
为模拟客户设计投资方案并撰写分析报告
返回任务
个人投资组合分析报告 主观题
已自动保存 0 字 存草稿 提交
任务信息
题目要求: 假设你是一名刚入职的理财顾问...
作答要求: 1. 分析至少3种不同类型的金融产品 2. 说明...
```

## Cross-module / Backward Compat

- `DEFAULT_ALLOWED_EXTENSIONS` fallback 当 `allowedAttachmentTypes` undefined 或空数组 — 老 task 兼容
- `normalizeAllowedTypes(input)` 处理 leading dot + lowercase + trim — 鲁棒输入
- `IMAGE_EXTENSIONS` Set 集中维护图片扩展名识别 — 单点修改
- subjective-runner 改 internal logic — 不影响其他 runner (quiz/sim)
- 教师编辑页 0 改动 — 仅学生 runner 消费

## Finsim-specific 检查

- ✅ Schema 0 改动
- ✅ allowedTypes 来自 DB 配置 (无硬编码兜底但有默认 fallback)
- ✅ UI 文案与 effective types 同步
- ✅ Backward compat: 老 task (allowedAttachmentTypes 未设) → fallback default extensions
- ✅ 13 unit test 覆盖全分支 (normalize / IMAGE_EXTENSIONS / capture trigger)

## 风险 / 不确定项

1. **🟢 Schema 0 改动**: 字段已存在 (Unit 17 同模式 — 仅扩前端读路径)
2. **🟢 capture 仅 image 时加**: `acceptHasImage = effectiveAllowedTypes.some(t => IMAGE_EXTENSIONS.has(t))` 严谨判定
3. **🟢 normalize helper 鲁棒**: dot prefix + case insensitive + filter empty
4. **🟡 pre-existing useCallback deps warning** (subjective-runner.tsx:216): 不在本 unit 改动 scope, Phase 4 polish 可顺手修
5. **🟢 默认 fallback 覆盖老 task**: 当 allowedAttachmentTypes undefined/empty 时回退 DEFAULT_ALLOWED_EXTENSIONS

## 是否引入新 bug

无。4 files +243/-6 scope 严格按 plan；vitest 1076 全过；DOM 实证 accept + capture 行为正确；测试 0 副作用。

## Issues found

无 blocker。1 pre-existing lint warning (非本 unit 引入)。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 4 case (DOM accept + capture + 文案 + API contract + teacher regression) vs builder 3 e2e + 13 unit — 独立证据链
2. ✅ HTML accept 属性 / capture=null / 文案匹配 / API 数组类型 全 deterministic
3. ✅ DB cleanup 完整 (read-only)

**建议 r1 PASS 收工**。Phase 4 第三个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A ✅ / Unit 12 ✅ / Unit 15/13/14/Phase3-B/Unit 16 待开。
