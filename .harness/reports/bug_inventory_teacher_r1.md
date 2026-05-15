# Bug Inventory — Teacher (molly) r1

调研日期：2026-05-14 ｜ 工作目录 `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim`
账号：`molly@qq.com / 123456`（teacher）
工具：Playwright `playwright.review.config.ts`，规格文件 `tests/e2e/bug-probe-teacher-{login,master,detail}.spec.ts`
证据：52 张截图 `.harness/screenshots/bug-probe-teacher/`，DB 直查（docker exec `acc4fef29d82_finsim-postgres`）

---

## molly 数据现状

- 拥有课程 1 门：`个人规划`（id `8f7f653c-9177-44f6-b764-80f7f779b2ef`）— 1 章 1 节 0 块 1 素材 1 班级 0 协作者
- 作为协作教师（CourseTeacher 表）挂入 teacher1 的 2 门 `个人理财规划`：
  - `e6fc049c-756f-4442-86da-35a6cdbadd6e`（金融2024A班）— 3 章 8 节 8 已发布任务 + 多个待审核草稿
  - `940bbe23-6172-40bf-bc7f-b22a1840a1de`
- 老师视角总计：3 门课程·15 项任务实例·20 人次在读（`/teacher/courses` 顶部统计）
- molly 自己创建的 Task 共 3 个（全 quiz）：`PDF导入测验` / `深度测试` / `个人理财基础概念测验`
- 这 3 个 task 各有 1 个 TaskInstance（全 published，均挂在 `金融2024A班`）— 仅 `个人理财基础概念测验` 实例有 **1 条 graded 提交**（score=0），其它 0 提交
- 仪表盘看到的 14 个"已过期"任务来自 collaborated 课程的所有实例（teacher1 builds + molly builds 共享视图）

---

## Bug 列表

### A. 课程材料工作台

#### B-COURSE-01
- **ID**: B-COURSE-01
- **模块**: 课程材料工作台 — 课程列表
- **标题**: 课程列表无"删除/归档/复制"动作，molly 完全没法清理自己的测试课程
- **严重度**: P0
- **复现步骤**:
  1. molly 登录 `/teacher/courses`
  2. 看任一卡片 — 卡片 hover/点击只看到"进入"按钮
  3. 全卡片所有按钮文本被探针扫一遍：`adminButtons=[]`（zero match for `删除|归档|复制|导出`）
- **实测证据**: `02-courses-list.png`；探针输出 `course-list admin buttons: []`；代码侧 `lib/services/course.service.ts` 没有 `deleteCourse` / `archiveCourse`；`app/api/lms/courses/[id]/route.ts` 只有 GET + PATCH，无 DELETE
- **是否阻塞演示视频叙事**: No（演示不删课）
- **是否依赖 seed 假数据**: N/A
- **对应 probe r1 项**: 未列
- **优化方向**: 至少加 archive 路径（隐藏卡片 + 软删），prod 数据安全先于硬删；DELETE 必须级联或拒绝有 task instance 的课程

#### B-COURSE-02
- **ID**: B-COURSE-02
- **模块**: 课程详情 — 协作教师 dialog
- **标题**: "协作教师"按钮在 molly 自有的"个人规划"页点击后没有弹出 dialog，直接关掉返回原视图
- **严重度**: P1
- **复现步骤**:
  1. 进 `/teacher/courses/8f7f653c-...`（个人规划）
  2. 点 "协作教师" 按钮
  3. 截图：还停在课程主页，没有 dialog 出现（探针 `dBody` 完全是课程概览的文字）
- **实测证据**: `D8-collab-dialog.png`；探针 `collab dialog excerpt: ...课程管理 / 个人规划个人规划金融2024A班...`（没有协作者列表 UI）
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: M2 P1（协作 dialog 不显示现有列表）— 现在更严重：dialog 完全没开
- **优化方向**: dialog 开打不对路；可能是 1 章节后 chunk 加载导致 click 没命中元素，需要 selector 兜底 + 重新绑定 onClick

#### B-COURSE-03
- **ID**: B-COURSE-03
- **模块**: 课程详情 — molly 自有课程 1 章 1 节 0 块
- **标题**: molly 的"个人规划"课程示例数据是零起步：1 章 "投资组合理论" / 1 节 "粉线" / 全 0 任务块；演示如果切到这门课立刻看到一片空
- **严重度**: P1（同 probe r1 M2 P0-A4 全局，但 molly 课更突出）
- **复现步骤**:
  1. molly 登录 → `/teacher/courses/8f7f653c-...`
  2. 课程结构 tab → 网格显示 "课前任务块 暂无内容 / 课中 暂无内容 / 课后 暂无内容"
