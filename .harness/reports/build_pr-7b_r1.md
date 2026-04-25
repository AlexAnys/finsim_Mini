# Build · PR-7B Mood + Hint AI 真接入（schema + Prisma 三步）· r1

**Owner**: builder · **Date**: 2026-04-26 00:18Z · **Spec ref**: HANDOFF Phase 7 PR-7B / informed-consent ack from team-lead

## 范围

把 Sim Runner 的 mood / hint 从"前端占位"升级为"真 AI 输出 + 持久化"。
- AI prompt 改为严格 JSON 输出（`reply` + `mood_score` + `mood_label` + `student_perf` + `deviated_dimensions`）
- 8 档 mood 枚举（向后兼容 5 档历史值）
- B3 hint 触发判定在 service 端做（避免 AI 自作主张）+ Socratic 追问形式
- Schema 加 `AnalysisReport.moodTimeline: Json?`，教师聚合时持久化每学生 mood 轨迹

## Schema 改动

```prisma
model AnalysisReport {
  // ... existing fields
  moodTimeline Json?  // PR-7B
}
```

Migration: `prisma/migrations/20260425160756_add_mood_timeline/migration.sql`
```sql
ALTER TABLE "AnalysisReport" ADD COLUMN "moodTimeline" JSONB;
```

DB 真验证：

```
\d "AnalysisReport"
 moodTimeline | jsonb |  |  |
```

## Prisma 三步严格走完

| Step | 命令 | 结果 |
|---|---|---|
| 1 · migrate dev | `npx prisma migrate dev --name add_mood_timeline` | ✅ Applying migration `20260425160756_add_mood_timeline` |
| 2 · generate | (auto-run by migrate dev) | ✅ Generated Prisma Client (v6.19.2) in 189ms |
| 3 · 重启 dev server | `lsof -ti:3000 \| xargs kill -9` + `npm run dev` + 真访问 | ✅ Old PID 70137 killed → new PID 2941 → `/login` 200 → `/sim/[id]` 200 |

## 改动文件

| 文件 | diff | 性质 |
|---|---|---|
| `prisma/schema.prisma` | +1 | 加 `moodTimeline Json?` 字段 |
| `prisma/migrations/20260425160756_add_mood_timeline/migration.sql` | +2 | new migration |
| `lib/types/index.ts` | +13/-2 | `MoodType` 8 档（HAPPY/RELAXED/EXCITED/NEUTRAL/SKEPTICAL/CONFUSED/ANGRY/DISAPPOINTED）+ `TranscriptMessage` 加 `moodScore?`/`hint?` |
| `lib/services/ai.service.ts` | +183/-30 | `chatReply` 重写为返回 `ChatReplyResult` JSON（保留同名 export，签名改）；新增 `generateSocraticHint` |
| `app/api/ai/chat/route.ts` | +13/-3 | 响应扩展 `mood/hint/hintTriggered/studentPerf/deviatedDimensions`；schema 加 `lastHintTurn`/`objectives` |
| `lib/services/insights.service.ts` | +88/-2 | `aggregateInsights` 收集每学生 sim transcript 的 mood timeline 并写入 `AnalysisReport.moodTimeline` |
| `components/simulation/simulation-runner.tsx` | +66/-25 | `parseMoodFromText` 替换为 JSON 字段读取；`MOOD_BANDS`/`MOOD_COLORS` 8 档全填；`handleSend` 计算 `lastHintTurn` + 传递 `objectives`；hint 渲染从 inline cast 改用 `m.hint` |

净 +378 行 / 7 文件。

## 行为升级

### AI prompt 重写（JSON 输出）

```jsonc
// AI 输出（PR-7B JSON 格式）
{
  "reply": "客户中文回复，2-4 句",
  "mood_score": 0.62,             // 0-1 单维强度
  "mood_label": "略焦虑",         // 8 档之一
  "student_perf": 0.2,            // 0-1 学生本轮表现
  "deviated_dimensions": ["识别风险承受能力与投资偏好"]
}
```

