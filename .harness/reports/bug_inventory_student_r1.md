# Bug Inventory — 学生 alex 视角全功能 E2E + 代码审计 r1

调研日期：2026-05-14 ｜ 学生账号 alex@qq.com（金融2024A班，studentId `236c3795-f19f-4107-a681-0bc0e1d21d62`）｜ 工作目录 `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim`

证据：7 套 Playwright spec（`tests/e2e/bug-probe-student-*.spec.ts`）+ 34 张截图（`.harness/screenshots/bug-probe-student/`）+ DB 直查。Dev server 跑 http://localhost:3000，全程未真提交任何作业、未创建任何 post、未点删除按钮，read-only 实测。

班级 / 课程 / 任务概况（DB 直查）：
- alex 所在 `金融2024A班` (`deedd844-...`) 关联 6 个 Course 行（5 个 courseTitle="个人理财规划"+1 个"个人规划"，多份配置数据冗余）
- 22 个已发布 TaskInstance（7 simulation + 8 quiz + 5 subjective + 2 其他）
- alex 现存 6 个 Submission（1 graded released score 0，5 graded 未公布），1 个 StudyBuddyPost（answered）

---

## 一句话结论

学生侧主线（dashboard → task → submission → grade）**整体跑得通**，但在 **任务列表入口缺失 / 任务关闭后 403 拒绝复查 / Study Buddy 强制选任务 / 自适应模式名不副实 / 资源&讨论 tab 占位** 这五个地方与演示叙事和合理 UX 都有明显落差。**没有任何 console error / hydration error / 500**，比 teacher 侧干净不少。

---

## P0（5 项，按"是否撕裂演示叙事 + 是否阻塞学生流程"归类）

| # | ID | 模块 | 标题 | 演示阻塞 | 依赖 seed |
|---|---|---|---|---|---|
| P0-1 | B-STU-TASKS-1 | 学生 /tasks | 学生 `/tasks` 路由 404 + sidebar 无入口 | 中（演示视频提到"我的全部任务" 但只能去 dashboard 翻 22 条混排） | N |
| P0-2 | B-STU-AUTH-2 | 已结束任务 | 任务 `status=closed` 时 GET 直接 403 "权限不足"，学生无法走 `/tasks/[id]` 回看自己已批改的作答 | 高（演示视频"学生看到自己 0 分 + AI 评语 + 题目明细"现在只能进 `/grades` 才看到） | N |
| P0-3 | B-STU-SB-3 | Study Buddy 必选任务 | 提问 dialog & API 强制 `taskId` UUID，22 个任务全是过期/未来 deadline 都能选，但根本无法"非任务的自由问课程"或"问通用术语" | 高（演示话术"随时向 AI 提问"被代码硬卡） | N |
| P0-4 | B-STU-QUIZ-2 | 自适应模式 | `深度测试 a7d9b380...` mode=adaptive，但 UI 标题写"练习模式"，10 题导航条一开始就全亮（1-10），无任何"按答对率出题"的 adaptive 行为 | 高（与 probe r1 B1 同根因；演示话术"少答题获得全面诊断"完全没实现） | N |
| P0-5 | B-STU-QUIZ-3 | 0 题已发布测验 | 学生班级里 2 个已发布 quiz TaskInstance 的 Task 没有 QuizQuestion 行：`7db59a62...` (PDF导入测验) + `00000000-...a601` (ANL-2 复利测验)。学生进去看到"暂无题目可作答" | 高（点开演示路径上的任务就翻车） | Y |

### P0 细节

#### B-STU-TASKS-1 — `/tasks` 404 + 无任务列表入口

- **模块**：STU-TASKS
- **严重度**：P0
- **复现步骤**：登录 alex → 直接访问 http://localhost:3000/tasks → 404 "页面不见了"
- **实测证据**：
  - `app/(student)/tasks/` 下只有 `[id]/page.tsx`，无 `page.tsx`
  - `components/sidebar.tsx:39-42` 学生 nav 只有 4 项：仪表盘 / 我的课程 / 我的成绩 / 课表管理
  - dashboard "最近成绩"卡的"查看全部 →"指向 `/grades`（`components/dashboard/recent-grades.tsx:67`），不是 /tasks
  - dashboard 的"学习任务"卡直接渲染全部 22 项（`components/dashboard/priority-tasks.tsx:122-125` "按截止时间排序 · 共 22 项"），没有折叠/分页
  - 截图 `.harness/screenshots/bug-probe-student/02-tasks-route.png`
