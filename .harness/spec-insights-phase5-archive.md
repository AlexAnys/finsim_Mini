# Spec — 数据洞察重构 · Phase 5：AI 教学建议 + KPI 下钻 + UUID→name UX 修复

> Phase 1-4 已 commit (`0f823d0` / `40b504a` / `a311478` / `22dc29c` / `3831468`)。本 spec 仅负责 Phase 5。完整 plan：`~/.claude/plans/main-session-snug-tide.md`。

## Unit 标识
- `insights-phase5`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 当前 Baseline
- 分支 `claude/elastic-davinci-a0ee14`，**5 commits ahead** of main `e311571`
- 区块 A/B/C 已实装；区块 D 是 phase 3 的 stub「即将推出」
- KPI 5 卡 `onClick`/`href` props 已留（phase 2），phase 5 实装 drawer
- service [scope-insights.service.ts](lib/services/scope-insights.service.ts) 已有 `getScopeSimulationInsights / getScopeStudyBuddySummary / scopeHash + 24h cache + LLM 失败兜底`
- service [weekly-insight.service.ts](lib/services/weekly-insight.service.ts) 已有 `generateWeeklyInsight` LLM 模式参考
- AnalysisReport.scopeSummary Json 已有（phase 4），可扩展加 `teachingAdvice` 字段

## Phase 5 范围

### ✅ 必须做的 5 件事

#### 1. Service 新增 `generateScopeTeachingAdvice` （AI 教学建议）

加入 [scope-insights.service.ts](lib/services/scope-insights.service.ts)：

```ts
export interface ScopeTeachingAdvice {
  scope: ScopeKey;
  generatedAt: string;
  source: "fresh" | "cache" | "fallback";
  knowledgeGoals: Array<{ point: string; evidence: string }>;
  pedagogyAdvice: Array<{ method: string; evidence: string }>;
  focusGroups: Array<{
    group: string;       // "8 名 declining 学生"
    action: string;      // "本周课前 5 分钟 1v1 复盘"
    studentIds: string[];
    evidence: string;    // "归一化均分 < 50% 持续 3 次"
  }>;
  nextSteps: Array<{ step: string; evidence: string }>;
  notice?: string;       // fallback 时显示「LLM 暂不可用，显示模板建议」
}

export async function getScopeTeachingAdvice(
  scope: ScopeKey,
  options?: { forceFresh?: boolean }
): Promise<ScopeTeachingAdvice>
```

**实现要点**：
- 复用 `scopeHash` + `AnalysisReport.scopeSummary` JSON（在 scopeSummary 里加 `teachingAdvice` 字段，**不动 Prisma schema**）
- 24h 缓存：先查 `AnalysisReport WHERE scopeHash = X AND createdAt > now-24h`，如 scopeSummary.teachingAdvice 存在且未过期 → source="cache"
- 不命中 / forceFresh：聚合 LLM 输入（**这是核心**）：
  - KPI snapshot：completionRate, avgNormalizedScore, pendingReleaseCount, riskChapter数, riskStudent数
  - studentInterventions（top-15 按 reason+score）
  - **scope simulation insights**（高分典型 + 低分问题 commonIssues，复用 phase 4 service）
  - **scope studybuddy summary**（按 section 共性问题，复用 phase 4 service）
  - 风险章节列表（completionRate < 60% OR avgScore < 60）
- LLM prompt（中文，结构化）：
  ```
  你是高校金融教育的资深教学顾问。基于以下学情数据，给出针对性教学建议：

  【KPI 概览】... 
  【共性问题】...
  【学生分布】...
  【共性提问】...
  【风险章节】...

  请输出 JSON：
  {
    "knowledgeGoals": [...],   // 3-4 项知识目标 + evidence
    "pedagogyAdvice": [...],   // 3-4 项教学方式 + evidence
    "focusGroups": [...],      // 2-3 个关注群体 + studentIds + action + evidence
    "nextSteps": [...]         // 3-4 个接下来步骤 + evidence
  }
  每条 evidence 必须直接引用上述数据中的具体数字 / 学生名 / 章节名。
  ```
