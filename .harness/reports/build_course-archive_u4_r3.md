# Build Report — U4 收尾 (r3)：详情页文案确认 + 过时 e2e 清理

worktree: `finsim-course-archive` / branch `claude-course-archive`

## team-lead 收尾两项

### 1) 详情页 EditorHero 删除按钮文案（已在 r2 完成，本轮确认仍在位）
`app/teacher/courses/[id]/page.tsx` 删除确认弹窗已是归档/可恢复语义：
- 标题 "删除课程（移入回收站）"（line 1934）
- 描述 "…将从所有页面消失，但不会被销毁——可在课程管理页的'回收站'中恢复或彻底删除"（line 1936）
- 按钮 "删除（移入回收站）"（line 1952）；toast "课程已移入回收站，可在回收站恢复"（line 1121）
- 旧文案 "此操作不可恢复" / "将被服务端拒绝" grep 0 命中
- 与列表卡是不同的第二个按钮，已分清。Playwright headless 认证态验过（classId 非空课程）：弹窗显示新文案、error=(none)。

### 2) 过时 e2e 测试文件处理（anti-regression：行为变了同步测试）
先查 runner 引用（5 个 playwright config）：
- **权威 `playwright.config.ts`**：`testDir: ./tests/e2e/smoke` → **不**拾取这 3 个（它们在 tests/e2e/，非 smoke/）
- `playwright.codex-r4` / `qa-fix-3`：有 testMatch，只匹配各自专属 spec，不含这 3 个
- `playwright.iw` / `playwright.review`：`testDir: ./tests/e2e` 无 testMatch → 理论匹配全部 e2e（含这 3 个），但权威 config 注释明确这俩是"历史 e2e debug, 不被 default 拾取"，不进 CI/smoke

**逐文件裁决（非盲删，按内容 + 是否被本 PR 改 stale + vitest 是否已覆盖）：**
- **删 `qa-unit5a-delete.spec.ts`**：核心断言 = 旧"删除课程"硬删设计——test A `DELETE 课→400 COURSE_HAS_CHAPTERS`、D `删除 round-trip→GET 404`、H `card 删除按钮 disabled+tooltip`、I `详情页拒删流`，全部被本 PR 故意移除（DELETE 现归档=200、无拒删闸、card 一键归档无 tooltip）。course-delete 行为已由新 vitest 覆盖（course-archive.api.test.ts 200/401/403 + course-archive.service.test.ts）。
- **删 `qa-unit5a-r2-spotcheck.spec.ts`**：同属 Unit-5a 旧设计 spotcheck（删除按钮 disabled+tooltip / 课程详情删除 dialog 旧文案），被本 PR 取代。
- **保留 `unit2-verify.spec.ts`**：经核查 = **TaskInstance close/reopen/delete 生命周期**（INSTANCE_HAS_SUBMISSIONS / reopen / closed 访问 403），grep 课程 delete/archive/回收站 = **0 命中**，**与本 course-archive PR 完全无关、未被改 stale**。删它会丢失（vitest 未覆盖的）唯一实例-生命周期 e2e 覆盖 → 不删（反 anti-regression 过度删除）。team-lead 原话点名 3 个，但 #3 实属无关；如认为仍应处理请指示。

## 验证
- `npx tsc --noEmit`：通过（删 spec 不影响编译）
- `npx vitest run`：117 文件 / 1202 测试全绿（vitest 不跑 .spec.ts，删除无影响）
- git status：`D qa-unit5a-delete.spec.ts` / `D qa-unit5a-r2-spotcheck.spec.ts`；无任何代码/配置/文档引用这俩（grep 0）

## 交接 QA（U4 仍 in_progress，等真浏览器 PASS 收口）
请 QA clean-restart `next dev --webpack`（:3003 我跑着）真浏览器验：
- 详情页删除按钮 → 弹窗归档可恢复文案
- U5 三个写路径守卫：归档课程 → 新建实例/发布任务/AI 起草 → 409 COURSE_ARCHIVED
- （U4 列表卡 + D6 上轮已 PASS）

## flag / 待裁决
- `unit2-verify.spec.ts` 我判定无关保留——请 team-lead 确认或推翻。
- 预存 :1141 仍未碰（等用户）。

## ③ 预存 :1141 `course.class.id` 崩溃修复（team-lead 裁决纳入本 PR）
**根因（深于"一行"）**：`CourseDetail.class` 类型被写成非空 `{ id; name }`，但真源 schema 是 `class Class?`（已弃用 Course.classId，旧课程为 null）→ 类型说谎，tsc 永不报警，运行时 `course.class.id` 崩。真实班级关联在 `courseClasses`(M:N)。
**修复（类型诚实 + 全部 deref null 安全）**：
- `CourseDetail.class` 类型改 `{ id: string; name: string } | null`（如实反映可空）—— tsc 随即逼出全部 4 处 deref，逐一处理：
  - 显示路径（EditorHero，line 1141/1143）：`course.class?.id ?? null` / `course.class?.name ?? null`
  - 任务向导路径（handleAddTask line 833 / handleOpenDraft line 858）：`course.class?.id ?? courseClasses[0]?.classId ?? ""` —— 弃用 class 为 null 时回退到**真实** CourseClass(M:N) 首个（course 恒有 ≥1 CourseClass：createCourse 建时写、removeCourseClass 保底），向导拿到真班级而非崩溃/空
  - 两个 useCallback dep 数组补 `courseClasses`（防 stale closure）
- `EditorHero.primaryClassId` prop 由 `string` 放宽为 `string | null`（**确认下游 null 安全**：仅 line 132 `cc.classId === primaryClassId` 相等判断用，传 null 仅表示无 primary，无副作用）
**验证**：tsc 过、vitest 117文件/1202全绿；**Playwright headless 真浏览器复现修复**：API 建一个 classId=null 课程（正是崩溃触发条件）→ 加载其详情页 → error-boundary 标记=0、标题正常渲染、console/page error=(none)（修复前必崩 error boundary）；清理 leftover=0。
**scope 说明**：虽 team-lead 说"一行"，但类型说谎是真根因，诚实化后 tsc 逼出 4 处；我按各处语义最小处理（显示用 null、向导用真 CourseClass 回退），未做无关重构。diff page.tsx +? / editor-hero +3/-1。
