# 产品走查报告 — audit-product（2026-07）

> 走查员：audit-product ｜ 基线：main @ f45b94c ｜ 只读审查，不改应用代码
> 运行时环境：**http://localhost:3001（真 FinSim，环境解封后）**｜ 三角色真浏览器走查（Claude Browser MCP / 真 Chromium 渲染）
> 覆盖：34/34 页面逐页判级 + quiz 客观题创建 e2e + 375px 响应式抽查
> 本报告状态：**由 JSONL transcript 恢复重建**（原 agent 走查全部完成，仅最终报告写作被 session limit 掐断；观察一行未落盘但完整存活于 transcript，已按段恢复 + DB 只读对账加固）。

---

## 🚦 执行摘要（先读这段）

**真浏览器走查已完整执行（34/34 页面 + quiz e2e + 375px）。** 与第一轮报告（静态版，:3000 是 Multica 的环境阻塞）不同：环境已于 2026-07-12 下午解封（本地重建 FinSim 跑在 :3001，见 `spec-audit.md` 决策记录），本轮是**真实运行时判级**，非代码静态推断。

**整体结论：产品成熟度高。** 34 页中 28 页判「成熟」（渲染干净、空态/加载态得当、几乎零 console error），登录/注册/模拟器/三角色主看板都是可交付质量。但走查在**核心教学闭环的 quiz 分支上撞到一个确定性硬伤**，以及一处教师侧内容渲染 bug：

- **F-PROD-06（P1，接近 P0）· quiz「创建并发布」确定性失败**：任务向导终点 `POST /api/lms/task-instances/with-task` 稳定返回 400，`fieldErrors:{task:["Too small: expected string to have >=1 characters"]}` —— 向导发出一个 **UI 从不暴露的空 `task` 字段**。3/3 复现（新建向导 + 重开草稿）。DB 对账：ZZAUDIT quiz 的 `TaskInstance` = **0 行**，即从 UI 唯一发布路径**根本发不出去**。这直接阻断「教师建 quiz → 学生作答 → 自动判分」核心闭环的 quiz 分支。
- **F-PROD-07（P1）· 教师端 quiz 选项渲染为空**：`/teacher/tasks/[id]` 每道题选项渲染成空 bullet「·」无文字，教师看不到选项（解析/参考答案正常渲染）；**学生 runner 同一份题目选项渲染完全正常** → 纯教师侧映射 bug。伴随 console error「unique key prop in TaskDetailPage」。

**判级分布**（34 页）：

| 桶 | 数量 | 说明 |
|---|---|---|
| 成熟 | **28** | 含 1 个「最成熟/最精致」= `/sim/[id]` 模拟器 |
| 可用但粗糙 | **1** | `/teacher/tasks/[id]`（选项渲染为空 + console 报错） |
| 半成品 | **0 页**（但 1 条**功能流程**半成品：quiz 创建→发布，可存草稿/可预览、无法发布） | |
| 冗余候选（应删一个） | **0** | 3 组疑似冗余全部裁定「都留」；4 个重定向壳是有意兼容 |
| 重定向壳 N/A | **4** | root→login、analytics→v2、ai-settings/ai-usage→workbench |
| 不可达/未定级 | **1** | `/teacher/tasks/drafts/[id]` 独立路由未经任何测试 UX 暴露（草稿以内嵌向导呈现，已覆盖） |

**严重级计数**：**P0×0（原环境 P0 已解封）｜ P1×2（F-PROD-06 quiz 发布、F-PROD-07 教师选项空）｜ P2×12**。另有 2 条已关闭（F-PROD-01 环境已解、F-PROD-04 可达性运行时证伪不成硬伤）、1 条未验缺口（F-PROD-05 通知铃铛）。