prompt 还包含 8 档 mood band 范围说明、中等顽固人设、对话目标维度（来自 rubric）。**真 AI 验证已通过**（见下）。

### B3 hint 触发判定（service 端）

```ts
const offTrack = student_perf < 0.5 || deviated_dimensions.length >= 1;
const turnsSinceHint = lastHintTurn != null
  ? currentTurn - lastHintTurn
  : currentTurn >= 3 ? 3 : 0;       // 第一次 hint：currentTurn ≥ 3 即可触发
const hintTriggered = offTrack && turnsSinceHint >= 3;
```

触发后再调一次 `aiGenerateJSON("studyBuddyReply", ...)` 生成 Socratic 追问。**Service 控制频率，AI 只回答内容**。

### 8 档枚举（向后兼容）

```ts
// 旧 5 档值仍合法（HAPPY/NEUTRAL/SKEPTICAL/CONFUSED/ANGRY）
// 新增 3 档（RELAXED/EXCITED/DISAPPOINTED）
// 历史 transcript 数据零迁移
export type MoodType =
  | "HAPPY" | "RELAXED" | "EXCITED" | "NEUTRAL"
  | "SKEPTICAL" | "CONFUSED" | "ANGRY" | "DISAPPOINTED";
```

### moodTimeline 持久化结构

```jsonc
[
  {
    "studentId": "...",
    "studentName": "张三",
    "submissionId": "...",
    "points": [
      { "turn": 1, "score": 0.05, "label": "HAPPY", "hint": null },
      { "turn": 2, "score": 0.18, "label": "RELAXED", "hint": null },
      { "turn": 3, "score": 0.62, "label": "CONFUSED", "hint": "您是否考虑客户的风险偏好？" }
    ]
  }
]
```

只在 sim transcript 存在 mood 字段时写入；非 sim 任务自然为空数组（写 null）。

## 验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | 0 错误 |
| ESLint | `npx eslint <6 files>` | 0 错误（1 pre-existing `generateObject` 警告，非本 PR 引入）|
| 单测 | `npx vitest run` | **366 / 366 passed**（基线一致）|
| 生产构建 | `npm run build` | 成功 · 25 routes 全编译 |
| DB schema | `\d "AnalysisReport"` | `moodTimeline jsonb` 列已存在 |
| 9 路由 regression | curl 真登录 student1 + teacher1 | 5 student + 4 teacher 全 200 |

## 真 AI E2E（核心验证）

### 场景 1：正常对话（hint 不应触发）

请求：
```jsonc
POST /api/ai/chat
transcript: 1 AI + 1 student（student 提了财务结构问题）
objectives: ["了解家庭财务基本面与支出结构", "识别风险承受能力与投资偏好", "给出至少一个可执行的配置建议"]
```

响应（HTTP 200, 4.69s）：
```jsonc
{
  "reply": "我和爱人加起来月收入大概3.7万... 现在最大的支出就是两套房贷...",
  "mood": { "score": 0.2, "key": "HAPPY", "label": "平静" },
  "hintTriggered": false,
  "studentPerf": 0.6,
  "deviatedDimensions": []
}
```
✅ AI 正确识别"良好开局"→ 平静、不偏离、不触发 hint。

### 场景 2：差表现（hint 应触发）

请求：student 说"今天天气不错"+"您要不要买点比特币"，明显偏离财务咨询场景。

响应（HTTP 200, 6.65s）：
```jsonc
{
  "reply": "比特币？这听起来风险有点高吧。我们家房贷压力不小...",
  "mood": { "score": 0.6, "key": "CONFUSED", "label": "略焦虑" },
  "hint": "您觉得家庭每月收支和房贷压力会影响投资选择吗？",
  "hintTriggered": true,
  "studentPerf": 0.2,
  "deviatedDimensions": ["识别风险承受能力与投资偏好", "了解家庭财务基本面与支出结构"]
}
```
✅ student_perf 0.2 (<0.5) + 2 个 deviated dimensions + currentTurn=3（≥3）→ hint 触发 + Socratic 单句追问 ~25 字。

### 场景 3：hint throttle（lastHintTurn 节流）