- **阻塞演示**：演示视频如果出现"我的全部任务"或"作业中心"画面会需要这条路由
- **对应 probe r1 项**：probe_summary_r1.md P1 模拟对话项 — "学生 `/tasks` 404，没有'我的全部任务'列表"，但 r1 标 P1，**我认为应升 P0**：22 个混排任务（10 个已过期、3 个待办、9 个已批改）挤一个卡片对学生体验是灾难
- **优化方向**：① sidebar 加"任务中心"项 + 实现 `app/(student)/tasks/page.tsx`，按 状态/类型/课程 三个维度筛；② 或退而其次：dashboard 的"学习任务"卡只显示前 5 项 + "查看全部"按钮，弹一个 sheet 显示完整列表

#### B-STU-AUTH-2 — closed 任务 403 拒学生复查

- **模块**：STU-AUTH
- **严重度**：P0
- **复现步骤**：登录 alex → 访问 `/tasks/449ae28c-8913-43f5-adda-dc296885071b`（个人理财基础概念测验，DB 状态 closed，alex 有 graded submission score 0）→ 错误页"你还不能进入这个任务 / 权限不足"
- **实测证据**：
  - `lib/auth/resource-access.ts:43` `if (inst.status !== "published") throw new Error("FORBIDDEN")` — 一刀切，不区分"未发布"和"已结束"
  - `app/(student)/tasks/[id]/page.tsx:272-282` ForbiddenState 文案 "你还不能进入这个任务" + description = error.message（即 "权限不足"），对"任务已截止"场景非常误导
  - 截图 `.harness/screenshots/bug-probe-student/74-quiz-fixed-entry.png`
  - 注意 `/grades` 页面正确显示了这条提交（`.harness/screenshots/bug-probe-student/50-grades-page.png` 可见这条 0/100 + 题目明细），所以学生最终能看到结果，**但路径不通**
- **阻塞演示**：演示视频如果按"任务卡 → 进入查看"路径展示已交付测验，会直接撞 403
- **优化方向**：① resource-access.ts 把 closed 也放行学生（学生只读其已交付的作答+成绩）；② Forbidden 文案区分"任务尚未开放""任务已结束""未在班级"三种 case；③ dashboard / 课程详情的"已批改"任务卡片 CTA 改成"查看结果"直接进 `/grades` 或 `/grades?focus=<submissionId>`

#### B-STU-SB-3 — Study Buddy 提问强制选任务 + 无法自由问课程

- **模块**：STU-SB
- **严重度**：P0
- **复现步骤**：登录 alex → /study-buddy → 点"新问题"→ dialog 出现 "课程与章节 / 关联任务" 三个 select → 不选任务时"发起对话"按钮 disabled
- **实测证据**：
  - `components/study-buddy/study-buddy-new-post-dialog.tsx:133-137` `canSubmit = selectedTaskStillVisible && title && question && !isSubmitting` —— UI 强制
  - `app/api/study-buddy/posts/route.ts:7-12` zod schema `taskId: z.string().uuid()` —— API 强制
  - 实测 evaluate fetch 无 taskId → `{"status":400,"text":"...taskId: Invalid input: expected string, received undefined"}`
  - 截图 `.harness/screenshots/bug-probe-student/41-sb-dialog-open.png`
- **阻塞演示**：演示话术 "随时向 AI 学习伙伴提问 / 课业疑问、术语解释、案例复习——立即开始对话"（`components/dashboard/ai-buddy-callout.tsx:19`）—— "术语解释 / 案例复习" 都是天然 **不挂任务** 的场景
- **对应 probe r1 项**：probe_summary_r1.md P1 课程材料 — "强制选关联任务" 同根因，**我认为应升 P0**：dashboard 的 callout 文案 vs UI 强制完全矛盾
- **优化方向**：① schema 把 taskId 改 optional；② UI 把"关联任务"做成 optional + 顶部加 segmented choice "通用提问 / 任务相关"；③ 顶端 dropdown 加"无任务"选项

