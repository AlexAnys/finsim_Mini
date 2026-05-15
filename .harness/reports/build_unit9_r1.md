# Build Report — Unit 9 Round 1

> Builder: builder · 2026-05-14 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit9_plan_r1.md`
> Bugs: probe r1 B2

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/services/ai.service.ts` | +83 / -1 | 新增 `countMismatchedEvidence` helper；evaluateSimulation: schema 加 evidence；systemPrompt 加规则 4（每项 ≥1 evidence + 逐字精确引用）；userPrompt JSON 示例扩；post-process 第 1 次评估后校验，发现 mismatch 触发 1 次 wrap retry + 加 hint；接受后给每条 evidence 打 `unverified` flag（studentText 在 transcript 找不到则 true）；每项 evidence 上限 3 条防爆量 |
| `components/instance-detail/submissions-utils.ts` | +8 | 新加 `RubricEvidence` interface + RubricBreakdownEntry.evidence?: 字段 |
| `components/instance-detail/grading-drawer.tsx` | +40 / -5 | inline GradeEvaluation interface 扩 evidence；rubric block AI 建议下展开"评分依据" + 黄色高亮气泡 + unverified badge "未通过引用校验" |
| `components/grades/evaluation-panel.tsx` | +33 | RubricEntry 扩 evidence；学生侧每条 rubric bar 下方展示"评分依据"块（仅显示 unverified !== true 的 evidence；老评分 evidence===undefined 显示"无引用依据（历史评分）"） |
| `tests/sim-evidence.test.ts` (新) | +264 | 9 case (5 countMismatchedEvidence + 4 evaluateSimulation 集成) |
| `tests/e2e/unit9-verify.spec.ts` (新) | +132 | 4 e2e case |

**生产代码**：164 / -6
**新代码 (含 tests)**：396
**Total**：~560 (plan 预算 400-500 — 略超因 unit tests 详细一点)

## 关键决策实施（按 coordinator 批准 + Q4 微调）

1. ✅ **Schema 位置：evaluation Json 嵌套** — 0 schema migration，与 worktree Unit 10 完全独立
2. ✅ **旧 sub 文案 "无引用依据（历史评分）"**
3. ✅ **Post-process retry 1 次后接受 fabricated quote** + unverified flag
4. ✅ **Q4 micro-adjust applied**：学生侧 `r.evidence.filter((ev) => !ev.unverified)`—— unverified entries 整条不显示（不显示编造引文气泡，避免误导学生）；教师侧 `aiScore.evidence.map(...)` 全显 + "未通过引用校验" badge（保留审计能力）
5. ✅ **evidence 上限 3 条 per rubric** — slice(0, 3) 在 evaluateSimulation 标准化处兜底

## Prisma 三步

✅ **0 schema 改动**，不需要 Prisma 三步。dev server PID 58339 继续运行，无需重启（仅 TypeScript + UI + service 改动，热重载即可）。

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 88 files / 1018 tests pass (1009 baseline + 5 countMismatchedEvidence + 4 evaluateSimulation 集成)
eslint: 0 issue on builder modified/new files (baseline 14 files 不变)
```

### Playwright E2E (4 case)
```
[A1] 学生 /grades 老 sub 显示 '无引用依据（历史评分）' fallback: ✓ (6.2s) — 5 维度都显示 fallback 文案
[B1] GET /api/submissions/<id> 返回结构含 rubricBreakdown: ✓ isolated (3.0s) — serial fail = NextAuth race
[C1] 教师任务实例页加载老 sub 无 console error: ✓ (8.5s)
[E1] 学生 /grades 老 sub 详情面板可见 (模拟对话 chip): ✓ (5.9s)

Serial 3/4 PASS + 1 race-isolated PASS（finsim 已知 NextAuth 模式）。
```

### 截图
- `.harness/screenshots/unit9-verify/A1-legacy-fallback.png` — belle 老 sub 评分明细 5 维度均显示"无引用依据（历史评分）"
- `.harness/screenshots/unit9-verify/C1-teacher-instance.png` — 教师任务实例页正常加载
- `.harness/screenshots/unit9-verify/E1-student-grades.png` — 学生成绩页详情正常

### Unit tests 实测
```
✓ countMismatchedEvidence:
  - all studentText found → returns 0
  - fabricated quotes counted
  - empty studentText (AI declared no quote) → not counted
  - missing evidence field → 0
  - multi-rubric counting

