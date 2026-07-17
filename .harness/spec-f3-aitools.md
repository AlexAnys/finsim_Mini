# Spec — F3 AI 助手 4 工具完善（Codex 单元）

> 流水线：Fable5 plan → Codex 执行 → Opus 真浏览器验收。根因详见只读报告（绝对路径）：
> `/Users/yangsenan/dev/Finsim-Mini/.harness/reports/staging-findings-2026-07/ai-assistant.md`（含 4 工具真实测试 AsyncJob 结果对照表）

## 背景（用户质疑对了一半）
教师端 AI 助手（/teacher/ai-assistant）4 工具（教案完善/思政挖掘/搜题与解析/试卷检查）。调查证实：后端**各自独立**（独立 prompt/模型/温度/渲染），真跑差异化——"四个返回同质内容"被证伪。但用户观察属实的三点：①"界面一模一样"（共用输入表单）②"搜题"缺核心能力 ③一个污染 bug。

## 用户已定决策：搜题走 **B（止血改名，不接搜索）**
不引入联网检索。把假开关去掉、工具正名。

## 范围（IN）
文件：`lib/ai/prompts/work-assistant.ts`、`lib/services/ai-work-assistant.service.ts`、`components/ai-assistant/*`、`app/teacher/ai-assistant/page.tsx`。

### F-AIT-01（P1）· 搜题与解析正名 + 移除假搜索开关（决策 B）
- 现状：全仓无任何联网检索实现，`SEARCH_PROVIDER` 只算个 flag；"请求搜索增强"开关（page.tsx:444-450 + 设置抽屉）是纯 prompt 标记位，拨了也不搜。
- 修复：工具「搜题与解析」→ **「题目解析」**；`desc` 改为「识别题型、知识点、解题步骤与易错点」；移除"请求搜索增强"开关及其在设置抽屉/service 里的 searchStatus/enableSearch 相关标记位（不再向 prompt 承诺搜索）。解析质量本身高，功能不缩水。

### F-AIT-02（P2）· 消除跨工具 gradingTable 污染
- 现状：4 工具共用同一 userPrompt + 同一 `workAssistantResultSchema`（含 gradingTable）；实测教案完善被模型填了虚构学生批改表，`lesson-polish-result.tsx:37` 无条件渲染 → 教案里冒出"示例学生A/B 得分表"。
- 修复：按 `toolKey` 生成不同输出契约——只有 examCheck（试卷检查）索要/渲染 gradingTable；教案完善/思政挖掘/题目解析的 prompt 去掉 gradingTable 段，且对应渲染组件不渲染它。

### F-AIT-03（P2）· 破"界面一模一样"：给工具补专属输入
- 现状：4 工具输入端完全共用（page.tsx:350-459），仅标题/图标/占位符不同。
- 修复：把 `TOOLS` 从纯展示扩成带 `extraFields` 的配置，按 activeTool 渲染专属字段并随 FormData 提交、服务端拼进对应 prompt：
  - **试卷检查**：加"标准答案""评分标准""满分"结构化输入（满分传入约束 gradingTable 分数不超满分）
  - **思政挖掘**：加"专业方向/学段"（轻量文本或下拉）
  - **教案完善**：加"课时/学段/学生基础"轻量字段
  - **题目解析**：加"题目数量/知识点范围"轻量字段（可选）
  - 各字段均可留空、留空则退回当前通用行为（不破坏现流程）

## 范围（OUT）
- F-AIT-04（联动平台课程知识库）——P3 增强，依赖课程选择器，本单元不做，报告记一句作后续。
- 不改评分核心/Prisma/auth。不动 OCR/文件解析链路（已可用）。

## 硬规则
1. 保住 4 工具后端各自独立的 prompt/模型/温度/渲染差异（别在"统一"名义下把它们合并回一条路径）。
2. extraFields 向后兼容：留空时行为不劣于当前；不破坏现有上传/粘贴/OCR 流程。
3. 中文 UI；最小必要 diff；commit 前 `npx tsc --noEmit && QWEN_MODEL= npx vitest run` 全绿；prompt 分派/schema 裁剪补回归测试（如"lessonPolish 输出契约不含 gradingTable"）。
4. 纪律：不 push；不动 `.env`；DB 只 SELECT；AI 真实调用 frugal（每工具≤1 次）。dev server 由 QA 起，勿长驻本 worktree。

## 验收标准（Opus QA 真浏览器 + 真 AI）
1. 「题目解析」标题/描述已改，无"搜索增强"开关；跑一次产出正常（题型/知识点/步骤/易错点）
2. 教案完善结果**不再出现**虚构学生批改表；思政/题目解析同样无 gradingTable；试卷检查 gradingTable 正常
3. 4 工具切换时输入区呈现各自专属字段（至少试卷检查有评分标准/满分）；专属字段真的进了 prompt 影响产出
4. 4 工具各真跑 1 次，产出仍差异化且贴合各自目的（无回归）
5. tsc 0 错 + vitest 全绿（含新增）

## 产出
分支 `codex-ai-tools-fix`；commit `fix:`/`feat:` 中文；不 push。报告 `.harness/reports/build_f3-aitools_r1.md`（每处改动+4 工具真实测试产出摘录+测试结果+遗留 F-AIT-04 备注）。
