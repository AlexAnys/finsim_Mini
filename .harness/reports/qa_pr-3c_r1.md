# QA Report — pr-3c r1

**Unit**: `/teacher/courses/[id]` 课程编辑器重设计
**Round**: r1
**QA**: qa-p3
**Date**: 2026-04-24
**Build report**: `.harness/reports/build_pr-3c_r1.md`
**Path chosen**: **A**（UI-only 重皮，零 API 改动）

## 路线决策审查

Builder 选 A（UI-only），依据：原 page.tsx **2 529 行**（spec 估算 ~600 是 4× 低估），完整 block 编辑需 ≥6 新 API routes，违反"不改 /api/lms/*"硬约束。Team-lead 的 A/B/C 问询未响应。

**QA 判定**：路线 A 合理。理由：
- spec 硬约束"不改 /api/lms/*"优先级高于"完整 6 block editor"的 feature 期望
- 已有 markdown block / Sheet 创建流程完整 — 保留行为即可满足"课程编辑器"最低可用
- 6 ContentBlockType 通过右侧 `BlockPropertyPanel` 有独立 icon + label + hint（宽松满足"独立 UI"的 acceptance）
- 若 team-lead 真需要完整 block 编辑，应显式解锁 API 改动并走 PR-3C2

## Checks

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS（路线 A） | 深靛 Hero + 220px 左 TOC + 280px 右块面板 + 中列原 Tabs；6 ContentBlockType 在右面板 icon+label+hint；零行为损失 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 162/162（151 → 162，+11 course-editor-transforms.test.ts） |
| 4. npm run build | PASS | 25 routes 全 emit |
| 5. Browser verification（curl + API + dry-run） | PASS | 见下 |
| 6. Cross-module regression | PASS | 学生端 4 页 + 教师端 7 页全 200；学生 /courses/[id] 200；service 零改；API 零改 |
| 7. Security（/cso 需否） | N/A（对本 PR） | PR-3C r1 零 auth / API / service / schema 改动，不触发审计。**但 QA 独立发现一个 pre-existing P1 边界 bug，见下** |
| 8. Finsim-specific | PASS | UI 全中文；无 Route Handler 业务逻辑；Dialog/Sheet 既有错误处理保留 |
| 9. Code patterns | PASS | 0 硬编码 Tailwind palette（grep 零）；Hero 用 `var(--fs-primary)` / `var(--fs-primary-deep)` / `var(--fs-accent)` CSS 变量（与学生 CourseHero 同模式，允许）；transforms 纯函数 + `Number.isFinite` |

## Surgical 改动审查（重点）

page.tsx diff：`+113 / -152`（净减 39 行，final 2 490 行）。6 hunks 全部在 1152~1504 行之间：

1. Line 3 — import 加 `useMemo`
2. Line 67 — import 3 新组件 + transforms
3. Line 1161 — 新增 2 个 useMemo（tocTree + counts，纯聚合）
4. Line 1199-1288 — 替换 Hero 段（EditorHero 透传 state + handler）
5. Line 1288 — 外层 grid `lg:grid-cols-[220px_1fr_280px]` 包裹 Tabs
6. Line 1462 — 右栏 BlockPropertyPanel + grid 闭合

**关键守护**：line 1506+ 的 **Dialog / Sheet / 所有 handler / 所有 state 零动**（diff --stat 6 hunks 止于 1504）。既有功能完整保留：
- 章节 / 小节 CRUD 对话框
- 添加内容 Sheet（4 sub-tab）
- 内联新任务创建（sim/quiz/subj 3 类型）
- PDF 导入测验题 / AI 生成测验题
- 协作教师 / 多班 / 学期日期编辑
- Analytics / Announcements delegated tabs

## 真数据核验

### 课程详情页 teacher1（真登录）

```
teacher1 /teacher/courses/e6fc049c-… = 200 (40 277 bytes)
teacher1 /teacher/courses/940bbe23-… = 200 (chapters=3)
API /api/lms/courses/e6fc049c-… → success=true
  courseTitle: 个人理财规划 / courseCode: FIN301
  chapters: 3 / sections: 8 / tasks: 3 (全 published)
```