请求：传 `lastHintTurn: 2`，currentTurn=3 → turnsSinceHint=1 < 3 → 不应触发。
响应（HTTP 200）：
```jsonc
{
  "reply": "...",
  "mood": { "score": 0.35, "key": "NEUTRAL", "label": "犹豫" },
  "hintTriggered": false,    // ✅ 节流生效
  "studentPerf": 0.4,
  "deviatedDimensions": ["识别风险承受能力与投资偏好"]
}
```
✅ 即使 student_perf 0.4 (<0.5) 且有偏离，因为 lastHintTurn 太近，hint 不触发。

### 场景 4：moodTimeline 持久化 E2E

1. 用 prisma 直接 seed 一份 graded sim submission，transcript 含 5 条消息 (3 AI 含 mood/hint)
2. teacher1 POST `/api/lms/task-instances/{id}/insights/aggregate`（HTTP 200, 7.9s）
3. 真 DB 查询 `AnalysisReport.moodTimeline`：

```jsonc
[
  {
    "studentId": "dcb6638a-...",
    "studentName": "张三",
    "submissionId": "3705b0b2-...",
    "points": [
      { "turn": 1, "score": 0.05, "label": "HAPPY", "hint": null },
      { "turn": 2, "score": 0.18, "label": "RELAXED", "hint": null },
      { "turn": 3, "score": 0.62, "label": "CONFUSED", "hint": "您是否考虑客户的风险偏好？" }
    ]
  }
]
```

✅ 3 AI turns 全部命中 + hint 字段正确保留 + studentName/submissionId 保留。
✅ 测试数据 cleanup 0 残留（submission + AnalysisReport 都删干净）。

### 场景 5：guard 守护

| 路径 | 期望 | 结果 |
|---|---|---|
| 无 graded sim 的 instance POST aggregate | 400 NO_GRADED_SUBMISSIONS | ✅ |
| `/api/ai/chat` body 缺 transcript | 400 validation error | (沿用 PR-7A 已稳, 未重测) |

## 行为不变性 audit（关键 callers）

| 项 | 状态 | 说明 |
|---|---|---|
| `/api/ai/chat` 响应 schema | **扩展但兼容** | `reply` 字段保留；新增 `mood/hint/hintTriggered/studentPerf/deviatedDimensions` 都是 optional 添加，老前端仍能读 `data.reply` |
| `chatReply()` export 名称 | 保留 | 签名改了（return type 从 `Promise<string>` → `Promise<ChatReplyResult>`），grep 全仓只有 1 caller (`app/api/ai/chat/route.ts`)，已同步更新 |
| `chatReply()` 老 `[MOOD: XXX]` 标签兼容 | 客户端 fallback | 客户端 `stripLegacyMoodTag` 仍清理残留标签；service 端 fallback 路径在 JSON 解析失败时返回 NEUTRAL mood |
| `MoodType` 5 档历史值 | **零迁移** | 历史 transcript 含 `mood: "ANGRY"` 等仍合法（type union 的 superset）；UI 通过 `MOOD_COLORS` 映射 8 档中文 |
| `aggregateInsights()` 返回 type | **扩展** | 新增 optional `moodTimelineCount`，不破坏 existing GET cached 路径 |
| `getCachedInsights()` 返回 type | 不动 | 老 type 仍兼容（`AggregateInsightsResult` 仅加 optional 字段）|
| `EvaluationView` 接口 | 不动 | 该组件只读 `messages`，新增 `mood`/`hint` 字段不影响渲染 |
| `course-analytics-tab.tsx` 本地 `TranscriptMessage` | 不动 | 该文件用 local-defined `interface TranscriptMessage { mood?: string }`，与 `lib/types` 解耦，零冲击 |

## 设计决策

