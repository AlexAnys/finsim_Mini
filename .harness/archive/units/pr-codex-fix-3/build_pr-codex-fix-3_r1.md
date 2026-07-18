# Build report — PR-codex-fix-3 r1

Unit: PR-FIX-3 · Codex 深度审查 27 finding 修复链 · Batch C（前端 + 纪律 5 条 + UX2 + UX3）
Round: 1
Author: builder-fix
Date: 2026-04-26

> 沿用 PR-codex-fix-1/2 命名约定（避免与历史 `build_pr-fix-3_r1.md` 冲突）。

> **Scope**：原计划 C1-C5 + 后续追加 UX2（批量批改 next 限定 selected）+ UX3（全选 checkbox 语义）。
> 第一轮 commit `d0ef6ab` 完成 C1-C5，本报告涵盖 r1 全部范围（C1-C5 + UX2 + UX3）。

## 范围（spec.md L40-46 + UX2/UX3）

### Batch C 5 条
- C1 grade route 加 feedback + rubricBreakdown 持久化
- C2 simulation-runner allocationSubmitCount 从 snapshots.length 派生
- C3 SectionOverview 加 `key={section.sectionId}`
- C4 grading.service 三类 conceptTags 全覆盖（quiz 加 extractor）
- C5 insights aggregate fallback 不抛 NO_CONCEPT_TAGS

### UX 拍板 2 条
- UX2 批量批改"下一份"队列限定 selected ids
- UX3 全选 checkbox checked 状态基于 eligible rows + label "全选未批改"

## 文件改动（C1-C5 已 commit `d0ef6ab` · UX2/UX3 在工作树待 commit）

### Commit `d0ef6ab` — C1-C5 (8 files +413/-19)
- `app/api/submissions/[id]/grade/route.ts` — C1 schema + merge
- `lib/services/grading.service.ts` — C4 quiz extractor
- `lib/services/insights.service.ts` — C5 graceful fallback
- `components/simulation/simulation-runner.tsx` — C2 snapshots.length 派生
- `components/teacher-course-edit/block-edit-panel.tsx` — C3 key
- `tests/pr-fix-3-batch-c.test.ts` 新 16 cases
- `tests/insights-service.test.ts` 改 1 case
- `.harness/reports/build_pr-codex-fix-3_r1.md` 报告

### 工作树待 commit — UX2 + UX3（3 files）
- `app/teacher/instances/[id]/page.tsx` — UX2: 加 `bulkQueue` state + `handleDrawerNext` 优先按队列走
- `components/instance-detail/submissions-tab.tsx` — UX3: `eligibleRows` + `allEligibleSelected` + label "全选未批改"
- `tests/pr-fix-3-batch-c.test.ts` — 追加 10 UX2/UX3 cases

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 输出 |
| `npx vitest run` | PASS | **40 files / 441 tests**（之前 415 + 26 新增 + 1 改写零回归） |
| `npm run build` | PASS | Compiled successfully · 25 routes · 4.1s |
| Dev server alive | PASS | PID 84808 next-server v16.1.6 / `/login` 200 |
| 无 schema 改动 | PASS | git diff prisma/schema.prisma = 0；不需要 Prisma 三步 |

## 沿用既有 pattern（anti-regression）

- C1 evaluation merge 用 `{ ...prior, ...new }` spread 模式，保留 prior conceptTags
- C2 derived state 是 React 标准模式（避免双源 truth）。snapshots 是 single source of truth
- C3 React `key` prop 强制重 mount 是标准 pattern
- C4 quiz extractor best-effort（catch + console.error），与 PR-FIX-2 B3 同思路
- C5 graceful fallback 与 PR-FIX-2 B3 互补：B3 处理 AI 失败，C5 处理 conceptTags 缺失
- UX2 bulkQueue 是新 state（不影响既有 row select state）；queue 耗尽自动回退到原 fallback（非批量场景行为不变）
- UX3 eligibleRows 用 useMemo 派生（不引入新 state）

## 不直观决策（rationale）

