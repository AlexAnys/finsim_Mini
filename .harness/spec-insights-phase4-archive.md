# Spec — 数据洞察重构 · Phase 4：任务表现 + Study Buddy（Prisma + LLM + Drawer）

> Phase 1-3 已 commit (`0f823d0` / `40b504a` / `a311478` / `22dc29c`)。本 spec 仅负责 Phase 4。
> 完整 plan：`~/.claude/plans/main-session-snug-tide.md`。

## Unit 标识
- `insights-phase4`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 当前 Baseline
- 分支 `claude/elastic-davinci-a0ee14`，**4 commits ahead** of main `e311571`
- 区块 A 实装；区块 B/C/D 是 stub「即将推出」
- service 已有 [insights.service.ts](lib/services/insights.service.ts) `aggregateInsights / getCachedInsights`（task instance 级）
- service 已有 [study-buddy.service.ts](lib/services/study-buddy.service.ts) `generateSummary`（task 级）+ `StudyBuddySummary.topQuestions`（已存）
- [ai.service.ts](lib/services/ai.service.ts) `aiGenerateJSON<T>` helper 可用
- [grading-drawer.tsx](components/instance-detail/grading-drawer.tsx)：参考的 Sheet drawer 模式（599 行，含 transcript 渲染）

## ⚠️ Prisma 三步铁律（CLAUDE.md anti-regression #5）

本 phase 改 schema，**必须严格三步且不能跳过**：
1. 编辑 `prisma/schema.prisma`
2. `npx prisma migrate dev --name phase4_scope_analysis_report`
3. `npx prisma generate`
4. **重启 worktree 内 dev server (port 3031)**：`pkill -f "next dev -p 3031"` → `cd worktree && npm run dev -- -p 3031` 或 `next dev -p 3031`
5. **真浏览器打开 page 验证不报 500**

跳过任何一步会导致运行时 500 但 tsc --noEmit 不报错。

## Phase 4 范围

### ✅ 必须做的 6 件事

#### 1. Prisma schema 扩展 [AnalysisReport](prisma/schema.prisma:814)

```prisma
model AnalysisReport {
  id             String   @id @default(uuid())
  taskId         String?
  taskInstanceId String?  @unique         // 保留（instance 级报告）
  scopeHash      String?                  // 新增：scope 级报告 hash
  scopeSummary   Json?                    // 新增：scope simulation 高分典型 + 低分问题 + studybuddy
  createdBy      String
  studentCount   Int
  report         Json
  createdAt      DateTime @default(now())
  commonIssues   Json?
  aggregatedAt   DateTime?
  moodTimeline   Json?

  creator      User          @relation("ReportCreator", fields: [createdBy], references: [id])
  task         Task?         @relation("ReportTask", fields: [taskId], references: [id])
  taskInstance TaskInstance? @relation("ReportInstance", fields: [taskInstanceId], references: [id])

  @@index([createdBy])
  @@index([taskId])
  @@index([scopeHash])         // 新增：scope 报告查找
}
```

注意：保持 `taskInstanceId @unique`，scope 级报告通过 `scopeHash` 区分（taskInstanceId null）。

#### 2. Service：scope 级 simulation insights

新增 `lib/services/scope-insights.service.ts`（独立文件，避免 analytics-v2.service.ts 进一步膨胀）：

```ts
export interface ScopeSimulationInsight {
  scope: ScopeKey;             // courseId / chapterId / sectionId / classIds / taskType / taskInstanceId
  generatedAt: string;
  highlights: Array<{          // 高分典型（启发式 + 可选 LLM 润色）
    studentId: string;
    studentName: string;
    submissionId: string;
    taskInstanceId: string;
    taskTitle: string;
    score: number;
    normalizedScore: number;
    transcript: TranscriptExcerpt[];   // 抽 ≤3 段亮点
    reason: string;            // 启发式描述（如"该学生在第 4 轮转折点抓住了客户犹豫情绪 + 给出 60/40 配比建议"）
  }>;
  commonIssues: Array<{        // 低分问题（LLM 聚合）
    title: string;             // 问题简称（中文）
    description: string;       // 问题描述
    frequency: number;         // 出现学生数
    relatedCriterion: string;  // 关联评分维度
    evidence: Array<{
      studentId: string;
      studentName: string;
      submissionId: string;
      transcriptExcerpt: string;
      rubricCriterion: string;
      score: number;
    }>;
  }>;
  source: "cache" | "fresh";
  staleAt?: string;            // cache 过期时间
}

export interface ScopeKey {
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  classIds?: string[];
  taskType?: TaskType;
  taskInstanceId?: string;
}

export async function getScopeSimulationInsights(
  scope: ScopeKey,
  options?: { forceFresh?: boolean }
): Promise<ScopeSimulationInsight>
```

