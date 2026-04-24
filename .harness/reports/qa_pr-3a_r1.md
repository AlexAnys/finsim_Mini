# QA Report — pr-3a r1

**Unit**: `/teacher/dashboard` 重设计（Phase 3 核心 PR）
**Round**: r1
**QA**: qa-p3
**Date**: 2026-04-24
**Build report**: `.harness/reports/build_pr-3a_r1.md`

## Spec

按 `.harness/mockups/design/teacher-dashboard.jsx` 完整落地教师 dashboard — Header + 5 KPI + 左栏 3 块（关注清单 / 班级表现+8 周趋势 / 待分析实例）+ 右栏 3 块（今日课表 / 动态 / AI 助手卡）。零 schema/API/auth 改动，降级 C2（薄弱概念→待分析实例）+ A（AI 卡保留深色入口占位）。

## Checks

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | PASS | 代码对齐设计稿结构完整：8 组件 + 1 transforms util；降级 C2/A 双落实；Header 右侧 AI 生成任务 + 新建任务 2 action；5 KPI 按 spec 业务优先级排（待批改第 3，班级均分第 4，待分析实例第 5）；左栏 3 模块全在；右栏 3 卡全在 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | 136/136（119 原 + 17 新增 teacher-dashboard-transforms.test.ts） |
| 4. npm run build | PASS | 25 routes 全 emit；`/teacher/dashboard` ƒ 动态 |
| 5. Browser verification（curl + data dry-run） | PASS | 见下"真数据核验" |
| 6. Cross-module regression | PASS | 学生端 4 页 + 教师端 7 页 全 200；见下 |
| 7. Security（/cso 需否） | N/A | 无 auth/session/db/权限代码改动（grep 零匹配）；只改前端展示 + 纯函数 transforms；无 file upload / payment / token |
| 8. Finsim-specific | PASS | UI 全中文；无 Route Handler 改动；API 响应格式沿用现有 `{success,data}`；无 `throw Error`；Zod 无新增需要 |
| 9. Code patterns | PASS | 0 处硬编码 hex/rgb/Tailwind palette 色（`#/rgb/rgba` 和 `bg-red-/blue-/…-NNN` 全 grep 零）；70+ 处 design token 引用；transforms 纯函数 + `Number.isFinite` 全程 NaN 守护；无"drive-by" 改动（schema/service/middleware 全未碰） |

## 真数据核验（curl 登录 + jq + node dry-run）

### 权限边界（Phase 1 PR-1B 守护关键）

teacher1 / teacher2 分别真登录 `/api/lms/dashboard/summary`：

| 字段 | teacher1 | teacher2 |
|---|---|---|
| courseCount | 2（"个人理财规划"同 class 两份） | 2（"投资分析基础"两份） |
| classIds | `[deedd844-…金融2024A班]` | `[1dbdc794-…]`（不同 class） |
| createdBy | teacher1 uid | teacher2 uid |
| taskInstanceCount | 10 | 0 |
| stats.publishedCount | 10 | 0 |
| stats.pendingCount | 0 | 0 |
| scheduleSlots | 4 | 0 |

**验证通过**：teacher2 完全看不到 teacher1 的课程 / 班级 / taskInstances / 待批改。PR-1B 的 `assertCourseAccess` 缩紧仍生效。**PR-3A 的前端聚合未引入权限泄漏**。

### 前端聚合真值（teacher1 dry-run）

用 `lib/utils/teacher-dashboard-transforms.ts` 的逻辑跑真 API 数据：

- `classCount = 1`（两门同课程同班级去重后）
- `studentCount = 5`（max(class._count.students)）
- `submittedThisWeek = 0`（seed submissions 在 2 月）
- `avgScore = null`（analytics 全 null → UI 显示 "—"，sub "暂无批改"）
- `weakInstanceCount = 0`（Graceful）
- `publishedThisWeek = 4`（Greeting Header "本周新发布 4 项任务" 真数据）
- `AttentionItem` top 4 命中真任务：B4 独立测验 / 个人投资组合分析报告 / 理财基础知识随堂测验 / 客户理财咨询模拟练习；全部 `published` 状态，正确被 `buildAttentionItems` 选中；B4 独立测验 `course=null`，attention-list.tsx 有 `courseTitle &&` 守护，不 crash

### 页面 HTTP

- `/teacher/dashboard` with teacher1 cookie → **200 OK**, 39 256 bytes
- `/teacher/dashboard` 在 "use client" 模式下 SSR 返回骨架 + client hydrate（预期）

### 链接目标真实性

| 按钮 | href | route 存在 |
|---|---|---|
| AI 生成任务 | `/teacher/ai-assistant` | ✓ app/teacher/ai-assistant/page.tsx |
| 新建任务 | `/teacher/tasks/new` | ✓ app/teacher/tasks/new/page.tsx |
| 全部任务 | `/teacher/tasks` | ✓ 已存在 |
| 待分析实例 · 查看洞察 | `/teacher/instances/{id}/insights` | ✓ app/teacher/instances/[id]/insights/ |
| AI 建议 · 打开 AI 助手 | `/teacher/ai-assistant` | ✓ |
| AI 建议 · 查看洞察 | `/teacher/analytics` | ✓ |
| Attention 查看 | `/teacher/instances/{id}` | ✓ |

全部是真路由，无死链。

### Regression（Phase 0/1/2 全守护）

| 页面 | HTTP |
|---|---|
| student1 `/dashboard` | 200 |
| student1 `/courses` | 200 |
| student1 `/grades` | 200 |
| student1 `/schedule` | 200 |
| teacher1 `/teacher/dashboard` | 200 |
| teacher1 `/teacher/courses` | 200 |
| teacher1 `/teacher/tasks` | 200 |
| teacher1 `/teacher/instances` | 200 |
| teacher1 `/teacher/schedule` | 200 |
| teacher1 `/teacher/analytics` | 200 |
| teacher1 `/teacher/ai-assistant` | 200 |

学生端 4 页 + 教师端 7 页 全 200，Phase 2 学生端未破。

## Issues found

无阻塞 issue。以下是**非阻塞观察**（builder 已在 Deferred 段自承，或可在 PR-3B/C 轻触）：

1. `lib/utils/teacher-dashboard-transforms.ts:306` — `TodaySchedule` 从 `s.course?.classes?.[0]?.name` 取 className，但真 API 返回的 `scheduleSlot.course` 只含 `{courseTitle, classId, semesterStartDate}`，**没有 `classes[]` 数组**。今日有课时班级字段将显示 `null`，UI fallback 到单独 classroom 字段。不 crash，但"班级 · 教室"会只显示"教室"。Builder Deferred #3 已自承。
2. `components/teacher-dashboard/ai-suggest-callout.tsx:30-34` — 文案写死 "基于近 7 天提交生成班级洞察与课堂讲解建议"，当前无真实后端 AI 建议数据，属 Risk A 降级（spec 允许）。
3. `app/teacher/dashboard/page.tsx:107` — KPI `submittedDelta` 硬设 null（Deferred #1）；要显示 "+12" 需额外 fetch 14d 历史数据。spec 未硬要求，可留 r2。
4. 时间 Tab"本周/本月/学期"仅 UI 渲染未接交互（Deferred #2），spec 和设计稿均未要求动作。

以上 4 点都在 Builder Report 的 Deferred 段诚实标注，合 spec 接受范围。

## Overall: PASS

**建议**：coordinator 可直接 commit PR-3A。以上 4 条观察可记入 Phase 3 后期微优化清单（或 r2 补刀），不作为本轮 FAIL 依据。

动态 exit 进展：连续 PASS 第 1 次。