**给 coordinator 的 3 个关键提醒**：
1. **F-PROD-06 可按 P0『必崩』定义升级**：它确定性阻断 quiz 核心闭环。我保守判 P1，因 simulation/subjective 两种任务类型的发布路径**本轮未测**（quiz 路径已坏，无法顺带验证其余两类是否共用同一坏 payload）——升级与否请你裁定。
2. **AI 依赖流程全程未测（环境待 key，非产品 bug）**：模拟对话 AI、主观题 AI 评分、学伴 AI 回复、AI 出题/教案生成均因 MIMO key 402（Insufficient balance）跳过。运行时观察到的是**优雅降级**（analytics-v2「AI 教学建议暂不可用，已显示规则模板」；ai-workbench 用量日志透明记录 402）——这是**正面信号**，不判 bug。key 到位后需补测这条尾巴。
3. **自动判分闭环尾巴未闭合**：因 F-PROD-06 发不出 ZZAUDIT quiz，学生「提交→客观题自动判分」这一步**未能端到端跑通**（学生 runner 只做了 view-only 渲染，未提交）。这是 F-PROD-06 的连带后果，非另一个 bug。

**Fixture**：ZZAUDIT 数据**按纪律保留、未 purge**（一次性库，留给 insights 对账）。DB 已只读核实存在（详见文末）。

---
## 功能判级总表（34 行 · 真运行时走查判级）

> 判级来自 :3001 真浏览器逐页渲染 + 交互。「关键观察」列记录空态/加载/错误态实测与关联发现号。