- **实测证据**: `02b-course-detail.png`；DB 查 `blocks=0` `chapters=1` `sections=1`
- **是否阻塞演示视频叙事**: Yes（如果演示视频要用 molly 账号录制）— 用 teacher1 账号则 No
- **是否依赖 seed 假数据**: Yes（molly 是手动测试账号，几乎没造数据）
- **对应 probe r1 项**: probe r1 M2 P0-A4
- **优化方向**: 引导式空态：首次进入显示"快速添加示例章节 / AI 生成大纲"按钮 + 提供"导入大纲"入口模板下载

#### B-COURSE-04
- **ID**: B-COURSE-04
- **模块**: 课程详情 — 协作课程权限混乱
- **标题**: molly 作为协作教师在 teacher1 课程上看到完整的 owner 级别按钮（添加班级 / 编辑课程 / 添加章节 / 多处删除），权限边界不清
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/courses/e6fc049c-756f-4442-86da-35a6cdbadd6e`（teacher1 的 "个人理财规划"）
  2. 探针扫按钮：`owner-only actions visible: ['添加班级', '学期始 2026-02-16', '协作教师', '删除', '删除', '删除']`
- **实测证据**: `D6-collab-course.png`；课程页头部仍标 `协作教师：molly×` 字样
- **是否阻塞演示视频叙事**: No（演示不切角色）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 协作教师 vs owner 权限需明确：协作只能加内容、不能改课程结构/班级/删除；UI 上禁用或隐藏 owner-only 按钮；后端在 service 层加 ownership 检查

#### B-COURSE-05
- **ID**: B-COURSE-05
- **模块**: 教学上下文 tab — 删除按钮
- **标题**: 教学上下文 tab 有删除按钮（探针在 collaborated 课程的此 tab 看到 3 个"删除"按钮），如果协作老师能删 owner 的素材是 P0 数据安全
- **严重度**: P1（待确认权限）
- **复现步骤**:
  1. molly → collaborated 课程 → "教学上下文" tab
  2. 看 syllabus / source 列表，每行右侧有"删除"按钮
- **实测证据**: `02-tab-教学上下文.png`；探针 `tab 教学上下文 admin btns: ['删除']`
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 协作教师删除 owner 素材应弹"二次确认 + 仅 owner 可删"；如果允许协作者删除需要 audit log 记录

### B. 任务建设（wizard）

#### B-TASK-01
- **ID**: B-TASK-01
- **模块**: 任务列表 — `/teacher/tasks` 入口
- **标题**: `/teacher/tasks` 在 r1 标"404"，实测 r2 已 200，但页面没有创建入口：仅显示 molly 自有任务列表 + 一个"前往课程添加任务"按钮
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/tasks`
  2. 页面显示 3 个 task（个人理财基础概念测验/深度测试/PDF导入测验）+ tab `全部/模拟对话/测验/主观题`
  3. 操作列只有空白，没有 row-level 删除/编辑/复制
- **实测证据**: `D1-tasks-index.png`；探针 `tasks body 800: ...任务管理前往课程添加任务全部模拟对话测验主观题...`
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 标题与 probe r1 不再一致（404 已修），但页面太简陋
- **优化方向**: 任务列表行尾加"编辑 / 复制 / 删除"，至少加 row click 跳详情；筛选器加"按课程过滤"

#### B-TASK-02
- **ID**: B-TASK-02
- **模块**: 任务向导直链
- **标题**: `/teacher/tasks/new` 渲染 404（fallback 到 [id] 路由，调 `/api/tasks/new` 404）
- **严重度**: P2
- **复现步骤**:
  1. 直接访问 `http://localhost:3000/teacher/tasks/new`
  2. 浏览器空白 + 控制台 `Failed to load resource: 404 /api/tasks/new`
- **实测证据**: `03-tasks-new.png`；探针 `[wizard http 404] http://localhost:3000/api/tasks/new`
- **是否阻塞演示视频叙事**: No（无任何 UI 链接指过去）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M3a P1
- **优化方向**: 要么把 `/teacher/tasks/new` 改成跳 `/teacher/courses` 并提示"先选课程"；要么补一个全局 wizard 起点

