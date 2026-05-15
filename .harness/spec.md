# Spec — finsim 2026-05-14 全模块修复（65 bugs + 用户决策）

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户，结果立刻写进 `.harness/spec.md` + commit。

> Coordinator: claude (main agent) · Builder + QA: team `probe-demo`
> Branch: `claude-demo-fixes` (created from main `98017c8`)
> Dev DB 已备份：`.harness/dev-db-backup-2026-05-14.sql` (701K)
> 演示账号：molly@qq.com / 123456（teacher） + alex/belle/charlie/dexter@qq.com / 11（students）

## 用户决策（拍板固化）

1. **真实自适应模式**：按知识点 + 题型难度（多选 0.8 > 简答 0.9 > 单选 0.5 > 判断 0.3）+ 答对率自适应，目标 ≤8 题诊断 ≥3 知识点掌握度；末尾输出"薄弱知识点报告"；规则引擎 + 简化贝叶斯混合
2. **Study Buddy 自由问**：taskId 改 optional；有素材引素材（含 excerpt），无素材用章节名/课程概要兜底，**不能拒答**
3. **演示账号 = molly@qq.com**，不切回 teacher1；不重做全局 seed；改造 molly 课的真实数据
4. **AI 回帖不需审核**：Study Buddy AI 回帖即时可见；学生提问 + AI 回帖聚合到老师"Study Buddy 管理页"
5. **协作教师权限上扬**：协作者**可改课程结构 + 可建班**（与 owner 接近，不再限制为只读）
6. **任务管理常理功能**：实例可重开 + 任务总览页全 config 可见可改 + 删除盘点全实体覆盖
7. **TaskBuildDraft 仍保留审核闭环**（任务发给学生前需老师审一遍）—— 区别于 SB AI 回帖（不审）

## Bug 清单引用

完整：`.harness/reports/bug_inventory_teacher_r1.md`（30 bugs）+ `.harness/reports/bug_inventory_student_r1.md`（35 bugs）

下面 Unit 中的 `B-XXX` 编号对应这两份报告。

---

## 当前 Phase 进度

- ✅ **Phase 1 完整收官**（8 unit，演示稳定化）
- ✅ **Phase 2 完整收官**（4 unit 全 r1 即收，演示承诺兑现）
- ✅ **Phase 3 完整收官**（molly 真实演示数据建设，6 M-step 全 PASS）
- 🔴 **Phase 4 必做**（8 项 unit/bug + 100% acceptance + 不允许 skip）— 见下文
- ⏭️ **Phase 5 review + PR** 在 Phase 4 完整完成后做

---

## Phase 1 — 核心 P0（已完成，归档参考）

[Unit 1-7 详细 acceptance + scope + 风险 保持原状，已 PASS 不重复列]

---

## Phase 2 — schema 改动 + 兑现演示承诺（已完成，归档参考）

[Unit 8-11 详细 acceptance 保持原状，已 r1 即收不重复列]

---

## Phase 3 — molly 真实演示数据建设（已完成，归档参考）

详见 `.harness/reports/phase3_molly_seed_r1.md`。

---

## Phase 4 — 剩余 polish + Phase 3 衍生 bug（**必做，禁止 skip**）

**硬约束**：8 项每项 acceptance 100% PASS 才标 completed。任何想 skip 任何一项必须先 ask 用户。不允许 backlog 项。

### Unit 17 — TaskInstance.taskSnapshot 字段消费

**触发**：Unit 4 衍生缺陷。schema 已有 `TaskInstance.taskSnapshot Json?` 字段 + service create/publish 时已写快照，但学生 runner 直接读 `instance.task.*` live 数据 → 教师改 task 模板后正在跑的 instance 立即看到新题，学生答到一半题目变了 / graded sub 题目和当前题目不一致。

**修**：probe r1 Unit 4 风险 + spec-amendments.md

**Acceptance**：
- 学生 runner（`app/(student)/tasks/[id]/page.tsx` + `app/(simulation)/sim/[id]/page.tsx`）优先读 `instance.taskSnapshot`，fallback `instance.task.*`
- 加 type guard（taskSnapshot 是 Json，运行时 parse + 验证 shape）
- 教师视图 `/teacher/instances/[id]` 保留读 live `instance.task.*`（看最新模板）
- vitest 覆盖：snapshot 存在时优先读；snapshot 缺失时 fallback
- 教师改 task 后，已发布且有 submission 的 instance 学生侧仍看到改前题目（实测）
- 新发布的 instance 仍看到最新题目（因 publish 时 snapshot 包含当时 task）

**Scope**：2 个 runner page.tsx + types guard + vitest

**预计**：~2h，single commit

**风险**：低（仅 frontend 读路径，不动 schema）

---

### Phase3-A — quiz-question-tagger 首次 job 计数虚高

