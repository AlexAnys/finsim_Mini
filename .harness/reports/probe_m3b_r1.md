# Probe Report — M3b 测验 + 主观题 + Study Buddy r1

调研时间：2026-05-14
账号：teacher1@finsim.edu.cn / student1@finsim.edu.cn / admin@finsim.edu.cn
方法：源码静态分析 + Playwright (`playwright.review.config.ts`) 真浏览器走查；6 个 spec 全 PASS（详见 `.harness/screenshots/probe-m3b/`）

---

## 一、测验

### P0-Q1 自适应模式是空壳 —— 演示视频核心卖点缺实现
- 症状：演示 "学生少答题即可获得较全面的能力诊断"
- 实测：
  - `prisma/schema.prisma:395-408` `QuizConfig` 定义 `mode (fixed|adaptive)`、`maxQuestions`、`startDifficulty`、`difficultyStep` 四个自适应字段。
  - 全仓 `grep -rn "startDifficulty\|difficultyStep" --include="*.ts" --include="*.tsx"` 只命中 `lib/validators/task.schema.ts:48-49`（schema），**没有任何运行时代码读取/消费这些字段**。
  - `app/(student)/tasks/[id]/page.tsx:138` 把 `mode === "adaptive"` 强行映射为 `"practice"`（即 runner 内部的"练习模式"，仅意味着每题逐个确认、提交后立即出对错），与 fixed 模式行为差异仅在 UI 即时反馈，**没有任何能力诊断 / 难度自适应 / 提前结束逻辑**。
  - `components/quiz/quiz-runner.tsx:124` 仅做 `shuffleArray`，所有题按 order 顺序出。
- 根因：自适应只完成了 schema + UI 文案占位（向导里 `wizard-step-quiz.tsx:126` 写"自适应（按答对率出题）"），缺整个 IRT / CAT 选题引擎。
- 优化方向：
  - **短期**：UI 文案改成"练习模式（每题即时反馈，仅查漏）"，把"按答对率出题"删除以免误导；
  - **中期**：要么按 `startDifficulty + difficultyStep + 答对率` 实现规则式选题（最简贝叶斯/IRT-1PL），要么直接弃用这几个 schema 字段，让 Quiz 只支持 fixed 一种。

### P1-Q2 "AI 按知识点出新题"只用任务名描述，不读章节素材
- 症状：演示 "AI 按知识点出题"
- 实测：`components/task-wizard/ai-quiz-dialog.tsx:79-87` 调 `/api/ai/task-draft/quiz`；`app/api/ai/task-draft/quiz/route.ts:41-65` 的 prompt 入参只有 `courseName/chapterName/prompt`，**没有 `courseId/chapterId/sectionId`**，更不会去拉 `course-knowledge-source` 的实际素材。
- 同时存在另一条更完整的路径：`/api/ai/task-draft/from-context`（components/teacher-course-edit/task-wizard-modal.tsx:686）会调 `getKnowledgeSourcesForDraft` 把素材文本喂给 AI；但向导主入口"AI 出题"按钮（wizard-step-quiz.tsx:177）走的是无素材的简单路径。
- 根因：两条 AI 出题路径并存且无显式区分，向导默认绑了弱的那条。
- 优化方向：把 `wizard-step-quiz.tsx` 的"AI 出题"按钮也改走 `from-context` 路径，并在弹窗里强制要求先选 chapter/section + sourceIds 才能生成。

### P1-Q3 题库上传识别要走两步，体验割裂
- 症状：演示 "上传扫描件 → AI 识别 → 入库"
- 实测：
  - 教师在课程详情页点"上传题库"（`app/teacher/courses/[id]/page.tsx:1538`），POST 到 `/api/lms/course-knowledge-sources`（带 sourceType="question_bank"）；
  - 仅生成 summary + tags 入 `CourseKnowledgeSource` 表，**不自动写 QuizQuestion**；
  - 真正的题目结构化要等教师**再次**进入测验任务向导 → 选这个素材 → 触发 `/api/ai/question-bank` (action=import) 才会出题（lib/services/question-bank.service.ts:114-336）。
  - 也就是上传题库的人和创建测验任务的人即便是同一个，也要做两遍操作（一次上传等异步处理，一次再选素材跑 import）。
