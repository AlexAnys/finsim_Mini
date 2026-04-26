# Build report — PR-codex-fix-3 r1

Unit: PR-FIX-3 · Codex 深度审查 27 finding 修复链 · Batch C（前端 + 纪律 5 条）
Round: 1
Author: builder-fix
Date: 2026-04-26

> 沿用 PR-codex-fix-1/2 命名约定（避免与历史 `build_pr-fix-3_r1.md` 冲突）。

## 范围（spec.md L40-46）

- C1 grade route 加 feedback + rubricBreakdown 持久化
- C2 simulation-runner allocationSubmitCount 从 snapshots.length 派生
- C3 SectionOverview 加 `key={section.sectionId}`
- C4 grading.service 三类 conceptTags 全覆盖（quiz 加 extractor）
- C5 insights aggregate fallback 不抛 NO_CONCEPT_TAGS

## 文件改动（7 files · +101 / −19）

### 路由 / 服务
- `app/api/submissions/[id]/grade/route.ts` — C1: schema 加 feedback + rubricBreakdown，merge 到现有 evaluation（保 conceptTags 等不丢），audit metadata 加 hasFeedback / hasRubricBreakdown
- `lib/services/grading.service.ts` — C4: gradeQuiz 加 extractQuizConceptTags() best-effort AI 调用提取概念标签（catch 失败不阻塞批改主流程）
- `lib/services/insights.service.ts` — C5: 删 `if (totalTags === 0) throw new Error("NO_CONCEPT_TAGS")`；改为转 weaknessConcepts 空数组 + AI 仍跑 commonIssues/highlights

### 前端
- `components/simulation/simulation-runner.tsx` — C2: 删 `allocationSubmitCount` useState，改用 `snapshots.length` 派生（防 localStorage 恢复后 setState(0) 重置导致绕过 maxSubmissions）；redo 路径仅 `setSnapshots([])` 间接 reset
- `components/teacher-course-edit/block-edit-panel.tsx` — C3: SectionOverview 加 `key={section.sectionId}`，切小节自动 unmount/remount → editingTitle / titleDraft 等 useState 自动 reset

### 测试
- `tests/pr-fix-3-batch-c.test.ts` — 新 16 cases（C1×3 + C2×5 + C3×2 + C4×4 + C5×2）
- `tests/insights-service.test.ts` — 改 1 case（NO_CONCEPT_TAGS 测试 → C5 graceful fallback 测试）

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 输出 |
| `npx vitest run` | PASS | **40 files / 431 tests**（之前 415 + 16 新增 + 1 改写零回归） |
| `npm run build` | PASS | Compiled successfully · 25 routes · 5.1s |
| Dev server alive | PASS | PID 84808 next-server v16.1.6 / `/login` 200 |
| 无 schema 改动 | PASS | git diff prisma/schema.prisma = 0；不需要 Prisma 三步 |

## 沿用既有 pattern（anti-regression）

- C1 evaluation merge 用 `{ ...prior, ...new }` spread 模式，保留 prior conceptTags / 其他字段不丢失（合规追责语义）
- C2 derived state 是 React 标准模式（避免双源 truth）。snapshots 是 single source of truth（持久化在 localStorage + 提交时打包到 assets.snapshots）
- C3 React `key` prop 强制重 mount 是标准 pattern，不引入新机制
- C4 quiz extractor 是 best-effort（catch + console.error），与 PR-FIX-2 B3 降级路径同思路
- C5 graceful fallback 与 PR-FIX-2 B3 是配对：B3 处理 AI 失败，C5 处理 conceptTags 缺失，两者都是"不抛错让聚合可降级运行"

## 不直观决策（rationale）

