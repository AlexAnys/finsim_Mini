# Build Report — PR-3B r1

**Unit**: `pr-3b` / `/teacher/courses` 列表重设计
**Round**: r1 (first build)
**Builder**: builder-p3
**Date**: 2026-04-24

## Scope

按 spec.md "PR-3B" 节落地教师课程列表，参照学生端 CourseCard 风格增补教师工具（多教师头像堆叠、多班级徽标、mini stats、管理/进入 CTA）。零 schema 改动，单一 Service include 扩展（additive）。

## Files changed

### 新建

- `lib/utils/teacher-courses-transforms.ts` — 纯函数：`buildTeacherList / displayInitial / buildClassNames / buildCourseMetrics / buildTeacherCourseSummary`
- `tests/teacher-courses-transforms.test.ts` — 15 单测
- `components/teacher-courses/teacher-course-card.tsx` — 教师课程卡片（顶 3px 色条 + courseCode + 多班徽标 + 多教师头像堆叠 + 3 stat 格 + 2 CTA）

### 改写

- `app/teacher/courses/page.tsx` — 全量 JSX 重写：Header（本学期 eyebrow + 标题 + 一句话摘要 + 新建按钮）+ `CourseSummaryStrip` 复用（4 KPI）+ 2-col 卡片网格。保留原 "创建课程" Dialog 功能，抽到子组件并统一 token 色。

### Service 微改（additive）

- `lib/services/course.service.ts` — `getCoursesByTeacher` 的 `include` 扩展：新增 `creator: { select: id/name/email }` 和 `teachers: { include: { teacher: { select: id/name/email } } }`。**没有改接口签名 / 参数 / 返回类型形状（只是多了两个字段）**。

  Caller scope 验证：grep 全仓只有 `app/api/lms/courses/route.ts` 调用，直接 return 给前端；前端只消费 `teachers`/`creator` 新字段（不依赖旧字段），student path 走 `getCoursesByClass`（未改）。

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS（0 errors） |
| `npx vitest run` | PASS 151/151（136 → 151, +15 新增 transforms 测试） |
| `npm run build` | PASS（25 routes emit） |
| `curl /teacher/courses` teacher1 session | HTTP 200 · 39 155 bytes SSR shell |
| `GET /api/lms/courses` 新 shape 命中 | `creator` 字段 + `teachers[].teacher` 字段真数据齐全 |
| Teacher2 隔离检查 | teacher1 ids `{940bbe23, e6fc049c}` ∩ teacher2 ids `{893aae18, d7906ea6}` = ∅ — PR-1B 缩紧依然守护 |
| 真数据多教师 | 第一门课：creator=王教授（主讲）+ CourseTeacher=molly（协讲）→ 头像栈正确渲染 |
| 真数据多班级 | 第二门课 `classes = [金融2024A班, 金融2024B班]` → 多班徽标并排 |

## Design decisions

**Schema / API 边界**：
- Course **没有 `status` 字段**（spec 写了"状态徽章如果 schema 已有"— 已确认没有），所以 **本 PR 不实现状态 badge**。是否在 PR-3C 期间补 `status` 由 coordinator 决定（如需要则是 schema change，走单独 PR）。
- 不改 `/api/lms/courses` Route Handler；仅在 Service 层的 `getCoursesByTeacher` include 里加字段。这是 "additive 扩展" 而非 "API 契约改动"。学生端走独立的 `getCoursesByClass`，零影响。

**多教师头像 UI**：
- Creator 排第一，其后 CourseTeacher rows 按 createdAt 顺序，deduped by teacher.id。
- 前 3 个显示，>3 时显示 "+N" 小头像。
- 头像色从 `tagColors` 哈希取 6 色之一（`avatarColor(id)`），与 course 色条分开一组哈希以避免视觉冲突。
- `displayInitial` 支持中文（第一个 codepoint）、拉丁（首字母大写）、空字符串 fallback `"师"`。

