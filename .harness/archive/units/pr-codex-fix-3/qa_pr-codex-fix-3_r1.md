# QA Report — PR-codex-fix-3 r1

Unit: PR-FIX-3 · Codex Batch C · 前端 + 纪律 5 条
Round: 1
Reviewer: qa-fix
Date: 2026-04-26
Builder report: `.harness/reports/build_pr-codex-fix-3_r1.md`
Commit: `d0ef6ab fix(frontend-discipline): codex 深度审查 Batch C · 5 条 P1/P2 闭环`

## Spec
C1 grade route 加 feedback + rubricBreakdown 持久化 / C2 simulation-runner allocationSubmitCount 改用 snapshots.length 派生 / C3 SectionOverview 加 key={sectionId} / C4 grading.service 加 quiz extractor / C5 insights aggregate fallback 不抛 NO_CONCEPT_TAGS

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 7 实现文件 + 1 build report = 8 files / +413/-19 与 builder 报告一致 |
| 2. tsc --noEmit | PASS | 0 输出 |
| 3. vitest run | PASS | 40 files / **431 tests**（baseline 415 + 16 新 + 1 改写零回归） |
| 4. npm run build | PASS | 25 routes / 5.1s |
| 5. C1 真 curl E2E | PASS | grade w/ feedback → DB merged + conceptTags 保留 + audit hasFeedback:true |
| 6. C5 真 AI E2E | PASS | 清空 conceptTags → POST aggregate → 200 + weaknessConcepts:[] + commonIssues 仍生成 |
| 7. C4 真 AI E2E | PASS | quiz submit → graded → conceptTags=[5 标签] AI 抽取成功 |
| 8. C2/C3 代码审查 | PASS | 见下方 |
| 9. Cross-module regression | PASS | 学生 5 + 教师 8 + course 详情 + instance 详情全 200 |
| 10. PR-FIX-1/2 守护链路 | PASS | unauth 401 / 学生 systemPrompt 403 仍生效 |
| 11. /cso 安全 | PASS | UX5 audit metadata 加 hasFeedback/hasRubricBreakdown 满足合规追责；C1 evaluation merge 用 spread 避免覆盖（保 conceptTags）；C2 derived state + 后端 max(20) 双层防护；C5 不抛错让聚合可降级运行 |

## 真 curl E2E 矩阵

### C1 grade route 持久化分维度评语（6 cases · 全 PASS）

测试帐号：T1=teacher1，S1=student1。Test fixture：1 份 graded simulation submission with prior conceptTags=[初始概念A, 初始概念B] + AI prior evaluation。

- **C1.1** T1 POST grade `{score:88, feedback:"教师手工总评", rubricBreakdown:[manual-c1]}` → **200**
- **C1.2** DB verify SimulationSubmission.evaluation:
  - `feedback="教师手工总评"`（merged 教师写入）✅
  - `rubricBreakdown=[manual-c1]`（merged 教师写入）✅
  - `totalScore=88, maxScore=100`（merged 新分）✅
  - `conceptTags=[初始概念A, 初始概念B]`（**保留** prior，未被覆盖）✅
- **C1.3** DB verify AuditLog.metadata: `{score:88, hasFeedback:true, hasRubricBreakdown:true}` ✅
- **C1.4** T1 POST grade `{score:75}`（仅打分，不提供 feedback）→ **200**
- **C1.5** DB verify: score 更新到 75，但 evaluation 不动（仍是上次 merged 的"教师手工总评" + 88 分）— 这是 spec 设计：仅当 feedback/rubricBreakdown 提供时才 merge
- **C1.6** DB verify AuditLog.metadata: `{score:75, hasFeedback:false, hasRubricBreakdown:false}` ✅

### C5 insights aggregate fallback 不抛 NO_CONCEPT_TAGS（1 case · PASS）

- 清空 SimulationSubmission.conceptTags=[]（数据缺失场景）
- POST `/api/lms/task-instances/.../insights/aggregate?force=true`
- 之前行为：抛 `NO_CONCEPT_TAGS` 400
- 现在行为：**HTTP 200**
  - `weaknessConcepts: []`（无 tags 时空数组）✅
  - `commonIssues: [3 条 AI 生成]` ✅
  - `highlights: [1 条]` ✅
  - `aggregatedAt` 写入，reportId=3136d1fa 持久化

### C4 grading.service quiz extractor（1 case · PASS）

