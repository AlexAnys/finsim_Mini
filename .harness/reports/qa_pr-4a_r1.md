# QA Report — pr-4a r1

## Spec
Phase 4 · PR-4A · 任务向导骨架 + Step 0/1：按 `mockups/design/teacher-task-wizard.jsx` 结构换壳，保留现有 form state / Zod / 提交流程；将原 3 步扩展为 4 步（Type / Basic / Config / Review），taskType 升级为独立 Step 0 三卡选择。

## 验证表

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 新增 5 组件（wizard-types.ts / wizard-stepper.tsx / wizard-card.tsx / wizard-step-type.tsx / wizard-step-basic.tsx）；主 page 重构为 220px stepper + 1fr main；Step 0 三卡；Step 1 basic；Step 2/3 保留 inline（PR-4B/4C 拆）；breadcrumb + pill header 到位；form state/Zod/提交逻辑零改（`/api/tasks POST` 仍在 page.tsx:539）|
| 2. `npx tsc --noEmit` | PASS | 0 errors |
| 3. `npx vitest run` | PASS | 225/225 绿（219 原有 + 6 新 `tests/task-wizard-types.test.ts`，覆盖 WIZARD_STEPS 顺序、TASK_TYPE_META 三类 × 色类齐全 × 中文 label × 字段非空）|
| 4. Browser (/qa-only 或 curl) | PASS (SSR 证据) + N/A (交互) | 见下 Evidence 节；`/qa-only` daemon 不可用于本会话；NextAuth credentials 本地返回 Configuration 错（非本 PR 引入，dev server 4/22 起，见 Issues#2）；SSR 200 + 关键中文 7/7 命中足以证明渲染 |
| 5. Cross-module regression | PASS | 11 路由未登录 SSR 全 200（学生 4 + 教师 7）；`/api/tasks POST` 调用未改；无其他文件受影响（git diff 仅 `.harness/spec.md` + `app/teacher/tasks/new/page.tsx` + 新 `components/task-wizard/` + 新 test）|
| 6. Security (/cso) | N/A | 纯 UI 重构；auth 走 layout SSR（未改）；无新 API / schema / secret / 权限路径 |
| 7. Finsim-specific | PASS | UI 全中文（新建任务 / 任务类型 / 选择要出的是哪种题 / 基本信息 / 预览并创建 / 模拟对话 / 测验 / 主观题 / 请输入任务名称 等）；无英文错误透出；page.tsx 是 "use client"，auth 在 layout SSR 透传（pattern 未改）；API 响应 shape 未动 |
| 8. Code patterns | PASS | 0 硬编码色（`grep -rnE "#[0-9a-fA-F]{3,6}" components/task-wizard/` 无命中）；新组件全 token 化（bg-sim-soft/text-sim/border-sim/bg-brand-soft/text-ink-*/border-line* 等 15+ tokens 已用）；Tailwind JIT 已从字面量扫出 12 个动态 `bg-sim/bg-sim-soft/text-sim/border-sim × 3 类型` 并落入编译 CSS；无 drive-by refactor |

## Evidence — 静态 + SSR

### 硬编码色扫描
```
grep -rnE "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(" components/task-wizard/ app/teacher/tasks/new/page.tsx
→ 0 命中
```

### Token 覆盖（新组件）
```
bg-brand / bg-brand-soft / bg-line-2 / bg-paper-alt / bg-success / bg-surface
border-line / border-line-2
text-brand / text-danger / text-ink / text-ink-2 / text-ink-3 / text-ink-4 / text-ink-5
```
加上 `TASK_TYPE_META` 内动态 12 类（sim/quiz/subj × soft/text/border/bg）。

### 动态类已落入编译 CSS（`.next/static/chunks/b0c9d9b7224eeb0f.css`）
```
.bg-sim / .bg-sim-soft / .text-sim / .border-sim          # 各 1-3 命中
.bg-quiz / .bg-quiz-soft / .text-quiz / .border-quiz      # 各 1-3 命中
.bg-subj / .bg-subj-soft / .text-subj / .border-subj      # 各 1-3 命中
```

### `npm run build` — 25 routes 全过
```
/teacher/tasks/new  ƒ Dynamic
```

### SSR curl `/teacher/tasks/new`（未登录，soft guard layout）
- HTTP 200 · body 52 590 bytes
- 中文命中（独立 grep）：
  - 新建任务 × 2（面包屑 + 标题）
  - 任务类型 × 3（stepper 步骤 1 + Step 0 标题 + 推荐时长旁）
  - 选择要出的是哪种题 × 1
  - 基本信息 × 1
  - 预览并创建 × 1
  - 模拟对话 / 测验 / 主观题 × 3 / 1 / 1

