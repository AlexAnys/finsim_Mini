# Spec — 数据洞察重构 · Phase 6：Polish + Minor 修复 + e2e + HANDOFF

> Phase 1-5 已 commit (`0f823d0` / `40b504a` / `a311478` / `22dc29c` / `3831468` / `264352c`)。
> 本 spec 仅负责 Phase 6（最后一个）。完整 plan：`~/.claude/plans/main-session-snug-tide.md`。

## Unit 标识
- `insights-phase6`，build/qa 报告 r1, r2...
- Dynamic exit：2 PASS 收工 / 同 fail 3 轮回 spec / 不跑保险轮

## 当前 Baseline
- 分支 `claude/elastic-davinci-a0ee14`，**6 commits ahead** of main `e311571`
- 区块 A/B/C/D 全实装；KPI 5 卡 drawer 全打通
- H1 仍 "数据洞察 V2" + Badge "实验"
- 老 `/teacher/analytics` 路由（非 v2）仍存在，被 [ai-suggest-callout.tsx:17](components/teacher-dashboard/ai-suggest-callout.tsx) 引用
- recharts ResponsiveContainer width=-1 warning 沿袭 phase 2-5

## Phase 6 范围（**全是 polish + 修 + 验，不加新功能**）

### ✅ 必须做的 7 件事

#### 1. 视觉 Polish — 去 V2 + 去 Badge "实验" + 文案统一

[analytics-v2-dashboard.tsx](components/analytics-v2/analytics-v2-dashboard.tsx)：
- L548 `数据洞察 V2` → `数据洞察`
- L549 删 `<Badge variant="outline">实验</Badge>`
- L580 `课程是数据洞察 V2 的必选范围。` → `课程是数据洞察的必选范围。`
- 副标题 `课程范围内的完成、掌握、题目和干预诊断` → `课程范围内的完成、掌握、共性问题和教学建议诊断`（精炼匹配新 4 区块定位）

#### 2. 修 phase 5 Minor 3 — drilldown vs KPI off-by-one 一致性

**根因**：风险阈值在两处定义不同步：
- [kpi-row.tsx:132](components/analytics-v2/kpi-row.tsx) 客户端 KPI 推导
- [scope-drilldown.service.ts:264](lib/services/scope-drilldown.service.ts) 服务端 drilldown 列表
- 两处条件细节差异导致 KPI=2 / drilldown=3，KPI=10 / drilldown=11

**修复方案**：
- 在 [analytics-v2.service.ts](lib/services/analytics-v2.service.ts) 加 export 共享常量：
  ```ts
  export const RISK_CHAPTER_COMPLETION_THRESHOLD = 0.6;
  export const RISK_CHAPTER_SCORE_THRESHOLD = 60;
  export function isRiskChapter(c: { completionRate: number | null; avgNormalizedScore: number | null }): boolean {
    return (
      (c.completionRate !== null && c.completionRate < RISK_CHAPTER_COMPLETION_THRESHOLD) ||
      (c.avgNormalizedScore !== null && c.avgNormalizedScore < RISK_CHAPTER_SCORE_THRESHOLD)
    );
  }
  export function isRiskStudent(s: { reason: "not_submitted" | "low_score" | "declining" }): boolean {
    return true;  // 三种 reason 全算
  }
  ```
- [kpi-row.tsx](components/analytics-v2/kpi-row.tsx) + [scope-drilldown.service.ts](lib/services/scope-drilldown.service.ts) 都用同一 helper
- QA 必验：drilldown returned count = KPI displayed count（两边 1:1 一致）

#### 3. 修 ResponsiveContainer width=-1 warning（phase 2 沿袭）

[score-distribution-chart.tsx](components/analytics-v2/score-distribution-chart.tsx) 或 [chart.tsx](components/ui/chart.tsx)：
- 给 ChartContainer 加显式 `width="100%"` + `minHeight={280}`，防 dynamic loading 时容器 size=-1
- 或改 ResponsiveContainer aspect={2.5}（宽高比固定）
- QA 验：page reload + tab 切换后 console 无 width=-1 warning

#### 4. 老 `/teacher/analytics` 路由清理

- **决策**：看是否还有外部依赖
- 现状：[ai-suggest-callout.tsx:17](components/teacher-dashboard/ai-suggest-callout.tsx) `insightsHref = "/teacher/analytics"` 默认值
- **方案 A**（推荐）：保留 `/teacher/analytics/page.tsx` 但内容替换为 redirect 到 `/teacher/analytics-v2`（防老 URL 收藏 404）
  ```tsx
  // app/teacher/analytics/page.tsx
  import { redirect } from "next/navigation";
  export default function LegacyAnalyticsPage() {
    redirect("/teacher/analytics-v2");
  }
  ```
- 同时改 ai-suggest-callout 默认 href = `/teacher/analytics-v2`
- 不删除 page.tsx 文件本身（保留 redirect）

#### 5. 单测 — 关键 service 函数

