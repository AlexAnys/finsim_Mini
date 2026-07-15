# QA Report — R2 quiz 发布链修复 · r1

**Unit**: `r2-quiz`
**Round**: `r1`
**QA**: Opus (真浏览器 Claude Browser MCP + DB SELECT + 网络面板)
**Date**: 2026-07-15
**Branch**: `codex-quiz-publish-fix`
**总判**: ✅ **PASS (10/10)**

真浏览器全程 `localhost:3001`（未 kill/重启 dev server）。写操作只经 UI 真实流程（ZZQA2/ZZAUDIT 前缀，未 purge）；DB 只 SELECT。

---

## A. Spec 六条验收标准

### 1. 向导新建 quiz 创建并发布 → 201 / status=published — ✅ PASS
- teacher1 → ZZAUDIT 走查测试课程（有 CourseClass 链接，见下 §发现B）→ 向导新建 `ZZQA2 单选多选发布验证`：Q1 单选(2分, 正确 A)、Q2 多选(3分, 正确 A/B)，各留一个空 D 槽。
- 「创建并发布」→ 网络面板 `POST /api/lms/task-instances/with-task` **201 Created**。
- 响应体：task `91ad6465…`、instance `914145f7-ba00-486c-96b5-aed02ecef6a9`，`status:"published"`，`classId=e56c…(金融2024A班)`。
- **关键**：两题 payload 的 `options` 仅含 `A/B/C`——**空 D 槽被 `buildQuizQuestionPayload` 过滤掉**，未触发 `quizOptionSchema.text.min(1)`（即 F-PROD-06 根因已修）。
- DB 复核：`TaskInstance 914145f7` status=published，classId=金融2024A班，publishedAt 有值。

### 2. 重开既有 ZZAUDIT 草稿 → 发布成功 — ✅ PASS
- ZZAUDIT 草稿 `0340e2c4…`（卡片仍显示历史 stale `待补：答案与选项`，因该字段在旧代码保存时落库，修复不回写既有草稿——符合预期）。
- 点卡片打开向导直落第 4 步（所有步骤绿勾、准备就绪）→「创建并发布」→ `with-task` **201**。
- 响应：instance `70b2f21e…` status=published；Q1 payload options 仅 `A/B/C`（空 D 过滤）。
- DB：`TaskBuildDraft 0340e2c4` status `draft→published`（无草稿残留），instance published。

### 3. 草稿完整性不再误报 + 真缺答案仍被拦 — ✅ PASS
- **3a**（不误报）：把「2 道完整题 + 各含空 D 槽」存草稿 → 课程结构卡显示 `测验 · 待审核 · 2 题`，**无** `待补：答案与选项` 徽标。（对照修复前 F-PROD-15 会误报。）
- **3b**（真缺仍拦）：新建多选题只填题干+选项、**不标正确答案** → 「创建并发布」被 `handleSubmit` 门拦截，toast **`第 2 题缺少有效选项或正确答案，请补全后再发布`**，并回到配置步。补标 A/B 后再发布即 201。

### 4. 学生作答 → 自动判分 → 手算吻合 — ✅ PASS
- student1 作答 `ZZQA2 单选多选发布验证`：Q1 选 A（正确）；Q2 勾 {A,C}（错——正确是 {A,B}）。提交 → `提交成功，系统正在后台批改`。
- DB：`Submission` graded，**score = 2.00 / maxScore = 5.00**。
- **手算**：选择题 `grading.service.ts:389` 精确匹配 `JSON(selected.sort())===JSON(correct.sort())`，全或无。Q1 A==[A]→2 分；Q2 {A,C}≠{A,B}→0 分。合计 **2/5** = 自动分，完全一致。

### 5. 教师详情选项文字完整 + console 零 key error — ✅ PASS
- `/teacher/tasks/f673dba7-ea17-4aae-afd3-02a8d63baa18`：6 题 A-D 选项文字**全部完整渲染**（含正确项绿标），展示态与「编辑」态均正常（`{label,content}` 经 `normalizeStoredQuizOptions` 归一化）。
- console：硬刷后**零 error/零 warning**（仅 React DevTools info + HMR connected）。F-PROD-07（空 bullet）与 F-PROD-08（unique key）均已修（key 改 `${id}-${index}`）。