**触发**：Phase 3 M-3 创建 adaptive quiz 后 async-job 跑完，result `tagged: 10` 但 DB knowledgeTagIds 全 `{}`。第二次手动 trigger 才真写入。adaptive quiz 无 tag 会 fallback 到 fixed 模式，影响演示。

**Acceptance**：
- 首次 async job 也真写入 knowledgeTagIds（DB query 验证）
- result tagged 计数与 DB 实际写入数一致
- 失败时 result.failed 正确反映 + error 字段写明原因
- vitest 单测覆盖：mock LLM 返回 → 写入 DB → 验证 + 计数

**Scope**：`lib/services/quiz-question-tagger.service.ts`（计数逻辑 / transaction）+ `lib/services/async-job.service.ts`（dispatcher 错误处理）+ vitest

**预计**：~1h，single commit

**风险**：低-中（计数 bug 排查，可能涉及 transaction commit 时序）

---

### Unit 12 — 主观题 allowedAttachmentTypes 实接 + capture 拍照

**修**：B-STU-SUBJ-1, B-STU-SUBJ-2

**Acceptance**：
- `components/subjective/subjective-runner.tsx` 接受 `allowedTypes: string[]` prop 替代硬编码 ALLOWED_EXTENSIONS
- `app/(student)/tasks/[id]/page.tsx` 透传 `task.subjectiveConfig.allowedAttachmentTypes` 到 runner
- 教师配置"只允许 pdf"时学生侧只能选 pdf（实测）
- 拍照按钮：`<input type="file" accept="image/*" capture="environment">` 移动端唤起原生相机
- 桌面浏览器拍照按钮降级为"上传图片"（不显示 capture 错误）

**Scope**：`components/subjective/subjective-runner.tsx` + `app/(student)/tasks/[id]/page.tsx`

**预计**：~1.5h

**风险**：低

---

### Unit 14 — 学生 dashboard 折叠 + AI buddy callout 视口

**修**：B-STU-DASH-1, B-STU-DASH-3

**Acceptance**：
- 学生 dashboard "学习任务"卡当 tasks ≥ 6 时折叠到 5 项 + "查看全部"按钮（sheet 或新页）
- 折叠展开状态 localStorage 持久化
- AiBuddyCallout 在 < xl 视口（1280px）也可见（修 `hidden xl:flex` → 改 layout 或加 fallback）
- 不破坏现有 ≥ xl 视口体验（pixel diff 实测）

**Scope**：`components/dashboard/priority-tasks.tsx` + `components/dashboard/ai-buddy-callout.tsx` + `app/(student)/dashboard/page.tsx`

**预计**：~1h

**风险**：低

---

### Unit 13 — 协作教师 dialog + 资源/讨论 tab 占位

**修**：B-COURSE-02, B-STU-COURSES-1

**Acceptance**：
- 协作教师 dialog 显示当前协作者列表（API `/api/lms/courses/{id}/teachers` 返回的）+ 每行"移除"按钮
- 移除走 DELETE + audit + 中文 confirm "确认移除 {name}？"
- molly 自有课程 dialog 能正常打开（不 freeze）
- 学生课程详情"资源 / 讨论"两个 tab 占位"将在后续版本中上线"改为：要么真显示功能（如只读资源列表 from CourseKnowledgeSource），要么完全隐藏 tab（不暴露占位）

**Scope**：`components/course/teacher-collab-dialog.tsx`（或 inline）+ `app/(student)/courses/[id]/page.tsx`

**预计**：~1h

**风险**：低

---

### Unit 15 — 一周洞察空数据 + 错误降级文案

**修**：probe r1 M1-P1-3

**Acceptance**：
- `weekly-insight.service.ts` 在 `submissionCount === 0` 时**不调 AI**，直接返回固定空态文案"本周尚无已公布提交，先去任务详情公布成绩"+ CTA 链接到 release 页
- 不再让 AI 编造 6 条机械重复"下周建议"
- LLM 失败时错误降级文案按 err.message 分桶：超时 / 配额耗尽 / 模型未配置 / 网络错误（4 个中文）
- 单测覆盖空数据短路 + 错误分桶映射

**Scope**：`lib/services/weekly-insight.service.ts` + `lib/api-utils.ts`（错误码）+ vitest

**预计**：~2h

**风险**：低

---

### Phase3-B — .doc (OLE2) 上传支持

**修**：Phase 3 实操发现，老师可能直接上传旧 Word 格式

**Acceptance**：选项 A 或 B 二选一（plan 阶段 builder 决策 + ask coordinator）：
- **A.** 后端用 `antiword` 或类似工具解析 .doc → 与 .docx 同 storage flow
- **B.** 前端检测 .doc 弹中文提示"请将 .doc 文件另存为 .docx 后再上传（Word 中『另存为 → Word 文档』）"，不让 POST 触发后端 400

**Acceptance（实测）**：
- 上传 .doc 不再返回 500 / 不友好 400
- 中文错误信息（如选 B）清晰可操作
- 若选 A，.doc structuredData 与 .docx 同样生成