| # | 页面 | 角色 | 运行时判级 | 关键观察 / 关联发现 |
|---|---|---|---|---|
| 1 | `(auth)/login` | 公共 | ✅ 成熟 | 「灵析 AI／欢迎回来」邮箱+密码，渲染干净、零 console error。minor：「使用条款/隐私政策」= 死锚 `#terms`/`#privacy`（F-PROD-16） |
| 2 | `(auth)/register` | 公共 | ✅ 成熟 | 学生/教师注册切换、教师邀请码、学生班级下拉、密码规则；375px 响应式良好 |
| 3 | `page.tsx`(root) | 公共 | ⚪ N/A 重定向 | `redirect("/login")` |
| 4 | `(simulation)/sim/[id]` | 学生 | ✅✅ 最成熟 | **全站最精致页**：全屏 背景情景 / 对话目标(4) / 评分对照 rubric / 客户情绪 meter / 资产配置面板(滑块+提交给客户 0/3) / seeded 客户开场白。AI 回复待 key，无新 console error |
| 5 | `(student)/dashboard` | 学生 | ✅ 成熟 | 问候、3 待办(含尝试次数)、学习伙伴 callout、KPI、「暂无公告/未来课程」空态 |
| 6 | `(student)/tasks` | 学生 | ✅ 成熟 | 状态 tab 待办/进行中/已批改/已结束(带计数)、课程/类型筛选、任务卡 |
| 7 | `(student)/tasks/[id]` | 学生 | ✅ 成熟 | **学生 quiz runner 选项渲染正确**(A.设定财务目标/B.评估财务状况…)、计时器 29:54、题目导航 1-6、已作答 0/6。与 F-PROD-07 教师侧空选项对照 → bug 仅教师侧 |
| 8 | `(student)/courses` | 学生 | ✅ 成熟 | UI 成熟，但暴露 enrollment 数据不一致（F-PROD-10）：只见 ZZAUDIT(0任务)不见个人理财规划，而任务中心却有其 3 任务 |
| 9 | `(student)/courses/[id]` | 学生 | ✅ 成熟 | 进度环、内容/任务/成绩/公告 tab、章节树、本章掌握度、学习伙伴建议、向老师提问。「暂无任务」正确反映未发布的 ZZAUDIT quiz。minor：任课教师显示通用「任课教师」非真名（F-PROD-14） |
| 10 | `(student)/grades` | 学生 | ✅ 成熟 | 本学期平均、学期目标 90、分类型拆分、「暂无提交记录」空态 |
| 11 | `(student)/schedule` | 学生 | ✅ 成熟 | 本周/周课表/日历 tab、导出 iCal、切换月视图、「本周没有课程」空态。**静态版「空态关键词=0」担忧被运行时证伪** |
| 12 | `(student)/settings` | 学生 | ✅ 成熟 | 基础资料(email 只读)、修改密码表单。经 topbar 入口进入 |
| 13 | `(student)/study-buddy` | 学生 | ✅ 成熟 | 双栏：会话列表+聊天、「还没有对话」空态、新问题/发起新问题 CTA。AI 对话待 key（裁定③发起端） |
| 14 | `teacher/dashboard` | 教师 | ✅ 成熟 | 真 KPI（在教班级 1/共 4 名学生）、任务列表、近期课表、空态得当（暂无动态/暂无待审核/暂无薄弱任务），零 console error |
| 15 | `teacher/courses` | 教师 | ✅ 成熟 | KPI、课程卡 FIN301/个人理财规划、回收站/新建课程、「已全部批改」空态 |
| 16 | `teacher/courses/[id]` | 教师 | ✅ 成熟(渲染) | **全站最大页(2585行)**渲染干净：hero + 6 tab（课程结构/任务实例/教学上下文/Study Buddy统计/数据分析/公告管理）。⚠️ 内嵌 quiz 发布流程 broken（F-PROD-06）；375px hero/tab 横向溢出（F-PROD-13） |
| 17 | `teacher/tasks` | 教师 | ✅ 成熟 | 3 seed 任务(类型 badge + 查看/编辑/删除)。build-draft 与 task 分离——ZZAUDIT 草稿不在此列（印证唯一发布路径=坏向导） |
| 18 | `teacher/tasks/[id]` | 教师 | 🟡 **可用但粗糙** | **F-PROD-07**：quiz 每题选项渲染成空 bullet「·」无文字（解析/参考答案正常）→ 教师看不到选项；**F-PROD-08**：console error「unique key prop in TaskDetailPage」+ dev 覆盖层「1 Issue」 |
| 19 | `teacher/tasks/drafts/[id]` | 教师 | ⚪ 不可达/未定级 | 独立路由 id 未经任何测试 UX 暴露；当前 UX 中草稿以**内嵌向导**呈现（已在 e2e 覆盖）。route 疑似遗留/孤儿，待确认 |
| 20 | `teacher/instances` | 教师 | ✅ 成熟 | 全部/草稿/已发布/已关闭 tab、表格(详情/关闭)、3 个已发布实例。ZZAUDIT quiz 缺席（未发布，再证 F-PROD-06） |
| 21 | `teacher/instances/[id]` | 教师 | ✅ 成熟 | 交付漏斗(已指派 4/4·已提交 0/4)、成绩公布 手动/自动 toggle、催交/开始批改/导出成绩、5 子 tab、空态得当。⚠️ 满分 100 vs 该 quiz 6 题实际和 70（F-PROD-09） |
| 22 | `teacher/instances/[id]/insights` | 教师 | ✅ 成熟 | KPI 提交总数/已批改/均分/最高最低、「暂无已批改提交」空态。无新 console error |
| 23 | `teacher/analytics-v2` | 教师 | ✅ 成熟 | 唯一真实数据洞察面，渲染干净 + **优雅 AI 降级**（「AI 教学建议暂不可用，已显示规则模板」——正面），空态全程得当 |
| 24 | `teacher/analytics` | 教师 | ⚪ N/A 重定向 | runtime 确认 `redirect→analytics-v2`（裁定①） |
| 25 | `teacher/groups` | 教师 | ✅ 成熟 | 三栏：班级概览 A班/B班、分组情况「还没有分组」空态、人员信息 搜索/批量添加、名册 张三/李四/王五/赵六 |
| 26 | `teacher/schedule` | 教师 | ✅ 成熟 | 本周/周课表/日历 tab、「请先设置学期开始日期」引导、「本周无课」空态、本周公告。**静态版空态担忧证伪** |
| 27 | `teacher/announcements` | 教师 | ✅ 成熟 | 列表 发布公告/删除。**本页面包屑已本地化「公告管理」**——反衬 ai-workbench/admin 的 raw-segment 是特定缺口（F-PROD-12） |
| 28 | `teacher/ai-assistant` | 教师 | ✅ 成熟 | 4 工具：教案完善/思政挖掘/搜题与解析/试卷检查；上传+粘贴表单；「选择工具并输入材料后开始分析」空态。裁定②创作工具集。AI 生成待 key |
| 29 | `teacher/ai-workbench` | 教师 | ✅ 成熟 | 用量/设置 tab；用量日志透明显示失败 MIMO 调用「错误：Insufficient account balance」（优雅）。裁定②平台管理面。minor：面包屑「教师/ai-workbench」raw（F-PROD-12） |
| 30 | `teacher/ai-settings` | 教师 | ⚪ N/A 重定向 | runtime 确认 `→ai-workbench?tab=settings` |
| 31 | `teacher/ai-usage` | 教师 | ⚪ N/A 重定向 | 同 pattern `→ai-workbench?tab=usage` |
| 32 | `teacher/study-buddy` | 教师 | ✅ 成熟 | 监控端：学生提问、scope tab 全部/未答疑/AI已回复、「当前筛选下暂无学生提问」空态。裁定③监控端 |
| 33 | `admin/audit` | 管理员 | ✅ 成熟 | 系统管理员；敏感操作日志/AI调用记录 tab；显示 ZZAUDIT chapter.create+section.create 审计条目，**且无 task-instance 条目**（印证 F-PROD-06）。面包屑「管理员/admin/audit」raw（F-PROD-12） |
| 34 | `admin/feedback` | 管理员 | ✅ 成熟 | 全部/待处理/已处理 tab、「暂无反馈」空态、admin-only。面包屑「管理员/admin/feedback」raw（F-PROD-12） |