**实现要点**：
- `scopeHash = sha256(JSON.stringify(scope))` 标准化排序
- 缓存 24h：先查 `AnalysisReport WHERE scopeHash = X AND createdAt > now-24h LIMIT 1`，命中且 `!forceFresh` 直接返回 `scopeSummary`
- 不命中：
  - **高分典型（启发式，免费）**：拉 scope 内 simulation submissions（taskType=simulation, status=graded），按归一化分数 desc 排序取 top-N（N=4）
    - 同一任务取 ≤2 名学生避免单任务垄断
    - 从 transcript 抽片段：`student/user` 角色 + 长度 > 15 字 + `mood` 积极的回合，最多 3 条 / 学生
    - reason 字段简单模板："{studentName} 在 {taskTitle} 中得分 {score}/{maxScore}，对话亮点见证据。"
  - **低分问题（LLM）**：聚合 scope 内 simulation submissions 的 evaluation.rubricBreakdown 中 `score / maxScore < 0.6` 的 criterion + comment，按 criterionId group + count
    - 取 top-3 高频弱项 + 每项最多 5 个学生 transcript 片段作输入
    - 调 `aiGenerateJSON<{commonIssues}>` (provider feature `insights`，参考 [insights.service.ts:367](lib/services/insights.service.ts#L367))
    - prompt 模板（中文）：「以下是教学场景模拟对话中，学生在 {criterion} 维度得分较低的样本，请总结 3-4 个最常见的共性问题。每个问题给出：title (≤15 字) / description (≤80 字) / 关联 criterion / 至少 2 个学生证据。输出 JSON: {commonIssues: [...]}.」
    - LLM 失败兜底：返回模板化结果（"未找到充分样本，请增加学生提交数"），UI 不空白
- 写回 `AnalysisReport(scopeHash, scopeSummary, ..., taskInstanceId=null)`

#### 3. Service：scope 级 Study Buddy 共性问题

同文件 `lib/services/scope-insights.service.ts`：

```ts
export interface ScopeStudyBuddySummary {
  scope: ScopeKey;
  generatedAt: string;
  bySection: Array<{
    sectionId: string | null;
    sectionLabel: string;     // "第 1 章 1.2 节"，null section 显示"未分配章节"
    chapterId: string | null;
    topQuestions: Array<{
      text: string;
      count: number;
      studentSampleIds: string[];   // 提问的学生 sample（可点击展开）
    }>;
  }>;
}

export async function getScopeStudyBuddySummary(
  scope: ScopeKey
): Promise<ScopeStudyBuddySummary>
```

**实现**（**纯查询，无 LLM**，直接读已有 StudyBuddySummary）：
- 拉 scope 内所有 task 的 `StudyBuddySummary` (`task.id IN scope task ids`)
- 按 task → section 反向映射
- 每节 group：合并多 task 的 `topQuestions`，按 `count` 排序取 top-5
- 多任务相同问题不去重（用 task 级 count 直接聚合，避免去重导致 sample 信息丢失）

#### 4. API endpoint

新建 `app/api/lms/analytics-v2/scope-insights/route.ts`：

- **GET**：
  - 入参：query 同 diagnosis（courseId 必选 + chapter/section/classIds/taskType/taskInstanceId optional）
  - requireRole(["teacher", "admin"])
  - 调 `getScopeSimulationInsights({...})` 和 `getScopeStudyBuddySummary({...})`
  - 返回 `{ simulation: ScopeSimulationInsight, studyBuddy: ScopeStudyBuddySummary }`
- **POST**：
  - 入参同 GET
  - 触发 `getScopeSimulationInsights({...}, { forceFresh: true })`（手动重新生成，会调 LLM）
  - 返回新结果（不走 async-job，因为 LLM 调用 < 30s 通常 OK；超时返回 504）

#### 5. 区块 B 实装（task-performance-block.tsx）

替换 phase 3 的 stub。

**布局**：
```tsx
<Card className="rounded-lg">
  <CardHeader>
    <CardTitle>任务表现典型例子</CardTitle>
    <CardDescription>
      {generatedAt 信息} · 
      <Button variant="ghost" size="sm" onClick={regenerate}>
        <RefreshCw /> 重新生成
      </Button>
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="highlights">
      <TabsList>
        <TabsTrigger value="highlights">高分典型 ({n})</TabsTrigger>
        <TabsTrigger value="issues">低分问题 ({m})</TabsTrigger>
      </TabsList>
      <TabsContent value="highlights">
        {highlights.map(h => (
          <button onClick={() => openEvidence(h)}>
            <span>{h.studentName} - {h.taskTitle} - {h.normalizedScore}%</span>
            <span className="line-clamp-2">{h.reason}</span>
            <ChevronRight />
          </button>
        ))}
      </TabsContent>
      <TabsContent value="issues">
        {commonIssues.map(issue => (
          <button onClick={() => openEvidence(issue)}>
            <Badge>×{issue.frequency}</Badge>
            <span className="font-medium">{issue.title}</span>
            <span className="text-muted-foreground line-clamp-2">{issue.description}</span>
          </button>
        ))}
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
```

#### 6. 区块 C 实装（study-buddy-block.tsx）

替换 phase 3 的 stub。

**布局**：
```tsx
<Card>
  <CardHeader>
    <CardTitle>Study Buddy 共性问题</CardTitle>
    <CardDescription>{generatedAt}</CardDescription>
  </CardHeader>
  <CardContent>
    {bySection.length === 0 ? <ComingSoon ... /> : (
      <Accordion type="multiple">
        {bySection.map(s => (
          <AccordionItem value={s.sectionId ?? "null"}>
            <AccordionTrigger>
              <span>{s.sectionLabel}</span>
              <Badge>{s.topQuestions.length}</Badge>
            </AccordionTrigger>
            <AccordionContent>
              {s.topQuestions.map(q => (
                <button onClick={() => openStudentSamples(q)}>
                  <Badge>×{q.count}</Badge>
                  <span>{q.text}</span>
                </button>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )}
  </CardContent>
</Card>
```

#### 7. 证据 Drawer 组件

新建 `components/analytics-v2/evidence-drawer.tsx`：

复用 [grading-drawer.tsx](components/instance-detail/grading-drawer.tsx) 的 Sheet 模式 + transcript 渲染（参考 [insights/page.tsx:559-628](app/teacher/instances/[id]/insights/page.tsx)）。

```ts
interface EvidenceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence:
    | { type: "highlight"; data: ScopeSimulationInsight["highlights"][number] }
    | { type: "issue"; data: ScopeSimulationInsight["commonIssues"][number] }
    | { type: "studybuddy_question"; data: ScopeStudyBuddySummary["bySection"][number]["topQuestions"][number]; sectionLabel: string }
    | null;
}
```

**渲染**：
- highlight 类型：学生头 + score badge + reason 简介 + transcript（3 条片段, mr-6 / ml-6 气泡 + role 标签 + mood emoji）+ 跳「单实例洞察」链接
- issue 类型：title + description + frequency + 关联 criterion + N 个学生证据列表（每条含 student + transcriptExcerpt + score）+ 各跳单实例洞察链接
- studybuddy_question 类型：sectionLabel + 问题文本 + count + 提问学生列表

### ❌ 必须不做的 5 件事

1. ❌ 不动 区块 D（AI 教学建议）— 那是 phase 5
2. ❌ 不动 区块 A / KPI / Filter
3. ❌ 不引入新 npm 依赖（recharts 在 phase 2 已是唯一新依赖）
4. ❌ 不动 [/teacher/instances/[id]/insights](app/teacher/instances/[id]/insights/page.tsx) （证据 drawer 链回它，但本身不动）
5. ❌ KPI 卡的下钻仍不接 drawer（phase 5）

## Acceptance Criteria

### A. 类型与构建（**Prisma 三步铁律**）
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` 全过
4. `npm run build` 成功
5. **Prisma 三步全做**：migration 文件存在 + `node_modules/.prisma/client` 含 `scopeHash` 字段（grep 验证）+ dev server 重启后 page 200（不 500）

### B. Schema 改动
6. `AnalysisReport.scopeHash String?` + `scopeSummary Json?` + `@@index([scopeHash])` 三项都加
7. `taskInstanceId @unique` 仍保留（不破坏 instance 级报告语义）
8. Migration SQL 含 `ADD COLUMN scopeHash` + `CREATE INDEX`

### C. Service 实装
9. `lib/services/scope-insights.service.ts` 存在
10. `getScopeSimulationInsights(scope, opts)` export 签名匹配 spec
11. `getScopeStudyBuddySummary(scope)` export 签名匹配 spec
12. scopeHash 算法稳定（同 scope 多次调 hash 相同；scope 字段顺序无关）
13. 24h 缓存生效：第一次调 → DB 写 + 返回 source="fresh"；第二次同 scope 调 → DB 读 + 返回 source="cache"
14. forceFresh 选项绕过缓存
15. LLM 失败兜底：mock LLM 报错 → 返回模板化 commonIssues（不抛 + 不空数组）
16. Study Buddy 按 section group + top-5 排序正确（手算 1 个 section 验证）

### D. API endpoint
17. GET `/api/lms/analytics-v2/scope-insights?courseId=X&classIds=A&classIds=B` 返回 200
18. 返回结构 `{ success: true, data: { simulation, studyBuddy } }`
19. POST `/api/lms/analytics-v2/scope-insights?courseId=X` 返回 200 + simulation.source="fresh"
20. 未登录 401 / 学生角色 403

### E. 区块 B 实装（task-performance）
21. 区块 B 不再显示 ComingSoon（或仅在数据为空时显示「暂无」）
22. 2 sub-tabs：高分典型 / 低分问题
23. 高分典型 tab：列表显示 ≤4 例（学生名 + 任务 + 分数 + reason）
24. 低分问题 tab：列表显示 ≤4 例（title + description + ×frequency Badge + 关联 criterion）
25. 卡 header 显示 generatedAt + 「重新生成」按钮（带 RefreshCw icon）
26. 「重新生成」点击 → POST API → loading 旋转 → 刷新数据
27. 列表项点击 → openEvidence → Sheet drawer 打开
28. 空状态：scope 内无 simulation / 无 graded → ComingSoon「当前范围无 simulation graded 数据」

### F. 区块 C 实装（study-buddy）
29. 区块 C 不再显示 ComingSoon（或仅在数据为空时显示）
30. Accordion 按 section 折叠
31. 每节显示 ≤5 top questions + ×count Badge
32. 节标题显示「{chapterTitle} {sectionTitle}」+ 问题数 Badge
33. 问题点击 → 显示提问学生列表（可在 drawer 或 popover）

### G. 证据 Drawer
34. `components/analytics-v2/evidence-drawer.tsx` 存在
35. 三种 evidence 类型（highlight/issue/studybuddy_question）UI 渲染都正确
36. highlight：学生 + score + transcript 气泡渲染（与 [insights/page.tsx:601-616](app/teacher/instances/[id]/insights/page.tsx) 同模式）
37. issue：title + 多学生证据
38. studybuddy_question：section + 问题 + 学生列表
39. drawer 内"查看完整提交"链接 → `/teacher/instances/{id}/insights`

### H. Phase 1-3 anti-regression
40. KPI 5 卡数字与 phase 3 一致
41. 区块 A 完整可用（5/10 段切换 / tooltip / cursor pointer / 多班分色）
42. Filter Bar / 班级多选 / 默认全部班 全工作
43. 老 URL 兼容
44. 单实例 insights / teacher dashboard 隔离
45. recharts bar fill 仍 CSS 变量（grep）
46. dashboard.tsx < 800 行（phase 3 已 632，本 phase 仅微改）

## Risks

| 风险 | 防御 |
|---|---|
| Prisma 三步漏步 → tsc 过但运行 500 | spec §A.5 强制 grep `.prisma/client` 含新字段 + 真浏览器 200 |
| LLM 调用 > 30s 超时 | API 加 timeout 25s + 超时返回 504 + UI 显示「超时，请稍后重试」 |
| LLM 调用 token 高峰 | 24h 缓存 + 手动「重新生成」按钮，避免 page load 自动调 LLM |
| scopeHash 不稳定 | hash 前 sort keys + 数组 sort + 用 sha256 |
| AnalysisReport.taskInstanceId @unique 与 scope 级 null 冲突 | scope 级 row taskInstanceId=null（unique 允许多 null）+ 用 scopeHash 标识 |
| Drawer 内 transcript 大对象拖慢 | scope-insights service 已截断 transcript ≤3 片段 |
| 多班 + 多 LLM 调用并发 | 缓存命中后无 LLM 调用 / forceFresh 用 mutex 防同 scope 并发请求 |

## QA 验证

### 必做
1. tsc / lint / vitest / build
2. **Prisma 三步验证**：
   - `cat prisma/migrations/*phase4*` 见 ALTER TABLE
   - `node_modules/.prisma/client/index.d.ts` grep `scopeHash`
   - dev server 重启后 `curl /teacher/analytics-v2` 重定向 /login（200）
3. **真浏览器** via gstack `/qa-only`：
   - dev server worktree 3031 重启后访问
   - 区块 B 高分典型 + 低分问题 tab 切换看数据
   - 「重新生成」按钮触发 POST + loading + 刷新
   - 区块 C accordion 展开每节看 top questions
   - 列表项点击打开证据 drawer 看 transcript / studybuddy 学生列表
   - drawer 内「查看完整提交」跳单实例 insights
   - 4 区块布局完整 + KPI / 区块 A 不变
   - 截图 ≥ 6 张 `/tmp/qa-insights-phase4-*.png`：B 高分典型 / B 低分问题 / B drawer transcript / C accordion / C drawer studybuddy / 整页 4 区块
4. **数据正确性**：
   - 手算 scope 内 simulation graded count + service highlights 数对比
   - 手算 1 节 StudyBuddySummary topQuestions count 与 UI 显示对比
   - cache 验证：连两次 GET → 第一次 source="fresh"；第二次 source="cache" + 数据相同
5. **LLM 失败兜底**：mock provider env 设错值 → page 不空白 + UI 显示「LLM 暂不可用，显示模板结果」

### 跳过
- ❌ /cso（无安全敏感改动）
- ❌ Bundle size（不引入新 deps）

## 提交策略

Atomic commit message：
```
feat(insights): phase 4 — task performance + study buddy with evidence drawer

- Prisma: AnalysisReport + scopeHash String? + scopeSummary Json? + @@index([scopeHash])
  Migration phase4_scope_analysis_report
- New lib/services/scope-insights.service.ts:
  - getScopeSimulationInsights (启发式 highlights + LLM commonIssues + 24h scopeHash cache)
  - getScopeStudyBuddySummary (纯查询 StudyBuddySummary by section)
  - scopeHash = sha256(sorted scope JSON), failure fallback to template
- New API: app/api/lms/analytics-v2/scope-insights/route.ts (GET cached / POST forceFresh)
- New components/analytics-v2/evidence-drawer.tsx
  (3 types: highlight / issue / studybuddy_question, transcript 气泡渲染,
   "查看完整提交"链接到单实例洞察)
- Block B: task-performance-block.tsx 实装
  (2 sub-tabs 高分典型 / 低分问题, 卡 header generatedAt + 重新生成按钮,
   列表项 click → evidence drawer)
- Block C: study-buddy-block.tsx 实装
  (Accordion by section, top-5 questions per section, click → drawer 学生列表)

Phase 1-3 anti-regression preserved (defaultClassIdsAppliedRef + courseId guard,
entity vs filter classIds, recharts design tokens, 4 blocks layout, dashboard < 800 lines)。

QA: r1 PASS X/X (tsc/lint/vitest/build 全绿, Prisma 三步严格执行)
- LLM 24h scopeHash 缓存命中 / forceFresh 触发新调
- LLM 失败兜底返回模板化结果 (UI 不空白)
- 真浏览器 6 张截图 /tmp/qa-insights-phase4-*.png
- Drawer transcript 渲染 + 跳单实例 insights 链接

See plan: ~/.claude/plans/main-session-snug-tide.md
See spec: .harness/spec.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