### Transforms dry-run（真数据）

```
counts: {chapterCount: 3, sectionCount: 8, totalTasks: 3, publishedTasks: 3, draftTasks: 0}
TOC:
  Ch1. 理财基础概念 (3 sections: 1.1-1.3, task 分布 0/0/1)
  Ch2. 投资工具入门 (3 sections: 2.1-2.3, task 分布 0/1/0)
  Ch3. 风险与资产配置 (2 sections: 3.1-3.2, task 分布 0/1)
```

Hero 右上将显示 **"3 章 8 节 · 3 项任务 · 已发布 3"**（counts 正确）。TOC 左栏小节编号 `1.1..3.2` 正确，taskCount 徽标正确。

### Regression

| 页面 | HTTP |
|---|---|
| student1 /dashboard /courses /grades /schedule | 4×200 |
| student1 /courses/{e6fc049c} (同课程学生视角) | 200 |
| teacher1 /teacher/{dashboard,courses,tasks,instances,schedule,analytics,ai-assistant} | 7×200 |

学生 `/courses/[id]` 独立的 `(student)/courses/[id]/page.tsx`，未受教师编辑器改动影响。

## Issues found

### 非阻塞观察（合 Deferred / Risk 范围）

1. `components/teacher-course-edit/block-property-panel.tsx:39-55` — `BlockPropertyPanel` context 当前恒为 null（`app/teacher/courses/[id]/page.tsx:1464`），每时每刻只显示默认态 "支持的块类型" 列表。Builder Deferred #1 自承；是路线 A 核心取舍
2. `components/teacher-course-edit/toc-sidebar.tsx` — `activeChapterId=null, activeSectionId=null` 硬传 null，IntersectionObserver 跟随滚动未做。Builder Deferred #3 自承
3. 右面板底部文案 "深度编辑将在后续版本上线" 是诚实占位；Builder Deferred #4 自承
4. "可用" 小标签在类型列表是视觉占位但不代表功能真启用。诚实但略误导

### 🚨 QA 独立发现（**pre-existing P1 边界 bug，不归 PR-3C 引入**）

**症状**：`app/api/lms/courses/[id]/route.ts:10` GET 方法 **没调用 `assertCourseAccess`**。

**复现**：teacher2 真登录，访问 `curl /api/lms/courses/{teacher1_course_id}` → 返回 `{success:true, data:{...}}`，**能读到 teacher1 的完整 chapters/sections/tasks 数据**。

**影响范围**：任何登录用户（包括学生）都能读任何课程详情。PATCH 方法有 `assertCourseAccess` 守护，但 GET 没有。

**归因**：
- PR-3C r1 **零 API 改动**（builder 承诺 + diff verified），此 bug 早在 PR-3C 之前就存在
- PR-1B 当初缩紧的是 `/api/lms/dashboard/summary` 和 `/api/lms/courses` list (`getCoursesByTeacher` 里 filter)，未扩到 GET-by-id

**建议**：
- **不作为 PR-3C r1 FAIL 依据**（不归本 PR 引入，且 PR-3C spec 明确"不改 API"）
- 建议 team-lead 开独立 PR-fix 或 Phase 5 一并修；代码改动极小（GET handler 加一行 `await assertCourseAccess(id, user.id, user.role)`）

## Overall: PASS

**建议**：coordinator 可直接 commit PR-3C r1。4 条观察全合 Deferred 范围；QA 独立发现的 P1 API 边界 bug 单独走一个 post-Phase-3 的 PR-fix。

动态 exit 进度：**连续 PASS 第 3 次**（PR-3A + PR-3B + PR-3C）。Phase 3 ship 条件满足。

## 下一步路线备忘

- Phase 3 完成（3 PR 全 PASS），可按 spec 结尾的计划继续 Phase 4（任务向导 `/teacher/tasks/new`）
- **提请 team-lead 优先处理**：pre-existing `/api/lms/courses/[id]` GET 缺 `assertCourseAccess` 的 P1 权限边界 bug
- 若后续需要完整 block 编辑器，需先解锁 "不改 /api/lms/*" 约束并走 PR-3C2
