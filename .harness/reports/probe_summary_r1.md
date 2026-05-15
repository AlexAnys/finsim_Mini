# Probe Summary — 演示视频逐字稿 v2 全模块 E2E + 代码审计 r1

调研日期：2026-05-14 ｜ 5 路 probe agent 并发完成 ｜ 工作目录 `/Users/alexmac/Documents/Mini 项目开发/finsim v2/finsim`

5 份 detail 报告：
- `.harness/reports/probe_m1_r1.md` (仪表盘+一周洞察)
- `.harness/reports/probe_m2_r1.md` (课程材料工作台)
- `.harness/reports/probe_m3a_r1.md` (模拟对话)
- `.harness/reports/probe_m3b_r1.md` (测验+主观题+Study Buddy)
- `.harness/reports/probe_m4_r1.md` (数据洞察+教师主导原则)

证据：≥50 张截图（`.harness/screenshots/probe-m*/`）+ 6 套 Playwright spec（`tests/e2e/probe-m*.spec.ts`）+ DB 直查。

---

## 一句话结论

**核心闭环都跑得通，但演示视频里反复强调的几个"看点"在当前数据 + 部分代码下无法被自然观察到**，需要分两批修：
- 第 1 批（不动代码 / 改 seed + UI 文案 + 节流）— 快速止血让演示稳。
- 第 2 批（动产品语义 + 加新流程）— 把"AI 待审核 + 留痕"、"自适应模式"、"引用原文"这些**承诺**真正实现到位。

---

## P0（11 项，按"是否撕裂演示叙事"归类）

### A. 演示翻车风险（seed/口径问题，没有 hard 代码 bug 但故事破）

| # | 模块 | 现象 | 推荐方向 |
|---|---|---|---|
| A1 | 仪表盘 | 「一周洞察」过滤条件要求批改 + 已 release，演示 teacher1 23 条 graded 中 7/10 未 release → 报告 100% 走空数据降级，AI 自写"过去 7 天无提交" | 改 seed 给一部分 graded 写 releasedAt；或前端检测空数据时不调 AI，直接显示"先去公布成绩"CTA |
| A2 | 仪表盘 | 任务列表 17 条全部"已过期"红色 badge，完成度 0/10，体验不像"进行中" | seed 一批未来 dueAt + 部分已 submitted 的实例 |
| A3 | 课程材料 | 演示原话"学生问 AI 时会引用上传教案" — 实测 contextSources=[]，因为 11 份 syllabus 都堆在没班级的课程，有学生的 3 门课全 0 sources | seed 把 syllabus 迁到有学生班级的课，加 smoke 测确认 contextSources>0 |
| A4 | 课程材料 | 全 DB ContentBlock=0，所有 section × 课前/课中/课后 网格 100% 空，老师首进零样例 | seed 在 demo 课塞 5-10 个 block 做示范 |
| A5 | Study Buddy | student1 现存 3 条 post 中 2 条 status=error + "未关联课程"，进 demo 立刻看到失败 | service 改 include 把 course/chapter title 透传；UI 加重试按钮；这一项依赖 SB5（settingsUserId fallback） |
| A6 | 数据洞察 | 默认 scope 任务表现 + Study Buddy 共性问题都"暂无数据"，演示需手动切换才有内容 | seed 演示数据 ≥3 simulation graded + 5 study-buddy post；空态文案改"切到 X 课" |

> A 类小结：6 个 P0 全都跟 **seed 数据 + 空态降级文案** 强相关。一次 seed 重做 + 空态友好化基本能全清。

### B. 核心承诺与代码不符（"不实陈述"风险）

| # | 模块 | 现象 | 推荐方向 |
|---|---|---|---|
| B1 | 测验 | 「自适应模式」schema 有 4 个字段（mode/maxQuestions/startDifficulty/difficultyStep），全仓 grep **运行时零消费**，runner 仅 adaptive→practice 多了"每题即时反馈"。演示原话「少答题即可获得较全面的能力诊断」**无任何实现** | **二选一拍板**：① 短期改演示话术 + UI 文案删除"按答对率出题"（避免误导）；② 中期真做最简贝叶斯/IRT-1PL 选题引擎，按答对率出难度 |
| B2 | 模拟对话 | 演示「对话原文与评分依据全程留痕，量规可见 quote 学生原话」— 实际 rubric.comment 是自由段落，prompt 仅"建议引用原文"，schema 没有 quote 字段，AI 行为不稳定 | rubric schema 加 `evidence: [{studentText, comment}]` 数组字段；prompt 强制每项 ≥1 引用；grading.service 加 post-process 校验 |
| B3 | 教师主导 | 演示「所有 AI 生成内容默认待审核」— 实测：① TaskBuildDraft 状态机无 approved 中间态、PATCH 直接发布无 audit、无 AI vs 教师编辑 diff；② Study Buddy AI 回帖（DB 5 条 succeeded）**直接对学生可见**，schema 无 releasedAt/approvedBy | TaskBuildDraft 加 aiPayload/editedPayload + approve 端点；Study Buddy AI 回帖落库默认 visibility=pending；都纳入审计 |

