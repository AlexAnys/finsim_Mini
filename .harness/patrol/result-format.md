# 巡检结果汇总格式（report + 截图条 + progress 行）

> #8 交付物之一：巡检产出的统一格式。巡检 agent 据此填 `.harness/reports/qa_<unit>_<round>.md`。结构对齐既有 `qa_*.md`，尤其 `qa_sim_staging_r1.md`（过往成功的 staging 巡检范例）。`<…>` 为占位，填完删尖括号。

---

## A. 报告骨架（填进 `reports/qa_<unit>_<round>.md`）

```markdown
# QA Report — <feature/PR 一句话> staging 巡检 <round>

- **Scope**: <验了哪些验收点 / 哪个 PR #N> · staging `https://staging.finsim.anlanai.cn`
- **Branch**: `<branch>` · **Date**: <YYYY-MM-DD> · **巡检**: gstack browse 持久 Chromium，<登录了哪些角色，如 teacher1(王教授) + student1(张三)>
- **证据**: `.harness/screenshots/<patrol-slug>/`（01–NN）

## 第一步 sanity gate — 改动是否 live
<PASS/BLOCKED>。<判据：新 route 返 200 / 新文案在页面 / 面板存在…>。<是否跑的是本 PR 版本，有无被别的 PR 覆盖>。
> 若 BLOCKED（改动未上 / 跑的是旧版本）：到此停，下面不填，SendMessage coordinator。

## staging 数据现实（如有，影响哪些验收点）
<staging 是独立 seed 库，可能缺生产数据；列出哪些验收点因数据缺失只能验空态 / 无法真值核。这是「验证盲区」非代码缺陷，需 coordinator 定夺补数据复验或接受生产数据自然覆盖。>

## 验证矩阵
| # | 验证点 | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | <验收点 1> | PASS/FAIL | <截图 01 / API 200 success / 元素文案命中 / console 0 error> |
| 2 | <验收点 2> | PASS/FAIL | <…> |

<产品取向的点标注 `需用户判断`——巡检只截图呈现，不裁决「是不是你要的」。>

## Issues found
<逐条 bug：现象 + 哪一步触发 + repro（引截图）+ console/pageerror 原文。密码写 [REDACTED]。无则「无代码缺陷」。巡检无 Edit 权：只报不修，repro 写清回传 builder。>

## 未能完整验证（如有，非 FAIL 依据）
<因 staging 数据/环境限制无法执行的验收点 + 已做的替代核验 + 建议（① 接受/生产数据自然覆盖 ② 造 fixture 补验）。诚实写明，不假装验过。>

## console 噪音说明（如有）
<pre-existing 噪音（如 NextAuth `_getSession` Failed to fetch）标明非本改动引入、不阻塞；与本改动相关的新报错必须计入 Issues。>

## 安全（顺带真浏览器核，如改动涉权限）
<跨户 403 / 未登录 401 / 数据不泄漏 的真浏览器抽验结果。安全敏感另跑 /cso。>

## 清理
test 数据 cleanup <0 残留 / 列出残留 id 待清>。未碰演示富课（成绩 e6fc049c / SB 940bbe23）。

## Overall: <PASS / FAIL / BLOCKED>（<N/M 可执行验收点 verdict；K 项因 staging 限制 DEFERRED，非代码缺陷，待 coordinator 定夺>）
```

## B. 截图条
- 存 `.harness/screenshots/<patrol-slug>/`，按步编号 `01-<step>.png`、`02-<step>.png`…；交互类加 `NN-<step>-after.png`。
- 报告每条验收点的 Evidence 引对应编号。
- 截完用 **Read 工具贴出来**给用户看（gstack 规则 #11，否则用户看不见）。

## C. progress.tsv 一行
见 `.harness/patrol/progress-row.md`。

## D. 给 coordinator/用户的一句话（SendMessage）
- PASS：`PASS：N/N 验收点真浏览器过，截图条见 screenshots/<slug>/`
- FAIL：`FAIL：第 X 步 <现象（报错/缺元素）>，截图 NN`（必指明哪一步+什么现象，spec F2 AC3）
- BLOCKED：`BLOCKED：<staging 502 未 live / 未 seed 测试账号 / 改动未上>`

---

## 对齐检查（spec F2 Acceptance + gstack 规则）
- **AC1** 自动登录 + 真浏览器跑完 + 每步截图 → 证据栏每条都要有截图编号或 API 返回。
- **AC2** PASS/FAIL + 截图条 + 报告 + progress 一行齐全。
- **AC3** FAIL 必指明哪一步 + 什么现象 → 写进「Issues found」。
- **AC4/R4** 清理段必写「未碰富课」+ cleanup 残留情况。
- **AC6/R3** 产品判断点标 `需用户判断`，巡检不替用户拍板；总判只对「能用 + 符合写好的验收点」负责。