新增 / 扩展（参考 finsim 已有 `tests/analytics-v2.service.test.ts` 模式）：
- `tests/scope-insights.service.test.ts`：
  - `scopeHash` 算法稳定性（同 scope 不同顺序 hash 相同）
  - `getScopeSimulationInsights` 启发式 highlights 正确（mock prisma 注入 N 个 submissions，验证 top-N + per-task cap）
  - LLM 失败兜底返回模板（mock aiGenerateJSON 抛错 → source="fallback" + commonIssues 非空）
- `tests/scope-drilldown.service.test.ts`：
  - `getRiskChapters` 阈值正确（0.59 → risk, 0.61 → not, 60 score → risk per `<` strict）
  - `getRiskStudents` 三种 reason 都包含
- `tests/scope-insights-route.test.ts`：
  - GET 200 + 401 + 403
  - cache 命中时 source="cache"，新调时 "fresh" 或 "fallback"

目标：phase 6 测试新增 ≥ 15 cases，**vitest 运行总数从 phase 5 的 782 涨到 ≥ 797**。

#### 6. 空态 / 加载态 / 错误态打磨

逐一审视所有 dashboard 状态：
- diagnosisLoading 显示 skeleton（不是只 spinner）
- 区块 D fallback notice 视觉与 phase 4 evidence-drawer alert 一致
- KPI 卡 hover 视觉（cursor + bg-muted/40）保持 phase 5
- 4 区块在小屏（< md 768）单列堆叠 + 卡片间留白
- 区块 A 空数据态文案统一（与区块 B/C 同模板）

#### 7. 端到端验证 (e2e) + 最终 HANDOFF

QA 跑全链路：登录 → 切课程 → 选班 → 看 KPI → 点柱子 → 看证据 drawer → 区块 D 重新生成 → 跳到单实例 insights → 返回。

Coordinator 在 commit 后写 chore HANDOFF commit（最终总结所有 6 phase 给下次 session）。

### ❌ 必须不做的 5 件事

1. ❌ 不动 Prisma schema
2. ❌ 不引入新 npm 依赖
3. ❌ 不实装新功能（区块 A-D 都已实装）
4. ❌ 不动 `/teacher/instances/[id]/insights`
5. ❌ 不删除 service 中 phase 3 后未渲染的字段（如 chapterDiagnostics / actionItems / weeklyInsight — 已被 4 区块 + KPI 间接消费，删了可能破坏）

## Acceptance Criteria

### A. 类型与构建
1. `npx tsc --noEmit` 0 errors
2. `npm run lint` 通过
3. `npx vitest run` ≥ 797 cases 全过（新增 ≥ 15）
4. `npm run build` 成功
5. 不引入新 npm 依赖

### B. Polish
6. 页面 H1 显示「数据洞察」（不是「数据洞察 V2」）
7. H1 旁不再有 Badge「实验」
8. 副标题 / 任何 user-visible 文案不出现 "V2"（grep 验证 dashboard 范围内 "V2" 0 命中）
9. dashboard 副标题精炼匹配 4 区块定位

### C. Minor 3 修复 — drilldown 与 KPI 一致
10. `RISK_CHAPTER_COMPLETION_THRESHOLD` + `RISK_CHAPTER_SCORE_THRESHOLD` + `isRiskChapter` 在 analytics-v2.service.ts export
11. KpiRow 风险章节计数 = drilldown getRiskChapters 返回 count（同 scope 1:1 一致）
12. KpiRow 风险学生计数 = drilldown getRiskStudents 返回 count（去重后 1:1 一致）
13. QA 真浏览器验证 a201 课程 KPI = drilldown count 一致

### D. ResponsiveContainer warning 修
14. page reload + 切 filter 后 `browse console --warnings` 不出现 `width(-1) and height(-1)` 字面字符串
15. 图表仍正确渲染（视觉 + bar fill 不变）

### E. 老路由 redirect
16. `/teacher/analytics` 浏览器访问 → 自动 302 → `/teacher/analytics-v2`
17. ai-suggest-callout 默认 href 改 `/teacher/analytics-v2`
18. 老 path 不报 404

### F. 单测扩展
19. 新增 `tests/scope-insights.service.test.ts`（≥ 5 cases）
20. 新增 `tests/scope-drilldown.service.test.ts`（≥ 5 cases）
21. 新增 `tests/scope-insights-route.test.ts`（≥ 5 cases）
22. vitest 总 cases ≥ 797（phase 5 baseline 782 + 15）

### G. 状态打磨
23. diagnosisLoading 显示 skeleton（含 KPI / 区块 A / 区块 B-D 各骨架）
24. 4 区块小屏 < md 单列堆叠 + 间距留白
25. 区块 A/B/C/D 空数据态文案模板一致

