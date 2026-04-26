# Build report — PR-codex-fix-4 r1

Unit: PR-FIX-4 · Codex 深度审查 27 finding 修复链 · D1（任务向导旧 5 档 [MOOD:] prompt 清理）
Round: 1
Author: builder-fix
Date: 2026-04-26

> 沿用 PR-codex-fix-1/2/3 命名约定。

## 范围（spec.md L52）

- D1 — `app/teacher/tasks/new/page.tsx:404` 旧 5 档 [MOOD:] prompt 清理
- 顺手修同源副本：`app/teacher/tasks/[id]/page.tsx:227`（编辑页同模板）

## 文件改动（3 files · +11 / −2）

- `app/teacher/tasks/new/page.tsx` — 删除 systemPrompt 模板里的 `【情绪标签】\n在每条回复末尾附加：[MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY]\n- HAPPY: ... - ANGRY: ...`，仅保留客户人设/对话风格/禁止行为引言。运行时 ai.service.chatReply 注入 8 档 JSON 输出协议（PR-7B 已落地）
- `app/teacher/tasks/[id]/page.tsx` — 同上，编辑页有相同模板（spec 只点了 new 页面，但相同内容也应清理；不清留下双源 drift 隐患）
- `tests/pr-fix-4-d1.test.ts` — 新 4 cases：
  - new 页面 5-mood [MOOD:] 列表已删
  - edit 页面 5-mood [MOOD:] 列表已删
  - 两文件 systemPrompt 仍生成且包含 {scenario} 占位符 + 基础人设引言
  - ai.service.ts 8 档 JSON 协议（PR-7B）仍在（防 PR-FIX-4 误删）

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| `npx tsc --noEmit` | PASS | 0 输出 |
| `npx vitest run` | PASS | **41 files / 445 tests**（之前 441 + 4 新增 · 零回归） |
| `npm run build` | PASS | Compiled successfully · 25 routes · 4.3s |
| Dev server alive | PASS | PID 84808 next-server v16.1.6 / `/login` 200 |
| 无 schema 改动 | PASS | git diff prisma/schema.prisma = 0；不需要 Prisma 三步 |
| 无 service 接口动 | PASS | git diff lib/services 空 |

## 不直观决策（rationale）

1. **顺手清编辑页**：spec 只点了 `app/teacher/tasks/new/page.tsx:404`，但 `app/teacher/tasks/[id]/page.tsx:227` 是同一模板的复制。如果只清 new 页，编辑页继续生成 5 档指令 → 教师改任务时又把老指令塞回 systemPrompt → drift。一次清干净是最低成本
2. **保留 ai.service.ts L546 评估提示中的 [MOOD:] 引用**：那是评估时"如果 transcript 里有遗留 [MOOD:] tag，把它当情绪信号"的 hint，不是"叫 AI 输出 [MOOD:]"。历史 transcript 上有这种 tag（5-mood 时代的 simulation 提交），所以这个提示对老数据仍有意义
3. **保留 simulation-runner stripMoodTagFromText helper**：那是兜底剥老 [MOOD: XXX] 的 helper，只在 chatReply JSON parse fail 时用。仍是合理 defensive code
4. **没改 lib/services/ai.service.ts**：8 档 JSON 协议本来就在（PR-7B 落地）。教师向导现在生成的 systemPrompt 不再尝试规定 mood 标签，运行时由 service 在 systemPrompt 之后追加 8 档 JSON 协议（见 ai.service.ts L300：`const systemPrompt = ${personaPrompt}\n${objectivesBlock}\n【输出格式 · 严格 JSON · PR-7B】...`）
5. **新增 tests/pr-fix-4-d1.test.ts 用文件 grep 而非 unit test**：D1 是模板字符串字面清理，正常 unit test 模 component 难覆盖到（需要 React render + form submit）。文件 grep 是最直接的"是否清干净"验证 + 锁定将来不再回退

## 范围外 / 不在本 PR

- D2/D3/D4/D5（spec L53-56）按 spec 留增量 PR
- ai.service.ts L546 评估提示中的 [MOOD:] hint（合理 legacy support，不动）
- simulation-runner stripMoodTagFromText helper（合理 defensive，不动）

## 给 QA 真浏览器提示

- teacher 进任务向导新建 simulation 任务 → 填核心人设/对话风格/禁止行为 → 提交 → DB Task.simulationConfig.systemPrompt 应仅含上述 3 段 + 基础引言 + {scenario}，**不含**"在每条回复末尾附加：[MOOD:" 字样
- teacher 进任务编辑页改同样 simulation 任务 → 改字段提交 → DB systemPrompt 同样不应回写 5-mood 指令（同源 drift 防御）
- 真 sim runner 学生对话 → AI 仍按 8 档情绪输出（mood_label 字段经 ai.service chatReply 注入），UI mood meter 8 档正常 chip dispatch（PR-7B 行为）
- 历史 task 含老 systemPrompt 仍能正常用（运行时 ai.service.chatReply 仍 wrap 8 档 JSON 输出协议，老指令被新指令"覆盖" — JSON 字段优先于 text [MOOD:]）

## 不需要 dev server 重启

- 无 schema / 无 service 接口动 → Next.js 热重载自动生效
- Dev server PID 84808 仍 alive