#### B-TASK-03
- **ID**: B-TASK-03
- **模块**: 课程结构 — 没有任何创建任务入口
- **标题**: molly 自己的课程"个人规划"课程结构 tab 完全找不到"+ 添加任务"入口（探针扫所有 button + title 属性，零匹配）
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/courses/8f7f653c-...` → 课程结构 tab
  2. 网格 cells `课前任务块 暂无内容` 等
  3. 探针 `create-task buttons: []` 和 `button[title] count: 3`（仅登出/通知/AI助手）
- **实测证据**: `02-tab-课程结构.png`；探针 `D9` 输出
- **是否阻塞演示视频叙事**: Yes（演示视频"老师 1 分钟生成任务"无法演示起点）
- **是否依赖 seed 假数据**: 部分相关 — 0 块时入口可能被压隐藏
- **对应 probe r1 项**: 未列
- **优化方向**: 空网格 cell 显示 "+ 添加任务/AI 生成" CTA；或在 chapter 行加固定"添加任务"按钮

### C. 任务管理（状态机 + 配置）

#### B-INSTANCE-01
- **ID**: B-INSTANCE-01
- **模块**: 任务实例 — 状态机
- **标题**: 实例关闭后无法重新开放（已关闭 tab 内行尾只有"详情"按钮，无"重新开放"）
- **严重度**: P0
- **复现步骤**:
  1. molly → `/teacher/instances` → 已关闭 tab
  2. 已关闭实例（探针前次扫到 "个人理财基础概念测验" 因 dueAt 自动归入已关闭）
  3. 行操作列只有"详情"，无 reopen
  4. 进 `/teacher/instances/449ae28c-...` 详情页，按钮区无任何 reopen 字样
- **实测证据**: `D3-instances-closed-tab.png`；探针 `reopen-like buttons: []`；schema `TaskInstanceStatus` 枚举包含 `published`，`updateTaskInstanceSchema` 允许提交 `status: "published"`，但前端没有暴露 reopen 路径
- **是否阻塞演示视频叙事**: Yes（演示如果误关后无法挽回，会卡在演示流程）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 已关闭实例详情页加"重新开放"按钮（弹"将 status published 并清空 closedAt"确认）；列表行也加快捷重启

#### B-INSTANCE-02
- **ID**: B-INSTANCE-02
- **模块**: 任务实例 — 关闭操作无 dialog 确认
- **标题**: "关闭实例"按钮在详情页可直接触发，但 cancel 路径不明确；探针点击后立刻状态切到 "已关闭"，无显式确认 dialog（页面文案改为"将关闭"未弹模态框）
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/instances/449ae28c-...`
  2. 点 "关闭实例" 按钮
  3. 探针 `dialog excerpt: ...QUIZ已关闭什么是个人理财...` —— 注意状态已经显示 "已关闭"，没有 confirm dialog 拦截
- **实测证据**: `D2-inst-close-dialog.png`、`D2-inst-after-cancel.png`（实例真的被关掉了，因为我们 cancel 太晚）— **请注意：本次 probe 实际执行了关闭！** dueAt < now 的实例本来就要自动归入已关闭
- **是否阻塞演示视频叙事**: Yes（误关 = 数据破坏）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 关闭按钮必须弹 confirm dialog 显示"该操作不可逆，关闭后学生将无法继续提交"；二级确认后才执行 PATCH

