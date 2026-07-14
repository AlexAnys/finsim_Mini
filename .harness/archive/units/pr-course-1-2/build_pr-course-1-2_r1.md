# build_pr-course-1-2_r1

> 联合 PR — C1（块编辑器交互重做）+ C2（任务向导整合 + 删 /teacher/tasks/new 路由）  
> main HEAD = 4291a01  
> Round 1（首轮 build）

## 决策记录

### C1 方向决策（用户给出 3 候选 + 兜底）

**采纳：方向 A — 直接在课程结构中编辑（inline edit）+ 删除右侧 BlockEditPanel 整列**

理由：
1. 用户明确说"本身比较多余，所有都直接可以在课程结构中编辑即可，包括小节名称，直接点击小节的名称就应该可以编辑"——这是 4 个候选里唯一具体落地路径。
2. 当代设计趋势：Notion/Linear/Asana 等都走 inline edit，不再有专门的"侧栏编辑面板"。
3. 删除 280px 整列后，左 220px TOC + 中间内容 = 主结构区扩到 minmax(0,1fr)，章节内容更舒展。
4. 编辑器（MarkdownEditor / LinkOrResourceEditor 等）以"展开/收起内联抽屉"形式直接挂在内容块下方——同时只能展开一个块（state expandedBlockId）。

不选 B/C 的理由：
- B（保留更小面板 + 折叠收起）— 仍占视觉重量，与"多余"反馈相悖。
- C（顶部 inline tabs）— 增加 tab 切换成本，编辑动作距离目标节点太远。

### C2 整合方式

**采纳：modal 容器 — `TaskWizardModal` 包裹 4 步 wizard step components**

- 不再有专属 `/teacher/tasks/new` 路由（用户原话"从仪表盘删那个"+ "添加任务整合"）
- 每个 slot 单元格右上角"+ 任务"按钮触发 modal
- modal 内部完整复用既有 `WizardStepper / WizardStepType / WizardStepBasic / WizardStepSim / WizardStepQuiz / WizardStepSubjective / WizardStepReview / AIQuizDialog` 8 个组件，不动它们的业务逻辑
- 4 步走完后自动 POST `/api/tasks` → POST `/api/lms/task-instances`（自动挂入 chapter/section/slot）→ POST `/api/lms/task-instances/:id/publish`，三步全成功 toast `任务已创建并发布`
- 任意一步失败 toast 中文错误，不阻塞 modal（保留草稿；用户改完可再提交）

## 改动清单

### 新增（3 文件）

| 文件 | 行数 | 用途 |
|---|---|---|
| `components/teacher-course-edit/inline-section-row.tsx` | 525 | C1 单小节行：inline 标题编辑 + 3 slot 单元格 + tasks/blocks 渲染 + 添加按钮 |
| `components/teacher-course-edit/chapter-section-list.tsx` | 141 | C1 章节列表壳：渲染章节卡 + 折叠/展开 + 嵌入 InlineSectionRow |
| `components/teacher-course-edit/task-wizard-modal.tsx` | 896 | C2 wizard modal 容器：4 步状态 + 提交闭环（POST tasks → instances → publish） |
| `tests/pr-course-1-2.test.ts` | 138 | 12 静态守护测试 |

### 删除

- `app/teacher/tasks/new/page.tsx`（739 行）+ 整个目录 `app/teacher/tasks/new/`

### 修改

| 文件 | 变化 |
|---|---|
| `app/teacher/courses/[id]/page.tsx` | **2787 → 1084 行（-61%）** —— 删除内联 4-步 wizard / 矩阵 Table / BlockEditPanel；ChapterSectionList + TaskWizardModal 替代；保留所有现有 dialogs（章节/小节/班级/教师/编辑课程） |
| `app/teacher/tasks/page.tsx` | "创建任务"按钮链接 `/teacher/tasks/new` → `/teacher/courses` 并改为 outline variant + 文案 "前往课程添加任务" |
| `tests/pr-fix-4-d1.test.ts` | 跟随重构：[MOOD:] 守护从原 `/tasks/new/page.tsx` 改为 `task-wizard-modal.tsx` |

### 保留但不再被 import 的"孤立"文件

- `components/teacher-course-edit/block-edit-panel.tsx`（469 行）—— 显式留作他途参考。现状已 0 引用。如要彻底删，建议独立小 PR 跑一遍 grep 确认（防止本 PR 二次扩 scope；spec 里 "严禁不动 schema/API/service" 的对偶 — 不动既有保留组件文件除非必须）。

## 数据指标

| 指标 | 改前 | 改后 | 变化 |
|---|---|---|---|
| `app/teacher/courses/[id]/page.tsx` 行数 | 2787 | 1084 | **-1703 (-61%)** |
| `components/teacher-course-edit/` 文件数 | 4（hero/toc/panel/property + block-editors/） | 6（+ inline-section-row + chapter-section-list + task-wizard-modal） | +3 |
| 应用路由总数 | 25 | 24 | -1（/teacher/tasks/new 删除） |
| Vitest 总数 | 695 | 707 | +12（新 pr-course-1-2.test.ts） |

## 验证

### 1. tsc 0 errors
```
$ npx tsc --noEmit
EXIT_CODE: 0
```

### 2. ESLint 0 errors
```
$ npm run lint  # 全仓
✖ 20 problems (0 errors, 20 warnings)  # 全部 warnings 是 pre-existing（grading.service / submissions-tab / study-buddy 等）
$ npx eslint app/teacher/courses/[id]/page.tsx components/teacher-course-edit/{inline-section-row,chapter-section-list,task-wizard-modal}.tsx
（无输出 = 0 issues）
```