- 调 `aiGenerateJSON<ScopeTeachingAdvice>` (provider feature `insights`)
- LLM 失败兜底（**不能让 UI 空白**，参考 [weekly-insight.service.ts:377](lib/services/weekly-insight.service.ts#L377) fallback 模式）：
  - knowledgeGoals: 基于 KPI 自动生成（如「本周需关注归一化均分 X% 偏低，建议加强 risk-tagged 章节复习」）
  - pedagogyAdvice: 模板化通用方法（如「针对低分维度增加 1 节翻转课堂」）
  - focusGroups: 直接用 studentInterventions 三 reason 分组
  - nextSteps: 模板化 step
  - source = "fallback"，notice = "LLM 暂不可用，显示规则模板建议"
- 写回 `AnalysisReport.scopeSummary.teachingAdvice`

#### 2. API 扩展 `/api/lms/analytics-v2/scope-insights`

[route.ts](app/api/lms/analytics-v2/scope-insights/route.ts) GET 返回结构扩展：
```ts
{ success: true, data: { simulation, studyBuddy, teachingAdvice } }
```

POST 也调 `getScopeTeachingAdvice(..., { forceFresh: true })`，返回三者新版本。

#### 3. 区块 D 实装 `teaching-advice-block.tsx`

替换 phase 3 的 stub。

**布局**（按 §3 设计约束保持风格一致）：
```tsx
<Card className="rounded-lg">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Sparkles className="size-4 text-brand" />
      AI 教学建议
    </CardTitle>
    <CardDescription className="flex items-center gap-2">
      <span>{generatedAt 中文}</span>
      <Badge variant="outline">{source 中文标签：缓存/已生成/降级}</Badge>
      <Button variant="ghost" size="sm" onClick={regenerate}>
        <RefreshCw /> 重新生成
      </Button>
    </CardDescription>
    {notice && (
      <Alert className="mt-2"><AlertCircle /> {notice}</Alert>
    )}
  </CardHeader>
  <CardContent className="space-y-3">
    <AdviceSection icon={Lightbulb} title="知识目标" items={knowledgeGoals} renderItem={(it) => ({primary: it.point, evidence: it.evidence})} />
    <AdviceSection icon={BookOpen} title="教学方式" items={pedagogyAdvice} renderItem={(it) => ({primary: it.method, evidence: it.evidence})} />
    <AdviceSection icon={Users} title="关注群体" items={focusGroups} renderItem={(it) => ({primary: `${it.group} · ${it.action}`, evidence: it.evidence, studentIds: it.studentIds})} />
    <AdviceSection icon={ArrowRight} title="接下来怎么教" items={nextSteps} renderItem={(it) => ({primary: it.step, evidence: it.evidence})} />
  </CardContent>
</Card>
```

`AdviceSection` 内部组件：
- 折叠列表（≤4 行展示，超出 collapsible「展开更多」）
- 每条主文 + 「依据」可展开（小字 `text-xs text-muted-foreground` 带 evidence）
- focusGroups item 额外显示 `studentIds.length` 名学生 → 点击展开学生名（用现有 studentInterventions 数据查 name）

#### 4. KPI 5 卡下钻 drawer 全打通

新建 `components/analytics-v2/risk-drawer.tsx`：

```ts
type KpiDrawerKind =
  | { kind: "completion_rate"; missingStudents: Array<{id, name, classId, taskId, taskTitle}> }
  | { kind: "avg_score"; lowScorers: Array<{studentId, name, taskTitle, score, taskInstanceId}> }
  | { kind: "pending_release"; pendingSubmissions: Array<{id, studentName, taskTitle, dueAt, submittedAt, taskInstanceId}> }
  | { kind: "risk_chapter"; chapters: Array<{chapterId, title, completionRate, avgScore, instanceCount, instances: [{id, title}]}> }
  | { kind: "risk_student"; students: Array<{studentId, name, classId, reason, taskInstances: [{id, title}]}> };
```

**Drawer 布局**：
- 标题：根据 kind 显示「未提交学生 · N 人」/「低分学生 · N 人」/「待发布作业 · N 件」/「风险章节 · N 个」/「风险学生 · N 名」
- 列表：每行显示关键字段
- 行内「→ 单实例洞察」按钮跳 `/teacher/instances/{taskInstanceId}/insights`（如适用）
- 「→ 批改页」按钮（pending_release 类型）跳 `/teacher/instances/{taskInstanceId}`

**KPI 卡接 onClick**：
- KpiRow 组件 onClick 实装：dispatch 一个 setOpenDrawer({kind, ...data})
- dashboard 维护 drawer state，传给 RiskDrawer

**数据来源**：
- 大部分数据已在 `diagnosis` 里（chapterDiagnostics / studentInterventions / instanceDiagnostics）
- `pending_release` 需要新 service 函数 `getPendingReleaseList(scope) → Array<{...}>`：query 对应 submission with taskInstance + student
- `missing_students`（未提交）：student set diff 计算（assignedStudents 减去 submittedStudentIds）

新增 service `lib/services/scope-drilldown.service.ts`（避免 scope-insights.service 进一步膨胀）：
```ts
export async function getMissingStudents(scope: ScopeKey): Promise<Array<MissingStudent>>
export async function getLowScorers(scope: ScopeKey, threshold = 60): Promise<Array<LowScorer>>
export async function getPendingReleaseList(scope: ScopeKey): Promise<Array<PendingSubmission>>
export async function getRiskChapters(scope: ScopeKey): Promise<Array<RiskChapter>>  // 复用 chapterDiagnostics 算法 + instances detail
export async function getRiskStudents(scope: ScopeKey): Promise<Array<RiskStudent>>  // 复用 studentInterventions + 详情
```

新 API `app/api/lms/analytics-v2/drilldown/route.ts`：
- GET `?kind=completion_rate&courseId=X&...` → 按 kind 调对应 service 函数 → 返回 list
- requireRole(["teacher", "admin"])

#### 5. 修 phase 4 Minor 1：commonIssue.relatedCriterion 显示 UUID → criterion name

[scope-insights.service.ts](lib/services/scope-insights.service.ts) `getScopeSimulationInsights`：
- 在 service 内查 criterion id → name 映射（`prisma.scoringCriterion.findMany` from related taskIds）
- LLM prompt 输入用 criterion name（不暴露 UUID）
- LLM 输出 commonIssues[].relatedCriterion 应该是 name 字符串
- 双重保险：service 在 LLM 返回后做 `criterionName: nameMap.get(originalCriterionId) ?? originalCriterion`，防 LLM 不老实
- **注意**：cache 里的旧数据 (UUID) 也要修 — 加一行迁移逻辑：cache 命中后检查 commonIssue.relatedCriterion 是否像 UUID（`/^[0-9a-f-]{36}$/`），是则用 nameMap 转换

### ❌ 必须不做的 5 件事

1. ❌ 不动 Prisma schema（复用 scopeSummary Json，不加新表/字段）
2. ❌ 不引入新依赖
3. ❌ 不动区块 A / B / C 现有功能
4. ❌ 不动 Filter Bar / KPI 数据计算逻辑（仅加 onClick）
5. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx)

