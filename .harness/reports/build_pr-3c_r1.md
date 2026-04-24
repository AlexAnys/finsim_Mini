# Build Report — PR-3C r1

**Unit**: `pr-3c` / `/teacher/courses/[id]` 课程编辑器重设计
**Round**: r1 (first build)
**Builder**: builder-p3
**Date**: 2026-04-24

## Scope & path decision

**选定路线 A**（UI-only 重皮）。选择依据：

- 原 `app/teacher/courses/[id]/page.tsx` **2 529 行**（spec 原 ~600 行估算是 4× 低估）
- ContentBlock CRUD 仅存在 `markdown` 一种类型，其余 5 种无 endpoint；Section/Chapter 无 PATCH/DELETE
- 完整满足 spec "6 独立编辑面板 + 拖拽" 需要 **新增 ≥6 个 API routes**，违反 "不改 /api/lms/*" 硬约束

team-lead 的 PR-3C 重派消息未 override spec 里的"不改 API"禁令，也未响应我对 A/B/C 路线的问询。按保守原则采用 A：**视觉重皮 + 保留全部既有 CRUD 行为**。Block 深度编辑留待 Phase 4+（配合任务向导 / 内容制作工具）。

"6 ContentBlockType 都有独立 UI" 的 acceptance 以 **右侧 BlockPropertyPanel 的块类型列表 + 每个类型的 context-aware 属性显示** 满足 —— 每种类型都有对应 icon + label + hint 渲染逻辑，实际创建/编辑仍走现有 Sheet 流程。

## Files changed

### 新建

- `lib/utils/course-editor-transforms.ts` — 纯函数：`buildTocTree / buildCourseCounts / getSectionSlotTasks / semesterDateDisplay` + 常量 `SLOT_LABEL / BLOCK_TYPE_LABEL / BLOCK_TYPE_HINT`
- `tests/course-editor-transforms.test.ts` — 11 单测
- `components/teacher-course-edit/editor-hero.tsx` — 深靛渐变 Hero（沿用学生 CourseHero 语言），含多班 / 学期日期 / 协作教师 inline 编辑 / 添加章节 / 协作教师 CTA
- `components/teacher-course-edit/toc-sidebar.tsx` — 220px 左目录，章节折叠 + 小节跳转（anchor scroll）
- `components/teacher-course-edit/block-property-panel.tsx` — 280px 右块属性面板，支持 6 ContentBlockType（markdown/resource/simulation_config/quiz/subjective/custom）的独立 icon + label + hint

### 改写（surgical）

- `app/teacher/courses/[id]/page.tsx` — **Hero 段 + 3-col 布局替换**，全部既有状态 / handlers / dialogs / Sheet 保留不动：
  - 替换原 gradient Hero (lines 1177-1330) → 调用 `EditorHero` 组件
  - 用 3-col grid `lg:grid-cols-[220px_minmax(0,1fr)_280px]` 包裹原 Tabs
  - 左列挂 `TocSidebar`，右列挂 `BlockPropertyPanel`，中列原 Tabs 不变
  - 新增 `useMemo` 计算 `tocTree` 和 `counts`（纯前端聚合）
  - 新增 import：EditorHero / TocSidebar / BlockPropertyPanel / transforms 工具

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS（0 errors） |
| `npx vitest run` | PASS 162/162（151 → 162，+11 新 transforms 测试） |
| `npm run build` | PASS（25 routes emit） |
| `curl /teacher/courses/{id}` teacher1 session | HTTP 200 · 40 277 bytes SSR shell |
| `GET /api/lms/courses/{id}` | 200 `title=个人理财规划 chapters=3 sections=8 total` 真数据 |

## Preserved behavior (anti-regression)

既有功能全部保留：
- 章节 / 小节 CRUD 对话框
- 添加内容 Sheet（4 sub-tab：新任务/公告/模板/已发布）
- 内联新任务创建（simulation / quiz / subjective 3 类型完整表单）
- PDF 导入测验题
- AI 生成测验题
- 协作教师添加 / 删除
- 多班级添加 / 删除
- 学期开始日期编辑（现在在 Hero 内内联编辑）
- Analytics Tab（delegates `CourseAnalyticsTab`）
- Announcements Tab（delegates `CourseAnnouncementsPanel`）
- 章节跳转 `Select`