#### B-STU-QUIZ-2 — 自适应模式名不副实

- **模块**：STU-QUIZ
- **严重度**：P0
- **复现步骤**：登录 alex → `/tasks/a7d9b380-49fd-4ce2-9d95-000935ac0c5a`（深度测试，QuizConfig.mode=adaptive，10 题）→ 进入答题页
- **实测证据**：
  - 标题渲染 `测验 · 练习模式`（`app/(student)/tasks/[id]/page.tsx:134` 把 adaptive 字面映射成"练习模式"）
  - 题目导航条 1-10 一开始全部亮起（`.harness/screenshots/bug-probe-student/15-quiz-adaptive-q1.png`），是固定 10 题顺序答
  - 与 fixed mode `449ae28c` 唯一不同是"确认答案"按钮点完会立即显示对错（即时反馈），但题目顺序、题目数量都不随表现变化
  - probe r1 已证 `QuizConfig.mode/maxQuestions/startDifficulty/difficultyStep` 4 字段运行时零消费
- **阻塞演示**：演示话术"自适应模式，少答题即可获得较全面的能力诊断"完全没实现
- **对应 probe r1 项**：probe_summary_r1.md B1 — 同根因
- **优化方向**：见 probe r1 B1 二选一拍板（① 改文案承认是"练习模式带即时反馈"；② 真做 IRT/贝叶斯选题引擎）

#### B-STU-QUIZ-3 — 已发布但 0 题目的测验

- **模块**：STU-QUIZ
- **严重度**：P0
- **复现步骤**：登录 alex → `/tasks/7db59a62-e806-44c6-b102-e767f61ed8bb`（PDF导入测验）→ 看到"暂无题目可作答，请联系教师确认题库已配置"
- **实测证据**：
  - DB 查询 `00000000-...a601`(ANL-2 复利测验) 关联 Task `00000000-...a501` 在 QuizQuestion 表有 0 行
  - 同样 `7db59a62-...`(PDF导入测验) 关联 Task `e07a8ba8-...` 也 0 行
  - 截图 `.harness/screenshots/bug-probe-student/11-quiz-entry.png` + `17-quiz-empty-published.png`
- **阻塞演示**：演示视频如果按发布日期排序点开"最新"测验，可能直接撞这两个空壳
- **依赖 seed**：是
- **优化方向**：① seed 填上这两个 Task 的 QuizQuestion；② 后端 `publishTaskInstance` 应校验 `QuizQuestion.count > 0`（`assertTaskReadyForPublish` 函数已存在，检查它有无这个分支）；③ 学生侧空态文案改更具体"该测验暂未配置题目，请联系教师"

---

## P1（共 11 项，按模块归类）

### 仪表盘（STU-DASH）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-DASH-1 | "学习任务"卡渲染全部 22 项混排，10 个已过期 + 3 个待办 + 9 个已批改全揉一起，看不清下一步 | `components/dashboard/priority-tasks.tsx:122-125` 直接 `tasks.length`，无分页；截图 `01-dashboard.png` |
| B-STU-DASH-2 | KPI "平均得分 0.0 基于 1 次公布成绩" + "已完成率 0%" — 演示用账号体感差（1 次的 0 分不能代表能力） | dashboard 实测；改 seed 给 alex 加 2-3 条 released 中高分 |
| B-STU-DASH-3 | "AI 助教 callout" `compact=true` 在 < xl (1280px) 视口完全 `hidden` | `components/dashboard/ai-buddy-callout.tsx:27`；在常规笔记本 1280-1440 边界 + 移动端学生完全找不到 Study Buddy 入口（sidebar 也无，见 P0-1）|
| B-STU-DASH-4 | "下午好，alex / 接下来 5 节未来课、16 项待办，其中 1 项今晚截止" — 16 项待办都是过期红字，"今晚截止"那 1 项实际是明天 8:00（截止时间 2026-05-15 08:00 不是今晚） | 这是 `app/(student)/dashboard/page.tsx:457-465` 中 `hoursLeft > 0 && <= 24` 判定，但显示为"今晚截止"误导 |