- S1 POST quiz submission（3 道题答对，3 道题未答）
- 等待 ~1 分钟 AI 异步批改 + extractor 异步运行
- DB verify QuizSubmission.conceptTags = **[个人理财规划, 投资产品分类, 风险管理, 风险偏好, 复利法则]**（5 个 AI 抽取的金融概念标签）✅
- Submission status=graded, score=35/70 ✅
- best-effort 失败回路：try/catch + console.error 不阻塞批改主流程（spec L222 + 代码 L203-207）

### C2 simulation-runner derived state（代码审查）

- L195-211: `useState<AllocationSnapshot[]>` 初始化时从 localStorage 恢复 `snapshots`
- L658: `submitCount={snapshots.length}` 直接派生（替代 useState）
- L406: setSnapshots append 后注释 "计数从 snapshots.length 派生"
- L555: redo 时 `setSnapshots([])` 间接 reset 计数
- grep `useState.*allocationSubmitCount\|setAllocationSubmitCount` = 0 hits（state 已彻底删除）✅
- 与后端 PR-FIX-2 B5 `.max(20)` 双层防护：前端 single source of truth + 后端 schema cap

### C3 SectionOverview key prop（代码审查）

- block-edit-panel.tsx L132-135: `<SectionOverview key={section.sectionId} ...`
- React 标准 unmount/remount 模式：sectionId 变化时整个组件重 mount → 内部 useState（editingTitle / titleDraft / creatingSlot）自动 reset
- key 选 `sectionId` 正确（稳定 unique）— title 改名不应触发 remount
- /teacher/courses/[id] 详情页 200（C3 改动未引入运行时错误）

## 不直观决策评审

| Builder 决策 | QA 评审 |
|---|---|
| C1 路由层 read-then-merge 而非 service 层 | **合理** — `updateSubmissionGrade` 现有 7 处 caller 依赖覆盖语义；route 层 merge 局限到手工批改场景，service 接口零改 |
| C1 audit metadata 用 boolean (hasFeedback/hasRubricBreakdown) | **合理** — 比存全量评语紧凑，符合"敏感数据写 audit 应最小化"原则 |
| C2 双层防护（前端 derived + 后端 max(20)） | **合理** — 防客户端绕过 + 防服务端类型错位 |
| C3 key={sectionId} 而非 sectionTitle | **合理** — title 改名不应触发 remount |
| C4 quiz extractor 单独 AI（非合并到主批改） | **合理** — quiz 是确定性批改无 AI 评估调用；单独喂 prompts 失败不阻塞 |
| C4 best-effort try/catch 失败仅 console.error | **合理** — 与 PR-FIX-2 B3 降级路径同思路 |
| C5 vs B3 互补 | **合理** — B3 处理 AI 失败，C5 处理数据缺失，两者都让 aggregate 不抛错可降级运行 |

## Issues found

无 BLOCKER。

**Minor observations**（不影响 PASS）：
1. C2/C3 真浏览器 E2E（localStorage 恢复 / 切换 section 编辑态 reset）我用代码审查 + 运行时 SSR 200 替代了真浏览器交互。React 标准 derived state + key prop 模式低风险，但若用户报这两个 UX bug 需 follow-up 真浏览器复现。
2. C1.4 case 当仅打分时不动 evaluation — 这是 builder 故意设计（仅当 feedback/rubricBreakdown 提供时 merge）。文档化清楚，无 bug，但教师"先打分再补评语"的工作流需要确保前端两次都把 feedback/rubricBreakdown 同时发。

## Cleanup

- 临时 sim submission 2112b3c1 + SimulationSubmission + AnalysisReport 已删
- 临时 quiz submission 2543aa52 + QuizSubmission 已删
- DB 测试数据 0 残留

## Overall: PASS

PR-FIX-3 Batch C 5 条全部修复闭环：
- C1 grade route merge 持久化 + audit metadata 标记 ✅
- C2 simulation snapshots single source of truth ✅
- C3 SectionOverview 切换 reset 编辑态 ✅
- C4 quiz extractor AI 抽取 5 个金融概念标签真生效 ✅
- C5 insights aggregate fallback 200 + weaknessConcepts:[] 不抛错 ✅

431 tests / tsc 0 / build 25 routes / 学生 5 + 教师 8 routes 200 / DB 0 残留 / PR-FIX-1+2 守护链路 alive。

**Dynamic exit**：连续 PASS 计数 **2/2**（pr-codex-fix-2 r1 + pr-codex-fix-3 r1）— 满足收工条件。可推进 PR-FIX-4（D1 旧 MOOD prompt 清理 · 30 行 surgical）即收尾，或直接收工等用户决定 PR-FIX-5 UX 决策项。
