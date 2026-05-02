# Build Report — fix-quiz-options r1

## Spec

`.harness/spec.md` 末尾 `🔧 BLOCKER 修复 · Q-OPTIONS-RENDER`：所有 Quiz 任务在学生 UI 渲染失败（选项 label 全为 "."、radio 永远 unchecked、提交 selectedOptionIds 为空）。

根因：`app/(student)/tasks/[id]/page.tsx` 的 mapping 层把 DB/API 的 `[{id, text}]` 直接当 `[{label, content}]` 传给 QuizRunner，未做 `{id→label, text→content}` 转换。后端管道 R4 已验证健康。

## 改动文件

| File | Lines | 改动 |
|---|---|---|
| `app/(student)/tasks/[id]/page.tsx` | 39 | 修正本地 `QuizQuestion` interface 的 `options` 类型从虚假的 `{label, content}` 改回真实 API 形状 `{id, text}` |
| `app/(student)/tasks/[id]/page.tsx` | 130-133 | 在 QuizRunner taskConfig.questions 的 mapping 里加 `{id→label, text→content}` 转换 |

## 关键改动说明

### 1. 本地 interface 修正（line 39）

```diff
 interface QuizQuestion {
   id: string;
   type: string;
   prompt: string;
-  options: Array<{ label: string; content: string }> | null;
+  options: Array<{ id: string; text: string }> | null;
   points: number;
   explanation: string | null;
   order: number;
 }
```

为什么必须改：旧 interface 是"类型谎言"——它声明 API 返回 `{label, content}`，但实际 API 返回 `{id, text}`（QA 已用 SQL/network 验证）。这个谎言正是为什么 `npx tsc --noEmit` 一直 0 errors 而 UI 完全 broken 的原因。

修正后 tsc 才能在边界处真实反映 API shape，让 mapping 层 `.map((o: { id: string; text: string }) => ...)` 与 input 类型对齐。

### 2. Mapping 转换（lines 130-133）

```diff
               type: q.type as "single_choice" | "multiple_choice" | "true_false" | "short_answer",
               stem: q.prompt,
-              options: q.options,
+              options: Array.isArray(q.options)
+                ? q.options.map((o: { id: string; text: string }) => ({ label: o.id, content: o.text }))
+                : null,
               points: q.points,
               explanation: q.explanation,
```

完全按 spec 给的方案。`Array.isArray` 守卫确保 short_answer 等 options=null 的题型不炸。

## 边界检查（CLAUDE.md anti-regression）

| 项目 | 状态 |
|---|---|
| ❌ 未改 `components/quiz/quiz-runner.tsx` | ✅ 遵守（QuizRunner 内部 `opt.label/opt.content` 全部保留） |
| ❌ 未 drive-by refactor 周围代码 | ✅ 遵守（仅这两处 minimal diff） |
| ❌ 未影响 simulation/subjective 分支 | ✅ 遵守（改动在 `if (task.taskType === "quiz" && task.quizConfig)` 块内 + 一个共享 interface） |
| QuizRunner 唯一 caller | `app/(student)/tasks/[id]/page.tsx` 一处（grep 验证），无其他 caller 受 interface 改动影响 |
| 提交 payload 契约不变 | ✅ Runner 仍发 `{questionId, selectedOptionIds: ["A"|"B"|...]}` 给后端，后端无需改动（backend 用 `q.options[].id` 校验，与 Runner 选回的 `opt.label`=`o.id` 一致） |

## 自检命令输出

### `npx tsc --noEmit`

```
(无输出 — 0 errors)
```

### `grep -rn "QuizOption\|opt.label\|opt.content" components/quiz/ app/(student)/tasks/`

```
components/quiz/quiz-runner.tsx:32:interface QuizOption {
components/quiz/quiz-runner.tsx:41:  options: QuizOption[] | null;
components/quiz/quiz-runner.tsx:501:                          const optionDomId = `${currentQuestion.id}-${opt.label}-${idx}`;
components/quiz/quiz-runner.tsx:504:                              key={`${opt.label}-${idx}`}
components/quiz/quiz-runner.tsx:508:                                value={opt.label}
components/quiz/quiz-runner.tsx:516:                                  {opt.label}.
components/quiz/quiz-runner.tsx:518:                                {opt.content}
components/quiz/quiz-runner.tsx:533:                          ).includes(opt.label);
components/quiz/quiz-runner.tsx:534:                          const optionDomId = `${currentQuestion.id}-${opt.label}-${idx}`;
components/quiz/quiz-runner.tsx:537:                              key={`${opt.label}-${idx}`}
components/quiz/quiz-runner.tsx:545:                                    opt.label
components/quiz/quiz-runner.tsx:556:                                  {opt.label}.
components/quiz/quiz-runner.tsx:558:                                {opt.content}
```

所有 `opt.label/opt.content` 引用都在 QuizRunner 内部（消费侧）；外部 callers 只有 page.tsx 的 mapping 层（已修）。无遗漏。

### `grep -rn "QuizRunner" --include="*.tsx" --include="*.ts"`

```
app/(student)/tasks/[id]/page.tsx:18:import { QuizRunner } from "@/components/quiz/quiz-runner";
app/(student)/tasks/[id]/page.tsx:114:      <QuizRunner
components/quiz/quiz-runner.tsx:54:interface QuizRunnerProps {
components/quiz/quiz-runner.tsx:97:export function QuizRunner({
components/quiz/quiz-runner.tsx:104:}: QuizRunnerProps) {</br>
```

QuizRunner 全仓库唯一 caller 即 `page.tsx`，已修。

## 潜在风险

1. **HMR 是否生效**：dev server 在 3030 跑着；client component（"use client"）改动应 hot-reload 即时。如果 QA 看到旧 UI，可能需要 hard refresh 浏览器（Cmd+Shift+R）。但**不需要**重启 dev server——schema 没动。
2. **submission payload 兼容性**：Runner submission 用 `selectedOptionIds: [opt.label]` = `[o.id]`，与原 DB option id 完全一致。后端 grading 服务读 `q.options[].id` 做匹配，不受影响。R4 中 alex 的 API 直接 POST `{selectedOptionIds: ["A"]}` 已验证可批改。所以本修复在前端把 UI 选回的值映射回 id，链路一致。
3. **浏览器历史 bfcache**：`Quiz UI` 之前 broken 状态下用户可能有未提交的草稿/state。新会话开新 tab 即可，无 fall-back hazard。

## 不需要做的事

- 无 schema 改动 → **不需要** Prisma 三步舞 / dev server restart
- 无 service interface 改动 → **不需要** caller scan
- 无 vitest 既有 Quiz UI 测试受影响（改动只触前端 client component mapping 层）

## 状态

BUILT — 待 qa 回归。

## 下一步给 QA

按 spec acceptance：
1. ✅ tsc 0 errors
2. 浏览器：alex@qq.com / 11 → 任意 Quiz（如 b7ca71ef）→ 4 选项 "A. xxx"/"B. yyy" 完整文案显示
3. Radio 可选中 + 提交 payload 含 `selectedOptionIds: ["B"]` 真实值
4. 后续 async grading 走 R4 已固化的管道
5. simulation/subjective 路径不受影响（page.tsx 的 quiz 分支独立）