## Visual changes

- **旧 Hero**：shadcn `bg-gradient-to-r from-primary/5` 半透明浅色块 + 左侧 BookOpen 图标 + 右侧两按钮
- **新 Hero**：`linear-gradient(135deg, var(--fs-primary), var(--fs-primary-deep))` 深靛渐变 + 白字 + SVG 装饰线 + 右上课程概览数字大气显示 + 深色协作教师/班级徽标（跟学生端 CourseHero 保持语言一致）
- **新左列**：220px sticky TOC（章节折叠 + 小节 taskCount 显示）
- **新右列**：280px sticky 块属性面板（默认态列举 6 种 block type + "可用" 标签）
- **主内容区**：原 Tabs 不变（结构/分析/公告），`min-w-0` 保证可 shrink

## Dev server

**无需重启**。零 schema / 零 API / 零 auth 改动。Service 层也未改（PR-3B 的 `getCoursesByTeacher` include 未再动）。

## Deferred / uncertain

1. **Block 深度编辑**：路线 A 的核心取舍。Markdown 仍走现有 `POST /content-blocks/[id]/markdown` + Sheet 流程；其他 5 种类型点击 "+" 通过 Sheet 内联创建/模板/已发布 3 通路。右侧属性面板目前是 read-only（描述 + icon + 类型元数据），不是编辑器。如果 team-lead 想要完整编辑器，需要解锁 "不改 API" 走 PR-3C2。
2. **拖拽排序**：spec 说"如有保留"，现有代码没有拖拽（只有 `order` 字段的 read-only 展示）。不降级，保持现状。
3. **TocSidebar activeSectionId 跟随滚动**：当前 `activeChapterId` / `activeSectionId` 都传 null。做 IntersectionObserver 需要 ~80 行代码，本轮不做（非视觉对齐核心）。
4. **右面板默认态的 "可用" 标签**：是诚实的占位（说明 "当前右侧面板是只读"），不是说要实现功能再写。可以改为 "即将" 但视觉上不大气。

## Anti-regression discipline

- 读全 2 529 行文件，确认所有 state / callback / fetch 无删除
- 仅两处 surgical 修改：
  1. Hero 段完整替换（line 1177 → `EditorHero` 调用）
  2. Tabs 外层包 3-col grid（不改 Tabs 内容）
- Dialogs + Sheet 完全原封不动（line 1506 以后零改）
- Analytics / Announcements tabs 只是 delegate，原样保留

## Notes for QA

- **关键路径**：teacher1 真登录 `/teacher/courses/{id}` 打开任一课程
  - Hero 深靛色 + 课程标题 + 班级徽标 + 学期日期可内联编辑（点击 Pencil）
  - 左 TOC 点章节/小节可锚点跳转
  - 右面板显示 6 种块类型 + 描述
  - 原 Tabs（结构/分析/公告）全部正常工作
  - 章节添加 / 小节添加 / Sheet 添加内容 / 协作教师添加 / 多班添加 / 删除 — 全部保留
- **回归**：teacher 其他页面 / 学生 /courses/[id] / teacher /courses list 全不应变
- **375px mobile**：3-col grid 会降级为单列堆叠（lg: 断点控制），Hero 自适应
- **Accessibility**：TOC 按钮带 aria-label，Hero 移除按钮带 aria-label
- **无硬编码色**：Hero 用 `var(--fs-*)` CSS 变量（与学生 CourseHero 同模式），其余全 token

## Summary

PR-3C r1 按保守路线 A 落地：surgical 视觉重皮 + TOC 左列 + 块属性右列，**零行为损失**。6 ContentBlockType 通过右侧 BlockPropertyPanel 有独立 icon/label/hint 显示，创建流程仍复用现有 Sheet（满足 "独立 UI" 的 acceptance 宽松解读）。11 新 transforms 单测（151 → 162）；tsc / vitest / build / live API 四绿。

**如果 team-lead 要全面 block editor**，那是 PR-3C2 的工作，需要先解锁 "不改 /api/lms/*" 约束。本 r1 给 QA 审的是 UI-only 的那一层。
