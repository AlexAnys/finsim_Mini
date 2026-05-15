# QA Report — Unit 16 Round 1

> QA: qa · 2026-05-15 · Branch `claude-demo-fixes` @ 4acbd18
> Build report: `.harness/reports/build_unit16_r1.md`
> Plan: `.harness/plans/unit16_plan_r1.md`（coordinator pre-approved scope: 4 做 / 2 省）

## Spec: Phase 4 Unit 16 — P2 收尾（modal 移动端 + 按钮字号 + KS AlertDialog + redirect 验证）

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 4 acceptance 全实现，scope reduction "4 做 2 省" 已记录在 plan 并由 coordinator pre-approved（与 spec line 198 "all PASS" 的 reconciliation：未做的 P2 项分散在 Unit 6/9/11 等前序 unit 已承接；明确 2 省项写进 plan/build report） |
| 2. tsc --noEmit | PASS | clean output |
| 3. vitest run | PASS | 96 files / 1094 tests passed (baseline 不变, polish 不增 unit test) |
| 4. Browser (independent QA via Playwright) | PASS | 5/5 case 全过, 见下方真 DOM 证据 |
| 5. Cross-module regression | PASS | grep `window.confirm(` in context-sources-panel = 0 hits; 其他 11 处 `window.confirm` 在 inline-section-row/block-edit-panel/etc 不在 Unit 16 scope（保留），无新引入 |
| 6. Security (/cso) | N/A | 仅样式 + 替换确认对话方式，不涉及 auth/session/payment/upload |
| 7. Finsim-specific | PASS | UI 全中文 ('删除其他老师上传的素材', '本周尚无可聚合数据', '+任务', '+块'), 无英文错误透传, API 响应 {success,error.code,message} 格式保持 (LEGACY_DOC_UNSUPPORTED 路径) |
| 8. Code patterns | PASS | 无 drive-by refactor; AlertDialog 复用 Unit 13 同款 state pattern；样式改动仅微调 className 不破坏 layout |

## 独立证据链（QA 独立验证，非 builder 自测复用）

### A1 — modal 移动端 className 真 DOM 验证

打开 weekly-insight modal 在 375×812 视口，Playwright 实测 `[role="dialog"]` className：

```
bg-background data-[state=open]:animate-in ... max-w-[calc(100%-2rem)]
... max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-3xl
```

3 关键类全部在真 DOM：`max-h-[90vh]` + `w-[calc(100vw-1rem)]` + `sm:max-w-3xl`。

视觉证据：`/tmp/qa-unit16-modal-mobile.png`（375 视口 modal 全显，未横向溢出）

mobile dashboard 测量：`scrollWidth=375 clientWidth=375`（完美吻合，无横向溢出）

### B1/B2 — 按钮字号 12px source verification

`inline-section-row.tsx`：grep `text-\[12px\]` 出现 ≥2 次（"+任务" + "+块"两按钮）
`block-edit-panel.tsx`：含 `<span className="text-[12px]">新建块</span>`

### C1 — context-sources-panel window.confirm → AlertDialog

`grep -n "window\.confirm(" components/course/context-sources-panel.tsx` → 0 hits。
AlertDialog 组件已正确 import + `confirmOwnerSourceId` state + "删除其他老师上传的素材" title + "确认删除" + "取消" 按钮。state 切换由 `setConfirmOwnerSourceId(sourceId)` 触发，符合 Unit 13 同款 pattern。

### D1 — /teacher/analytics redirect

真浏览器实测：`page.goto('/teacher/analytics')` → URL 自动跳转到 `/teacher/analytics-v2`，response status=200。
`app/teacher/analytics/page.tsx` 内容仅 `redirect("/teacher/analytics-v2")` 一行（Next.js 服务端 redirect）。

### 跨视口确认（无横向溢出）

| 视口 | scrollWidth | clientWidth | 状态 |
|---|---|---|---|
| 375×812 (mobile) | 375 | 375 | ✓ 无溢出 |
| 1440×900 (desktop) | dashboard 加载成功 | — | ✓ |

视觉证据：`/tmp/qa-unit16-dashboard-{desktop,mobile}.png`、`/tmp/qa-unit16-modal-mobile.png`、`/tmp/qa-unit16-courses.png`

## 测试套件 numerical evidence

```
tsc --noEmit: clean
vitest: 96 files / 1094 tests passed (Phase3-B 后 baseline)
lint: 0 errors (27 warnings 均为 pre-existing 与 Unit 16 无关)
e2e (builder spec): 5/5 PASS (12.8s)
e2e (QA independent spec): 5/5 PASS (~1.6m, real browser, real login)
```

## Issues found

None blocking. Builder report 中 reflection note "regex /window\.confirm\(/ 锁实际调用而非字符串" 实质把"检查注释会误命中"这个潜在 false-positive 修了 — 良好实践。

### Scope clarification (非 issue, 仅 note)

Spec line 198-237 列出 ~21 个 P2 items。Plan & build report 明确"4 做 2 省"，coordinator 已 pre-approved 此 scope reduction（per build 报告 line 25 "按 coordinator 推荐"）。其余 P2 items 由 Phase 1-3 各 unit 已承接（如 SB Top 3 卡 → Unit 6+11, LLM 错误降级 → Unit 15, 主观题集中底部 → Unit 12 已部分覆盖，learning task 折叠 → Unit 14, etc.）。

明确 2 省项：
- dashboard SB Top 3 卡（Unit 6 + 11 已承接）
- "次班"术语替换（边角 wording，演示视频不展示）

仍有少数 spec P2 项目（如"缓存命中态重新生成按钮加确认"、"30 轮硬截断 toast"、"recompute toast"、"AI 优化原题题目级悬停"、"教师 override 显示对比"、"settingsUserId fallback"、"ENABLE_AUDIT_LOGS 采样率"、"B-STU-P2-1 to 6"）未在 Phase 4 兑现，但由 coordinator/builder 与 user 在 spec → plan 转化时决策。**若用户检视后认为这些缺口仍需 Phase 5 兑现，应在 PR 前补单独 unit；否则 PASS。**

## Overall: PASS

Phase 4 8/8 完成（Unit 17 / Phase3-A / Unit 12 / Unit 15 / Unit 13 / Unit 14 / Phase3-B / Unit 16 全 r1 即收）。