## Acceptance Criteria

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` 全过
4. `npm run build` 成功
5. **不引入新 npm 依赖**（package.json 不变）

### B. AI 教学建议 service
6. `getScopeTeachingAdvice(scope, opts)` 在 scope-insights.service.ts 导出
7. 24h 缓存生效：第一次 source="fresh" 第二次 source="cache" 同 generatedAt
8. forceFresh 选项绕过缓存
9. LLM 真调成功（有数据课程如 e6）：返回 4 类各 3-4 项 + evidence 全中文
10. LLM 失败兜底：mock provider 报错 → source="fallback" + 4 类模板内容非空 + notice 中文
11. evidence 字段引用具体数字 / 学生名 / 章节名（grep 验证至少含一个数字）

### C. API 扩展
12. GET `/api/lms/analytics-v2/scope-insights?courseId=X` 返回 `{ data: { simulation, studyBuddy, teachingAdvice } }` 三键齐
13. POST 同上 + teachingAdvice.source="fresh" 或 "fallback"
14. 未登录 401 / 学生角色 403

### D. 区块 D 实装（teaching-advice-block）
15. 区块 D 不再显示 ComingSoon（除非 scope 内 0 数据）
16. Card header 显示 generatedAt 中文 + source 中文 Badge（缓存/已生成/降级）+ 重新生成按钮
17. fallback 状态显示 notice Alert
18. 4 类（知识目标 / 教学方式 / 关注群体 / 接下来怎么教）各 1 个 section + 不同 icon
19. 每条主文 + 「依据」可展开（默认折叠 evidence，点击「展开依据」显示）
20. focusGroups item 显示 group + action + studentIds 数 + 可点击展开学生名
21. 中文文案 + 设计 token 配色（icon 用 brand / muted-foreground）

### E. KPI 下钻 drawer
22. `components/analytics-v2/risk-drawer.tsx` 存在
23. 5 个 KPI 卡 onClick 接通：
    - 完成率点击 → drawer kind=completion_rate 列未提交学生
    - 归一化均分点击 → drawer kind=avg_score 列低分学生
    - 待发布点击 → drawer kind=pending_release 列待发布作业
    - 风险章节点击 → drawer kind=risk_chapter 列章节 + 内任务
    - 风险学生点击 → drawer kind=risk_student 列学生 + reason
24. drawer 内行内有「→ 单实例洞察」链接（taskInstanceId 已知时）
25. drawer 内 pending_release 行额外有「→ 批改页」链接
26. 空数据 → drawer 显示「当前范围 N 项无内容」中文提示
27. KPI 卡视觉：cursor pointer（hover 时）+ 整卡可点击

### F. drilldown service + API
28. `lib/services/scope-drilldown.service.ts` 存在 + 5 函数 export
29. `app/api/lms/analytics-v2/drilldown/route.ts` GET 200 + 5 kind 全工作
30. drilldown API 返回数据正确性：手算 a201 missing_students = assigned - submitted

### G. UUID → name UX 修复
31. service 加 criterionId → name 映射查询
32. 区块 B「低分问题」列表项不再显示 UUID（如 `f25293a6-...`），改显 criterion name（如「需求澄清能力」）
33. drawer issue 类型同上不再显示 UUID
34. 旧 cache 数据也被自动转换（cache 命中时检查 UUID pattern + 转换）

### H. Phase 1-4 anti-regression
35. KPI 5 卡数字与 phase 4 一致
36. 区块 A/B/C 完整可用
37. Filter Bar / 班级多选 / 默认全部班 全工作
38. 老 URL 兼容
39. 单实例 insights / teacher dashboard 隔离
40. recharts bar fill 仍 CSS 变量
41. dashboard.tsx < 850 行（phase 4 是 704 + 本 phase 加 KPI onClick + drawer state ≈ 60 行 = 764 行）
42. defaultClassIdsAppliedRef + courseId guard 完整保留
43. Prisma 三步 N/A（本 phase 不动 schema）

## Risks

| 风险 | 防御 |
|---|---|
| LLM 调用 token 高峰 | 24h scopeHash cache + 手动「重新生成」按钮，与 phase 4 同 |
| LLM 输出不结构化或缺 evidence | Zod 校验失败 → 兜底模板，不抛错 |
| KPI 5 卡 onClick 触发 drilldown API 慢 → drawer loading 不流畅 | drawer open 时立刻显示 loading skeleton + 不阻塞主页面 |
| pending_release / missing_students SQL 慢 | 限制返回 ≤50 条 + 加 LIMIT |
| UUID → name 映射 cache 旧数据看起来 stale | service 命中 cache 后 in-memory 转换 + 不修改 DB（避免幂等问题）|
| 区块 D 内容过多撑高卡片 → 4 区块布局打破 | AdviceSection 默认 ≤4 行 + 「展开更多」 collapsible |

## QA 验证

### 必做
1. tsc / lint / vitest / build
2. 真浏览器 via gstack `/qa-only`：
   - dev server 3031 alive
   - 区块 D 4 类显示 + evidence 展开 + 重新生成按钮工作
   - KPI 5 卡 click → drawer 打开 + 5 种 kind 全测
   - drawer 行内链接跳 single instance insights / 批改页正常
   - 区块 B「低分问题」列表 UUID 已替换为 name
   - 4 区块布局无破坏
   - 截图 ≥ 8 张 `/tmp/qa-insights-phase5-*.png`：D 4 类完整 / D evidence 展开 / D fallback notice / KPI 5 个 drawer 各一张 / B UUID 已修复
3. **数据正确性**：
   - drilldown missing_students = SQL 直查 assigned - submitted 一致
   - drilldown risk_chapter chapter 数与 KPI 卡数字一致
   - drilldown risk_student 数与 KPI 卡数字一致
4. **LLM 失败兜底**：mock provider 报错 → 区块 D fallback notice 显示 + 4 类有内容
5. **UUID 修复回归**：phase 4 已生成的 cache（含 UUID）被 service 命中时，UI 显示 name（不显示 UUID）

### 跳过
- ❌ Prisma 三步（本 phase 无 schema 改动）
- ❌ Bundle size（不引入新 deps）
- ❌ /cso（无安全敏感改动）

## 提交策略

Atomic commit message：
```
feat(insights): phase 5 — AI teaching advice + KPI drilldown drawer + UUID UX fix