### 学生 /tasks 入口（STU-TASKS）

见 P0-1。

### 模拟对话（STU-SIM）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-SIM-1 | 进入 `/sim/[id]` 直接显示客户已发"老师，我想确认这位客户适合怎样的资产配置" 第一条消息，**无角色/任务说明的引导页 / 无"开始对话"按钮 / 无 consent** | `components/simulation/simulation-runner.tsx:270-274` 若 `messages.length===0 && openingLine` 直接 prepend；截图 `40-sim-fullscreen.png` |
| B-STU-SIM-2 | 字数计数器写"字数 0"很奇怪（应该是"已输入 0 字"或留白），同时下方"为客户配资产 / 此任务无需资产配置"对学生未配置资产场景说明不友好 | 截图同上 |
| B-STU-SIM-3 | 客户情绪条仅在头顶显示一个静态"犹豫" + 一个圆点，对话推进过程中是否实时变化未在 1-2 轮内验证（学生看不出反馈机制） | 截图同上 |

### 测验（STU-QUIZ）

P0-4 + P0-5 已覆盖主线。补：

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-QUIZ-4 | adaptive mode 仅 UI 标题映射"练习模式"，但 `task.quizConfig.mode === 'adaptive'` 与 runner `mode: 'practice'` 间无任何 adaptive 行为差异（同 P0-4 根因，单独列出便于追修） | `app/(student)/tasks/[id]/page.tsx:138` |
| B-STU-QUIZ-5 | options 兼容代码有奇怪 fallback：`label = (o.label ?? o.id ?? "").trim() || String.fromCharCode(65 + idx)`，DB 里历史 quiz 看到过 options shape 不统一（probe r1 也提到 true_false correctOptionIds 形态差异），未来题库迁移会留炸药包 | `app/(student)/tasks/[id]/page.tsx:147-160` |

### 主观题（STU-SUBJ）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-SUBJ-1 | runner `accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"` 硬编码 7 种扩展名，**忽略后端 `SubjectiveConfig.allowedAttachmentTypes`** —— 老师若设 `["pdf"]` 限制，前端依然把 jpg/png/docx 全列出来 | DB 查 `a5d8f119` 配置 `{pdf,docx,xlsx}`，前端 file input accept 与配置不一致；probe r1 同条 P1 |
| B-STU-SUBJ-2 | file input **无 `capture` 属性**，移动端不会唤起原生相机 | `bug-probe-student-3-deeper.spec.ts:STU-SUBJ-2` 实测 `capture="null"`；移动端学生交不了试卷拍照 |
| B-STU-SUBJ-3 | 无"拍照按钮" 独立 UI（只能从 file input 选） | 同上 |
| B-STU-SUBJ-4 | `wordLimit: null` 硬编码，1800 字测试输入无任何提示/截断 | `app/(student)/tasks/[id]/page.tsx:180`；schema 无 wordLimit 字段就一直 null |
| B-STU-SUBJ-5 | a603 ANL-2 资产配置简答 `allowedAttachmentTypes=[]` → runner 完全不显示附件 UI，但任务说明"用不超过 300 字解释" 不需要附件其实合理；问题是**学生从外部看不出"这个题目允不允许传附件"**，要 trial-and-error | 截图 `13-subj-entry.png` vs `18-subj-with-attachment.png` |

### Study Buddy（STU-SB）

