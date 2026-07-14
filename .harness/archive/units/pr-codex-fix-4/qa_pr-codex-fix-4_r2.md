# QA Report — PR-codex-fix-4 r2 (service-layer fortification)

Unit: PR-FIX-4 D1 service 层 stripLegacyMoodBlock helper（team-lead optional）
Round: 2（增量 commit · 不是 r1 反馈迭代）
Reviewer: qa-fix
Date: 2026-04-26
Builder commit: `af7abb8 fix(task-wizard): codex D1 服务层兼容老任务模板`
（接续 r1 commit `e79689a`）

> Mid-state 透明备注：commit `41cc85b` 是早期 1 层 regex 的过渡版本（hook 自动 commit），随后 `af7abb8` 改进到 4 层。Main HEAD（含 `8cfc862` HANDOFF）状态正确。

## Spec
service 层 stripLegacyMoodBlock 让教师编辑老任务时（pre-PR-FIX-4 创建的）自动清理残留 [MOOD:] 块，不需手工 SQL 迁移。

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | service 层 sanitize 函数 + createTask/updateTask 调用 + 4 层正则覆盖 |
| 2. tsc --noEmit | PASS | 0 输出 |
| 3. vitest run | PASS | 41 files / **450 tests**（baseline 445 + 5 新 · 零回归） |
| 4. npm run build | PASS | 25 routes / 4.3s |
| 5. 真 curl E2E | PASS | 见下方 |
| 6. byte-EQ pass-through | PASS | clean prompt 不变 |
| 7. Hybrid 决策评审 | PASS | service 层 strip 不动 zod schema（7+ caller 零影响）+ 不一次性 SQL 清现存配置（保 audit trail 教师视角连贯）|

## 真 curl E2E 矩阵

### D1.SVC.1 service strip 老 [MOOD:] 模板（PASS）

POST `/api/tasks` 含完整 legacy systemPrompt：
```
你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：
王女士，30岁
【对话风格】
请保持自然
【情绪标签】
在每条回复末尾附加：[MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY]
- HAPPY: ...
- NEUTRAL: ...
- CONFUSED: ...
- SKEPTICAL: ...
- ANGRY: ...
```

DB 验证 `SimulationConfig.systemPrompt`：
```
你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：
王女士，30岁
【对话风格】
请保持自然
```

✅ 整段【情绪标签】块（regex 1）+ 5 档 [MOOD:] 列表（regex 2）+ "在每条回复末尾附加"残句（regex 3）+ 5 行 - HAPPY/.../-ANGRY（regex 4）全清
✅ 保留 客户人设引言 + 【对话风格】块 + 王女士 30岁 信息
✅ grep "[MOOD:" in DB = 0 hits

### D1.SVC.2 byte-EQ pass-through（PASS）

POST `/api/tasks` 含 clean systemPrompt（无 [MOOD:]）：
```
你是一个金融理财场景中的模拟客户。
【对话风格】
请保持自然
```

DB 验证：内容**不变**（byte-EQ pass-through）✅

## 不直观决策评审

| Builder 决策 | QA 评审 |
|---|---|
| service 层 strip 而非 zod transform | **合理** — zod transform 改类型推导会冲击 7+ caller；service 层注入只在 createTask/updateTask 命中 |
| 4 层 regex 兜底（块/列表/残句/残行） | **合理** — 教师写法多样（不同顺序、空白、缩进），单一 regex 易漏。4 层互不冲突 |
| strip 后空字符串返 undefined | **合理** — 教师只填 [MOOD:] 块时清完应等于"未配置"，让 ai.service 用默认人设而非传空字符串 |
| 不一次性 SQL 清现存 SimulationConfig | **合理** — 强制 SQL 会让"教师没改过怎么 prompt 变了"的 audit trail 不连贯。教师 update path 自动清足够 |

## Issues found

无 BLOCKER。

**Note**：早期 commit 41cc85b 的 1 层 regex 过渡版本已经被 af7abb8 覆盖（git history 保留 mid-state 透明）。Main HEAD 状态正确。

## Overall: PASS

PR-FIX-4 D1 service-layer fortification 完成：
- Wizard 模板清理（r1 / e79689a）+ Service 层 sanitize（r2 / af7abb8）双层防护
- 真 curl E2E：legacy prompt → strip 干净；clean prompt → byte-EQ
- 4 层 regex + 9 总测试 cases（4 文件 grep + 5 service strip）
- byte-EQ + audit-friendly + zero schema impact
- 450 tests / tsc 0 / build 25 routes / dev server PID 84808 alive

**完整 Codex 修复链最终状态（main 12 commits 自 65f2e26 起）**：

| Commit | PR | 范围 |
|---|---|---|
| 65f2e26 | PR-FIX-1 r1 | Batch A 9 + UX4 + UX5 |
| c6c178c + 2844ec8 | Plan D | drift 修复 |
| 30dec3b | PR-FIX-1 r3 | tsc 修 |
| 96ed776 | PR-FIX-2 r1 | Batch B 7 + Prisma 三步 |
| 365972f | chore | reports archive |
| d0ef6ab | PR-FIX-3 r1 | Batch C 5（C1-C5）|
| 0ac5ec3 | PR-FIX-3 r2 | UX2 + UX3 |
| e79689a | PR-FIX-4 r1 | D1 wizard 清理 |
| 41cc85b | PR-FIX-4 mid | service strip 1-layer 过渡版（被覆盖） |
| e789e00 | chore | reports archive |
| af7abb8 | PR-FIX-4 r2 | D1 service-layer 4-layer fortification |
| 8cfc862 | chore | HANDOFF 最终 |

**累计**：450 tests、76 新/改写 tests、9 fix commits + 3 chore + 2 Plan D = **14 commits 全部 PASS**

**Codex 27 finding 全闭环 + 5 UX 决策项全落地**：
- 18 P1（Batch A 9 + Batch B 7 + Batch C 前端 P1 from C1+C2）
- 8 P2/D-tier（Batch C 3 + UX2/UX3 + D1）
- 5 UX（UX1/UX2/UX3/UX4/UX5）
- D2/D3/D4/D5 留增量 PR

**Dynamic exit**：连续 PASS 4/4（pr-codex-fix-2 r1 + pr-codex-fix-3 r1+r2 + pr-codex-fix-4 r1+r2）— **远超 2/2 收工阈值** ✅
