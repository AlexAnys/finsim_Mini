# Build report — PR-codex-fix-4 r1

Unit: PR-FIX-4 · Codex 深度审查 27 finding 修复链 · D1（任务向导旧 5 档 [MOOD:] prompt 清理）
Round: 1
Author: builder-fix
Date: 2026-04-26

> 沿用 PR-codex-fix-1/2/3 命名约定。

> **Scope**：分两部分：
> 1. 第一阶段（commit `e79689a`）：清理任务向导（new + edit）的 systemPrompt 模板里残留 [MOOD:] 指令
> 2. 第二阶段（待 commit · 本报告 update 范围）：team-lead 追加 optional 项 — service 层 stripLegacyMoodBlock 兼容老任务模板（教师 update 老任务自动清理）

## 范围（spec.md L52 + team-lead 追加）

- D1 — `app/teacher/tasks/new/page.tsx:404` 旧 5 档 [MOOD:] prompt 清理
- D1 同源副本 — `app/teacher/tasks/[id]/page.tsx:227`（编辑页同模板）
- **D1 服务层兼容**（team-lead optional ack）— `lib/services/task.service.ts` 加 `stripLegacyMoodBlock` 在 createTask + updateTask 入口自动剥老 [MOOD:] 块

## 文件改动（5 files · ~+200 / −2）

### 第一阶段（已 commit `e79689a`）
- `app/teacher/tasks/new/page.tsx` — 删模板 `【情绪标签】[MOOD: HAPPY|...]` 段
- `app/teacher/tasks/[id]/page.tsx` — 编辑页同模板顺手清
- `tests/pr-fix-4-d1.test.ts` — 4 cases 文件 grep 锁定
- `.harness/reports/build_pr-codex-fix-4_r1.md` — 报告

### 第二阶段（待 commit）
- `lib/services/task.service.ts` — 新增 `stripLegacyMoodBlock` exported helper + `sanitizeSimulationConfig` internal helper；createTask + updateTask 在写入 simulationConfig 之前自动 sanitize（老任务保存时自动清理，新任务零变化）
- `tests/pr-fix-4-d1.test.ts` — 追加 5 service-layer cases（整段块清/单 [MOOD:] 残片清/byte-EQ 透传/empty handling/strip 后空返 undefined）

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 输出 |
| `npx vitest run` | PASS | **41 files / 450 tests**（之前 441 + 9 新增 · 零回归） |
| `npm run build` | PASS | Compiled successfully · 25 routes · 4.3s |
| Dev server alive | PASS | PID 84808 next-server v16.1.6 / `/login` 200 |
| 无 schema 改动 | PASS | git diff prisma/schema.prisma = 0；不需要 Prisma 三步 |

## 不直观决策（rationale）

1. **顺手清编辑页**（第一阶段）：spec 只点了 `app/teacher/tasks/new/page.tsx:404`，但编辑页是同模板复制；只清新建页 → 编辑老任务时模板再被注回 → drift。一次清干净
2. **保留 ai.service.ts L546 评估提示中的 [MOOD:] 引用**：那是 AI 评估时"如果 transcript 里有遗留 [MOOD:] tag，把它当情绪信号"的 hint，不是"叫客户端 AI 输出 [MOOD:]"。历史 transcript 上仍有这种 tag，提示对老数据有意义
3. **保留 simulation-runner stripMoodTagFromText helper**：那是兜底剥老 [MOOD: XXX] 的 helper，只在 chatReply JSON parse fail 时用。仍是合理 defensive code
4. **服务层 strip 在 task.service 而非 schema.zod**（第二阶段）：zod transform 会改变 type signature（output ≠ input）→ 影响 7+ caller 类型推导；service 层 sanitize 局限到 simulationConfig 字段且不改 schema 接口 → 风险最低
5. **stripLegacyMoodBlock 4 层正则**（第二阶段）：
   1. 整段【情绪标签】块（吃到下一个【块】或字符串末尾） — 主清
   2. 落单 `[MOOD: HAPPY|NEUTRAL|...]` 列表残片（无【情绪标签】框） — 兜底
   3. "在每条回复末尾附加：" 残句 — 兜底
   4. 5 行 `- HAPPY: ... - ANGRY: ...` 残行 — 兜底
   多层兜底是因为不同教师的 prompt 写法可能略有差异（手改过、转译过等）
6. **strip 后空返 undefined 而非空字符串**：教师之前可能把 systemPrompt 全填的就是 mood 指令，清完没有内容应被视为"教师未配置 systemPrompt"，让 ai.service 用默认人设
7. **byte-EQ 透传干净 prompt**：用 `===` 严格比较，无变化时直接返回原对象（不重建对象，节省 GC + 测试容易锁定）

## 范围外 / 不在本 PR

- D2/D3/D4/D5（spec L53-56）按 spec 留增量 PR
- ai.service.ts L546 评估提示中的 [MOOD:] hint（合理 legacy support，不动）
- simulation-runner stripMoodTagFromText helper（合理 defensive，不动）
- 数据库迁移自动清理已有 SimulationConfig 记录（一次性 SQL）— 本 PR 不做。理由：现有 simulationConfig 数据量小（仅教师手建任务 ~< 100 条），update path 自动清理已经够用。强制 SQL 清理还会让审计 trail 不连贯（教师视角："我没改过这个任务，怎么 systemPrompt 变了？"）

## 给 QA 真浏览器 + 真 curl 提示

### 第一阶段（commit `e79689a`）
- teacher 进任务向导新建 simulation 任务 → 填核心人设/对话风格/禁止行为 → 提交 → DB Task.simulationConfig.systemPrompt 应仅含上述 3 段 + 基础引言 + {scenario}，**不含**"在每条回复末尾附加：[MOOD:" 字样
- teacher 进任务编辑页改同样 simulation 任务 → 改字段提交 → DB systemPrompt 同样不应回写 5-mood 指令（同源 drift 防御）

### 第二阶段（待 commit）
- 真验证：seed 一个含旧 [MOOD:] 模板的 SimulationConfig（手工 SQL 或脚本 INSERT）→ 教师进编辑页 → 不改任何字段直接 Save → 服务层 sanitize 自动 strip → DB systemPrompt 应已清干净
- 单测 9 cases 全过（4 文件 grep + 5 service-layer regex）
- 真 sim runner 学生对话 → AI 仍按 8 档情绪输出（mood_label 字段经 ai.service chatReply 注入，与 systemPrompt 是否含 [MOOD:] 无关）

## 不需要 dev server 重启

- 无 schema / 无 service 接口动 → Next.js 热重载自动生效
- Dev server PID 84808 仍 alive