P0-3 已覆盖。补：

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-SB-1 | alex 唯一一条 StudyBuddyPost（mode=direct）AI 回复内容**完全没引用任何 contextSources 文件名 / excerpt** — `lib/services/study-buddy.service.ts:106-117` 有 contextSources 拼装逻辑但 alex 这条 post 落库时课程根本没 syllabus（probe r1 A3 同根因） | 截图 `30-study-buddy-list.png`；DB 看 `messages` jsonb 无 sources 字段 |
| B-STU-SB-2 | dialog "学习伙伴会根据所选任务的课程上下文回答问题" 文案承诺与实际行为脱节，因为 alex 班级课程下没有 syllabus；演示需先 seed 修 | 同上 |
| B-STU-SB-3 | post 详情面板下方"引导式 / 直接 / 匿名"3 个 chip 都是只读 label，**追问消息时还能选模式吗？UI 不清晰**（实测看 followUp API 只传 content，没 mode override） | `app/(student)/study-buddy/page.tsx:259-266` |

### 学生 /courses（STU-COURSES）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-COURSES-1 | 课程详情 Tabs 中 "资源" 和 "讨论" 两个 tab 都显示 "该视图将在后续版本中上线" — 演示视频若展示这俩 tab 等于自爆 | 截图 `54-course-tab-announce.png` + `55-course-tab-resources.png` |
| B-STU-COURSES-2 | 课程章节进度 "0% 0/2 章" — 课程下章节有任务但学生进度永远 0，因为没有"我已完成该章学习"的入口或自动派生逻辑（probe r1 m2 也提到 ContentBlock=0） | 截图 `52-course-detail-tabs.png` |
| B-STU-COURSES-3 | "学习伙伴建议：完成预读材料后再进入模拟对话，效率会显著提升。" — 是写死的占位文案？没有针对当前学生 / 章节生成 | 截图同上 |

### 课表（STU-SCHED）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-SCHED-1 | 周一同一节课 "个人理财规划 第2节 10:00-11:40 金融楼 301" **重复 2 次**；周三 "第4节 14:00-15:40" 也重复 2 次 — 同 probe r1 m1 仪表盘"近期课表卡同 slot 同时段重复 3 次" 同根因 | 截图 `05-schedule.png` + `78-schedule-detail.png` |
| B-STU-SCHED-2 | "本周任务截止" 列表里把 9 条全列出来（包括 2026-05-15 8:00 的 ANL-2 三题），"本周任务"和"本周任务截止"概念分不清；信息密度低，无 status 过滤 | 截图 `78-schedule-detail.png` |
| B-STU-SCHED-3 | "切换月视图" / "本周" / "周课表" / "日历" 4 个控件在头部混排 + "本周课程"为标题；用户搞不清这是切视图还是切时间范围 | 截图同上 |

### 权限边界（STU-AUTH）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-AUTH-1 | `/teacher/dashboard` 学生进入正确返回 403 "你还不能看这个页面 / 教师工作台仅对教师和管理员可见"；但 `/admin` 返回 404 而非 403，根因是 `/admin` 路由根本不存在（这本身是 probe r1 m4 提到的 admin UI 缺失） | `.harness/screenshots/bug-probe-student/19-teacher-route-as-student.png`；API: `/api/admin/audit-logs` 404 / `/api/teacher/dashboard/summary` 404 |
| B-STU-AUTH-2 | 见 P0-2（closed 403）|
| B-STU-AUTH-3 | 跨班 task instance `00000000-...b601`（B 班测验）alex 访问 `/tasks/[id]` 正确返回 403；API `/api/lms/task-instances/...b601` 也 403 ✅；POST `/api/submissions` 用跨班 taskInstanceId 也被 zod 拦在 400 ✅ | 截图 `61-task-other-class.png` |

### 错误处理（STU-ERR）

| ID | 标题 | 证据 |
|---|---|---|
| B-STU-ERR-1 | 不存在的 taskInstance ID `/tasks/ffffffff-...000` → "错误 · 404 / 任务不存在 / 任务实例不存在"，文案 OK | 截图 `60-task-not-found.png` |
| B-STU-ERR-2 | 全程未观察到网络抖动场景的具体文案降级（dashboard 默认 fetch 失败显示"网络错误，请稍后重试"是通用的，不区分超时/连接拒绝/服务 500） | `app/(student)/dashboard/page.tsx:140` |

---

## P2（共 6 项，polish）