1. **C1 在路由层做 evaluation merge 而非 service**：`updateSubmissionGrade` 现有签名是覆盖语义（多个 AI 自动批改 caller 都依赖该语义）。改 service 会冲击 7 处 caller。在路由层 read-then-merge 把 merge 局限到手工批改场景，service 接口零改 → anti-regression 友好
2. **C1 audit metadata 加 hasFeedback / hasRubricBreakdown**：合规追责需要知道教师是否提交了分维度评语（vs 仅打分）。boolean 字段比存全量评语更紧凑且符合"敏感数据写 audit 应最小化"原则
3. **C2 不删除 maxSubmissions check**：spec L43 说"按钮 disabled 用 snapshots.length >= maxSubmissions"。我保留 `disabled={... || submitCount >= maxSubmissions}`（其中 submitCount 现在 = snapshots.length），双侧守护。前端单源（snapshots）+ 后端校验（B5 .max(20)）两层防绕过
4. **C3 key 选 sectionId 而非 sectionTitle**：sectionId 是稳定 unique；title 改名不应 unmount。spec L44 也是这么写的
5. **C4 quiz extractor 单独 AI 调用**：spec 说"覆盖 simulation/quiz/subjective 三类"。simulation 和 subjective 已在主 AI 评估调用里输出 conceptTags（任务文本本身有上下文）。quiz 是确定性批改（无 AI 评估），单独调一次 AI 提取概念标签（喂前 30 题 prompts）。失败不阻塞 grading，只是 conceptTags=[]
6. **C4 用 quizGrade feature env**：复用现有 AI provider 配置，不引入新 feature key
7. **C5 vs B3 互补**：B3 是 "AI 调用失败时降级"，C5 是 "数据不足时降级"。两者都让 aggregate 不抛错，UI 可一致显示"暂无共性问题/标签"。不在 B3 改 C5 是因为 B3 范围内不能假定 C4 已修

## 范围外 / 不在本 PR

- D1（旧 5 档 MOOD prompt 清理）由 PR-FIX-4 处理（task #78）
- D2/D3/D4/D5 按 spec 留增量 PR

## Open questions / 不确定

- C4 quiz conceptTags 是 best-effort —— 如果 AI 调用失败，aggregate 时该 quiz submission 仍走 C5 graceful 路径（weaknessConcepts 略短）。两者协同，但 QA 可考虑测两者交叉场景
- C3 `key` 改后切换小节会丢失编辑中的标题草稿 → 这是 spec 意图（"切换小节自动 reset 编辑态"）。如未来希望保留，可改为 `useEffect` 在 sectionId 变化时手动 reset
- C1 merge 仍可能有微小 race（fetch existing → update）：实际场景下教师手工批改前端发请求间隔 ≥1s，无并发问题；如要严格防 race 需 prisma transaction 包，但增加复杂度，本 PR 不动

## 给 QA 真 curl 提示

- **C1**：teacher POST `/api/submissions/[id]/grade` body 含 `score: 88, maxScore: 100, feedback: "..."` + `rubricBreakdown: [{...}]` → DB 中 simulationSubmission.evaluation 应包含 feedback / rubricBreakdown / 保留原 conceptTags（不被覆盖）
- **C2 真浏览器**：student 进 sim 任务记 3 次配比（按钮 disabled）→ 刷新页面 → snapshots 从 localStorage 恢复 → 按钮仍 disabled（之前 bug：可再点 3 次绕过 max）。展示文字"(3/3)"应 stick
- **C3 真浏览器**：teacher 编辑 section A 点开 title 编辑 → 切到 section B → 切回 A → editingTitle 应 false（之前 bug：编辑态串味）
- **C4**：seed 一份 graded quiz submission → 查 DB `quizSubmission.conceptTags` 应非空（best-effort，如果 AI 提取失败则空，不阻塞）
- **C5**：清空所有 submission 的 conceptTags → POST aggregate → 期望 200 + weaknessConcepts:[] + commonIssues/highlights 仍正常（之前 bug：抛 NO_CONCEPT_TAGS 400）

## 不需要 dev server 重启

- 无 schema 改动 → 不需要三步
- 仅 route.ts + lib/services + components 改动 → Next.js 热重载自动生效
- Dev server PID 84808 仍 alive（PR-FIX-2 启的，本轮没 kill）