#### B-INSTANCE-03
- **ID**: B-INSTANCE-03
- **模块**: 任务实例 — 详情页 删除按钮缺失
- **标题**: 实例详情页和实例列表都没有"删除"按钮，但后端 `app/api/lms/task-instances/[id]/route.ts` 提供了 DELETE method
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/instances/449ae28c-...`
  2. 探针扫按钮：`del=[]`
  3. 即使在已关闭 tab，列表也没"删除"
- **实测证据**: `04-inst-1.png`；探针 `inst 1 buttons: close=["关闭实例"] edit=[] del=[] release=[]`；route 文件 line 48-58 有 DELETE handler
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 已关闭 / draft 状态的实例可删（前提：有 submission 时拒绝）；UI 加"删除实例"二级菜单项

#### B-TASK-04
- **ID**: B-TASK-04
- **模块**: 任务总览 — 配置完整性
- **标题**: 任务详情页只能编辑 taskName / requirements / simulation 三段 prompt / subjective prompt；测验的题目、量规、AI 评分严格度、allocation、knowledge tag 都不能改
- **严重度**: P0
- **复现步骤**:
  1. molly → `/teacher/tasks/3e26c6d2-...`（quiz 8 题）
  2. 点"编辑" → 进入 edit mode
  3. 探针 `inputs in edit: 3` — 仅 taskName(1) + requirements(textarea*1) + ... 不见题目编辑
  4. 代码侧 `app/teacher/tasks/[id]/page.tsx` line 566-590 "测验配置" 卡片只显示信息，editing flag 没有切到可编辑控件；line 694-841 "题目列表" 整段也没 editing 分支
- **实测证据**: `D4-task-edit-mode.png`；代码 grep `editing\s*?` 出 9 处，全在 simulation/subjective 分支
- **是否阻塞演示视频叙事**: Yes（演示原话"教师改任务一键发布"如果只能改标题就破承诺）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M3b P0/P1 多处涉及
- **优化方向**: 测验任务的题目编辑入口（每题"编辑/删除/复制"+"+ 添加题目"）；scoringCriteria 卡片改可编辑；allocationSections 同理；quizConfig.mode / showCorrectAnswer / timeLimit 三个字段必须能改

#### B-TASK-05
- **ID**: B-TASK-05
- **模块**: 任务总览 — 已发布 + 已批改的任务安全
- **标题**: 编辑模式下保存后会直接 PATCH 写库，没有任何"已有批改提交 → 高危改动"的拦截
- **严重度**: P0
- **复现步骤**:
  1. molly → `/teacher/tasks/3e26c6d2-...`（这个 quiz 有 1 条 graded 提交）
  2. 点"编辑"改任意 simulation prompt（虽然 type=quiz 没有这种字段；改 taskName 也可）
  3. 点保存 → 立即 PATCH `/api/tasks/<id>`，无任何确认
- **实测证据**: `D4-task-overview.png`；代码 line 253 `fetch('/api/tasks/${taskId}', { method:'PATCH' })` 无前置 dialog
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: PATCH 前查询 `submission.count() > 0`，弹 dialog "该任务已有 N 条提交，改动可能影响分数解读，是否继续？"；勾选"复制后修改"创建新任务实例

#### B-TASK-06
- **ID**: B-TASK-06
- **模块**: 任务列表 / 任务详情 — 没有"复制"动作
- **标题**: 老师没法把一个调好的任务一键复制成新模板
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/tasks/<id>` 或 `/teacher/tasks`
  2. 探针 `dup btns: []`
- **实测证据**: `05-task-1.png` 等；探针扫"复制/克隆/另存"零结果
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 任务详情页"更多"菜单加"复制为新任务"

### D. 数据洞察 v2

#### B-INSIGHT-01
- **ID**: B-INSIGHT-01
- **模块**: 数据洞察 v2 — KPI hydration error 复现
- **标题**: 进 `/teacher/analytics-v2` 控制台立即报 2 条 hydration error：`<button> cannot be a descendant of <button>`
- **严重度**: P0
- **复现步骤**:
  1. molly → `/teacher/analytics-v2`
  2. F12 → console 立刻看到 `In HTML, <button> cannot be a descendant of <button>.`
  3. URL 自动带上 `?courseId=e6fc049c-756f-4442-86da-35a6cdbadd6e&classIds=deedd844-...`
- **实测证据**: `06-analytics-v2.png`；探针 `[av2 error] In HTML, %s cannot be a descendant of <%s>.`、`<button> button`
- **是否阻塞演示视频叙事**: Yes（演示打开"数据洞察"立刻 2 条 console 红字）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M4 P0-C2（同问题）
- **优化方向**: `components/teacher/analytics-v2/kpi-row.tsx`：外层卡片包裹改 `<div role="button" tabIndex={0}>`，或内层 info tooltip trigger 改 `<span>`

