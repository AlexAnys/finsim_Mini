# Lessons — 失败 → 根因 → 检测 → 预防 滚动池

> 滚动累积。任何 r2+ PASS 必须在此追加一条（"同一坑栽两次"是当前最贵的浪费类型）。
>
> **Schema 5 字段**: `Symptom` / `Root cause` / `Detection` / `Prevention` / `Commit`
> **Status 三态**: `active` / `superseded-by-L-XXX` / `deprecated-since-{commit}`
>
> 写新条目前请先 grep — 看是否已有相关 active 条目可合并或标 superseded。详见 `.harness/STYLE.md`。
>
> 归档规则: status: superseded 或 6 月未复发 → 由 coordinator 在 append 新条目时标 deprecated + 挪到 `archive/lessons-archive.md`（见 `archive/README.md`）。

---

## L-001 · Prisma include 漏字段 → 运行时 500 / undefined

- **Symptom**: 教师 dashboard "本周" Tab 空; `tsc --noEmit` 通过; 41 tests 通过; 运行时页面渲染空白
- **Root cause**: `prisma.schedule.findMany` 的 include 漏了 `semesterStartDate`; `CLAUDE.md` "Prisma Gotchas" 段已静态警告过此模式, 但静态文档不触发回放检查
- **Detection**: 必须用 gstack `/qa-only` 真浏览器加载页面; `$B console` 查 "cannot read property of undefined"
- **Prevention**: 已升级为 `qa.md` "Calibration · finsim 已知高频失败模式" 第 1 项静态规则 — Prisma runtime 缺 include 任何场景必跑真浏览器
- **Commit**: PR-CALENDAR-1 r2 (progress.tsv `2026-04-22T16:55:00Z`)
- **Status**: superseded-by-static-rule (qa.md Calibration §1)

---

## L-002 · inline style `auto/auto` 覆盖 CSS height/width

- **Symptom**: lockup PNG 实际渲染 256×85 (natural 比例); CSS `.lx-brand-logo { height: 56px; width: 36px }` 没生效
- **Root cause**: next/image warning 修复加了 `style={{ height: "auto", width: "auto" }}`; inline style specificity 高于 class CSS, 把数值约束压死
- **Detection**: `getComputedStyle(el).height` vs CSS 期望值; **必须真浏览器测**, diff review 看不出
- **Prevention**: 任何在 `<img>` / `<Image>` 上加 inline style 的 PR, QA 必须验 computed style 与 CSS 数值一致 (写进 qa.md Calibration 的扩展项)
- **Commit**: `2a6abc7` (PR-AUTH-1 stageC r2)
- **Status**: active

---

## L-003 · spec 数值阈值无数学依据 → r2/r3 反复 FAIL

- **Symptom**: Phase 9 §G.31 "1280 视口 chart cardContent ≥ 25px"; r1/r2/r3 三轮都 FAIL by ~2.81px (r3 实测 22.19px); 触发 dynamic exit "同一 FAIL 三连即回 spec"
- **Root cause**: spec 写阈值时没算账。1280 视口数学上限 = `616 - chrome - AI(230) - DQ(39) - gaps(48) - KPI(88) - filter(32) = main grid 179 → 3fr_2fr score row 107 - card header 32 - py-3 28 = 22.19px`。spec 25 是凭"应该够"猜的, 物理不可达。
- **Detection**: 当 r2 FAIL 是 "同一数值差几个 px" 而不是"功能错"时, 优先怀疑 spec 阈值物理不可达, 不是 builder 实现错
- **Prevention**: coordinator 在 spec.md 写绝对像素 / 绝对数值类 acceptance 之前, **要么有数学算账推导, 要么改用相对改善表述**（"chart cardContent ≥ baseline × 2.5"）。猜值的代价是 r2/r3 烧 token。
- **Commit**: insights-phase9 r3-final (progress.tsv `2026-05-04T07:00:00Z`; spec §G.31 25→20 / §G.32 40→35 调整后 PASS)
- **Status**: active

---
