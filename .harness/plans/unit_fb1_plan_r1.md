# Unit-FB1 Plan — instance 详情页融合任务配置入口

## 调研

- `app/teacher/instances/[id]/page.tsx`（1043 行）：学生提交列表 + AI 分析 + 实例 meta；`task` 字段仅含 `{id, taskName, taskType, scoringCriteria}`
- `app/teacher/tasks/[id]/page.tsx`（1660 行）：完整 Unit 4 sections（read mode + edit mode）+ 高危 dialog + audit log + 复制为新任务
- 重复完整 Unit 4 编辑 UI 进 instance 页 = 1500 行 copy/paste + 两处维护成本高 → 不可接受

## 方案（务实 middle ground）

instance 页顶部加 **"任务配置"折叠卡**（默认收起）：
- 展开后调 `/api/lms/tasks/{instance.task.id}` 拿完整 task data
- 渲染 **read-only summary**：任务名 / 类型 / 题目数（quiz）/ rubric 维度数 / scoring 配置 / allocation 段数 / 章节关联 — 不完整渲染所有题目，只汇总
- 卡尾"编辑任务配置 →"按钮 → `router.push(/teacher/tasks/{task.id}?edit=true)`（用 Unit 4 已有的 edit mode + 高危 dialog + audit log，**不重复实现**）

## 改动

| 文件 | 改动 |
|---|---|
| `components/teacher/task-config-summary.tsx` (新) | 折叠卡组件：fetch task by id → 渲染汇总信息 + Link 跳转 Unit 4 edit |
| `app/teacher/instances/[id]/page.tsx` | 顶部插 `<TaskConfigSummary taskId={instance.task.id} />` 折叠卡 |
| `tests/e2e/unit-fb1-verify.spec.ts` 新 | (A) molly 进 instance 看到"任务配置"折叠区；(B) 展开后显示 task type + 题目数；(C) 点编辑跳到 `/teacher/tasks/{id}?edit=true` |

## 决策

- **方案 B (链接式) 优先**: instance 页加 summary + 跳转编辑 — 单次 demo 价值已交付。Unit 4 全 inline 编辑融入 r2/r3 候选（要做就抽 component）
- **不动 Unit 4 行为**: PATCH / 高危 dialog / audit log 全在 `/teacher/tasks/{id}` 路径继续工作
- **TaskSnapshot 兼容**: Unit 17 学生 runner 用 snapshot，老师改 task 不破坏进行中 instance — 已经 OK
- **/teacher/tasks/[id] 兼容保留** (老师可直接访问)
- **/teacher/instances 列表 nav 入口**：sidebar 已有 "任务列表" → 老师从那里也能进 task 编辑（兼容路径不变）

## 风险

- 🟢 schema 0 改动
- 🟢 复用 Unit 4 编辑流程（PATCH + dialog + audit）零重复
- 🟡 用户期望"折叠展开直接编辑"vs"链接跳转编辑" — 跳转方案视觉切换有跳屏感，但避免维护两份编辑 UI

预计 ~150 prod + ~80 e2e / r1 可能即收。

如果用户坚持要 inline edit（不接受跳转），需要 r2 抽 component（300+ 行 + 测试）。
