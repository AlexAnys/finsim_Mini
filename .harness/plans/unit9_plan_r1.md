# Unit 9 Plan — 模拟对话评分依据结构化 quote 学生原话

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 9
> Bugs: probe r1 B2

## 调研发现

### A. 当前 sim 评分数据流

```
评分 trigger
 └─ grading.service.ts: gradeSimulation(submission) [line 244]
     └─ 读 submission.simulationSubmission.transcript (Array<{role, text}>)
     └─ 读 submission.task.scoringCriteria (ScoringCriterion[]) — rubric 数据源
     └─ 调 aiService.evaluateSimulation(...)
         └─ ai.service.ts:1533 evaluateSimulation
             └─ aiGenerateJSON("evaluation", ...) (with retry 2 次)
             └─ 返回 rubricBreakdown: [{criterionId, score, maxScore, comment}]
     └─ 写 SimulationSubmission.evaluation (Json)
```

UI 路径（数据源就是上面 `evaluation` JSON）：
- 教师 grading drawer: `components/instance-detail/grading-drawer.tsx:347` rubric.find by criterionId → 显示 "AI 建议 X/Y · comment"
- 学生 grades: `components/grades/evaluation-panel.tsx:208` rubric.map → 显示 评分明细 bar + comment

### B. 现有 rubricBreakdown 结构 (`ai.service.ts:1558`)

```ts
rubricBreakdown: Array<{
  criterionId: string,
  score: number,
  maxScore: number,
  comment: string,   // ← 当前是单一文字评语
}>
```

### C. 关键决策点（coordinator 4 问）

**Q1 Schema 位置：嵌套在 evaluation JSON 还是 SimulationConfig.rubric？**
→ 答：**嵌套在 evaluation JSON 内 rubricBreakdown[].evidence** 而非新加 Prisma 字段。理由：
- evidence 是"评估输出"非"评分模板配置"，属于 Submission 侧不属于 Task 侧
- 现有 SimulationConfig 不存 rubric（rubric 来自 task.scoringCriteria 数组关系表）；新加 rubric Json 重复 source of truth
- evaluation 是 Json 类型，嵌套字段不需 schema migration
- 跟 quiz/subjective 的 evaluation 结构平行（同模式扩展）
- **本 unit 0 schema 改动，按 coordinator 建议在 worktree 分工里属于安全场景**

**Q2 Evidence 字段必填 vs 可选 + 旧数据兼容**
→ 答：**TS 类型上 optional `evidence?: Array<{...}>`**；新评分 AI 必须返回，旧 graded submission（无该字段）UI 显示 fallback "无引用依据（历史评分）"。
- 数据兼容 = 不动旧 submission.evaluation JSON
- 新评分都走新 prompt 强制返回 evidence
- post-process 校验也只针对**新评分**触发

**Q3 Post-process retry 边界**
→ 答：**最多 retry 1 次**，第二次仍失败接受 AI 输出（log warn 不阻塞）。
- 当 transcript 不含某条 studentText 时（regex 比对失败）→ retry 加重新 prompt "你引用的原句在对话中不存在，请仅引用 transcript 中的精确原话"
- 再失败：接受 AI 给出的 evidence（可能 fabricated quote），UI 加 badge "未通过引用校验" 标识。
- 不无限重试（成本控制）

**Q4 Student grades UI 展示位置**
→ 答：**直接嵌在现有评分明细 bar 下方**（evaluation-panel.tsx:208 rubric.map），不开新 tab。理由：
- 同一 rubric 维度的 evidence 紧贴 comment 最直观
- 新 tab 增加点击成本，且 evidence 是 rubric 的"展开内容"