#### B-INSIGHT-02
- **ID**: B-INSIGHT-02
- **模块**: 数据洞察 v2 — 完成率"需核对"标
- **标题**: 默认 scope 完成率显示 "15.9% (11/69 人次) 需核对"，data-quality 提示 5 项（严重 0 · 需核对 3 · 信息 2）
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/analytics-v2`
  2. KPI 行第一格 "完成率 需核对"
  3. 页面底部 "数据质量提示 5 项 严重 0 · 需核对 3 · 信息 2"
- **实测证据**: `06-analytics-v2.png`；探针 `av2 excerpt: ...完成率需核对15.9%11/69 人次...`
- **是否阻塞演示视频叙事**: Yes（演示重点演示数据洞察就摆个"数据有问题"标签）
- **是否依赖 seed 假数据**: Yes（teacher1 课的 instance 状态 + submission release 不齐导致）
- **对应 probe r1 项**: probe r1 M4 P0 系列
- **优化方向**: 修 seed 让 demo 课的 release 状态完整；或把"需核对"改成 tooltip 解释（不让 KPI 主标签变红）

#### B-INSIGHT-03
- **ID**: B-INSIGHT-03
- **模块**: 数据洞察 v2 — 任务表现 / Study Buddy 共性问题 / AI 建议永远加载中
- **标题**: 进默认 scope 页面后 3 个核心模块卡 loading：`正在加载任务表现样本`、`正在加载共性问题`、`正在生成 AI 教学建议`
- **严重度**: P0
- **复现步骤**:
  1. molly → `/teacher/analytics-v2`（等 ≥30s）
  2. 探针 `av2 excerpt` 在 networkidle 后仍显示 "正在加载..."
- **实测证据**: `06-analytics-v2.png`；探针 `has-4dims: true` 因匹配到"建议"字面，但实际是 loading 字
- **是否阻塞演示视频叙事**: Yes
- **是否依赖 seed 假数据**: 部分 — 也可能是后端 SSE/long-poll 没返回
- **对应 probe r1 项**: probe r1 M4 P0
- **优化方向**: 抓 `/api/lms/analytics-v2/scope-insights` 实际响应；如果超时降级到 cached 数据；UI 显示"暂无足够数据"而不是无限 loading

#### B-INSIGHT-04
- **ID**: B-INSIGHT-04
- **模块**: 数据洞察 v2 — KPI "完成均分 / 归一化均分"分歧
- **标题**: KPI 行同时显示 "完成均分 57.9% 中位数 58%" 和 "均分 完成" 两块，叠在一起后术语含义不清
- **严重度**: P2
- **复现步骤**:
  1. molly → `/teacher/analytics-v2`
  2. 看 KPI 第二、三、四列
- **实测证据**: `06-analytics-v2.png`；探针 body 文本 `归一化均分57.9%中位数 58%—均分完成`
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M4 P1（口径混乱）
- **优化方向**: 三列改成统一标题 + 子标签，info 图标解释定义

### E. 一周洞察

#### B-DASH-01
- **ID**: B-DASH-01
- **模块**: 仪表盘 — 一周洞察 modal 缺 meta 留痕
- **标题**: 一周洞察 modal 打开后没有任何 model/token/耗时/缓存状态 / 生成时间戳 — 完全不知道是不是新生成的
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/dashboard`
  2. 点"一周洞察"按钮
  3. modal 打开，仅看到任务列表 + "重新生成"按钮
  4. 探针 `cache hint: false`、`meta indicators: false`
- **实测证据**: `D7-weekly-modal.png`
- **是否阻塞演示视频叙事**: Yes（演示宣称"AI 留痕 模型/耗时"，演示视频里查无）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M1 P1
- **优化方向**: modal footer 加一行"由 {model} 生成 · 耗时 {ms}s · {generatedAt}"；"重新生成"按钮加冷却倒计时

#### B-DASH-02
- **ID**: B-DASH-02
- **模块**: 仪表盘 — 任务列表全过期 + dialog accessibility 警告
- **标题**: 仪表盘"任务列表"14 个全部"已过期"红 badge；打开一周洞察 modal 时控制台两条 React DialogContent warning（缺 description/aria-describedby）
- **严重度**: P1
- **复现步骤**:
  1. molly 仪表盘
  2. 任务列表 14 条全部"已过期"
  3. 点一周洞察 → console 报 `Missing Description or aria-describedby for {DialogContent}`
- **实测证据**: `01-dashboard.png`；`D7-weekly-modal.png`；探针 `[weekly warning] Warning: Missing Description or aria-describedby={undefined} for {DialogContent}`
- **是否阻塞演示视频叙事**: Yes（仪表盘"今日 0 节课·待批 0 份·本周新发布 0 项任务"传达"系统没活儿"）
- **是否依赖 seed 假数据**: Yes（seed 任务 dueAt 全在 5 月以前）
- **对应 probe r1 项**: probe r1 M1 P0-A2
- **优化方向**: seed 重做让一部分实例 dueAt 在未来；DialogContent 加 `aria-describedby` 或 sr-only Description

#### B-DASH-03
- **ID**: B-DASH-03
- **模块**: 仪表盘 — 课表"今日 0 节"
- **标题**: 5/14 是周四第 13 教学周，molly 协作 2 门课，今日依然显示"0 节课"
- **严重度**: P1
- **复现步骤**:
  1. molly 仪表盘
  2. 顶部"今日 0 节课"
  3. 切到 `/teacher/schedule` 看是否有课表数据