- 还有第二条上传路径 `/api/import-jobs` POST（app/api/import-jobs/route.ts:7）能直接将 PDF 转 QuizQuestion，但需要预先有 `taskId`，且当前 UI 没有入口调它。两条路径并存让识别流程很混乱。
- 根因：题库上传与题目入库被拆成两个生命周期。
- 优化方向：
  - 在 `course-knowledge-source.service.ts` 上传完毕后，对 `sourceType === "question_bank"` 自动触发 `runQuestionBankProcessing(action=import)` 把题目预解析到一个"未关联任务"的中间存储；任务创建时直接 "一键挂载"。
  - 或者把 `/api/import-jobs` 路径下线，避免误导后续开发。

### P2-Q4 "AI 优化原题"路径存在但 UI 不显眼
- 实测：`/api/ai/question-bank` action="checkOptimize" 走通（question-bank.service.ts:537-562 的 prompt 非常详尽，强制要求"补题 + 质检 issues + 拒绝抽象建议"），按钮在 `wizard-step-quiz.tsx` 的素材区附近，但和"AI 出题"并列，文案不直观。
- 优化方向：在题目列表每题悬停加"AI 优化此题"快捷按钮，引导教师按题级优化而非批量。

### P1-Q5 学生答题渲染选项已修但 short_answer 仍有边缘问题
- 已知 PR #4 修了 `{label,content}` vs `{id,text}` 两种 shape 兼容；`app/(student)/tasks/[id]/page.tsx:150-159` 通过 `o.label ?? o.id` / `o.content ?? o.text` 兜底。
- 边缘问题：seed.ts:354 把 true_false 题的 `correctOptionIds` 写成了 `["错误"]`（直接用中文标签作 ID），而 runner 内部按 `label`(A/B/正确/错误) 对比是 OK 的，但若一旦经过 `normalizeOptions` (question-bank.service.ts:504-509) 强制改为 `[{id:"A",text:"正确"},{id:"B",text:"错误"}]`，则原 seed 数据的 `correctOptionIds:["错误"]` 永远不会匹配。**导入路径与种子数据 ID 形态不一致，是后续题库迁移的潜在地雷**。
- 优化方向：seed 改用 `["B"]`，统一 ID 用 A/B；写一个数据修复脚本扫库归一。

---

## 二、主观题

### P1-S1 `allowedAttachmentTypes` 配置被忽略 —— 老师设的"只准上传 pdf"在前端形同虚设
- 症状：`SubjectiveConfig.allowedAttachmentTypes` 是 `String[]`，老师可以勾选 pdf/docx/jpg 等。
- 实测：
  - `components/subjective/subjective-runner.tsx:99` 把允许列表写死为常量 `ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "xlsx"]`。
  - `app/(student)/tasks/[id]/page.tsx:181` 只用 `allowedAttachmentTypes.length > 0` 决定要不要展示上传区，没把数组本身传给 runner。
  - 结果老师即便配置 "只允许 pdf"，学生仍能上传 docx/jpg 等，validation 仅看常量名单不看后端配置。
- 根因：interface `SubjectiveRunnerProps.taskConfig` 缺 `allowedTypes` 字段；page.tsx 没把数据透传。
- 优化方向：runner 加 `allowedTypes: string[]` 入参；page.tsx 把 `task.subjectiveConfig.allowedAttachmentTypes` 传进去；`validateFile` 改成读这个 prop。

### P1-S2 "拍照上传"在移动端没启用 native camera
- 症状：演示 "学生可以网页输入 / 文件 / 拍照上传作答"
- 实测：`components/subjective/subjective-runner.tsx:572-582` 的 `<input type="file">` **没有 `capture` 属性**，accept 也未单独列出 `image/*`。移动浏览器（Safari/微信内）会让用户从相册里选，不会主动唤起相机。
- 根因：未做移动端拍照场景。
- 优化方向：加 `<input type="file" accept="image/*" capture="environment">` 或额外加一个"拍照"按钮（`react-webcam`），上传后并入附件列表。