教师 drawer 同样位置：rubric block 内嵌 evidence list，点击 evidence 高亮原对话（v1 简化：仅展示引文气泡，不做联动滚动，留 Phase 4 polish）。

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/services/ai.service.ts` | 改 | evaluateSimulation: schema 加 evidence; prompt 强制；post-process 校验 + 1 次 retry |
| `lib/services/grading.service.ts` | 改 | gradeSimulation：把 evaluation.rubricBreakdown 完整透传到 evaluation JSON（已是这样，只是确认） |
| `components/instance-detail/grading-drawer.tsx` | 改 | rubric block 内显示 evidence 引用气泡 |
| `components/grades/evaluation-panel.tsx` | 改 | 学生 rubric 明细加 evidence 引文展示 |
| `components/instance-detail/submissions-utils.ts` | 改 | RubricBreakdownEntry interface 加 evidence?: 字段 |
| `tests/sim-evidence.test.ts` (新) | 新 | 4-6 case: prompt 含 evidence 要求 / post-process regex 校验 / retry 触发 / fallback 接受 |
| `tests/e2e/unit9-verify.spec.ts` (新) | 新 | 4-6 case |

**生产代码预计** ~150-200 lines / **测试** ~250 lines / **总** ~400-450 lines。

## 关键改动思路

### 1. ai.service.ts evaluateSimulation schema 扩

```ts
const evaluationSchema = z.object({
  totalScore: z.number(),
  feedback: z.string(),
  rubricBreakdown: z.array(z.object({
    criterionId: z.string(),
    score: z.number(),
    maxScore: z.number(),
    comment: z.string(),
    evidence: z.array(z.object({
      studentText: z.string(),
      comment: z.string(),
    })).default([]),   // ← 新字段，default 空数组兜底 AI 漏返
  })),
  conceptTags: z.array(z.string()).optional(),
});
```

### 2. Prompt 强制 + 引用校验

```ts
// systemPrompt 加：
4. 每项 rubric 必须返回至少 1 条 evidence：
   - studentText: 必须是 transcript 中"理财经理"角色的精确原句（逐字引用，不得改写、不得拼接多句）
   - comment: 解释这句话如何对应该 rubric 评分
5. 没有可引用原句时，studentText 设为 "" 空字符串，并在 comment 中说明缺失原因（不影响 score）
```

### 3. Post-process 校验

```ts
function validateEvidence(rubricBreakdown, studentTexts) {
  const allText = studentTexts.join("\n");
  let missingCount = 0;
  for (const r of rubricBreakdown) {
    for (const ev of (r.evidence ?? [])) {
      if (ev.studentText && !allText.includes(ev.studentText)) {
        missingCount++;
      }
    }
  }
  return missingCount;
}

// 在 evaluateSimulation 中：
const studentTexts = data.transcript
  .filter(m => m.role === "student")
  .map(m => m.text.replace(/\[MOOD:.*?\]/g, "").trim());

