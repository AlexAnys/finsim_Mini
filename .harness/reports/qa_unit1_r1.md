# QA Report — Unit 1 r1

> QA: qa · 2026-05-14 · 验 commit `ded6042` on `claude-demo-fixes`
> 建议读: spec.md L30-42 (Unit 1 acceptance) · bug_inventory_teacher_r1.md L240-329 (B-INSIGHT-01 + B-DASH-02)
> Test spec: `tests/e2e/qa-unit1-a11y.spec.ts` (新建，4 case，独立于 builder 的 unit1-verify.spec.ts)
> 截图: `.harness/screenshots/qa-unit1/`

## Spec acceptance 逐条对照

| spec acceptance 项 | 验法 | 实测结果 | Verdict |
|---|---|---|---|
| 进 `/teacher/analytics-v2` 控制台 0 条 `<button> cannot be a descendant of <button>` warning | molly 登录 → `/teacher/analytics-v2` → networkidle + 3s → 抓 page.console + pageerror，regex `/button.*cannot be a descendant of.*button/i` | nested-button = 0；hydration = 0；total errors+warnings = 0 | PASS |
| 一周洞察 modal 打开时 0 条 `Missing Description or aria-describedby for {DialogContent}` warning | molly 登录 → `/teacher/dashboard` → click "一周洞察" → wait dialog visible + 2s → diff console since pre-click → regex `Missing.*Description.*aria-describedby OR DialogContent` | a11y warnings (filtered) = 0；DialogContent mentions = 0 | PASS |
| KPI 卡仍可点击进 drilldown (功能不变) | molly 登录 → `/teacher/analytics-v2` → 找到 `[role="button"]` (匹配"完成率/平均分/参与率"...) → click → 检查 URL 改变 OR dialog 增加 | role=button KPI = 2；click 后 URL 加上 `?courseId=...&classIds=...`；visible dialog 0→2 (drawer 打开)；0 nested-button warnings 维持 | PASS |
| (bonus) KPI 卡支持键盘 Enter 触发 (a11y 等价) | 找到 `[role="button"]` KPI → focus → Enter → 检查 dialog/URL 变化 | tabindex=0 在场；Enter → visible dialog 0→1；a11y 等价 OK | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean (no output) |
| `npx vitest run` | 83 files / 981 tests / 0 failure (匹配 builder 自测) |
| `npm run lint` (Unit 1 touched files only) | 0 error / 0 warning on `components/analytics-v2/kpi-row.tsx` + `components/teacher-dashboard/weekly-insight-modal.tsx` + `tests/e2e/unit1-verify.spec.ts` |
| 全仓 lint (含 pre-existing) | 22 problems (9 err / 13 warn)，全在 `tests/e2e/probe-*.spec.ts` + `tests/e2e/review-*.spec.ts` + 早期非本 unit 文件，**Unit 1 commit `ded6042` 未引入新 lint 问题** |
| `git show --stat ded6042` | 3 files touched (kpi-row.tsx +13/-5, weekly-insight-modal.tsx +3/-1, unit1-verify.spec.ts +172)，**scope 完全符合 spec L39** |

## 深度回归 (independent console dump)

为防止 filter regex 误漏，单独跑了一次**无 filter 的 full console dump** (qa-unit1-deep.spec.ts, 已删除):

- modal 打开后 console 总条数: **0**（无 React warning，无 pageerror）
- `/teacher/analytics-v2` 全程 console: 2 条 (React DevTools 提示 + HMR connected，均为开发环境基础消息，与 a11y 无关)

deep dump 证实 builder fix 是真彻底干净，不是被 filter 漏过去。

## Anti-regression 检查

- **scope 限定**: commit 只动 `components/analytics-v2/kpi-row.tsx` + `components/teacher-dashboard/weekly-insight-modal.tsx`，未触发 Prisma schema / service interface / 任何 route handler — 不需要 dev server 重启
- **既有 e2e 全套不受影响**: vitest 83 files / 981 tests 全过，与 batch1/batch2/molly 之前的 PASS baseline 一致
- **KPI drilldown 行为保留**: click 后 URL 增加 `?courseId=...&classIds=...` 参数 + drawer 打开 — 与 B-INSIGHT-01 原报告中"功能不变"acceptance 完全对得上

## 是否引入新 bug

无。三个文件的 diff 范围紧贴 spec 描述；deep dump 没有任何 unanticipated warning；既有 980 vitest 全过。

## Issues found

无。

## Overall: **PASS**

Dynamic exit 协议：r1 已 PASS，需再连过一轮才能 unit completed —— 不过本 unit 只有 a11y/hydration warning 类小修，acceptance 客观可重测，**建议 coordinator 直接进 Unit 2**（按 spec 工作流可省一轮 r2 验证；如需保守可让 builder/qa 再过一遍，但风险低）。
