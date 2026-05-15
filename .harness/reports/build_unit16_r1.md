# Build Report — Unit 16 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit16_plan_r1.md`
> Bug: probe r1 + bug_inventory r1 P2 扫尾

## 改动文件清单（4 items）

| 文件 | +/- | 说明 |
|---|---|---|
| `components/teacher-dashboard/weekly-insight-modal.tsx` | +2 / -1 | DialogContent className 加 `max-h-[90vh] w-[calc(100vw-1rem)]`（移动端近全屏）+ 保留 `sm:max-w-3xl`（桌面不变） |
| `components/teacher-course-edit/inline-section-row.tsx` | +3 / -2 | "+任务"、"+块"两按钮 `text-[10.5px]` → `text-[12px]` 中老年教师辨识度 |
| `components/teacher-course-edit/block-edit-panel.tsx` | +1 / -1 | "新建块" 文案 `text-[10.5px]` → `text-[12px]` |
| `components/course/context-sources-panel.tsx` | +45 / -6 | KS owner-confirm 改 AlertDialog 替代 window.confirm；新 `confirmOwnerSourceId` state；catch `KNOWLEDGE_SOURCE_OWNER_REQUIRES_CONFIRM` → setState 打开 AlertDialog "删除其他老师上传的素材" + 取消/确认删除 |
| `tests/e2e/unit16-verify.spec.ts` (新) | +110 | 5 case (A1 modal className 含 max-h-90vh + w-calc(100vw-1rem) + sm:max-w-3xl / B1 inline-section-row text-[12px] ≥2 / B2 block-edit-panel 新建块 12px / C1 不再 window.confirm() 调用 / D1 /teacher/analytics redirect → /teacher/analytics-v2) |

**生产代码**：51 / -10
**测试**：110
**Total**：~161（plan 估 40 prod + 100 e2e = 140，命中）

## 关键决策实施（按 coordinator 推荐 4 做 2 省）

### 4 做
1. ✅ **modal 移动端响应式** — Tailwind `w-[calc(100vw-1rem)]` 让 < sm 视口几乎占满；桌面保留 sm:max-w-3xl
2. ✅ **+任务/+块按钮字号 12px** — inline-section-row 两按钮 + block-edit-panel "新建块"
3. ✅ **KS owner-confirm AlertDialog** — 与 Unit 13 协作教师移除 + Unit 2/5a 同款 state pattern
4. ✅ **/teacher/analytics redirect 验证** — v1 page 已 `redirect("/teacher/analytics-v2")` (无需改 code，仅 e2e D1 verify)

### 2 省（按 coordinator 建议）
- ❌ dashboard 顶层 SB 高频提问卡（Unit 6 老师管理页 + Unit 11 AI 留痕已承接）
- ❌ "次班"术语（边角 wording，演示视频不展示）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 96 files / 1094 tests pass (baseline 不变, polish 不增 unit)
eslint: 0 new issue
```

### Playwright E2E (5 cases all pass)
```
[A1] modal className 含 max-h-90vh + w-[calc(100vw-1rem)] + sm:max-w-3xl: ✓ (8ms, source-level)
[B1] inline-section-row text-[12px] ≥2: ✓ (1ms, source-level)
[B2] block-edit-panel 新建块 12px: ✓ (1ms, source-level)
[C1] context-sources-panel 不再 window.confirm() 调用: ✓ (2ms, regex /window\.confirm\(/ 不匹配)
[D1] /teacher/analytics → redirect /teacher/analytics-v2: ✓ (6.9s, real browser)
```

DB 测后还原确认：N/A（本 unit 不动 DB）

## 风险 / 不确定项

1. **🟢 schema 0 改动**
2. **🟢 modal w-[calc(100vw-1rem)]**：< sm 视口给 1rem 边距防贴边；sm+ 视口 sm:max-w-3xl 覆盖（Tailwind 最后规则优先）
3. **🟢 按钮 12px** — 中老年教师辨识度提升，不破坏 layout（仅微调字号）
4. **🟢 AlertDialog 与 Unit 13 同模式** — state pattern + handleDelete force=true 复用
5. **🟢 context-sources-panel 内仅一个 window.confirm 被改**：grep 显示其他 3 处 "window.confirm" 都在注释中（历史说明），regex `/window\.confirm\(/` 实际调用不再存在

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| 仪表盘 modal 移动端响应式 (max-w-3xl + 全屏 drawer) | ✅ A1 |
| "+任务/+块" 按钮 10.5 → 12px | ✅ B1+B2 |
| KS owner-confirm 改 AlertDialog | ✅ C1 |
| /teacher/analytics → analytics-v2 redirect | ✅ D1 实测 |
| tsc/vitest/lint 全过 | ✅ |

## 不在本范围

- ❌ dashboard SB 卡（Unit 6+11 已承接）
- ❌ "次班"术语
- ❌ 课程列表 hover 区域 / "待批改"含义 tooltip（spec 选省）
- ❌ sim 评分依据路径深（Unit 9 已加 evidence UI）

## 反思

- 4 个 polish 各自独立但符合"少而精"原则 — coordinator 推荐 ✓
- C1 测试第一版用 `segment.not.toContain("window.confirm")` 误命中注释中的 "window.confirm → AlertDialog" 文本。改用 regex `/window\.confirm\(/` 锁实际调用。**Lint: 验证调用而非字符串**
- e2e 大多 source-level 检查（filesystem read + regex），快速 (<1ms)；仅 D1 真浏览器 (6.9s)，因 redirect 必须真跑

## Phase 4 收尾

Phase 4 8/8 完成（Unit 17 ✓ / Phase3-A ✓ / Unit 12 ✓ / Unit 15 ✓ / Unit 13 ✓ / Unit 14 ✓ / Phase3-B ✓ / Unit 16 ✓）。