### P2-S3 老师复核能 override AI 分，但 UI 没显示"AI 原分"
- 实测：`app/api/submissions/[id]/grade/route.ts:21-90` 的手工批改 POST 接口可写入新分；merge `evaluation`（line 42-64），强制 audit（line 73-86 `logAuditForced action="submission.grade"`）。
- 缺：`components/instance-detail/grading-drawer.tsx` UI 是用一个文本框 + 数字，让老师 override；但没有同框对比 "AI 给的分 vs 老师改的分"，也没标"已被教师覆盖"badge。
- 优化方向：UI 显示 AI 原分 + 老师新分两行；列表页加"已人工调整"标签。

### P2-S4 附件 OCR/解析未覆盖 jpg/png
- 实测：`lib/services/document-ingestion.service.ts` 的 OCR 主要走 pdf/docx 路径；附件上传后写入 `SubjectiveSubmission.extractedText`，但若学生上传的是手写图片（拍照路径），grading 输入 `combinedText = textAnswer + extractedText`（grading.service.ts:508）拿到的 extractedText 可能为空，AI 直接打 0 分（line 510-530）。
- 优化方向：与 P1-S2 配套，确保拍照路径必有 OCR。

---

## 三、Study Buddy

### P0-SB1 现存 3 条 post，2 条 "未关联课程 + 回复失败"
- 实测：student1 登录 `/study-buddy`，左侧列表 3 条 post：
  - "nihao" 个人理财规划 引导式 — answered（一切正常）
  - "123" 未关联课程 引导式 — **回复失败** (status=error)
  - "深度" 未关联课程 匿名 — **回复失败**
  - 截图：`.harness/screenshots/probe-m3b/30-study-buddy-page.png`
- 根因 A（未关联课程）：`lib/utils/study-buddy-transforms.ts:128-162` 通过 client-side join 把 dashboard.summary 的 task.id 映射到 post.taskInstanceId；如果 instance 被 archive / 不在 dashboard 返回集合，就退化成 "未关联课程"。**没有服务端兜底**——服务端 `study-buddy.service.ts:222` 的 `findMany` 没 include `taskInstance.course.courseTitle`，导致客户端缺数据。
- 根因 B（回复失败）：`study-buddy.service.ts:174-180` catch 后只把 status 转 error，前端**没有重试入口**。
- 优化方向：
  - service 改 include 把 course/chapter/section title 透传，避免依赖 dashboard summary；
  - UI 加 "重试" 按钮 + 错误原因展示（教师把 AI 没配 key 当回事）。

### P1-SB2 "有据可查"实际只展示文件名，没有原文摘录或定位
- 实测：`components/study-buddy/study-buddy-message.tsx:85-109` 的 `contextSources` chip 渲染了 `scopeLabel + fileName`（如 "课程 / 财富管理-理财基础.pdf"），但没有 `excerpt`（原文片段）和 `page`。
- 而 `study-buddy.service.ts:104-119` 的 `materialSources` 里实际有 `summary` 和 `excerpt`（来自 `getKnowledgeSourcesForStudyBuddy`），传给 AI 用了，但**没回写到 `contextSources` 持久化字段**（line 104-109 只 map 4 个字段）。
- 演示视频原话 "有据可查的回答" 实现 50%——能看到引用哪个文件，看不到引用文件的哪段。
- 优化方向：`generateReply` 把 excerpt 也写进 `contextSources`；message UI 增加 hover 展开摘录。