**跨页正面观察**：几乎全站零 console error（唯一例外是 TaskDetailPage 的 key 警告，且会 stale 残留到后续页）；中文校验规范（建课「请选择班级」红字）；modal 点背景关闭不留脏数据（无残课程）；空态/加载态/引导态覆盖普遍到位。

---

## 冗余裁定（3 组 · 代码高置信 + 运行时确认）

> 结论先行：**「应删一个」净候选 = 0。** spec 里「两套并存/4 个 AI 页/双端」的担忧，代码 + 运行时双确认后已合理消解。

### 裁定① · `/teacher/analytics` vs `/teacher/analytics-v2` → **都留（本就不是两套）**
- `analytics/page.tsx` = 5 行 `redirect("/teacher/analytics-v2")`；v2 委托 `AnalyticsV2Dashboard`（唯一真实看板，侧栏「数据洞察」指向它）。**运行时确认重定向生效。** v1 早退化为兼容壳，零维护成本，无需合并/删除。

### 裁定② · 教师 4 个 AI 页 → **2 真实页都留，另 2 个已是重定向**
- `ai-assistant`（侧栏「AI 助手」）= **AI 创作工具集**（教案/思政/搜题/试卷）——「用 AI」。运行时确认 4 工具布局成熟。
- `ai-workbench`（侧栏「AI 工作台」）= **AI 平台管理面**（用量监控 + provider 设置）——「管 AI」。运行时确认用量日志透明记录调用。
- `ai-settings`/`ai-usage` = 重定向壳（Unit B1 兼容书签）。**运行时确认 `ai-settings→ai-workbench?tab=settings`。**
- **裁定：都留。** 两真实页受众/功能正交，不冗余；整合早已做完。遗留打磨点见 F-PROD-02（侧栏两标签语义不自解释）。

### 裁定③ · study-buddy 学生端 vs 教师端 → **都留（一个功能的两端）**
- 学生 `/study-buddy` = **发起端**（建 post 绑定任务、拿 AI 回复、追问）；教师 `/teacher/study-buddy` = **监控端**（列 post、scope 筛选、统计、可删）。运行时两端均成熟渲染，受众/能力不同，非冗余。

---

## 核心流程 e2e 记录（教师建课→建任务→发布→学生作答→自动判分）

**执行方式**：造 ZZAUDIT 课程/章/节/quiz 走真实教师 UX，客观题（不依赖 AI），目标验证「客观题自动判分」闭环。