- **实测证据**: `01-dashboard.png`、`10-_teacher_schedule.png`
- **是否阻塞演示视频叙事**: Yes（演示视频要"今天工作流"开场）
- **是否依赖 seed 假数据**: Yes（ScheduleSlot seed 没覆盖 molly 协作课）
- **对应 probe r1 项**: 未列
- **优化方向**: seed 补 ScheduleSlot；空时改文案"今日没有排课"

### F. Study Buddy 教师视图

#### B-SB-01
- **ID**: B-SB-01
- **模块**: 课程 Study Buddy 统计 tab — 空
- **标题**: 课程"Study Buddy 统计"tab 显示"暂无学生提问"
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/courses/8f7f653c-...` → "Study Buddy 统计" tab
  2. 仅一句空态："学生在学习伙伴中提问后，这里会按章节和任务汇总。"
- **实测证据**: `02-tab-Study_Buddy_统计.png`；探针 `sb tab delete btns: []`
- **是否阻塞演示视频叙事**: Yes（演示要让老师看"学生都问什么"）
- **是否依赖 seed 假数据**: Yes（molly 课没学生 post）
- **对应 probe r1 项**: probe r1 M3b
- **优化方向**: seed 给 demo 课塞几条 post；空态加"暂无数据" + "如何引导学生使用 Study Buddy" 链接

#### B-SB-02
- **ID**: B-SB-02
- **模块**: 全局 Study Buddy 入口
- **标题**: 没有全局 Study Buddy 聚合页（教师只能从课程 tab 进入）
- **严重度**: P2
- **复现步骤**:
  1. 探针访问候选路径 `/teacher/study-buddy` 等 — 全 404
- **实测证据**: 探针 `07-...` 系列
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M3b P1
- **优化方向**: 加 `/teacher/study-buddy` 全局聚合页：跨课程的热门提问、未答疑、AI 回复留痕

#### B-SB-03
- **ID**: B-SB-03
- **模块**: Study Buddy 教师管理 — 无删除/隐藏路径
- **标题**: 教师没法删除/隐藏不当 Study Buddy 提问
- **严重度**: P1
- **复现步骤**:
  1. `app/api/study-buddy/posts/route.ts` 仅 POST + GET
  2. 探针扫教师 SB tab 按钮 `delete btns: []`
- **实测证据**: 代码 grep + `08-study-buddy.png`
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 加 DELETE / PATCH visibility 端点 + 教师列表行尾"隐藏/删除"

### G. AI 留痕 UI

#### B-ADMIN-01
- **ID**: B-ADMIN-01
- **模块**: AI 留痕 / 审计列表 — 全 404
- **标题**: `/teacher/ai-usage` `/teacher/ai-runs` `/admin` `/admin/audit` `/admin/audit-logs` `/teacher/audit` `/teacher/admin` 全 404；API 同步 404；只有 `/teacher/ai-settings` 200（配置页 ≠ 留痕页）
- **严重度**: P0
- **复现步骤**:
  1. molly 登录后逐个访问以上路径
  2. 探针逐一报 404 final url
- **实测证据**: `07-*.png` 系列 11 张；探针 `url /teacher/ai-usage → 404`、`url /api/admin/audit-logs → 404 len=14601` 等
- **是否阻塞演示视频叙事**: Yes（演示原话"AI 调用留痕"系统里查不到任何）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M4 P1（AiRun 表只写不读）
- **优化方向**: 建 `/teacher/ai-usage` 列表（按 feature/userId/dateRange 筛选）；admin 加 `/admin/audit` 审计页；AiRun 表加 inputTokens/outputTokens/summary 字段

#### B-ADMIN-02
- **ID**: B-ADMIN-02
- **模块**: 管理员入口本身缺失
- **标题**: molly@qq.com 是 teacher，但即便切到 admin 也找不到任何 `/admin*` 页面（全 404）
- **严重度**: P0
- **复现步骤**:
  1. molly → `/admin` → 404
  2. 同 `/admin/audit-logs`、`/admin/users` 等
- **实测证据**: 探针 `07-*` 截图
- **是否阻塞演示视频叙事**: No（演示不切 admin）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 M4 P1
- **优化方向**: 至少建 `/admin/dashboard` + `/admin/audit-logs`；admin 角色 sidebar 独立 layout

### H. 管理 / 删除盘点（汇总）

#### B-DELETE-01
- **ID**: B-DELETE-01
- **模块**: 综合 — 删除能力盘点
- **标题**: 全平台删除路径稀缺，多数核心实体没"删除"操作
- **严重度**: P0（整体）
- **复现步骤**: 见各子项
- **实测证据**:
  | 实体 | 删除入口存在？ | 备注 |
  |---|---|---|
  | 课程 Course | ❌ | 无 service + 无 API DELETE |
  | 章节 Chapter | ✅ | `deleteChapter` in `course.service.ts`，但 UI 没找到点击入口（探针扫到课程 tab "删除"x3，可能就是 section 行删除） |
  | 小节 Section | ⚠️ | 可能在 inline-section-row 组件有删除按钮（grep 命中 `inline-section-row.tsx`），需点击实测 |
  | ContentBlock | ⚠️ | block-edit-panel 组件含删除（同上） |
  | Task 模板 | ❌ | `/teacher/tasks/<id>` 无"删除"按钮 |
  | TaskInstance | ⚠️ | 后端 DELETE 存在，UI 无入口 |
  | Submission | ❌ | 后端无 DELETE / 撤销批改路径 |
  | CourseKnowledgeSource | ✅ | service 有 `deleteCourseKnowledgeSource`，UI 在 context-sources-panel 有"删除"按钮 |
  | StudyBuddyPost | ❌ | 后端无 DELETE |
  | Class | ❓ | 待 admin 视角测 |
- **是否阻塞演示视频叙事**: 部分（演示不需删，但用户痛点强烈）
- **是否依赖 seed 假数据**: N/A
- **对应 probe r1 项**: 未系统盘点
- **优化方向**: 补全核心实体的 archive（软删） + 关联约束保护（有 submission 的 task 拒删；有学生的班级拒删等）

#### B-DELETE-02
- **ID**: B-DELETE-02
- **模块**: 班级 / 学生管理
- **标题**: `/teacher/groups` 是班级管理总入口，但页面是"分组管理"导向，没有直接"建班/转班/移除学生"的纯班级操作
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/groups`
  2. 看到 `班级管理 / 班级与分组管理 / 新建分组` —— 是 "分组"导向（students 在 group 维度）
  3. 扫按钮：仅"批量加入"、"清空"、"新建分组"