1. **保留 `chatReply` 名而不是改 `chatReplyJson`**：API surface 单一 caller (`route.ts`)，改名意义不大且增加 grep noise。改 return type 即可。
2. **`MoodType` union 而非 enum**：现有 codebase 用 string union（同 `TaskType` / `SlotType` 等惯例），向后兼容 5 档值最自然方案。
3. **8 档英文 key + 中文 label 双层映射**：DB/transcript 存英文 key（HAPPY/RELAXED/...），UI 渲染映射为中文（平静/放松/...）— 历史数据零迁移，未来 i18n 也好做。
4. **B3 hint 节流策略**：第一次 hint（无 lastHintTurn）放宽到 `currentTurn >= 3`，避免学生第一轮就被打断；后续严格 `>=3 turns since last hint`。
5. **hint 生成失败不阻断主对话**：`generateSocraticHint` 用独立 try/catch，AI 出错时返回 `undefined` 而非 throw — 主回复仍能展示。
6. **moodTimeline 用 `Prisma.DbNull` sentinel**：Prisma 的 nullable Json 字段必须用 `Prisma.DbNull`（不是 `null`），加了静态 `import { Prisma } from "@prisma/client"`。
7. **`hintTriggered` 字段语义 = "本轮真发出了 hint"**：即 `offTrack && turnsSinceHint >= 3 && hint != null`；hint 生成失败时为 false（避免误导前端跳过下一次触发）。

## 不确定点 / Risks

1. **AI prompt 调试可能需 r2/r3**：当前 qwen-max 输出已稳定（3 个真测场景全 PASS），但生产环境长对话（50+ 轮）下 mood_score 一致性未测。team-lead 已 ack r2/r3 允许。
2. **`mood_score` 与 `mood_label` 一致性**：AI 偶尔会给 score=0.2 但 label="平静"（理论 0.00-0.12 才是平静）。当前不强制一致，UI 用 label 渲染中文 + score 仅记录强度。如需严格，可 server 端用 score 反推 label。
3. **`generateObject` 未用导入警告（pre-existing）**：本 PR 不引入也不修；属于 ai.service.ts 历史代码，独立 PR 清理即可。

## 顺手未做的事

- 没有为 `chatReply` 加单测（service 调真 AI，难 mock；mood label/key 映射的纯函数 `MOOD_LABEL_TO_KEY` 是单语句 record，单测价值低）
- 没有改 `evaluateSimulation`（评分） prompt — 其依赖的旧 `[MOOD:]` 标签从 transcript 来，但客户端 PR-7A 已不再写标签，AI 重新评估会基于 `mood` 字段值（仍可读到，因为 `m.mood` 现在是 8 档英文 key）— 留 PR-7C 或 Phase 8 顺手清

## dev server 状态

- killed PID 70137（PR-7A 遗留）
- fresh restart PID 2941
- `/login` 200, `/sim/{id}` 200
- chat API 真 AI 跑通 4.69s + 6.65s

## 给 qa-p7 的提示

- dev server PID 2941 alive
- student1@finsim.edu.cn / password123 cookie 在 `/tmp/cookies.txt`
- teacher1 cookie 在 `/tmp/tcookies.txt`
- simulation TI id=`e34afdc0-dc06-4072-aa5c-d1b945de0850`
- DB 当前**零 graded sim submission**，所以 aggregate 会返回 NO_GRADED_SUBMISSIONS（这是预期行为，QA 想测 moodTimeline 写入需自行 seed 一份）

**重点验视项**：
1. 真访问 `/sim/[id]` → 真聊一轮 → 检查 AI 气泡下显示 mood chip（中文标签 + 三色 tone good/warn/bad），8 档颜色应正确
2. 故意"差表现"对话（连续 3 轮答非所问）→ 检查学习伙伴 hint 出现（`var(--fs-sim-soft)` 紫色背景 + Sparkles）
3. 触发 hint 后下一轮立刻不应再出 hint（B3 节流）
4. 翻 Network panel 看 `/api/ai/chat` 响应 JSON 字段：`mood / hint / hintTriggered / studentPerf / deviatedDimensions`
5. 测一下 mood meter（顶栏 8 段条）随对话切换正确档位（不再是 PLACEHOLDER）

**允许 r2/r3**: team-lead 已 ack 真 AI prompt 调试可能 r1 不一次过 PASS。