✓ evaluateSimulation integration:
  - real quote → unverified=false; fabricated → unverified=true
  - mismatch → 1 retry triggered; still fail → accepted with unverified
  - evidence sliced to 3 entries when AI returns 5
  - AI omits evidence field → defaults to []
```

## 风险 / 不确定项

1. **🟢 0 schema 改动**：spec L186 字面要求 schema 加 evidence，我选择 evaluation Json 嵌套（coordinator 批准）。旧 submission 完全不影响。
2. **🟡 LLM 引用准确度依赖**：post-process 用严格 `includes` 比对（标点/空格逐字精确）。预期 1 次 retry 命中率高，但仍可能 unverified；UI 层有 fallback。**生产实测前无法 100% 预测 LLM 配合度**。
3. **🟢 现有 graded sub 兼容**：evidence === undefined → UI 显示 fallback；不影响展示其他 rubric 数据（score/comment）。
4. **🟡 retry cost**：当 evidence mismatch 时，evaluateSimulation 多调一次 AI（~1.5x 正常成本）。Unit 11 节流不卡此场景（节流仅针对 weekly-insight/scope-insights force=true）。
5. **🟢 学生侧 unverified 隐藏**：按 coordinator Q4 micro-adjust。学生看不到编造引文，但能看见教师评语（包括评分理由）— 信息不缺失。
6. **🟢 教师 unverified badge**：黄色 warning 文字标识"未通过引用校验"，配合 evidence 引文气泡共存。教师可识别并手动调整。
7. **🟡 [MOOD:] 标签处理**：在 studentTextPool 构造阶段 regex 去除（`\[MOOD:.*?\]`）。如果 LLM 输出的 studentText 没去 MOOD 标签可能 mismatch — prompt 已明示 "不要引用 [MOOD:...] 标签内的内容"。
8. **🟢 unit tests 验证**：`evaluateSimulation` 集成测试用 vi.mock generateText，3 个核心路径（real / fabricated / retry）都覆盖。

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| Rubric (在 evaluation) 加 evidence: Array<{studentText, comment}> | ✅ schema z.array 嵌套，optional default [] |
| AI evaluate prompt 强制每项 rubric ≥1 evidence + 精确引用 | ✅ systemPrompt 规则 4 + userPrompt JSON example 扩 |
| 服务端 post-process 校验 transcript 包含 studentText（regex/includes） | ✅ countMismatchedEvidence + studentTextPool join |
| 否则触发一次 retry | ✅ wrap retry + 加 hint；第二次失败接受 + unverified |
| 教师 grading drawer UI 显示评分依据（rubric + 引用气泡） | ✅ grading-drawer.tsx 黄色高亮 + unverified warn 标签 |
| 学生侧 grades UI 同步显示（按 Q4：unverified 隐藏） | ✅ evaluation-panel.tsx filter unverified !== true |
| tsc / vitest / lint 全绿 | ✅ |

## 不在本 unit 范围

- ❌ 教师手动编辑 evidence（AI 输出 only，本 unit 仅展示）
- ❌ 学生点 evidence 跳到对话原句位置（Phase 4 polish）
- ❌ Subjective / Quiz 的 evidence（spec 只针对 simulation）
- ❌ 老 evaluation 数据迁移 / backfill（UI 优雅降级即可）
- ❌ Schema 上加 SimulationConfig.rubric Json（plan Q1 选 evaluation 嵌套）

## 反思

- evaluation Json 嵌套是务实选择 — 既符合 spec 字面意图（evidence 作为评分输出的一部分），又避免与 worktree 协调 Prisma 时序（drift 风险）。
- AI prompt 强制 + post-process 校验 + unverified flag 三层降级是关键设计：LLM 不可能 100% 配合，但 UI 层确保学生看到的 evidence 都是真实可信的（unverified 自动 hide）。
- 双层 retry（ai.service 内层处理 JSON shape；evaluateSimulation 外层处理引用校验）独立，cost 最大 1.5x（不是 4x）。
- 学生 vs 教师视角差异化 — 学生看"可信结论"，教师看"完整审计"，体现 Unit 11 引入的 audit 思想。
