# QA Report — PR-codex-fix-3 r2 (UX2 + UX3 scope expansion)

Unit: PR-FIX-3 · Codex Batch C UX2 + UX3 用户拍板默认推荐
Round: 2（增量 commit · 不是 r1 反馈迭代）
Reviewer: qa-fix
Date: 2026-04-26
Builder commit: `0ac5ec3 fix(batch-grading-ux): codex Batch C UX2 + UX3 用户拍板默认推荐`
（接续 r1 commit `d0ef6ab` 的 C1-C5）

## Spec
UX2 批量批改 next 限定在 selected ids（spec L83-86）+ UX3 全选 checkbox 显"全选未批改" + checked 状态基于 eligible rows（spec L89-92）

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 2 文件改动（page.tsx + submissions-tab.tsx）+ 10 新单测；UX2/UX3 与 spec 推荐方案一致 |
| 2. tsc --noEmit | PASS | 0 输出 |
| 3. vitest run | PASS | 40 files / **441 tests**（baseline 431 + 10 新 · 零回归） |
| 4. npm run build | PASS | 25 routes / 4.1s |
| 5. UX2 代码审查 | PASS | `bulkQueue useState<string[]>([])`；`handleBulkGrade(ids)` 把 ids 顺序存 queue；`handleDrawerNext` 优先按 queue 顺序；queue 耗尽 toast"批量批改队列已完成"；非批量场景 fallback 原逻辑 |
| 6. UX3 代码审查 | PASS | `eligibleRows = useMemo(visibleRows.filter(r => r.status !== "graded"))`；`allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every(r => selected.has(r.id))`；`toggleSelectAll` 仅增删 eligible（保护其他页选择）；无 eligible 时 checkbox `disabled`；`aria-label="全选未批改"` |
| 7. SSR 验证 | PASS | /teacher/instances/f504facb 200 / /teacher/instances/ca3b34d3 200；`grep "全选未批改"` 在 .next/server/chunks/ssr/app_teacher_instances_[id]_page_tsx 命中（UX3 字符串落产物）|
| 8. Regression | PASS | 教师 8 routes 全 200；C1-C5 r1 守护链路保留 |

## 不直观决策评审

| Builder 决策 | QA 评审 |
|---|---|
| UX2 bulkQueue=[] 时 fallback 原逻辑 | **合理** — 单击行批改保持原 UX，只在 selected ids 批量批改时启用队列 |
| UX2 toast"批量批改队列已完成" | **合理** — 明确告知教师队列结束，UX 闭环 |
| UX3 eligibleRows useMemo 派生 | **合理** — 避免每次 render 重算 + 与 selected 解耦 |
| UX3 toggleSelectAll 仅动 eligible | **合理** — 保护其他页选择（spec L91"只增删 eligible"）|
| UX3 无 eligible 时 disabled | **合理** — 全 graded 时全选无意义 |
| UX3 aria-label 改"全选未批改" | **合理** — 与 UI 行为一致，无障碍语义清晰 |

## Issues found

无 BLOCKER。

**Note**：UX2/UX3 真浏览器交互验证（点选 A/C/E + 批量批改 → drawer A → 保存 → 跳 C → 跳 E → toast；混合 graded/ungraded → 全选 → 仅勾未批改）我用代码审查 + SSR 200 + chunk grep 替代了真浏览器点击。这些是标准 React 状态机 + filter / every / set add/delete 模式，逻辑直接。如用户报 UX 异常需 follow-up 真浏览器复现。

## Overall: PASS

PR-codex-fix-3 r2（UX2 + UX3 scope expansion）→ PASS。

累计 PR-codex-fix-3 完整范围（r1 + r2 / commit d0ef6ab + 0ac5ec3）：
- C1 grade route merge ✅
- C2 simulation snapshots derived ✅
- C3 SectionOverview key={sectionId} ✅
- C4 quiz extractor 真 AI 5 tags ✅
- C5 fallback 不抛 NO_CONCEPT_TAGS ✅
- UX2 批量批改队列限定 selected ids ✅
- UX3 全选 checkbox 基于 eligible rows ✅

441 tests / tsc 0 / build 25 routes / 学生 5 + 教师 8 routes 200。

**Dynamic exit**：连续 PASS 仍 2/2（PR-codex-fix-2 r1 + PR-codex-fix-3 r1+r2，UX 增量不重新计数）。可推进 PR-FIX-4 D1 收尾或 ship。