**跑通的部分**（全部成熟）：
1. **建课**：ZZAUDIT 课程创建成功，绑定 金融2024A班。过程中：中文校验良好（未选班级红字「请选择班级」）；modal 背景关闭不留脏数据。
2. **课程详情**（2585 行大页）渲染干净，6 tab，金融2024A班 badge 在位。
3. **建章建节**：章「ZZAUDIT 第一章 基础测验」+ 节（1章1节，含 课前/课中/课后 phase 列）创建成功。
4. **任务向导**：清晰 4 步（任务类型→基本信息→素材与配置→预览并创建），3 类型 模拟对话/测验/主观题。选 QUIZ。
5. **加客观题**：Q1 单选题（A=活期存款 标绿正确）、Q2 多选题（A+B 标绿正确）均成功。
6. **预览**（step 4）干净：2 题（单选 1分 + 多选 1分）、提交后显示答案=是、「准备就绪」。
7. **保存草稿成功**：`POST /api/lms/task-build-drafts → 201`。DB 对账草稿存在（id `0340e2c4…`，taskType=quiz，status=draft）。

**卡死的部分**（F-PROD-06 · P1 接近 P0）：
- **创建并发布 确定性失败**：toast「请求参数错误」→ `POST /api/lms/task-instances/with-task → 400`，响应体 `fieldErrors:{task:["Too small: expected string to have >=1 characters"]}`。
- 向导发出**空 `task` 字段**——一个 UI 从不暴露的字段。所有可见字段都已填。
- **3/3 确定性复现**：新建向导 2 次 + 重开草稿 1 次，均 400 空 task。
- 重开草稿确认：题目 + 正确答案（A/B 标绿）**确实已保存/保留**——所以是 payload 组装 bug，不是数据缺失。
- **DB 根因线索**：ZZAUDIT quiz 的 `TaskInstance` = 0 行（发不出去）；草稿 `missingFields = {答案与选项}`（服务端仍认为答案/选项缺失，尽管向导里已填并标绿）——强烈指向**向导未把题目 config 绑进草稿/发布 payload**，与「空 task 字段」互为印证。
- **连带阻断**：因发不出 quiz，「学生提交→客观题自动判分」尾巴**未能端到端跑通**（学生 runner 仅 view-only 渲染，未提交）。这是本条的后果，非独立 bug。

**旁路验证**：`/teacher/tasks`（任务管理）只列 seed 任务、不列 build-draft → 确认**唯一发布路径就是这个坏向导**，无旁路可绕。

---

## 375px 响应式抽查

抽查 5 核心页（register、login、teacher dashboard、course-detail、analytics-v2）：

- **register/login/teacher dashboard/analytics-v2 = 响应式良好**：hero+表单干净堆叠、KPI 卡 reflow 2×2、筛选 chip 换行、无页面级横向溢出（analytics-v2 实测 `docScrollW==innerW==375`）。
- **F-PROD-13（P2）· course-detail（最大页）hero 按钮行 + tab 行横向溢出**：按钮左侧被裁、tab 右侧被切（contained 横向滚动容器，**非页面级溢出**）。汉堡导航正常、内容 reflow 正常，密但可控。

---
## 发现清单

> 每条含：严重级 · 证据（页面+复现/console/DB）· 影响 · 修复方向。P0 数据错误/安全/必崩；P1 核心体验硬伤；P2 打磨。

### F-PROD-06 · quiz「创建并发布」确定性失败（空 task 字段）
- **严重级**：**P1（接近 P0——确定性阻断 quiz 核心闭环；coordinator 可按「必崩」升级 P0）**
- **证据**：教师任务向导填完 2 道客观题 → 点「创建并发布」→ toast「请求参数错误」→ `POST /api/lms/task-instances/with-task → 400`，body `fieldErrors:{task:["Too small: expected string to have >=1 characters"]}`。向导发出空 `task` 字段（UI 从不暴露此字段）。**3/3 复现**（新建向导×2 + 重开草稿×1）。**DB 对账**：ZZAUDIT quiz 的 `TaskInstance`=0 行；草稿 `missingFields={答案与选项}`（服务端认为答案/选项缺失，尽管向导已填并标绿）。
- **影响**：quiz 任务**无法经 UI 唯一路径发布**；连带「学生提交→客观题自动判分」尾巴无法端到端验证。simulation/subjective 是否共用同一坏 payload 未测。
- **修复方向**：追 task-wizard 提交 payload 组装——发布路径未把题目 config（`task`/questions）序列化进 `with-task` 请求体；对照 `保存草稿`（201 成功）路径的 payload 差异。同时补服务端 400 的用户可读中文错误（现「请求参数错误」过泛）。

