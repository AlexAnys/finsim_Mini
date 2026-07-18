# Build report — F3 AI 助手切换崩溃修复 r2

- Unit: F3 / F-AIT-01～03 回归修复
- Builder: Codex
- Branch: `codex-ai-tools-fix`
- Parent build: `d4c54cd` (`fix(ai-assistant): 正名题目解析并隔离四工具契约`)
- Date: 2026-07-17
- Result: **READY FOR OPUS QA r2**

## r1 QA 结论

F-AIT-01 正名、F-AIT-02 去污染、F-AIT-03 专属输入均已 PASS，本轮未改动这些逻辑。r1 仅因以下 P1 回归判 FAIL：查看任一非试卷工具结果后切到“试卷检查”，页面进入 500 错误边界。

## 崩溃根因

1. r1 将 `gradingTable` 从公共结果 schema 移到 `examCheck` 专属 schema，非试卷结果不再携带该键。
2. `ExamCheckResult` 直接读取 `result.gradingTable.length`，缺字段时抛出 `TypeError`。
3. 工具切换时 `activeTool` 先更新，`result` 要等持久化 hook hydrate 后的 effect 才同步；中间渲染会把上一工具的结果交给新工具组件。
4. 因此从带结果的 `lessonPolish` / `ideologyMining` / `questionAnalysis` 切到 `examCheck` 时，组件会短暂收到缺少 `gradingTable` 的旧结果并崩溃。`origin/main` 的公共默认空数组仅掩盖了这个问题。

## r2 修复

- 止血：`ExamCheckResult` 将 `result.gradingTable ?? []` 归一为局部 `gradingRows`，缺字段时安全显示“未输出逐题批改表”空态。
- 根治：`setActiveTool` 在切换前同步清空 `job`、`result`、`originalResult`，再更新 `activeTool`；hydrate 随后恢复目标工具自己的状态，不再跨工具分发旧结果。
- 同工具保护：点击当前已选工具时直接返回，避免误清当前结果。

## 回归测试

- 真渲染 `ExamCheckResult`：传入故意缺少 `gradingTable` 的非试卷结果，断言渲染不抛错并进入空表提示分支。
- 切换竞态契约：锁定 `setActiveTool` 在翻转 `activeTool` 前同步清空三项旧工具状态，覆盖 `lessonPolish` 有结果后切 `examCheck` 的回归路径。

| 命令 | 结果 |
|---|---|
| `npx vitest run tests/ai-assistant-result-views.test.ts` | **1 file / 20 tests PASS** |
| `npx tsc --noEmit` | **PASS，0 错** |
| `QWEN_MODEL= npx vitest run` | **126 files / 1292 tests PASS** |
| `git diff --check` | **PASS** |

## 范围纪律

- 仅修改 `exam-check-result.tsx`、`page.tsx` 的工具切换逻辑、对应结果视图测试，以及本报告。
- 未修改 F-AIT-01/02/03 已 PASS 的正名、去污染 schema/prompt、专属输入逻辑。
- 未修改 `.env`，未写 DB，未启动、停止或干扰 QA 使用的 `:3013` dev server，未 push。