let result = await aiGenerateJSON(...);
const missing = validateEvidence(result.rubricBreakdown, studentTexts);
if (missing > 0) {
  // retry 1 次，prompt 加 hint
  result = await aiGenerateJSON(..., 1 /* fewer retries */, {
    metadata: { evidenceRetry: true }
  });
  const missingAgain = validateEvidence(result.rubricBreakdown, studentTexts);
  if (missingAgain > 0) {
    // 接受，UI 标识"未通过校验"
    result.rubricBreakdown = result.rubricBreakdown.map(r => ({
      ...r,
      evidence: r.evidence.map(ev => ({
        ...ev,
        unverified: allText.includes(ev.studentText) ? false : true,
      })),
    }));
  }
}
```

注意：`aiGenerateJSON` 自己内部已有 2 次 retry，本 unit 在 evaluateSimulation 层再 wrap 1 次 retry。两层独立 — 内层处理 JSON shape 失败，外层处理引用校验失败。

### 4. RubricBreakdownEntry interface

```ts
export interface RubricBreakdownEntry {
  criterionId: string;
  score: number;
  maxScore: number;
  comment?: string;
  evidence?: Array<{
    studentText: string;
    comment: string;
    unverified?: boolean;
  }>;
}
```

### 5. grading-drawer.tsx UI

```tsx
{aiScore && showAiSuggestion && showAi && (
  <div className="mt-1.5 space-y-1">
    <div className="text-[10.5px] text-sim">
      AI 建议 {aiScore.score}/{aiScore.maxScore}
      {aiScore.comment && ` · ${aiScore.comment}`}
    </div>
    {aiScore.evidence && aiScore.evidence.length > 0 && (
      <div className="space-y-1 pl-2 border-l-2 border-line">
        {aiScore.evidence.map((ev, i) => (
          <div key={i} className="text-[10.5px]">
            {ev.studentText ? (
              <>
                <span className="bg-yellow-100 px-1 rounded">「{ev.studentText}」</span>
                <span className="text-ink-5">{ev.unverified && " 未通过校验"}</span>
              </>
            ) : (
              <span className="text-ink-5">未引用原句</span>
            )}
            {ev.comment && <div className="text-ink-5 mt-0.5">{ev.comment}</div>}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

### 6. evaluation-panel.tsx (学生侧) UI

类似，在每条 rubric bar 下方加 evidence 块。简化为 1 行引文 + comment。

## 风险点

1. **🟡 AI 引用准确度**：LLM 可能生成"近似"原句而非精确逐字。post-process 用 `includes` 严格比对；retry 1 次后接受。可能仍有 fabricated quote，UI 用 `unverified` 标识。
2. **🟢 schema 0 改动**：嵌套在 evaluation Json 内，旧 submission 不受影响（evidence?: optional）。
3. **🟡 现有 AiRun retry 已 2 次**：本 unit 在 service 层再 wrap 1 次（独立维度，处理引用 vs JSON shape）。Cost ≈ 1.5x evaluation 调用（在不通过校验时）。已 spec L227 节流接受，本 unit 0 节流改动。
4. **🟢 现有 graded submission 兼容**：UI 用 `evidence ?? []`，空数组时显示 fallback "无引用依据（历史评分）"。
5. **🟡 prompt 长度增量**：systemPrompt 加 ~150 字（evidence 规则）；userPrompt 加 ~50 字（提示 transcript 原句出处）。可控。
6. **🟢 [MOOD:] 标签干扰**：transcript 含 [MOOD:HAPPY] 等系统标签；regex `\[MOOD:.*?\]` 去除后再比对（已实现在 prompt 端去除，post-process 也照样去）。
7. **🟢 多语句 evidence**：spec 字面"≥1 evidence per rubric"，本 unit 上限 default 3 条 evidence per rubric（prompt 内提示），避免 LLM 输出过长截断。
8. **🟡 学生侧 evidence 暴露内部 unverified flag**：考虑只对教师暴露 unverified，学生侧 unverified 等同隐藏 evidence（避免学生质疑 AI）。**实现：evaluation-panel 不显示 unverified flag**，但仍显示 studentText（quote 本身是真实的——它来自学生自己的话）。**只在教师 drawer 显示 "未通过校验"** badge。

## 自测计划

### 自动化
1. tsc + vitest (含 4-6 unit 测) + eslint
2. e2e 4-6 case

### Unit tests
- A: `validateEvidence` 输入 transcript + rubricBreakdown，返回 missingCount 正确
- B: AI mock 返回包含 transcript 中真原句 → 0 retry → 0 unverified
- C: AI mock 返回 fabricated quote → 1 retry → 仍失败 → unverified=true
- D: AI mock 返回 evidence=undefined（旧 prompt 兼容） → service 自动注入 []

### E2E
- A: 触发新 sim 评分 → DB evaluation.rubricBreakdown[0].evidence 非空
- B: 教师 grading drawer 显示 evidence 引文气泡
- C: 学生 grades 详情显示 evidence 引文（quote 高亮）
- D: 老 submission（无 evidence 字段）UI 不报错，显示 "无引用依据（历史评分）"
- E: API 返回 schema 含 evidence 字段
- F (可选): unverified 标识仅教师可见，学生侧不显示

## 不在本 unit 范围

- ❌ Schema 改 SimulationConfig 加 rubric Json （decision Q1：用 evaluation 嵌套更自然）
- ❌ 教师手动编辑 evidence （AI 输出 only，本 unit 仅展示）
- ❌ 学生点 evidence 跳到对话原句位置（Phase 4 polish）
- ❌ 自适应严格度对 evidence 数量调节（保持 prompt 固定 1-3 条）
- ❌ Subjective / Quiz 的 evidence（spec 只针对 simulation）

## diff 预算

预计 400-500 行：
- ai.service.ts ~80（schema + prompt + validateEvidence + retry）
- 2 UI components ~80（rubric block evidence 渲染）
- submissions-utils.ts interface ~10
- tests unit ~150 + e2e ~200 ~350

复杂度中等。Schema 0 改动 = 不动 Prisma，与 worktree Unit 10 安全并行。

## 待 coordinator 确认

1. **decision Q1 用 evaluation 嵌套 vs 加 SimulationConfig.rubric**：plan 选嵌套，理由见上。如要求加 schema，本 unit 需走 Prisma 三步 + 协调（worktree builder-b 不动 schema 应 OK）。
2. **decision Q2 旧 submission fallback 文案**："无引用依据（历史评分）" — 是否同意此措辞？或改"无 AI 引用"更简洁？
3. **decision Q3 retry 限制 1 次**：plan 字面 + 接受 fabricated quote 时加 unverified flag。是否同意此妥协？
4. **decision Q4 学生侧不显示 unverified flag**：plan 选只对教师暴露，学生看到 evidence 本身但不暴露"AI 引用未通过校验"提示。是否同意？
5. **evidence 上限 3 条 per rubric**（防 LLM 输出爆量）：是否同意？

预计 r1 即收概率 60%（AI prompt + post-process retry + UI 横跨 3 处，QA 可能挑出 evidence regex 边界 case）。