### F-PROD-07 · 教师端 quiz 选项渲染为空 bullet（teacher-side only）
- **严重级**：**P1（教师无法在任务详情看到任何选项）**
- **证据**：`/teacher/tasks/[id]` 每道 quiz 题选项渲染成空 bullet「·」无文字；解析/参考答案正常渲染。**同一份题目学生 runner（`/tasks/[id]`）选项渲染完全正常**（A.设定财务目标…）→ 纯教师侧 option-list 映射 bug。真渲染才可见（curl/tsc 不报）。
- **影响**：教师在任务详情页复核 quiz 时看不到答案选项，无法审题。
- **修复方向**：查 TaskDetailPage quiz 选项渲染的字段映射（选项数组未取到 label/text）；与学生 runner 的取字段方式对齐。

### F-PROD-08 · TaskDetailPage React「unique key prop」console error
- **严重级**：P2（功能不阻断，但 dev 覆盖层报「1 Issue」，且 stale 残留到后续页误导排查）
- **证据**：进入 `/teacher/tasks/[id]` 触发 console error「Each child in a list should have a unique key prop. Check TaskDetailPage」；此警告在后续教师/学生页面持续 stale 残留。
- **影响**：列表 diff 可能异常；污染 console，掩盖真错误。
- **修复方向**：TaskDetailPage 列表渲染补稳定 `key`（很可能就是 F-PROD-07 空选项 map 的同一处循环）。

### F-PROD-09 · 任务总分/满分「100」无数据支撑，与题目实际分和不符
- **严重级**：P2（显示误导，可致教师/学生误判满分）
- **证据**：ZZAUDIT quiz（2 题各 1 分）step-4 预览显示「总分 100」；seed quiz（6 题）教师实例页显示「满分 100」、学生 runner 显示「总分 70」、题目实际和 70——**同一 quiz 教师端/学生端满分不一致**。**DB 对账**：`QuizConfig` 与 `Task` 均无 total/points 声明列 → 「100」是**无后端支撑的 UI 默认值**，非题目分求和。
- **影响**：满分显示不可信，教师配比例、学生看占比都会被误导。
- **修复方向**：满分统一由题目分求和派生（或显式声明并回填 DB），消除教师/学生两端口径差。

### F-PROD-10 · 学生 enrollment 数据两处口径不一致
- **严重级**：P2（数据一致性）
- **证据**：student1（A班）「我的课程」只见「ZZAUDIT 走查测试课程」（0 任务），**不见「个人理财规划」**；但「任务中心」显示该生有来自「个人理财规划」的 3 个任务。两处 enrollment 数据源不一致（有其任务的课却不在其课程列表）。
- **影响**：学生课程列表与任务来源脱节，学生找不到任务所属课程。
- **修复方向**：核对「我的课程」与「任务中心」各自的 enrollment 查询（一处可能按 CourseClass、另一处按其它关系），统一真源。

### F-PROD-11 · 课程卡「学生 —（未关联班级）」stat 读废弃字段
- **严重级**：P2（显示不一致，已 DB 根因）
- **证据**：ZZAUDIT 课程卡 badge 显示「金融2024A班」，但「学生」stat 显示「—（未关联班级）」。**DB 根因**：`CourseClass` 表存在 courseId→classId(`e56c4b63`=金融2024A班) 关联行（badge 正确）；而 `Course.classId` 列为 null——schema 里该列已标 **`@deprecated`（"新代码用 CourseClass 关联"）**。即 stat 仍在读**废弃的 `Course.classId`**，故误显「未关联班级」。
- **影响**：学生数关联状态显示错误，教师误以为课程没绑班。
- **修复方向**：把学生数/班级关联 stat 的读取从 `Course.classId` 切到 `CourseClass`（reader 收敛遗漏点）。

### F-PROD-12 · 面包屑 i18n 缺口（系统性）
- **严重级**：P2（文案/本地化）
- **证据**：`ai-workbench` 面包屑「教师 / ai-workbench」、`admin/audit`「管理员 / admin / audit」、`admin/feedback`「管理员 / admin / feedback」——均漏本地化，直出 raw route segment；而 `announcements` 面包屑已本地化「公告管理」。
- **影响**：部分深页面包屑露英文路由段，观感与一致性打折。
- **修复方向**：面包屑 segment→中文 label 映射补齐缺失路由（workbench/audit/feedback 等）。