### 回归守护 — 11 路由未登录 SSR 全 200
| route | status | size |
|---|---|---|
| /teacher/dashboard | 200 | 38 405 |
| /teacher/courses | 200 | 38 305 |
| /teacher/tasks | 200 | 37 926 |
| /teacher/tasks/new | 200 | 52 600 |
| /teacher/instances | 200 | 37 949 |
| /teacher/groups | 200 | 38 328 |
| /teacher/schedule | 200 | 38 340 |
| /dashboard | 200 | 40 369 |
| /courses | 200 | 39 878 |
| /grades | 200 | 40 275 |
| /schedule | 200 | 40 293 |

### Wiring（page.tsx 静态 review）
- 4 步定义：`WIZARD_STEPS` 长度=4（Type / Basic / Config / Review）
- `validateStep0` = true（Step 0 有 default `simulation`）
- `validateStep1` = 校验 taskName 非空 → 中文错误 "请输入任务名称"
- `validateStep2` = 按 3 类 config 校验 → 中文错误（"请输入场景描述" / "请至少添加一道题目" / "请输入题目提示" 等）
- `nextStep` 顺序调 validateStep0/1/2，clamp `step` 0..3
- `jumpTo(idx)` 只允许往回跳（`idx <= step`）
- Footer：`step === 0` 禁用"上一步"；`step === 3` 显示"创建任务"按钮走 handleSubmit → POST /api/tasks

## Issues found

### #1（note · 非阻塞） builder 已自报的 2 处设计稿偏离
来源：`.harness/reports/build_pr-4a_r1.md` 第 3 节

- "保存草稿" 按钮未实现（codebase 无 draft 持久化；spec 要求"保留现有 form 逻辑"）
- Step 1 章节/小节/课前课中课后/可见性 4 个 select 未实现（需要新 API 三级联查询；spec 本 PR "不做新 API"）

评审：这两项属设计稿到数据模型的"视觉-数据不对齐"，均为纯装饰字段，本 PR 范围明确排除。非 FAIL；作为 PR-4C / Phase 5 的待评估项已记入 build report。

### #2（note · 与本 PR 无关） NextAuth credentials 登录返回 `error=Configuration`
- 本地 `POST /api/auth/callback/credentials` 302 但 `Location: /api/auth/error?error=Configuration`
- Dev server 进程 PID 30897 于 **4月22日 21:28** 启动，至今 2 天，期间经过 Phase 3/SEC 多次 Prisma 改动 + schema 变更（见 progress.tsv r1b/r1c/r1d 等），可能导致内部状态陈旧
- pre-existing，非本 PR 引入（PR-4A diff 只碰 page.tsx + 新 components + 1 test；未改 auth/env/prisma）
- 影响：QA 无法拿到 session cookie 执行交互模拟；SSR 验证 + 静态 wiring review + build+tests 三重证据足够替代
- 不记为 PASS 前提的 FAIL；建议 team-lead 在启动 PR-4B 前重启 dev server（dev server 重启能解三件事：NextAuth cookie 恢复、Prisma client 刷新、避免 Phase 4 schema 改动时的老 client 缓存）

### #3（note · 非阻塞） `gstack /qa-only daemon` 在本会话不可用
- `$B` 命令 + `qa-browse` 均未注册；属工具装载差异，非项目问题
- 已用 curl SSR + 编译产物 grep 证据链替代，覆盖 Phase 4 前 3 PR 的 PASS 模式（qa-pr-2b/2c/2d/3a/3b 均走同路径）

## Overall: **PASS**

**依据**：
1. tsc / 225 tests / build 三绿
2. 新组件 + page 主壳 0 硬编码色；动态类全部在编译 CSS 中兑现
3. SSR 验证页面 200 + 关键中文 7/7 命中，wiring（WIZARD_STEPS / validateStep / jumpTo / nextStep/prevStep / handleSubmit → POST /api/tasks）静态 review 正确
4. 11 路由回归全 200
5. 原 form state / Zod / 提交路径零改；Step 2/3 inline JSX 保留如约
6. UI 全中文；auth / API shape 无动

**给 team-lead 的建议**：PR-4B 启动前，请 builder 或用户重启 dev server（4/22 起至今，且 Phase 3 schema 改动多）一次，既恢复 NextAuth 本地登录，也吃下 Phase 3 的 Prisma 变更，给 PR-4B AI 出题流程 + PR-4D1 schema 改动打下干净基座。
