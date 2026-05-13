# 自动化输入流 Review（Stream B）

日期：2026-05-13 · 范围：`document-ingestion.service.ts` + `course-knowledge-source.service.ts` + `task-build-draft.service.ts` + `question-bank-regex.service.ts` + `question-bank.service.ts` + `app/api/ai/task-draft/*` + `app/api/ai/question-bank/*` + `app/api/lms/courses/[id]/outline-{import,apply}` + 教师课程编辑器 · 实测：dev server + Playwright/Chromium，teacher1 账号 + 3 份测试大纲 / 题库 markdown。

## 这块功能在干嘛

老师把 `.docx` / `.pdf` / `.md` 大纲传到课程里，文档解析层（PDF 文字层 + DOCX mammoth + 表格 XLSX + ZIP 拆包 + 图片/扫描件 Qwen-VL OCR）把文本抽出来；然后 AI 分两路过：先做"摘要+概念标签"，syllabus 类还会再过一遍生成 **章/节/学习目标/任务建议** 的结构化目录草稿，存进 `CourseKnowledgeSource.structuredData`。老师可以在 UI 编辑目录、点"安全合并"把新增章节并入课程结构。同时这层素材也喂给后面的 AI 任务草稿（quiz / subjective / simulation）和题库导入 —— 题库这条线有 regex 直抽（80% 中文题库格式）+ AI 兜底两路。

## 实测发现

- 🟢 **整齐 markdown 大纲 100% 识别准确**：传 3 章 × 2 节的 `/tmp/finsim-test-syllabus.md`，AI 返回的 `structuredData.chapters = [财务管理导论, 资金的时间价值, 投资决策]`，`sectionCounts = [2, 2, 2]`，全对（log `AUTO-02-poll`）。从上传到 `status:ready` 约 **75 秒**（31 次轮询 × 2.5 秒）。摘要写得相当合理："本课程覆盖财务管理基础原理…重点讲解资金的时间价值…"。
- 🟢 **格式很烂的大纲也能救回来**：`/tmp/finsim-test-syllabus-bad.md`（6 行混杂中英文、没明确层级）AI 居然抽出 3 章 `[财务导论, 货币的时间价值, 投资决策]`（log `AUTO-05-poll`），约 95 秒。容错性比预期高，但**没有 confidence 字段告诉老师"这次抽得很勉强"** —— 老师可能误信乱解析的结果。
- 🟢 **题库 regex 直抽完美工作**：传一份 4 题混合（单选 + 多选 + 判断 + 简答）markdown，`/api/ai/question-bank` 返回 `"通过结构化解析直接识别 4 题（共扫到 4 个题块）"`，**confidence=1.0，887 ms，零 AI 调用**（log `AUTO-04-qbank-import`）。`question-bank.service.ts:175` 的"regex 高置信 → 跳过 AI"逻辑省钱省时。
- 🟢 **AI 任务草稿三种类型都能跑通**：quiz/subjective/simulation 草稿都返回结构完整的 JSON（log `AUTO-03-*`）。响应时间 43-50 秒，内容质量合理（NPV 单选题选项设计正确、主观题给了完整评分标准、simulation 给了客户人设和开场白）。任务草稿是同步 API，老师点了"AI 生成"得等 ~45 秒，**没有进度条**，只有 spinner。
- 🟡 **大纲编辑只有"安全合并"一条路，不能删/改/拖排序**：UI 提供 inline 编辑章节标题（`outlineDraftEditors` local state），但 `outline-apply` API（`route.ts:107-144`）的逻辑只**新增缺失章节**，**不删除、不重命名、不重排**已有章节。注释里也明说："不会删除、重命名或覆盖已有章节、小节、任务和提交。" —— AI 识别错了一个章节名，老师改完点"安全合并"只会**再新增一个**（原错章节还在）。
- 🟡 **大纲解析失败/异常对老师不透明**：`course-knowledge-source.service.ts:447-453` 摘要 + 目录两个 AI 调用任一失败，只是把 `error` 字段写一句"课程大纲解析暂不可用"，状态留在 `ai_summary_failed`；UI 显示"文本可用"，**不告诉老师目录到底有没有 / 错了什么**。教师没有"重试 AI 解析"的按钮 —— 只能删掉重传。
- 🟡 **2 个 AI 调用串行，syllabus 上传等 75-95 秒**：`processCourseKnowledgeSource` 串行调 `aiGenerateJSON("taskDraft", ...)` 两次（行 347 摘要 + 384 outline）。两个调用其实可并行，可省一半时间。
- 🟡 **大纲编辑"未保存即丢"**：`outlineDraftEditors` 是 `useState` 局部对象，老师编辑章节名后**不点"安全合并"刷新页面就全没了** —— 没有"保存草稿"按钮。
- 🟡 **`outline-import` 路由把所有上传强制标 `sourceType:"syllabus"`**（route.ts:46），但 UI 文案是"上传大纲"。如果老师其实想传"教材正文 / 题库"，被这个路由处理就会触发不必要的 outline 提取（耗 1 次额外 AI 调用 + ~30 秒）。题库上传走的是同一个端点（实测 AUTO-04 通过它传题库 markdown），不必要触发了 syllabus 解析 + 失败兜底。
- 🟢 **AI 失败 + regex 撑场**：question-bank `import` 路径若 AI 报错但 regex 已识别 ≥3 题，仍能完成导入（`question-bank.service.ts:282-289`），提示语会包含"AI 未能调用…但已通过结构化解析直接导入 N 题"。这个 fallback 设计合理。

