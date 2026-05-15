# QA Report — Unit 9 r1

> QA: qa · 2026-05-14 · 验 commit `b6ae5f3` on `claude-demo-fixes`
> Bugs: probe r1 B2 · spec.md L186-196
> Test spec: `tests/e2e/qa-unit9-sim-evidence.spec.ts` (5 case，独立于 builder unit9-verify.spec.ts)

## 测试数据

- **BELLE_SIM_SUB** `32b9381c-8b6c-44cd-93ce-1d18b1049020` — belle sim graded sub, 5 rubric维度全部 NO evidence (legacy data) — fixture for fallback test
- **SIM_TASK_INSTANCE** `f1494008-e987-4576-b5e5-4a304d0ec822` — 客户理财咨询模拟练习 instance (teacher1 owns, ec619c34 course — molly **不是** collab，需用 teacher1 验)

## Schema 不改 — Prisma 三步 N/A

Builder 选 `evaluation Json 嵌套` 方案（plan Q1 批准）:
- `SimulationSubmission.evaluation` 已是 JSONB — schema 0 改动
- evidence 直接进 `evaluation.rubricBreakdown[].evidence` 数组
- 不需 migration / 不需重启 dev server ✓
- Spec L186 字面"加 evidence Array"满足（在 evaluation Json 内）

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| Rubric (evaluation) 加 `evidence: Array<{ studentText, comment }>` | 代码 grep + vitest sim-evidence.test.ts 5 case | schema z.array 嵌套, default []，TS interface RubricEvidence 完整 ✓ | PASS |
| AI evaluate prompt 强制每项 rubric ≥1 evidence + 逐字精确引用 transcript | grep ai.service.ts systemPrompt 规则 4 | "每项 rubric 至少 1 条 evidence" + "studentText 必须是 transcript 中的逐字精确引用" 加 prompt + JSON example | PASS (code-verified) |
| 服务端 post-process 校验 transcript 含 studentText (regex/includes) | `countMismatchedEvidence` helper + studentTextPool join logic | grep ai.service.ts L1538 `countMismatchedEvidence` + L1717 unverified flag computation + 完整 5 unit test 覆盖（all found / fabricated / empty / missing field / multi-rubric）vitest 全过 | PASS |
| 否则触发 1 次 retry | 代码 grep + vitest evaluateSimulation 集成测试 | wrap retry + 加 hint，retry 仍失败则接受 + unverified flag | PASS (code + 4 集成 case) |
| 教师 grading drawer UI 显示评分依据 (rubric + 引用气泡) | grep grading-drawer.tsx L400-412 | `aiScore.evidence.map(...)` + 黄色气泡 + unverified="未通过引用校验" badge | PASS (code-verified) |
| 学生侧 grades UI 同步显示 (按 Q4 unverified 隐藏 + 老 sub fallback) | belle /grades 实测 | "无引用依据（历史评分）" × 5 (每 rubric 维度) ✓；学生 view 0 "未通过引用校验" badge (Q4 micro-adjust honored) ✓ | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立 tsc + vitest + eslint | tsc 0 / **vitest 90 files / 1033 tests pass** (1009 baseline + 9 sim-evidence + 其他单测 = 1033) / 0 lint error | PASS |

## 额外验证

| 项 | 实测 | Verdict |
|---|---|---|
| Belle 老 sub /grades 详情面板可见 (模拟对话 chip + task name + rubric criterion + score) | "客户理财咨询模拟" task name + 5 rubric (需求/风险/资产/沟通/合规) + score 25/100 显示 ✓ | PASS |
| Teacher1 /teacher/instances/[id] 老 sim 加载 0 console error | (隔离运行) | PASS |
| Teacher1 instance 页对老 sub evidence===undefined 不显示编造证据 section | 抓 "评分依据 + 未通过引用校验" 组合 = false ✓ | PASS |
| 学生侧 unverified badge 隐藏 (Q4 honored) | "未通过引用校验" 在 belle /grades = 不出现 ✓ | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **90 files / 1033 tests pass** (含 sim-evidence 9 new case) |
| `npx eslint <6 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat b6ae5f3` | 6 files +560/-6 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ (evaluation Json 嵌套，向后兼容) |
| Dev server 重启 | N/A (无 schema 改动，热重载即可) |