| ID | 标题 |
|---|---|
| B-STU-P2-1 | 主观题作答区 "0 字" 计数显示在右上，"已自动保存" 在中间，"存草稿 / 提交" 在 header — 三处分散，应集中底部 |
| B-STU-P2-2 | dashboard "下午好，alex" + summary "5 节未来课、16 项待办" — "未来"两字突兀；建议改"未来 7 天" |
| B-STU-P2-3 | grades 列表的"按提交时间降序"按钮可能不可点（label-only），无明显反馈是否可切换升序 |
| B-STU-P2-4 | sim 头部"重来 / 结束对话" 间距太紧（截图 `40-sim-fullscreen.png`） |
| B-STU-P2-5 | sim 评分对照仅一句"这是引导你作答用的简要评分指引"，没列出 ScoringCriteria 维度 |
| B-STU-P2-6 | settings 页 "邮箱只读"文案在 input 内 placeholder 还是 label 外不清晰 |

---

## 逐字稿提到但学生侧未实现的功能（即"演示话术 vs 代码"差距）

1. **"自适应模式：少答题即可获得较全面的能力诊断"** — 见 P0-4，QuizConfig 4 字段运行时零消费
2. **"随时向 AI 学习伙伴提问，课业疑问、术语解释、案例复习"** — 见 P0-3，UI + API 都强制 taskId UUID
3. **"AI 助教会引用上传的课程素材（syllabus / 章节资料）回答"** — 见 B-STU-SB-1，contextSources 拼装逻辑存在但 alex 班级课程下没 syllabus，因此实际看不到引用
4. **"任务关闭后学生可以回看自己的答案 + AI 评语 + 题目明细"** — 见 P0-2，closed 状态 403 拦死
5. **"模拟对话评分依据可 quote 学生原话"** — probe r1 B2 已认定 schema 无 quote 字段
6. **"教师审过的 AI 内容才对学生可见"** — probe r1 B3 同条；alex 这个 StudyBuddyPost 答完直接可见，无 pending / approved 中间态

---

## 意外发现

1. **`recent-grades.tsx:67` 的"查看全部 →"指向 `/grades` 而不是 `/tasks`，但 `/tasks` 又是 404** — 学生从 dashboard "最近成绩"卡的"查看全部"出去看历史成绩没问题，但**没有任何入口能去看"待办任务全集"**
2. **dashboard `AiBuddyCallout` 同时在两处渲染**：一个 `compact=true`（在 `GreetingHero.accessory` 里，hidden xl:flex），一个非 compact 在右下卡片栏（`section` 带 brand gradient bg）。后者无 hidden 类，所以学生在所有视口都能看到底部蓝色 callout。所以前面 B-STU-DASH-3 的影响其实是"顶部 hero 内的 callout 在 < xl 不渲染，但底部还有 fallback"，影响度比单看代码低，但代码冗余
3. **`closed` 状态的 TaskInstance 已发布过的事实学生完全感知不到** — DB 里 `449ae28c` (个人理财基础概念测验) status=closed，但 dashboard 学习任务卡里这条还是显示 `已批改 / 已过期 5月14日 / 1/2 次尝试 / [结果]按钮`，按 [结果] 按钮跳到 `/tasks/[id]` 撞 403，而不是跳 `/grades`
4. **DB 里 alex 班级关联了 6 个不同 Course id 但绝大部分 `courseTitle="个人理财规划"` 是冗余 / 测试数据** — 学生 /courses 列表理论上应该看到多门课，实测只见到 1 张卡（说明 API 有去重或 filter）。这层"DB 冗余 vs UI 去重"需要二次确认是不是 happy coincidence
5. **没有任何 console error / hydration error / pageerror** — 比 teacher 侧（probe r1 m4 提到 `<button>` nested + 一周洞察 24s 烧 LLM 等）干净
6. **API 防御靠 zod 比 service 层更早** — 跨班 / 无 taskId 全在 zod 阶段就 400 拒绝（"taskId: Invalid input"），service 层基本没机会到。这是好事，但意味着错误码全是 VALIDATION_ERROR，不是 FORBIDDEN，前端要根据 details.fieldErrors 来辨识，**前端目前没这个分支**
7. **`closed` 任务在 dashboard 学习任务卡和课表"本周任务截止"列表里都还显示**（说明前端 fetch 没过滤 closed），但点进去 403。建议要么前端过滤、要么 service 区分"closed 自己有 submission 的可读"