**3 stat 格（任务 / 学生 / 均分）**：
- 任务 = 该 course 下所有 TI 数量 + sub "已发布 N" or "全部草稿"
- 学生 = `max(class._count.students)` 跨该 course 的 TI（与 PR-3A 的 KPI 保持一致）
- 均分 = analytics.avgScore 的算术平均（忽略 null/0），≥80 时 tone="success" 高亮绿色

**待批改徽标**：
- footer 左侧如果有 pendingCount > 0，显示 "N 份待批改 · 前往实例列表"（warn 色）；否则显示学期开始日期
- "进入" CTA 链接 `/teacher/instances?courseId={id}` 作为实例筛选入口（路由已存在）

**Summary strip（4 KPI）**：
1. 总课程（门）— 课程数
2. 学生总数（人）— `sum(unique classSize)` 跨 TI 去重（避免同一班被多课计入时虚高）
3. 本周活跃任务（项）— 发布且 `dueAt` 在过去 7 天到未来之间
4. 待批改（份）— 从 dashboard.stats.pendingCount 直接取，warn 色强调

**Empty states**：
- 无课程时显示 BookOpen 图标 + 中文提示 + 右上角 "新建课程" 按钮可用
- 无学生时学生 stat 显示 "—" / "未关联班级"
- 无均分时 "—" / "暂无批改"

## Dev server

**无需重启**。Service include 扩展（Prisma runtime 已经能处理任何 include 字段，因为模型关系在 schema.prisma 早已定义）；无 schema change，无 Prisma generate 重建。live curl 已验证 200 + API JSON 新字段齐全。

## Deferred / uncertain

1. **Course 状态 badge**（草稿/已发布/已归档）：schema 无 `status` 字段，本 PR 未做。spec 有条件性要求"如果 schema 已有"，符合"不改 schema"硬约束就是跳过。
2. **复制课程**按钮：spec 提到"复制"操作，但现有 API 无 duplicate 端点；r1 未实现，如需走 PR-3C 或单独 feature PR。
3. **Dialog 样式微调**：现 Dialog 仍用通用 shadcn，未做 token 再染色（沿用基础 border/bg，`text-danger` 已对齐）。视觉上可接受但没有 "完整对齐 Phase 2 学生端 Hero-depth" 的精致度。
4. **学生总数可能不准**：用 `max(classSize)` 聚合是个指示值（同课程 2 个 TI 分别在 A 班 / B 班时，总数按 `max(|A|,|B|)` 而非 `|A|+|B|`）。这是为了避免跨多 TI 重复累加。spec 没要求精确。

## Notes for QA

- **关键路径**：teacher1 + teacher2 真登录 `/teacher/courses`，核对：
  - 课程数 · 多教师 avatar stack · 多班徽标 · 3 stat 值 · 底部 CTA 跳转
  - teacher2 看不到 teacher1 的课（API 层 PR-1B 守护 + intersection ∅ 已验证）
- **视觉**：375px mobile 下 2-col 网格应堆叠单列、summary strip 2x2、avatar stack 保持右上角
- **Dialog**：点右上"新建课程"打开，创建流程应正常 POST `/api/lms/courses`
- **Accessibility**：avatar 有 `title` tooltip（主讲/协讲）；stat 格 aria 可读
- **Regression**：学生端 `/courses` 不应变（走 getCoursesByClass）；`/teacher/dashboard` 不受影响
- **链接目标**：管理 → `/teacher/courses/{id}`、进入 → `/teacher/instances?courseId={id}`、全部为已存在路由
- **无硬编码色**：grep 零 hex / 零裸 Tailwind palette；全部 token 引用

## Summary

PR-3B 按 spec 落地，遵循 Phase 2 学生端卡片语言，单 Service include 扩展 + 新组件 + 新 transforms + 15 新 tests（136 → 151）。tsc / vitest / build / live API 四绿。teacher1 多教师（王教授主讲 + molly 协讲）+ 多班（金融 2024A班 / 2024B班）真数据均正确渲染；teacher2 权限隔离 verified。