> B 类小结：3 个 P0 都是「演示承诺 vs 代码实现」的 gap。B3 体量最大（动两个表 + 2 个 UI flow）；B2 中等（schema + prompt + UI 渲染）；B1 是选择题。

### C. 稳定性/资源安全

| # | 模块 | 现象 | 推荐方向 |
|---|---|---|---|
| C1 | 仪表盘 | 一周洞察连续点 force=true 真烧 LLM（实测 19/15.5/15.7s 各一刀），前端只 disable 按钮，**服务端无任何节流** | 服务端按 teacherId + featureKey 60s 节流；UI 加 cooldown 倒计时 |
| C2 | 数据洞察 | `kpi-row.tsx` 外层 `<button>` 包整卡 + 卡内 info tooltip 也是 `<button>` → 每次进 analytics-v2 控制台报 `<button> cannot be a descendant of <button>` 2 条 hydration error | 外层改 `<div role="button" tabIndex={0}>` 或 info 改 `<span>` |

---

## P1（约 24 项，按模块归类，每项一句）

### 仪表盘
- 近期课表卡同 slot 同时段重复 3 次（buildUpcomingSchedule 未去重）
- KPI「待批 0」与 service stats.pendingCount=2 不一致（同一指标双口径）
- 0 数据时 LLM 仍硬编 6 条机械重复"下周建议"（prompt 缺空数据约束）
- 24s loading 仅 spinner，无渐进进度感知
- 一周洞察 modal 内不显示 model / token / 耗时 — 与"AI 留痕"承诺脱节

### 课程材料
- Study Buddy 强制选关联任务（schema taskId 必填），无"自由问课程"路径 — 与演示"基于课程材料自由提问"话术不符
- 协作教师 dialog 不显示现有协作者列表（API 有，UI 没暴露 remove）
- 协作教师 / 多班 dialog 缺"能改什么不能改什么"说明
- 上传 file accept 类型在 syllabus dialog vs 通用上传两处不一致

### 模拟对话
- `/teacher/tasks/new` 渲染 404（必须从课程进入向导）
- 学生 `/tasks` 404，没有"我的全部任务"列表（仅 dashboard 卡片入口）
- 评分 rubric 未结构化"引用学生原话"（见 B2，同条）

### 测验+主观题+Study Buddy
- AI「按知识点出新题」走 `/api/ai/task-draft/quiz`，**不传 courseId/chapterId、不读 knowledge sources**，章节素材形同虚设；另有 `from-context` 路径才真用素材
- 题库上传识别**两步流程**：先入 course-knowledge-source 再创建测验任务时再触发 question-bank import，体验割裂
- seed/库内 true_false 题 `correctOptionIds: ["错误"]` vs `normalizeOptions` 转 `["B"]`，ID 形态不统一 → 后续题库迁移地雷
- 主观题 runner 硬编码 ALLOWED_EXTENSIONS，**忽略 SubjectiveConfig.allowedAttachmentTypes** — 老师设"只准 pdf"前端形同虚设
- 主观题拍照 `<input type=file>` 缺 `capture="environment"`，移动端不会唤起原生相机
- Study Buddy contextSources 只展示文件名，service 拿到的 excerpt 没回写持久化 — "有据可查"实现 50%
- Study Buddy 章节上下文不可手选（强绑 taskInstance），无任务的学期完全无法提问

### 数据洞察+教师主导
- 演示话术"4 维度建议"代码实际 5 块（knowledge / skill / pedagogy / focusGroups / **nextSteps**） — 话术与代码不一致
- analytics-v2 scope-insights cache TTL=24h，"重新生成"按钮可能命中 cache 不刷新
- filter bar 信息密度低（任务类型 / 实例 / 计分口径 / 时间全藏 popover）
- AiRun 表缺 `inputTokens/outputTokens/summary` 字段（无法做成本分析 + 回溯）；DB 有 1 条 evaluation status=running 卡死未结束
- **AiRun 表只写不读** — 教师/admin 端无任何 UI 可查 AI 调用历史 / AuditLog（`/admin`、`/api/admin/audit-logs`、`/api/lms/ai-runs` 全 404）