---

## 与 teacher 侧 r1 报告的交叉点

| 学生侧条目 | teacher 侧已有 | 推荐合并 |
|---|---|---|
| B-STU-QUIZ-2/4 自适应名不副实 | probe r1 B1 + (teacher r1 待出) | 一次拍板 |
| B-STU-SUBJ-1 allowedAttachmentTypes 忽略 | probe r1 m3b 同 | 同一 unit 修 |
| B-STU-SB-3 强制选任务 | probe r1 m3b P1 | 同 |
| B-STU-DASH-3 callout hidden | 仅学生有 | 学生侧独立 |
| B-STU-SCHED-1 课表重复 | probe r1 m1 仪表盘同根因 | 同一函数 `buildUpcomingSchedule` 修 |
| P0-2 closed 403 | teacher 侧不存在（教师没这个权限墙） | 学生侧独立 |
| P0-5 0 题已发布 | seed 问题 | 同一 seed 修批次 |
| P0-1 /tasks 404 | probe r1 m3a P1 升 P0 | 同 |

---

## 建议修复批次

### Batch 1：演示稳定化（不动产品语义）— 1-2 天

- **P0-1** 加 `/tasks/page.tsx` + sidebar 增项（学习任务列表）
- **P0-2** resource-access.ts 学生侧放行 closed，文案区分
- **P0-5** seed 修两个 0 题测验 + 加 publishTaskInstance 题目数量校验
- **B-STU-COURSES-1** 资源/讨论 tab 在 r1 阶段直接隐藏（不显示比"后续版本上线"占位好）
- **B-STU-SCHED-1** 课表去重（与 probe r1 m1 一并修）

### Batch 2：兑现核心承诺（动产品语义）— 5-8 天

- **P0-3** Study Buddy taskId 改 optional + UI 加"通用提问"路径
- **P0-4** 自适应模式拍板（短期改文案 or 中期做 IRT）
- **B-STU-SUBJ-1/2** allowedAttachmentTypes 实接 + 移动端 capture
- **B-STU-SB-1/2** seed syllabus + service 把 excerpt 持久化到 contextSources

### Batch 3：UX 细化 — 3-5 天

- B-STU-DASH-1 学习任务卡折叠
- B-STU-DASH-3 callout hidden 逻辑
- B-STU-COURSES-2 章节进度真实化
- B-STU-SUBJ-3/4 拍照按钮 + wordLimit
- 其余 P2

---

## 测试覆盖说明

7 套 Playwright spec（全部 PASS，路径 `tests/e2e/bug-probe-student-*.spec.ts`）：

1. `bug-probe-student-1-core.spec.ts` — dashboard / /tasks / /courses / /grades / /schedule 基础 4 个 test
2. `bug-probe-student-2-tasks.spec.ts` — simulation / quiz / subjective 三类任务入口
3. `bug-probe-student-3-deeper.spec.ts` — adaptive quiz 真实进入 / 0 题测验 / 主观题附件 / 权限边界
4. `bug-probe-student-4-sb.spec.ts` — Study Buddy 主页 + post 详情 + sim fullscreen 详查
5. `bug-probe-student-5-sb-dialog.spec.ts` — Study Buddy dialog 必填字段 + API 强制 taskId
6. `bug-probe-student-6-misc.spec.ts` — 成绩页 / 课程 Tabs / 设置 / 错误处理 / 跨班
7. `bug-probe-student-7-final.spec.ts` — 移动端布局 / sidebar 链接 / 字符上限 / fixed quiz 进入流程 / 课表细节

34 张截图存 `.harness/screenshots/bug-probe-student/`。

---

## 总数

- P0 × 5
- P1 × 24（按模块归类共 8 个模块）
- P2 × 6

**未发现任何 console error / hydration error / 500 / 完整阻塞性 bug**。