## Code Review 发现

- 🔴 **`outline-apply` 只会 add，永远不会 update/delete**（`route.ts:106-145`）：教师可以编辑 outline 草稿（局部 state），但 server 端 merge 只看"标题不在现存表里就 create"，不处理改名 / 删除 / 重排。**这等于把"修正"功能做成"再添加"**。
- 🔴 **`outline-import` route 强写 `sourceType:"syllabus"`**（`route.ts:46`），UI 唯一上传按钮文案"上传大纲"。但**老师上传题库 docx/xlsx 时没有独立入口** —— `app/api/lms/course-knowledge-sources/route.ts` 有更通用的 POST，但 UI 没接它。结果：题库被打了 syllabus 标 → 触发 AI outline 抽取 → 抽出垃圾 → 状态变成 `ai_summary_failed`。
- 🟡 **document-ingestion 单测仅 2 个**（`tests/document-ingestion.test.ts`），但 `extractDocumentText` 覆盖 PDF / DOCX / XLSX / ZIP / OCR 五种分支 + `isReadableExtractedText` 判 PDF artifact 的 regex 阈值 —— **5 个分支 2 个测试，盲区大**。OCR 失败兜底、ZIP 递归限制、损坏 PDF 等场景没覆盖。
- 🟡 **`question-bank-regex` 单测 14 个，质量很好**（覆盖标号式 / 题型标记 / Markdown / Q1 形式 / 判断题 / 简答题 / 缺答案 / 续行等），实测 confidence=1.0 也说明它真能用。但 service 里 regex 阈值 0.7（`question-bank.service.ts:166`）和 0.6（regex 内部封顶）是 magic number，没注释为啥。
- 🟡 **`processCourseKnowledgeSource` 两个 AI 调用串行 + 没超时**：syllabus 上传 75-95 秒 90% 是这两步。`Promise.all` + AbortController 30s 上限可省一半时间。
- 🟡 **`structuredData` 是 `unknown` 类型**（schema.prisma 里 Json + 服务层 `as never`），消费方都得各自再 zod 解一次（outline-apply 重新定义了几乎相同的 schema 行 14-58）—— 两份 schema 漂移风险。
- 🟢 **OCR provider 配置降级路径清晰**（`document-ingestion.service.ts:344-351`）：先看 `OCR_PROVIDER`，再看 `QWEN_API_KEY` / `MIMO_API_KEY`，都没有就明确报"未配置"中文错。OCR 失败状态 `ocr_required` 是独立态，区分得很好。
- 🟢 **题库 import 失败时错误信息分得很清**（`question-bank.service.ts:282-289`、`339-346`）："AI 未配置 API key" / "AI 调用已限流" / "AI 响应超时" / "AI 返回格式不完整" / "AI 服务异常" —— 老师能看懂大概是哪儿挂了。
- 🟢 **regex pipeline 单元可测、纯函数**（`question-bank-regex.service.ts` 顶部注释明确），架构干净。

## 建议

1. 🔴 **`outline-apply` 加 `mode:"replace"` 或 `mode:"update"`**：让老师能改章节名 / 调顺序 / 删多余章节。当前的"只 add"语义对 AI 错抽的场景救不回来，老师只能弃用大纲功能。
2. 🔴 **拆 syllabus 和 question-bank 上传入口**：要么在 outline-import route 加 `sourceType` 参数（默认 syllabus），要么 UI 增加"上传题库"按钮直接调 `/api/lms/course-knowledge-sources`。当前 UI 强制所有上传走 syllabus 解析 —— 浪费 AI 调用 + 误导状态。
3. 🟡 **syllabus 处理并行 + 限时**：`Promise.all` 把摘要和 outline 两步并发，加 30s AbortController，单上传从 75-95 秒压到 ~40 秒；超时给老师"重试"按钮。
4. 🟡 **大纲编辑加"保存草稿"按钮 + AI 解析失败重试**：现在编辑只存 React state，刷新即丢；老师碰一次会留下"不靠谱"印象。失败的 source 需要"重新 AI 解析"按钮（参考 `retryAsyncJob` 已实现），不要只能删掉重传。
5. 🟢 **document-ingestion 补 OCR 失败 / 损坏 PDF / ZIP 嵌套这几个分支的单测**：现在 2 个测试覆盖 5 个分支，生产出 bug 不容易复现。

---

**实测产物**：
- 测试脚本：`tests/e2e/review-automation.spec.ts`（5 个用例：课程入口 / 大纲上传 + 识别 / 三种 AI 草稿 / 题库 regex 导入 / 恶劣大纲容错）
- 截图：`.harness/screenshots/review-2026-05-13/automation/01-teacher-courses.png`、`01b-course-edit.png`、`02-syllabus-recognized.png`
- 测试输入：`/tmp/finsim-test-syllabus.md`（3 章 × 2 节标准）、`/tmp/finsim-test-syllabus-bad.md`（6 行混乱）、`/tmp/finsim-test-questions.md`（4 题混合）
- 关键日志：
  - AUTO-02：syllabus 上传 → 大纲 chapter/section 数 = `[2, 2, 2]`，3 章名全对，77s
  - AUTO-03：quiz/subjective/simulation 草稿响应 43-50s，结构完整
  - AUTO-04：4 题 regex 完美识别，confidence=1.0，887ms（零 AI 调用）
  - AUTO-05：6 行乱码大纲仍救出 3 章，95s