**Scope**：`lib/services/storage.service.ts` + `components/teacher-course-edit/upload-syllabus-dialog.tsx`（如选 B）

**预计**：~1.5h

**风险**：低（依赖选择，二选一）

---

### Unit 16 — P2 扫尾

**修**：probe r1 P2 + bug_inventory_*_r1.md 中所有 P2

**Acceptance**：以下每项**全部 PASS**（不允许 partial skip）：

仪表盘 P2：
- modal 移动端 < sm 改全屏抽屉
- 缓存命中态"重新生成"按钮加确认"覆盖 7 天缓存？"
- LLM 错误降级文案分级（与 Unit 15 协作）
- 学生权限测试 spot check（已 PASS 仅 sanity）

课程 P2：
- "+任务"/"+块"按钮升到 12-13px（B-P2-1）
- "次班"术语换中文化（B-P2-2）
- 课程列表"待批改"指标 tooltip 说明范围（B-P2-3）

模拟对话 P2：
- 教师查对话原文路径加快捷入口（B-P2-2）
- 客户情绪条 mood 历史可视化（B-P2-3）
- 30 轮硬截断前端 toast 提示（B-P2-4）
- 语音失败 toast 加"或手动输入"备选 CTA（B-P2-6）

测验/主观 P2：
- "AI 优化原题"按钮加题目级悬停（B-Q-P2-4）
- 教师 override 显示 AI 原分 + 老师改分对比（B-S-P2-3）

StudyBuddy P2：
- 教师 dashboard 顶层加"本周 SB 高频提问 Top 3"卡（B-SB-P2-4）
- settingsUserId fallback 加 system default provider 兜底（B-SB-P2-5）

数据洞察 P2：
- recompute 完成 toast 提示（B-DI-P2-6）

教师主导 P2：
- `ENABLE_AUDIT_LOGS` env 改控制采样率而非全开关（B-PR-P2-4）

学生侧 P2 6 项：
- B-STU-P2-1 主观题三处分散 → 集中底部
- B-STU-P2-2 "未来"→"未来 7 天"
- B-STU-P2-3 grades 排序按钮可点 + 反馈
- B-STU-P2-4 sim 头部"重来 / 结束"间距
- B-STU-P2-5 sim 评分对照列 ScoringCriteria 维度
- B-STU-P2-6 settings 邮箱只读文案位置

**Scope**：跨多个组件 / 服务的小修

**预计**：~3h（每项 < 10 min × ~20 项）

**风险**：低（每项独立小修，可分多个 commit）

---

## Phase 5 — 整体 code review + PR（仅在 Phase 4 全部 completed 后做）

- 全 unit merge 到 `claude-demo-fixes` 后
- 跑全量 `npx tsc --noEmit && npx vitest run && npm run lint`
- code review report：结构 / 一致性 / 性能 / 必要小重构
- update PR #12 描述（不开新 PR）→ CI quality + staging deploy → 用户 staging 实测 → squash merge

---

## 工作流（每个 unit 严格遵守）

1. **Builder 接手**：读 spec + 该 unit 引用的 bug 报告条目 + 触及文件，**计划自己输出"实现方案 + 文件清单 + 风险"给 coordinator 审一眼**（避免误读）
2. **Builder 实现**：单 commit；每 commit 跑 `npx tsc --noEmit`；diff 控制 ≤ 200 行（schema 改动除外）
3. **Builder 提交报告** `.harness/reports/build_unit{N}_r{M}.md`，列：改动文件 / 关键决策 / 自测结果
4. **QA 独立验证**：read spec + build 报告 + 不读 builder 改动方案；用 Playwright 真浏览器跑 acceptance；写 `qa_unit{N}_r{M}.md`
5. **Dynamic exit**：
   - acceptance 100% PASS 且证据扎实（QA 三条件：独立证据链 + 全 deterministic + DB cleanup）→ unit completed → coordinator 标完成 → 进下个 unit
   - FAIL 同样问题连续 3 轮 → 回 spec 重规划，**不要硬磨**
6. **每个 unit completed 写一行到** `.harness/progress.tsv`
7. **任何想 skip 任何一项 acceptance 必须先 ask 用户**（行为底线）

## 不修的项（用户已表态 / 设计选择）

- Study Buddy AI 回帖**不**走审核（与 TaskBuildDraft 不同）
- 全局 seed 重做（用户决策：演示用 molly，造真实数据已完成）

## 风险登记

- Phase 4 各 unit 都不动 Phase 1-3 已完成的核心闭环（Anti-regression：每 unit 跑 vitest 1049 baseline 必须仍全过）
- Phase3-A bug 排查可能发现 transaction commit 时序问题，需深入 prisma client
- 用户可能在 Phase 4 期间 rewind 到之前对话点续作 — HANDOFF.md 已经同步 Phase 4 必做清单，rewind 后任何 session 接手读 HANDOFF 即可续作