### H. 端到端 e2e（QA 必跑）
26. 登录 teacher1 → sidebar 「数据洞察」高亮
27. 默认课程 → 默认全部班 → KPI 5 卡数字正确
28. 班级多选 → 区块 A 多班分组柱（如有 graded）
29. 区间 5/10 段切换 + localStorage 持久
30. 区块 B 高分典型 + 低分问题 列表 → click 打开 evidence drawer 看 transcript
31. 区块 D 「重新生成」按钮 → POST → 4 类刷新
32. KPI 卡 click → 5 个 drawer 全工作 + 跨链接到单实例 insights
33. drawer 内 「→ 单实例洞察」点击 → `/teacher/instances/{id}/insights` 200
34. 老 `/teacher/analytics` URL → 自动跳 `/teacher/analytics-v2`

### I. Phase 1-5 anti-regression（最后一次完整跑）
35. KPI 5 卡数字与 phase 5 一致
36. 区块 A: 5/10 段 / tooltip / cursor pointer / bar CSS 变量 / 多班分色（数据允许的话）
37. 区块 B: 高分典型/低分问题 sub-tabs / 重新生成 / drawer 三类 evidence
38. 区块 C: Accordion by section（仍 ComingSoon 因 SBSummary 0 行，code 路径完整）
39. 区块 D: 4 sections / evidence collapsible / fallback notice
40. Filter Bar / 班级多选 / 默认全部班 / 老 URL 兼容
41. 单实例 insights / teacher dashboard 隔离
42. recharts bar fill CSS 变量
43. defaultClassIdsAppliedRef + courseId guard
44. dashboard.tsx < 850 行（phase 5 是 753，本 phase 微改）

## Risks

| 风险 | 防御 |
|---|---|
| 改 H1 / Badge 文案误删 KPI 数据 | 仅改 user-visible 字符串，不动逻辑 |
| ResponsiveContainer 修复破坏图表 | QA 视觉验证 bar 仍正确 |
| 单测 mock prisma 不正确 | 参考已有 analytics-v2.service.test.ts mock 模式 |
| 老路由 redirect 死循环 | redirect 只在 `/teacher/analytics` → `/teacher/analytics-v2`，单向 |
| Minor 3 修复改 helper 影响其他 caller | grep 全仓 chapterDiagnostics 用法，确认只在 KpiRow + drilldown 两处 |

## QA 验证

### 必做
1. tsc / lint / vitest（**vitest 必须 ≥ 797 cases，新增 ≥ 15**）/ build
2. **真浏览器** via gstack `/qa-only` — 完整 e2e（spec §H 26-34 全跑）：
   - 截图 ≥ 10 张 `/tmp/qa-insights-phase6-*.png`：H1 改名 / 老路由 redirect / 区块 ABCD 完整页 / KPI 5 drawer 各一张 / e2e 跳单实例 insights / e2e 返回
3. **数据正确性**：
   - drilldown count = KPI count（spec §C.13）
   - vitest 单测覆盖率 spot check
4. **console 无 warning**（除 phase 4 已知 SBSummary 0 行 + recharts width=-1 已修后无新 warning）
5. **真测一遍小屏 < md** spec §G.24

### 跳过
- ❌ Prisma 三步（无 schema）
- ❌ Bundle size（不引入新 deps）
- ❌ /cso（无安全敏感改动）

## 提交策略

Atomic commit message：
```
feat(insights): phase 6 — polish + minor fixes + e2e + tests

- Drop "数据洞察 V2" → "数据洞察"; remove Badge "实验"; refresh subtitle
- Fix Phase 5 Minor 3: shared isRiskChapter / RISK_*_THRESHOLD constants
  in analytics-v2.service.ts; KpiRow + scope-drilldown 1:1 一致
- Fix recharts ResponsiveContainer width(-1) warning (chart.tsx minHeight + width 100%)
- Legacy /teacher/analytics → 302 redirect /teacher/analytics-v2 (preserve old bookmarks)
- ai-suggest-callout default href → /teacher/analytics-v2
- Add tests/scope-insights.service.test.ts (≥5 cases: scopeHash stability,
  highlights heuristic, LLM fallback)
- Add tests/scope-drilldown.service.test.ts (≥5 cases: risk thresholds, reason filter)
- Add tests/scope-insights-route.test.ts (≥5 cases: GET/POST 200/401/403, cache)
- Skeleton states for diagnosisLoading + 4 blocks empty state 文案模板一致
- Small-screen <md 4 blocks single-column stack + padding refined

Phase 1-5 anti-regression preserved (defaultClassIdsAppliedRef + courseId guard,
entity vs filter classIds, recharts design tokens, 4 blocks layout, dashboard <850 行,
24h cache, LLM fallback template, drawer 5 kinds + cross-link)

QA: r1 PASS X/X (tsc/lint/vitest 797+/build 全绿)
- e2e 全链路通过 (登录→KPI→drawer→单实例 insights→返回)
- drilldown vs KPI 1:1 一致 (Minor 3 修复)
- ResponsiveContainer warning 消除
- /teacher/analytics 老路由 redirect 工作
- 10 张真浏览器截图 /tmp/qa-insights-phase6-*.png

See plan: ~/.claude/plans/main-session-snug-tide.md
See spec: .harness/spec.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Coordinator 在 builder commit 后写 chore HANDOFF commit（总结所有 6 phase）。