- New getScopeTeachingAdvice in scope-insights.service.ts
  (LLM 4 类 knowledgeGoals / pedagogyAdvice / focusGroups / nextSteps + evidence,
   24h scopeHash cache 复用 phase 4 scopeSummary JSON, 失败兜底模板 + notice)
- New lib/services/scope-drilldown.service.ts (5 functions: getMissingStudents
  / getLowScorers / getPendingReleaseList / getRiskChapters / getRiskStudents)
- New API app/api/lms/analytics-v2/drilldown/route.ts (5 kinds GET, requireRole)
- API /scope-insights GET/POST 扩展返回 teachingAdvice
- Block D: teaching-advice-block.tsx 实装 (4 sections 不同 icon,
  evidence collapsible, fallback notice Alert, 重新生成按钮)
- New components/analytics-v2/risk-drawer.tsx (5 kinds list + cross-link to
  single instance insights / 批改页)
- KPI 5 卡 onClick 接 risk-drawer (cursor pointer + 整卡可点击)
- Fix Phase 4 Minor 1: criterion UUID → name (service 加 nameMap, LLM input/output
  都用 name; cache 旧数据 in-memory 转换 UUID→name)

Phase 1-4 anti-regression preserved (defaultClassIdsAppliedRef + courseId guard,
entity vs filter classIds, recharts design tokens, 4 blocks layout, 24h cache,
LLM fallback template, dashboard <850 行)。

QA: r1 PASS X/X (tsc/lint/vitest/build 全绿)
- 4 类教学建议 + evidence 中文 + LLM 兜底
- KPI 5 个 drawer 全打通 + 跨链接到单实例 insights / 批改页
- UUID → name 修复 (phase 4 cache 也自动转换)
- 8 张真浏览器截图 /tmp/qa-insights-phase5-*.png

See plan: ~/.claude/plans/main-session-snug-tide.md
See spec: .harness/spec.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