### F-PROD-13 · 375px course-detail hero 按钮行 + tab 行横向溢出
- **严重级**：P2（响应式，contained scroll 非页面级溢出）
- **证据**：course-detail（最大页）375px：hero 动作按钮行左侧被裁、tab 行右侧被切（横向滚动容器）。其余抽查页无页面级横向溢出。
- **影响**：窄屏教师操作按钮/tab 需横向滚动才可见，易漏。
- **修复方向**：hero 按钮组与 tab 组在窄屏改为换行/折叠菜单，或明确可滚提示。

### F-PROD-02 · 侧栏「AI 助手」/「AI 工作台」语义不自解释
- **严重级**：P2（信息架构文案）
- **证据**：`components/sidebar.tsx` teacherNav 并列「AI 助手」（创作工具集）与「AI 工作台」（用量+设置），两名对教师都像「AI 那块」，难一眼区分。运行时确认两页均成熟、职能正交。
- **修复方向**：重命名使职能自解释（如「AI 备课工具」vs「AI 用量与设置」）。

### F-PROD-03 · 侧栏「搜索… ⌘K」死占位（runtime 已确认）
- **严重级**：P2（死 UI）
- **证据**：`components/sidebar.tsx` 搜索框为静态 div，无 onClick、⌘K 无绑定（注释「command palette TBD」；cmdk 原语存在未接线）。**运行时确认**：点击搜索框 + 按 ⌘K 均无反应。
- **修复方向**：接上命令面板（cmdk 已在），或先隐藏占位避免假可点。

### F-PROD-14 · 学生课程详情「任课教师」显示通用标签非真名
- **严重级**：P2（数据/文案）
- **证据**：`(student)/courses/[id]` 任课教师字段显示通用「任课教师」而非真实姓名（王教授）。
- **修复方向**：查询补 include 教师姓名并渲染。

### F-PROD-15 · 草稿卡「待补：答案与选项」标签不准
- **严重级**：P2（显示误导，与 F-PROD-06 同源）
- **证据**：保存草稿后卡片显示「测验 草稿 2题 · 待补：答案与选项」，但重开向导确认题目+正确答案（A/B 标绿）**已保存/保留**；DB `TaskBuildDraft.missingFields={答案与选项}`。→ missingFields 计算与实际不符（很可能就是 F-PROD-06 payload 未含题目 config 的同一根因表现）。
- **修复方向**：与 F-PROD-06 合并追查——草稿 payload 是否真的含题目 config，missingFields 判定逻辑校正。

### F-PROD-16 · login「使用条款/隐私政策」死锚
- **严重级**：P2（minor 死链）
- **证据**：登录页「使用条款」「隐私政策」链接指向 `#terms`/`#privacy` 空锚，无目标。
- **修复方向**：补真实条款/隐私页或移除链接。

### F-PROD-17 · 建课 modal「请选择班级」校验红字选后不清除
- **严重级**：P2（表单交互）
- **证据**：建课 modal 选中班级后，之前触发的红色「请选择班级」错误不随 onChange 清除，持续显示。
- **修复方向**：班级选中即清除该字段校验错误。

### ✅ 已关闭 / 未验缺口
- **F-PROD-01（原 P0 环境阻塞）→ 已解封关闭**：首轮 :3000 是 Multica、FinSim 未跑；下午本地重建 FinSim@:3001，走查完成。历史见 `spec-audit.md` 决策记录。
- **F-PROD-04（原候选·nav 可达性）→ 运行时证伪、关闭**：orphan 路由（学生 settings/study-buddy、教师 study-buddy、instances）运行时均有上下文入口（topbar/dashboard callout/课程 Tab/下钻）可达，不构成硬伤。
- **F-PROD-05（topbar 通知铃铛接线）→ 未验缺口**：本轮 runtime pass 未显式点击验证铃铛是否为占位，状态 unknown，留作补测。