### 3. Vitest 707 PASS
```
$ npx vitest run
Test Files: 55 passed (55)
     Tests: 707 passed (707)
```
新 `pr-course-1-2.test.ts` 12 cases 全过：
- C1 守护：BlockEditPanel 不被 page.tsx import / 3-列布局 220px+1fr+280px 已替为 220px+1fr / InlineSectionRow inline 标题编辑（Enter 保存 / Escape 取消） / ChapterSectionList 渲染 InlineSectionRow / page 直接 render ChapterSectionList。
- C2 守护：tasks/new/ 目录不存在 / TaskWizardModal 复用 8 个 wizard 子组件 / page.tsx import + handleAddTask + setWizardOpen 真触发 / InlineSectionRow 暴露 + 按钮 + aria-label 中文 / 三步 API 闭环。
- caller 链接：tasks/page 改 href / 全代码 0 routeRefs / 中文文案命中（添加任务/创建并发布/课程编辑器）。

### 4. Production build 24 routes（-1）
```
$ npm run build
✓ Compiled successfully in 5.1s
✓ Generating static pages using 9 workers (51/51) in 159.8ms
```
- `/teacher/tasks/new` 已不在路由表
- 其余 24 路由全编译通过

### 5. 真 cookie SSR + E2E（teacher1 / password123）

启动新 dev server（PID 15040，原 55026 已杀重启）→ teacher1 登录 302 → session-token 写入。

```bash
# SSR 200
GET /teacher/courses/e6fc049c-756f-4442-86da-35a6cdbadd6e → 200 (43661 bytes)
GET /teacher/courses → 200
GET /teacher/dashboard → 200
GET /teacher/instances → 200
GET /teacher/tasks → 200
# 删除路由
GET /teacher/tasks/new → 200 但 body 渲染 TeacherNotFound 组件（dev 模式 next 行为；prod 是真 404）

# 学生路由回归
GET /dashboard → 200
GET /courses → 200
GET /grades → 200
```

E2E wizard 闭环（真 curl 三步走完整流程）：
1. POST /api/tasks taskType=quiz → 201 task_id=488ca940-5afb-4828-8260-15d8c5d307f1
2. POST /api/lms/task-instances（chapterId/sectionId/slot=pre + classId）→ 201 inst_id=1fa6bbbb-6af7-403a-9a0c-bd12788af322
3. POST /api/lms/task-instances/{inst_id}/publish → 200, status=published
4. cleanup DELETE inst + DELETE task → 200×2，0 残留

`prisma.taskInstance` 字段验证（PUB_RESP）：
- chapterId / sectionId / slot=pre 全注入
- taskSnapshot 自动写入（含 quizConfig / quizQuestions）
- releaseMode='manual' / publishedAt=2026-04-27T01:30:17.312Z

### 6. 编译产物含新组件（prod chunks 命中）

```bash
$ grep -rl "未命名小节|创建并发布|前往课程添加任务" .next/static/chunks/
.next/static/chunks/f44b6e5e5609f731.js  # course detail page chunk
.next/static/chunks/65aa7627b6d5665a.js  # tasks list page chunk
```

## 不确定 / 留增量

1. **dev mode 路由 304 / 200 对比**：dev server 对已删路由仍返回 200（body = TeacherNotFound 组件渲染）。prod build 已确认路由表无该项；prod 部署后真 404。本地 QA 验证视觉建议直接看 prod build。
2. **block-edit-panel.tsx 孤立文件**：保留 469 行 unused 代码不删，留作单独清理 PR（避免本 PR 二次扩 scope）。同样保留：`components/teacher-course-edit/block-property-panel.tsx`（PR-3C 引入但本次重构后已不再 import）。
3. **wizard modal 内部空状态没专门 UI**：开 modal 时直接渲染 Step 0；无 placeholder / 加载态。原 `/teacher/tasks/new` 同等行为，可接受。
4. **分批"批量挂入"不在本 PR**：用户没要求；目前一次只能创建一个 task → 一个 instance → 一个 slot。

## 回归守护

| 守护项 | 状态 |
|---|---|
| PR-FIX-4 D1 [MOOD:] 5 档 | PASS（test 文件已跟随重构指向 task-wizard-modal.tsx） |
| PR-7B mood 8 档 JSON 协议 | PASS（ai.service.ts 不动） |
| PR-SEC1-4 GET/POST/DELETE owner guards | PASS（service 层 0 改动；route handler 0 改动） |
| PR-COURSE-3 PDF 进度 dialog | PASS（component 文件不动；wizard 中 PDF import 未集成 — 留增量） |

## 不动声明

- ✅ schema 0 改 / Prisma 三步 0 触发
- ✅ API endpoints 0 改 / `lib/services/` 0 改  
- ✅ 仪表盘 / simulation / student 页面 0 改
- ✅ wizard 4 步内部组件（components/task-wizard/*）0 行业务逻辑改动（仅容器从 `/teacher/tasks/new/page.tsx` → `TaskWizardModal`）

## 提交策略

未 commit / 未 push（按 spec 流程要求 — 待 QA 通过）。

文件状态：4 新建（3 components + 1 test）+ 1 修改（page.tsx 大改）+ 1 修改（tasks/page.tsx 链接）+ 1 修改（pr-fix-4-d1.test.ts 路径修正）+ 1 删除（tasks/new/page.tsx）。