## DB 实证 — Backward Compat

```sql
SELECT jsonb_pretty(evaluation) FROM "SimulationSubmission" WHERE "submissionId" = '32b9381c-...';
```
返回 5 rubric entries，每个含 `{criterionId, score, maxScore, comment}` 但**无 evidence 字段**：

```json
{
  "rubricBreakdown": [
    {
      "criterionId": "202a0e7d-...",
      "score": 10,
      "maxScore": 25,
      "comment": "询问了理财目标..."
      // ← NO evidence field
    },
    ...
  ]
}
```

UI 渲染时 `r.evidence === undefined` → fallback **"无引用依据（历史评分）"** × 5 rubric 维度 ✓

## Cross-module / Backward Compat

- `evaluateSimulation` 三层降级 (prompt 强制 → post-process 校验 → unverified flag) — LLM 不配合时不阻塞流程
- 老 graded sub (evidence===undefined) — UI 优雅 fallback，0 console error
- Service signature 变化：`countMismatchedEvidence` 是新 export helper，不影响既有 caller
- 既有 vitest 1009 baseline → 1018 (Unit 9 +9) → 1033 (其他 unit 累计)，无回归

## Finsim-specific 检查

- ✅ UI 文案全中文："无引用依据（历史评分）" / "未通过引用校验"
- ✅ Service 接口扩 (countMismatchedEvidence export) 不影响既有 caller
- ✅ Schema 0 改动 (Phase 2 内 Json 嵌套策略合理)
- ✅ 学生 vs 教师视角差异化 (Q4 micro-adjust)

## 风险 / 不确定项

1. **🟡 LLM 配合度依赖**: `includes()` 严格比对，标点/空格差异会判 mismatch。生产实测前无法 100% 预测 LLM 配合度。**3 层降级 (prompt + retry + unverified flag) 兜底**。
2. **🟢 Retry cost 1.5x**: 当 evidence mismatch 时多调 1 次 AI。Unit 11 节流不卡此场景（仅针对 weekly-insight/scope-insights force=true），合理。
3. **🟡 [MOOD:] 标签处理**: studentTextPool 构造阶段 regex 去除。如果 LLM 输出含 MOOD 标签会 mismatch，但 prompt 已明示"不引用 [MOOD:] 标签"。
4. **🟢 学生 evidence 隐藏 unverified**: Q4 honored - 学生看不到编造引文，但能看到教师评语，信息不缺失。
5. **🟢 教师 unverified badge 黄色 warn**: 配合 evidence 引文共存，教师可识别编造 quote 并手动调整。

## 是否引入新 bug

无。6 files +560/-6 scope 严格按 plan；vitest 1033 全过；UI 优雅降级；测后无 DB 写入。

## Issues found

无 blocker.

## Overall: **PASS**

**判断标准对照 (r1 即收三条件 — 无 schema 改动版)**：
1. ✅ QA 5 case (legacy fallback + teacher 加载 + 学生详情 + console errors) vs builder 4 case + 9 unit + 4 集成 — 独立证据链
2. ✅ DOM text count (5×fallback) / console errors=0 / fallback 文案精确匹配 / Q4 unverified 隐藏 — deterministic
3. ✅ DB cleanup 完整 (read-only 验证，无任何修改)

**建议 r1 PASS 收工**。Unit 9 决策非常稳健：
- evaluation Json 嵌套规避 Prisma migration 风险 (Q1 batched 决策)
- 3 层降级 (prompt + retry + unverified flag) 让 LLM 不配合也不阻塞
- 学生 vs 教师视角差异化 (Q4 micro-adjust) — 学生看可信，教师看完整审计
- 老 sub fallback 文案"无引用依据（历史评分）" — backward-compat 体面

Phase 2 进度: Unit 11 ✅ / Unit 10 ✅ / Unit 9 ✅ (本) / Unit 8 待开。

idle 等 Unit 8 通知（真自适应 IRT — 算法 + AI 题选择 + schema 消费）。