### ➕ 正面发现（非 bug，值得记录）
- **AI 优雅降级**：analytics-v2「AI 教学建议暂不可用，已显示规则模板」；ai-workbench 用量日志透明记录 402「Insufficient account balance」——AI 不可用时降级得当，是成熟工程信号。
- **零 console error**（除 TaskDetailPage key 警告）；中文校验规范；modal 背景关闭不留脏数据；空态/引导态覆盖普遍到位。

---

## 环境说明（首轮阻塞 → 解封，历史留档）

本单元跨两个 session：
- **首轮（上午）**：`:3000` 实为 Docker 容器 `multica-ws0-frontend-1`（Multica，`ghcr.io/multica-ai/multica-web`），非 FinSim；本目录无 `.env`/`.next`，FinSim 从未在此跑过。真浏览器走查被 P0 阻塞，首版报告如实上报未编造。
- **解封（下午）**：按 `spec-audit.md` 决策记录，本地重建 FinSim 于 **:3001**（`.env` = 容器真实 DB 密码 + 随机 secret + 生产 MIMO 变量；`prisma migrate reset` + 28 迁移重放 + seed 9 账号，用户明确同意）。:3001 渲染「灵析 AI / 欢迎回来」确认为真 FinSim，本轮全部走查在此完成。
- **AI key 现状**：生产 MIMO `sk-` key 已 402（Insufficient balance），订阅端点需 `tp-` key（用户待提供）。故 AI 依赖流程本轮跳过，标「环境待 key」，非产品缺陷。

---

## Fixture 说明（ZZAUDIT · 按纪律保留、未 purge · DB 只读已核实）

按 `spec-audit.md` 决策⑤「ZZAUDIT 数据不再 purge（一次性库，成绩数据留给 insights 对账复用）」，本轮**故意保留**造出的数据。只读 SELECT 核实现存：

| 对象 | id / 值 | 备注 |
|---|---|---|
| Course | `c43370cc-…` 「ZZAUDIT 走查测试课程」 | courseCode=ZZAUDIT；`Course.classId`=null（走 CourseClass） |
| CourseClass 关联 | courseId→`e56c4b63`（金融2024A班） | 印证 F-PROD-11：关联真存在，badge 正确 |
| Chapter | `606c4126-…` 「ZZAUDIT 第一章 基础测验」 | |
| Section | 1章1节（含 课前/课中/课后 phase） | |
| TaskBuildDraft | `0340e2c4-…` 「ZZAUDIT 客观题小测」quiz/draft | `missingFields={答案与选项}`（印证 F-PROD-06/15） |
| TaskInstance（ZZAUDIT） | **0 行** | 印证 F-PROD-06：发布失败，实例从未生成 |

**纪律确认**：全程 DB 仅 SELECT（未 reset/seed/drop/write）；ZZAUDIT 数据保留供 insights 对账；共享 dev DB 未被破坏。

---

## 缺口清单（本轮未覆盖，非恢复丢失——原走查本身即未做/被阻断）

> 说明：JSONL transcript 恢复**完整**，34/34 页判级、e2e 全过程、375px 结果一条未丢。以下是原走查**本身**因约束未做的部分，供补测规划：

1. **AI 依赖全链路未测**（环境待 `tp-` key）：模拟对话 AI 回复、主观题 AI 评分、学伴 AI 对话、AI 出题/教案生成。
2. **客观题自动判分尾巴未闭合**：被 F-PROD-06 阻断——ZZAUDIT quiz 发不出，学生未提交（仅 view-only 渲染 seed quiz runner）。key/发布 bug 任一解决后需补跑「学生提交→客观题自动判分→成绩回流」。
3. **simulation / subjective 两种任务类型的发布路径未测**：仅测了 quiz 发布（已坏），未验证另两类是否共用同一坏 payload。
4. **`/teacher/tasks/drafts/[id]` 独立路由未渲染**：当前 UX 走内嵌向导，独立 route 未经任何入口暴露，疑似遗留/孤儿，待确认。
5. **F-PROD-05 topbar 通知铃铛**未点击验证接线。
6. **375px 仅抽查 5 页**（register/login/teacher dashboard/course-detail/analytics-v2），非全 34 页移动端。