- **实测证据**: `09-groups.png`；探针 `groups excerpt: ...班级管理 班级与分组管理 先选班级，再管理学习分组和人员信息。新建分组...`
- **是否阻塞演示视频叙事**: No
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: 未列
- **优化方向**: 班级是 grading scope 的核心容器，需要专门"班级管理"页 — 建班 / 转入 / 转出 / 学期归档

### I. 逐字稿对齐 / 演示承诺

#### B-DEMO-01
- **ID**: B-DEMO-01
- **模块**: 演示「AI 默认待审核」
- **标题**: 即便课程页能看到"PDF导入测试-S2-1856 测验 待审核 100%"字样，但点击没有审核界面（探针未深入），且 Study Buddy 帖子无审核态
- **严重度**: P0
- **复现步骤**:
  1. molly → collaborated 课程 → 1.2 节
  2. 见 "PDF 导入任务测试 测验 草稿 100% 1 题 待补：任务描述 删除"
  3. 现有 status 包括 `草稿` `待审核` `已发布`，但 TaskBuildDraft 流程 + 审核 vs 直接发布 vs AI vs 教师 diff 都没有
- **实测证据**: `D6-collab-course.png`；probe r1 B3 详细
- **是否阻塞演示视频叙事**: Yes（核心承诺）
- **是否依赖 seed 假数据**: No
- **对应 probe r1 项**: probe r1 B3
- **优化方向**: 见 probe r1 Batch 2 描述

#### B-DEMO-02
- **ID**: B-DEMO-02
- **模块**: 演示「按知识点出新题」/「按章节生成任务」
- **标题**: 任务详情页"知识点"信息完全没有（探针扫所有 task 都 `knowledge=false`）；编辑模式不能改 chapter/section 关联
- **严重度**: P1
- **复现步骤**:
  1. molly → `/teacher/tasks/<id>`
  2. 探针 `task 1 sections present: rubric=false persona=false questions=true classes=true knowledge=false`
- **实测证据**: `05-task-*.png` 系列
- **是否阻塞演示视频叙事**: Yes
- **是否依赖 seed 假数据**: 部分（seed 没赋 knowledgeTagIds）
- **对应 probe r1 项**: probe r1 M3b
- **优化方向**: 任务总览补"知识点 / 章节 / 小节"展示卡 + 编辑入口

---

## 功能缺失但逐字稿提到的清单

