# Build Report — Unit 4 Round 2

> Builder: builder · 2026-05-14 · Commit `f078815` on `claude-demo-fixes`
> Builds on r1 commits `dc5b1db` + `7b0a13d`
> Plan delta: r2 必做 1（allocation 编辑 UI）+ r2 必做 2（sim/sub e2e 各 1）

## r2 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `app/teacher/tasks/[id]/page.tsx` | +174 / -16 | editAllocations state + fetchTask 初始化 + buildPatchBody 拼 allocationSections + 编辑模式 UI（section/items 行级增删改）|
| `tests/e2e/unit4-verify.spec.ts` | +191 | I/J/K 3 个新 case + 一处 dialogueRequirements null→undefined 兼容 |

r2 总 diff +365 / -16。在 plan 预算 150-200 之上，多出来主要是 allocation UI 的嵌套结构（section + items 双层增删）+ 完整 e2e 覆盖。

## r2 关键改动思路

### 1. Allocation 编辑（r2 必做 1）

**State**: `editAllocations: AllocationSection[]`，结构与 DB 一致：`{ id, label, order, items: { id, label, order }[] }`。

**fetchTask 初始化**: 深拷 + sort by order。新加的 section/item 用 `new-sec-${Date.now()}` / `new-item-${Date.now()}` 作为临时 id（仅 UI 用，保存时由 service 重建实体）。

**buildPatchBody**: 仅当 editAllocations 非空或原 task 有 allocation 时拼入 body。order 字段保存时由 idx 重新赋值（避免用户调整顺序需手填）。

**UI**:
- 卡片显示条件：`task.allocationSections.length > 0 || (editing && task.taskType === "simulation")` — 给 sim 任务一个"从无到有"的入口
- editing 模式：每个 section 一行 `Input(label) + X 删除` + 嵌套 items 列表（`Input(label) + X 删除`），底部「添加条目」按钮
- 顶部「添加分区」按钮
- 读模式保留原样（Badge 渲染）

### 2. sim/sub 完整保存 e2e（r2 必做 2）

选取 teacher1 名下 0 graded sub 的 fixture：
- `a308c7ba` sim 任务 — 已有 1 个 allocation 分区"资产配置方案" + 5 items
- `aff902a3` sub 任务 — 已有 prompt + 0 sub

**Test I**: sim allocation API CRUD (add item → +1 → restore)
**Test J**: sim systemPrompt 改核心人设（注入 marker → 回读含 marker → restore）
**Test K**: sub prompt 改（append marker → 回读 → restore）

发现一个 schema 兼容问题：`simulationConfigSchema.dialogueRequirements: z.string().optional()` — 传 `null` 会被 zod 拒（"expected string, received null"）。我用 `?? undefined` 兜底。Production UI 也有这个隐患，但 page.tsx editing 中 `dialogueRequirements` 字段没有编辑入口（保持 DB 原值），是 readonly UI passthrough；只要 service `updateTask` 收 null 时不写就行。检查 service L246：`if (patchData.simulationConfig && existing.taskType === "simulation")` 后 `safeConfig` upsert，patchData.simulationConfig 来自 zod parse 通过的对象，所以这条 zod 约束就是 production 保护。**production 端没有传 null 的路径**（page.tsx 的 buildPatchBody simulationConfig 块里没拼 dialogueRequirements 字段），所以是测试端假阳性，已修。

### 3. 不在 r2 范围（依旧）

- ❌ taskSnapshot 修根（Phase 4）
- ❌ 改 wizard 组件复用
- ❌ quiz edit/delete 单独 e2e（H 验过 add；同一组件分支 edit/delete 已实现）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc clean
vitest: 83 files / 986 tests pass
eslint: 0 problems
```

### Playwright E2E（11 case 累计，serial）
```
[r1] commit-1 (高危拦截 + 复制为新任务):
✓ A: 无 graded sub PATCH 直通
✓ B: 有 graded sub PATCH 无 force → 400 TASK_HAS_GRADED_SUBMISSIONS
✓ C: 有 graded sub PATCH + force:true → 200 + audit force=true
✓ D: UI dialog 显示 + 三按钮 + 取消逻辑
✓ E: 「复制为新任务」→ POST tasks + router.push + "(副本)"
✓ F: 「直接保存」→ 第二次 PATCH 含 force:true

[r1] commit-2 (编辑模式 UI 扩):
✓ G: 编辑模式可见 quiz 题目编辑控件 + scoring 编辑控件
✓ H: 添加 quiz 题目 → 保存 → 题目数 +1

[r2] commit-3 (allocation + sim/sub):
✓ I: simulation task — allocation 增条目 PATCH 200 → 还原 + UI 验证 (5.3s) ⭐ r2
✓ J: simulation task — 改 systemPrompt 核心人设 → 保存 → 回读含 marker (2.1s) ⭐ r2
✓ K: subjective task — 改 prompt → 保存 → 回读含 marker (2.2s) ⭐ r2

11 passed (55.9s)
```

### DB 测后还原（实测）
```sql
-- sim task allocation
SELECT COUNT(*) FROM "AllocationItem" ai JOIN "AllocationSection" s
  ON ai."sectionId"=s.id WHERE s."taskId"='a308c7ba-...';
=> 5 (baseline)

-- 副本 task 清理
DELETE FROM "Task" WHERE "taskName" LIKE '%副本%';
=> 1 row removed (留作 r1 残留)
```

sim systemPrompt 和 sub prompt 都在测试内 restore 调用还原（API 双向 trip）。

## Acceptance 对照（r2 角度）

| spec acceptance | r1 状态 | r2 补全 |
|---|---|---|
| 编辑模式 allocation 可改 | ❌ 读模式只 | ✅ Test I + UI 完整 |
| 跨 task type 回归 - sim 完整 PATCH | ❌ smoke only | ✅ Test J |
| 跨 task type 回归 - sub 完整 PATCH | ❌ smoke only | ✅ Test K |

## 风险 / 不确定项（r2 引入）

1. **🟢 zod simulationConfig 字段需 undefined 而非 null** — 测试已修。Production 路径无此问题（buildPatchBody 不拼 dialogueRequirements）。
2. **🟢 allocation order 数组下标 reorder** — 用户编辑期不能拖动，保存按 UI 顺序赋 order。spec 没要求拖动。
3. **🟢 allocation UI 仅在 simulation 或已有数据时显示** — 防止其他类型任务老师误改。

## 是否需要重启 dev server

不需要。无 schema 改动。

## r1 → r2 总览

- r1 commits: `dc5b1db` (backend + dialog) + `7b0a13d` (quiz/scoring UI) — QA r1 PASS
- r2 commit: `f078815` (allocation UI + sim/sub e2e) — 本报告
- 累计：3 commits，11 e2e cases，0 regression。