### 6. tsc 0 错 + vitest 全绿 + 回归 — ✅ PASS
- `npx tsc --noEmit` → **0 errors**。
- `QWEN_MODEL= npx vitest run` → **125 files / 1272 tests 全绿**（含新增 `tests/quiz-publish-payload.test.ts` 7 条）。（`QWEN_MODEL` 置空为 builder 说明的既有环境污染，与本 unit 无关。）
- 回归抽查：seed quiz 列表/详情正常、student1 dashboard 正常（7 待办渲染）。

---

## B. AI e2e 补测（关闭审计未尽事项 + 验 R0 换 key）

### 7. simulation 真对话 + AI 评分 + 教师端可见 — ✅ PASS
- 发布 `ZZQA2 理财顾问模拟对话`（with-task 201）。student1 进 `/sim/[id]` 与 AI 客户**真实对话 2 轮**：AI 回复真实返回、上下文连贯（准确回应投资期限/风险偏好追问），客户情绪 `犹豫→平静→放松`。
- 结束对话 → AI 评分完成，DB `SimulationSubmission.evaluation` = **85/100** + 详实评语（精准引用实际对话："识别客户风险偏好(稳健型)和投资期限(三五年)…70%低风险+30%定投…扣分点：未回应债券基金风险疑问，对话中断"）——证真 AI（MIMO 新 key 有效）。
- **教师端**：`/teacher/instances/3d847e45…` 提交列表见 张三 `已出分`、教师分 **85/100**、AI 初判 85、`已分析·未公布`。

### 8. subjective 提交 + AI 评分落库 — ✅ PASS
- 发布 `ZZQA2 理财观点简答`（with-task 201）。student1 提交一段分散投资简答 → AI 评分完成。
- DB `SubjectiveSubmission.evaluation` = **100/100** + 评语（"正确区分非系统性/系统性风险并给出恰当例子"），Submission graded 落库。

### 9. simulation/subjective 创建并发布路径 — ✅ PASS
- 三类任务的「创建并发布」均走同一已修 payload 逻辑：quiz / simulation / subjective 的 `with-task` 均 **201 Created**。审计未尽事项 3（sim/subj 是否共用已修路径）**确认共用且正常**。

---

## C. 反作弊检查（对修复本身）

### 10. 服务端校验未放松 — ✅ PASS
`git diff main..HEAD` 文件清单与 builder 报告一致，仅：
- `app/teacher/tasks/[id]/page.tsx`、`components/teacher-course-edit/task-wizard-modal.tsx`（前端）
- `lib/utils/quiz-question-payload.ts`（新增纯函数，**无 Zod / 无 schema**）
- `tests/quiz-publish-payload.test.ts`（新增测试）、build 报告

**无** route / validator / `schema.prisma` / migration 改动。`quizOptionSchema.text.min(1)`（task.schema.ts:64）与 `points.max(3)`（:74）**保持严格**——实测两条 400 仍从服务端触发，证明校验未被 optional 化/兜底掩盖。

---

## 发现的越界既有缺陷（非本 fix 引入，不阻塞本 unit，建议另开 unit）

**A) quiz 题 `points` UI/服务端不一致（中优先）**
`lib/validators/task.schema.ts:74` `points: z.number().int().min(1).max(3)`，但向导 UI 允许任意分值。首测把每题设 10 → `with-task` 400 `fieldErrors.task:["Too big: expected number to be <=3"]`。且改良后的中文 toast 把此错误误标为「任务内容不完整，请检查题目、选项和正确答案」（误导——真因是分值超上限，非内容缺失）。seed quiz 数据用 10-15 分是经 seeding 直插绕过了校验。改用 points≤3 后发布即成功，故本 unit 判 PASS，但该 cap 会挡住教师设"真实"分值的 quiz。

**B) `个人理财规划` 课 CLASS_COURSE_MISMATCH（数据模型不一致）**
该 seed 课 legacy `Course.classId=金融2024A班` 有值，但 `CourseClass` 表 0 行；`with-task` 按 CourseClass 校验 → 在该课发布**任何**任务均 400 `CLASS_COURSE_MISMATCH`「班级不属于该课程」（影响所有任务类型，与 quiz fix 无关）。`ZZAUDIT` 课 CourseClass 链接正常，发布成功。本 unit 的发布测试全部改在 ZZAUDIT 课完成。

---

## 状态
r1 PASS。建议 coordinator 走 PR 流程；发现 A/B 另开 unit 评估（尤其 A 的 points cap + 误导 toast）。