---

## P2（约 16 项，polish 不阻塞）

- 仪表盘 modal 移动端溢出；缓存命中态"重新生成"无 cooldown；LLM 错误降级文案太通用
- 课程：+任务/+块 按钮 10.5px 太小；"次班"术语费解；课程列表"待批改"含义模糊
- 模拟对话：教师查对话原文路径深、客户情绪条未利用、30 轮硬截断无提示、语音降级无备选 CTA
- 测验/主观：「AI 优化原题」入口不显眼；老师 override 缺 AI 原分对比 UI；jpg/png OCR 弱
- StudyBuddy：教师 dashboard 缺顶层高频提问卡；settingsUserId fallback 不健壮（同 A5 根因）
- 数据洞察：recompute 完成无 toast
- 教师主导：`ENABLE_AUDIT_LOGS` env 可让普通 audit 失活（仅 logAuditForced 不受控）

---

## 建议的修复批次（你拍板用）

### Batch 1 「演示稳定化」 — 1-2 工作日，不动产品语义
- **Seed 重做**：A1-A4-A6（一次 seed 修正搞定 weekly-insight 数据可见 / 任务非全过期 / Syllabus 挂到有学生的课 / ContentBlock 样例 / 数据洞察默认非空 / Study Buddy post 自愈）
- **节流 + 修 hydration**：C1 + C2
- **空态友好化 + UI 文案不实陈述临时修**：A1 空态 CTA、B1 删 UI 误导文案、P1 LLM 空数据建议不调用

→ **预期效果**：演示视频脚本能从头到尾不卡壳，所有"看点"自然呈现。

### Batch 2 「兑现核心承诺」 — 5-8 工作日，动产品语义
- **B2 评分依据结构化**：rubric schema 加 evidence + UI 渲染对话引用气泡
- **B3 审核闭环**：TaskBuildDraft 加 approved 中间态 + AI vs 编辑 diff + audit；Study Buddy AI 回帖 visibility=pending + 教师审核 UI
- **AI 留痕**：补 inputTokens/outputTokens/summary 字段 + 教师 `/teacher/ai-usage` 列表 + admin `/admin/audit` 视图（PR-3）
- **AI 出题真读章节素材**：把 `wizard-step-quiz.tsx` 的"AI 出题"走 from-context 路径，强制选 chapter/sourceIds
- **Study Buddy 引用 excerpt 持久化**：generateReply 把 excerpt 写进 contextSources 持久化字段

→ **预期效果**：演示视频里说的"待审核"、"评分依据可 quote 原话"、"AI 留痕模型/耗时/摘要"、"按章节出题" 4 项核心承诺全部能在 UI 上自然看到。

### Batch 3 「次要短板」 — 3-5 工作日，按余力做
- 主观题 allowedAttachmentTypes / capture / OCR 全套
- Study Buddy 自由问课程路径（非任务相关分类）
- 自适应模式（B1 中期方案，如选做）
- 协作教师 dialog 完整化（现有列表 + 权限说明）
- 课表去重、KPI 口径统一、filter bar 提升、AI 错误降级分级、移动端样式

### Batch 4 「polish」 — 随手做
P2 全部。

---

## 需要你拍板的决策点

1. **B1 自适应模式**：① 改文案承认是"练习模式"（低成本，但弱化卖点）；② 真做选题引擎（≥3 天工作量）。**选哪个？**
2. **P1 Study Buddy 自由问课程**：① 改演示话术，承认必须挂任务；② 真做"非任务相关提问"通道（≥2 天）。**选哪个？**
3. **A 类 seed 重做**：是否允许重写 `prisma/seed.ts`？这会让现有 demo 数据全部刷新（admin/teacher/student 账号保留，但课程结构 / 任务 / 提交都会重生成）。
4. **B3 审核闭环范围**：Study Buddy AI 回帖加"待审核"会让学生**问完不能立刻看到 AI 回答**（教师审通过才看到）— 这对演示视频"学生随时提问"叙事有否冲突？是否改为"先回学生 + 教师事后可撤回"的弱审核模式？

---

## 下一步（等你拍板）

确认上述 4 个决策点 + 选定 Batch 范围 → 我会写新的 `.harness/spec.md` 把 Batch 1（或 1+2）拆成 unit，开 build/qa 团队走 harness 流程修。每个 unit Builder 实现 → QA 真浏览器独立验证 → dynamic exit（连续两次 PASS 收工，三连 FAIL 回 spec）。