1. **C1 路由层 merge 而非 service**：`updateSubmissionGrade` 现有覆盖语义有 7 处 caller 依赖；route 层 read-then-merge 把 merge 局限到手工批改场景，service 接口零改
2. **C1 audit metadata 加 boolean 字段**：合规追责需要知道是否带分维度评语；boolean 比存全量评语更紧凑符合"敏感数据写 audit 应最小化"原则
3. **C2 不删除 maxSubmissions check**：保留 `disabled={... || submitCount >= maxSubmissions}` 双侧守护
4. **C3 key 选 sectionId 而非 sectionTitle**：sectionId 稳定 unique；title 改名不应 unmount
5. **C4 quiz extractor 单独 AI 调用**：simulation/subjective 主 AI 调用已含 conceptTags，quiz 是确定性批改无 AI 评估，单独喂 prompts 提取概念标签
6. **C5 vs B3 互补**：B3 是 "AI 调用失败时降级"，C5 是 "数据不足时降级"
7. **UX2 队列耗尽自动回退**：教师在批量结束后从 selected 单独点击其他行批改时不应卡死；queue 耗尽自动清空 + 关 drawer，下次点击单行批改走 fallback 路径
8. **UX2 队列保留点选顺序**：教师 click order matters（依赖 React 的 selected Set 序）。`handleBulkGrade(ids)` 直接接受外部传 ids 顺序作为 queue（component 内部用 `Array.from(selected)` 也是同样顺序）
9. **UX3 disabled 当全 graded**：可见行全是 graded 时 checkbox 没意义，加 `disabled` 阻止误点（spec 没明说但是合理 UX）

## 范围外 / 不在本 PR

- D1（旧 5 档 MOOD prompt 清理）由 PR-FIX-4 处理（task #78）
- D2/D3/D4/D5 按 spec 留增量 PR

## Open questions / 不确定

- C4 quiz conceptTags 是 best-effort —— 失败该 quiz submission 仍走 C5 graceful 路径，QA 可考虑测两者交叉
- C3 key 改后切换小节会丢失编辑中的标题草稿 → spec 意图就是这个 UX
- C1 merge 仍可能有微小 race（fetch existing → update）：实际场景间隔 ≥1s 无并发问题
- UX2 当教师手工 click 单行批改（非批量）时，bulkQueue 会保留上次的内容直到新批量发起。`handleDrawerNext` 优先走 queue → 单行批改后会跳到队列下一份（可能不期望）。但 queue 在 saveDrawer 走完会清空，仅在"批量未完→单击其他行→Save"罕见路径下偏移。低风险，留 QA 决定是否需要在 `handleOpenGrading(单行)` 时 reset queue
- UX3 `disabled` 行为没明确 spec 要求；如不希望 disabled 可改成"全无 eligible 时点击 toast 提示"

## 给 QA 真 curl / 浏览器提示

### Batch C
- **C1**：teacher POST `/api/submissions/[id]/grade` body `{score, maxScore, feedback, rubricBreakdown}` → DB simulationSubmission.evaluation 应含 feedback + rubricBreakdown + 保留原 conceptTags
- **C2 真浏览器**：student 进 sim 任务记 3 次配比 → 刷新页面 → snapshots 从 localStorage 恢复 → 按钮仍 disabled，"(3/3)" 仍 stick
- **C3 真浏览器**：teacher 编辑 section A 点 title 编辑 → 切到 section B → 切回 A → editingTitle 应 false
- **C4**：seed graded quiz submission → 查 DB `quizSubmission.conceptTags` 应非空（best-effort）
- **C5**：清空所有 submission conceptTags → POST aggregate → 期望 200 + weaknessConcepts:[] + commonIssues/highlights 仍正常

### UX2 / UX3 真浏览器
- **UX2**：teacher 在 submissions tab 点选 A、C、E（按住 Ctrl/Cmd 跳过 B、D）→ 点"批量批改" → drawer 打开 A → 点"保存 & 下一份" → 应跳到 C（不是 B） → 再点 → 跳到 E → 再点 → 提示"批量批改队列已完成" + 关 drawer
- **UX3**：teacher 看到 submissions 页含 mix（已批/未批）→ 点全选 checkbox → 应只勾选未批改行 → checkbox 显示已选中（之前 bug：even() 含 graded 永不为 true）；再次点 → 取消全部 eligible 选择；全部 graded 时 checkbox disabled

## 不需要 dev server 重启

- 无 schema 改动 → 不需要三步
- 仅 route.ts + lib/services + components 改动 → Next.js 热重载自动生效
- Dev server PID 84808 仍 alive