### P1-SB3 章节上下文区分 —— 不可手选，强绑定 taskInstance
- 症状：演示 "学生选不同章节问同一问题，回答不一样"
- 实测：`StudyBuddyNewPostDialog`（被引入 `app/(student)/study-buddy/page.tsx:340-354`）只让学生选 taskInstance（已发布任务），章节是从 instance 派生的（非显式选）。
- 若学生没有任何已发布任务，根本无法创建 post（page.tsx:198-204 `当前学期暂无可关联的任务，无法发起对话` 阻拦提示）。
- 章节"不一样"的回答能力依赖教师上传了章节级素材 + instance 绑了 chapter；现实里很多 instance 没绑 chapter（schema 允许 nullable），落到课程级素材兜底，效果上和不区分章节差不多。
- 优化方向：把入口扩展为"按课程+章节自由提问"模式，post 直接绑 chapter 而非 task，给出独立的"非任务相关提问"分类。

### P2-SB4 教师侧"提问反哺学情分析"已落地但入口偏深
- 实测：教师 `/teacher/courses/[id]` 页面有 `<CourseStudyBuddyAnalyticsTab>`（`components/course/course-study-buddy-analytics-tab.tsx`），调 `/api/lms/study-buddy/analytics?summarize=true` 走 `generateSummary`（study-buddy.service.ts:238-286），AI 输出 topQuestions + knowledgeGaps + teachingSuggestions。
- 缺：教师 dashboard 顶层没看到"本周 Study Buddy 高频提问"卡片，必须进单门课程才能看到（M1 探索时未在 `/teacher/dashboard` 看到）。
- 优化方向：dashboard "一周洞察" 卡片增加 Study Buddy 高频提问 Top3。

### P2-SB5 service 调 AI 用任务创建者的 settings，但任务可能与发问学生无关
- 实测：`study-buddy.service.ts:145` `settingsUserId: taskInstance?.createdBy || task.creatorId || userId`。如果学生跨班关注同课不同实例，settings 仍归原任务老师；当教师 A 没配 AI key、教师 B 配了，学生选 A 的任务必失败 —— 与 P0-SB1 失败现象吻合。
- 优化方向：fallback 顺序加上 "课程 owner 教师"或 system default provider。

---

## 优先级总结

| 优先级 | 模块 | 项 | 简述 |
|---|---|---|---|
| P0 | 测验 | Q1 | adaptive 模式是空壳，schema 字段无运行时实现 |
| P0 | Study Buddy | SB1 | 3 条 post 2 条失败 + "未关联课程"占位泛滥（service 没 include 兜底） |
| P1 | 测验 | Q2 | AI 出题主入口不读章节素材 |
| P1 | 测验 | Q3 | 题库上传需两步，识别路径割裂 |
| P1 | 测验 | Q5 | seed/库内题目 ID 形态不统一，未来题库迁移地雷 |
| P1 | 主观题 | S1 | `allowedAttachmentTypes` 配置被前端忽略 |
| P1 | 主观题 | S2 | 拍照上传未唤起原生相机 |
| P1 | Study Buddy | SB2 | 引用只显示文件名，缺原文 excerpt |
| P1 | Study Buddy | SB3 | 章节上下文不能手选，强绑 taskInstance |
| P2 | 测验 | Q4 | AI 优化原题入口不显眼 |
| P2 | 主观题 | S3 | 教师 override 缺 AI 原分对比 UI |
| P2 | 主观题 | S4 | jpg/png 附件 OCR 链路不健全 |
| P2 | Study Buddy | SB4 | 教师 dashboard 缺顶层 Study Buddy 高频提问 |
| P2 | Study Buddy | SB5 | settingsUserId fallback 不健壮，跨教师场景失败 |

---

## 关键证据文件
- 截图：`.harness/screenshots/probe-m3b/01..40-*.png`
- Probe spec：`tests/e2e/probe-m3b.spec.ts`（6 specs PASS）
- 核心代码引用：
  - `app/(student)/tasks/[id]/page.tsx:138` (adaptive→practice 映射)
  - `lib/services/question-bank.service.ts:114-336` (题库 import 主流程)
  - `lib/services/study-buddy.service.ts:68-181` (Study Buddy generateReply)
  - `components/subjective/subjective-runner.tsx:99,572-582` (硬编码 ALLOWED_EXTENSIONS + 无 capture)
  - `components/study-buddy/study-buddy-message.tsx:85-109` (引用仅显示 fileName)