1. **「材料解析 → 任务生成 → 智能批改 → 学情诊断」完整闭环**：
   - 学情诊断目前在 `/teacher/analytics-v2` 跑得了但 KPI hydration + 永久 loading（B-INSIGHT-01/03）
2. **「按课程目标生成任务」**：
   - `wizard-step-quiz.tsx` 的 AI 出题不读 chapter knowledge sources（probe r1 已记录）
3. **「AI 客户配置 → 学生多轮对话 → 评分量规」**：
   - molly 视角看不到 simulation 任务（自己只造了 quiz）；teacher1 课里 simulation rubric 字段存在，但量规 quote 学生原话未实现（probe r1 B2）
4. **「题库扫描件 → AI 识别题干选项 → 入库」**：
   - molly 的 quiz "PDF导入测验" 任务 0 题（说明导入流程跑过但题入库失败 / 任务未链接）
5. **「AI 优化原题 / 按知识点出新题」**：
   - 任务编辑页没有这两个入口
6. **「自适应模式 - 少答题获得能力诊断」**：
   - molly 的"深度测试"task `mode: 自适应`，但实际 quiz 仍是固定 10 题；runtime 无适应性（probe r1 B1）
7. **「AI 默认待审核」原则**：
   - 见 B-DEMO-01
8. **「AI 调用留痕（模型 / 耗时 / 关键摘要）」**：
   - 见 B-ADMIN-01/02
9. **「跨课程对比 / 班级对比」**：
   - analytics-v2 有"多班对比详情"链接但 molly 的 scope 只有 1 班，无法演示

## 意外发现

1. **课程头部"协作教师：molly×"的 X 按钮**：在 collaborated 课程上点这个 X 可能让 molly 把自己从协作者中移出，但有无 confirm dialog 未测；如果直接生效是 P1
2. **`/teacher/analytics` 自动重定向到 `/teacher/analytics-v2`**：v1 已不存在；考虑彻底删 v1 路由文件
3. **侧边栏 "AI 助手 · 本周建议"**：在 dashboard 上单独有这个块，但内容是模糊的"薄弱任务 2 低均分，建议讲解"，是模板还是真生成的 LLM 输出不明
4. **"灵析教师/任务中心" breadcrumb**：所有 `/teacher/tasks/<id>` 都标"任务中心"，但 `/teacher/tasks` 标"任务管理"；breadcrumb 命名不统一
5. **molly 协作课程头部右上角"添加班级·学期始 2026-02-16"按钮**：collab 教师点这个按钮可改课程的学期开始日期？P1 风险（B-COURSE-04 延伸）
6. **collaborated 课程 `1.2 财务目标设定` 节里有 3 个"待审核 / 草稿"任务草稿（PDF导入测试-S2 / PDF 导入任务测试 / test）**：molly 是协作者，看得到 teacher1 的草稿；隐私边界 OK 但是否能编辑提交 unknown
7. **`/teacher/courses/<molly own>` 课程概览说"1 章 1 节 0 项任务"但课程目录列出 "1.1 粉线"（节名 "粉线"——看起来是测试数据噪声）**：seed 清理待办
8. **`/teacher/tasks/new` 直接 404 而不是友好提示**：(B-TASK-02)
9. **/teacher/analytics-v2 默认 scope 直接选定 `e6fc049c-...`（teacher1 的课）**：molly 自己的"个人规划"课没有任何 analytics 数据可看，scope 自动跳到协作课 — 这个 fallback 行为合理但要确认是不是 bug

---

## Bug 计数

| 严重度 | 数量 | 编号 |
|---|---|---|
| P0  | 10 | B-COURSE-01 · B-INSTANCE-01 · B-TASK-04 · B-TASK-05 · B-INSIGHT-01 · B-INSIGHT-03 · B-ADMIN-01 · B-ADMIN-02 · B-DELETE-01 · B-DEMO-01 |
| P1  | 17 | B-COURSE-02 · B-COURSE-03 · B-COURSE-04 · B-COURSE-05 · B-TASK-01 · B-TASK-03 · B-TASK-06 · B-INSTANCE-02 · B-INSTANCE-03 · B-INSIGHT-02 · B-DASH-01 · B-DASH-02 · B-DASH-03 · B-SB-01 · B-SB-03 · B-DELETE-02 · B-DEMO-02 |
| P2  | 3 | B-TASK-02 · B-INSIGHT-04 · B-SB-02 |
| **总计** | **30** | (9 项功能缺失对齐 + 9 条意外发现独立计数) |
