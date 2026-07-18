# Spec — R2 quiz 发布链修复（Codex pilot unit）

> 流水线：Fable 5 plan → **Codex 执行** → Opus 真浏览器验收。本 unit 同时是新协作模式的 pilot。

## 背景与根因证据（详见 `.harness/reports/audit-2026-07/product.md`）

- **F-PROD-06（P0）**：教师任务向导「创建并发布」quiz → `POST /api/lms/task-instances/with-task` 400，`fieldErrors:{task:["Too small: expected string to have >=1 characters"]}`——向导发出一个 UI 从不暴露的空 `task` 字段。3/3 复现（新建向导 ×2 + 重开草稿 ×1）。DB 对账 `TaskInstance`=0 行。quiz 类型从 UI 唯一路径无法发布，无旁路。
- **F-PROD-15（P2，同源）**：保存草稿 201 成功，但 `TaskBuildDraft.missingFields={答案与选项}`——重开草稿确认题目+正确答案（A/B 标绿）实际都在 → missingFields 判定与发布 payload 疑似同一根因（题目 config 未进 payload）。
- **F-PROD-07（P1）**：`/teacher/tasks/[id]` 教师端 quiz 每题选项渲染成空 bullet「·」无文字（解析/参考答案正常）；**学生 runner 同一份题目选项渲染完全正常** → 纯教师侧字段映射 bug。
- **F-PROD-08（P2）**：同页 console error「unique key prop in TaskDetailPage」，疑似与 07 同一处循环。

**复现资产**：本地 dev server http://localhost:3001 运行中（**勿 kill**，hot reload 会自动生效）；DB 为一次性审查库，内有 ZZAUDIT quiz 草稿（`TaskBuildDraft` id `0340e2c4…`，2 题已配答案）；教师账号 teacher1@finsim.edu.cn / password123。

## 范围

- **IN**：上述 4 条的根因修复 + 防同型回归的测试。
- **OUT**：F-PROD-09 满分口径（另开 unit）；simulation/subjective 发布路径改动（除非同一根因天然覆盖，需在报告论证）；任何 schema/migration 变更；一切 drive-by 重构。

## 硬规则（违反即 FAIL）

1. **禁止放松服务端校验来消除 400**。审计证据指向前端 payload 组装缺陷（向导未把 task/题目 config 序列化进 with-task 请求体）。若调查发现根因确在服务端，必须在 build 报告给出完整论证（对比「保存草稿 201 成功」路径的 payload 差异），且不得用 optional 化/默认值兜底掩盖数据缺失。
2. CLAUDE.md Bug Fix Rule：修根因不绕过；最小 diff（≤150 行原则，超出需报告说明）。
3. 中文 UI：顺带把 with-task 400 的用户可见 toast 从「请求参数错误」改为指明缺失内容的可读中文。
4. commit 前 `npx tsc --noEmit && npx vitest run` 全绿；为 payload 组装 / missingFields 判定补回归测试（route 或组件级均可，标准=能拦住同型回归）。
5. 纪律：不 push、不动 `.env`、不 kill :3001、DB 只允许 SELECT（可查草稿数据佐证根因）。

## 验收标准（Opus QA 将真浏览器逐条验）

1. 向导新建 quiz（≥1 单选 + 1 多选）「创建并发布」→ 201，TaskInstance 创建且 status=published
2. 重开既有 ZZAUDIT 草稿 → 发布成功
3. 草稿卡 missingFields 不再误报「答案与选项」
4. student1 可见任务 → 作答 → 提交 → 客观题自动判分，得分与配分逻辑一致
5. `/teacher/tasks/[id]` 选项文字完整渲染；console 零 key prop error
6. tsc 0 错；vitest 全绿（含新增测试）；seed 任务与 simulation 流程无回归

## 产出

- 分支 `codex-quiz-publish-fix`（从本地 main 切）；commit `fix:` 中文 message；**不 push**（QA PASS 后由 coordinator 走 PR 流程）
- 报告 `.harness/reports/build_r2-quiz_r1.md`：根因论证（含两条路径 payload 对比）/ 每处改动及理由 / 测试结果 / 自测记录 / 遗留风险
