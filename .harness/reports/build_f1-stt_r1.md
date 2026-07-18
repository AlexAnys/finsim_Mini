# Build Report — F1 语音识别修复 · r1

- **角色**：Codex Builder
- **Worktree**：`/Users/yangsenan/dev/finsim-f1-stt`
- **分支**：`codex-stt-fix`
- **基线 commit**：`b87f11c`
- **本次 commit**：`f699eb5` — `fix: 修复 MiMo 语音转写请求与失败兜底`
- **Push**：未执行

## 根因确认

根因引用只读报告：
`/Users/yangsenan/dev/Finsim-Mini/.harness/reports/staging-findings-2026-07/stt.md`

报告中的 3 次真实 MiMo 订阅端点探针已形成闭环：

1. **TEST1**：现网请求 `mimo-v2-omni + text + input_audio` 返回 HTTP 400，真实错误为 `Unsupported model mimo-v2-omni`，证明不是音频格式问题。
2. **TEST2**：`mimo-v2.5-asr + 仅 input_audio + asr_options.language=zh` 返回 HTTP 200，转写内容为“你好。”，证明正确模型与请求形状可用。
3. **TEST3**：只换成 `mimo-v2.5-asr`、仍保留 text 部分时返回 HTTP 400，错误指出 ASR 请求禁止 text parts，证明不能只改 env/model 名。

因此本轮按 TEST2 的已验证 body 修根因，没有改动正常的浏览器 webm/mp4 → WAV 转码链路。

## 实现改动

### `app/api/ai/speech-to-text/route.ts`

- 默认模型改为 `mimo-v2.5-asr`，并移除语义错误的 `MIMO_OMNI_MODEL` 回退；仍保留专用 `MIMO_STT_MODEL` 覆盖入口。
- 删除 `STT_PROMPT`、text content part 及仅为 prompt echo 服务的归一化分支。
- 出站 body 对齐 TEST2：content 仅保留 `input_audio`，新增 `asr_options: { language: "zh" }`。
- 删除 ASR 不需要的 `thinking`、`temperature`、`max_completion_tokens`。
- 上传上限从 16MB 下调为 MiMo ASR 的 10MB，中文校验文案同步更新。
- MiMo 400/415 不再误报“音频格式被拒”，改为中性中文：`云端语音识别暂不可用，可改用浏览器语音或手动输入。`
- 非成功的 4xx/5xx 响应均允许浏览器兜底（`canFallback = res.status >= 400`）。
- 非 MiMo provider 的提示从旧的 “MiMo Omni” 更正为 “MiMo ASR”。

### `components/simulation/simulation-runner.tsx`

只读核对后无需修改：现有链路已将 `canFallback=true` 映射为 `transcribeAudio()` 返回 `false`，随后由 recorder `onstop` 自动调用 `startBrowserSpeechToText()`。route 放开 4xx 后，F-STT-03 的自动兜底已经贯通。按 spec OUT 保留前端 WAV 转码原样。

### 回归测试

新增 `tests/speech-to-text-route.test.ts`（Vitest 只收集 `tests/**/*.test.ts`，故测试文件作为 spec 明确要求的验证产物）：

1. 精确断言出站 URL、鉴权头和 TEST2 JSON body；content 只有 `input_audio`，默认模型为 `mimo-v2.5-asr`，并显式禁止 `text`、`thinking`、`temperature`、`max_completion_tokens` 回归。测试环境特意设置旧 `MIMO_OMNI_MODEL=mimo-v2-omni`，确保 STT 不再继承它。
2. 模拟 MiMo HTTP 400，断言 `canFallback=true`，用户文案为中性中文且不含“音频格式”。

## TDD 与验证结果

先加测试、在旧实现上运行：

- **2/2 FAIL（预期红）**
  - body 实际仍为 `mimo-v2-omni + text + thinking/temperature/max_completion_tokens`；
  - HTTP 400 实际仍返回 `canFallback=false`。

完成最小实现后：

- `npx vitest run tests/speech-to-text-route.test.ts`：**1 file / 2 tests PASS**。
- `npx tsc --noEmit && QWEN_MODEL= npx vitest run`：**TypeScript 0 error；125 files / 1267 tests PASS**。
- `npx eslint app/api/ai/speech-to-text/route.ts tests/speech-to-text-route.test.ts`：**0 error / 0 warning**。
- `git diff --check`：**PASS**。

全量 Vitest 输出中的 stderr/stdout 均为既有异常分支测试的预期日志；最终失败数为 0。

## 范围与纪律核对

- 代码 commit 仅包含 STT route 与专项回归测试；总 diff 为 110 insertions / 34 deletions（144 行改动，小于 150 行约束）。
- `simulation-runner.tsx` 只读验证、未改；前端转码与录音逻辑零改。
- 未改 `.env`；遵循用户本轮“仅指定实现范围”的要求，`.env.example` 与 staging/prod/GH 环境同步留给 coordinator。
- 未手工执行 DB 命令；本次代码无 DB/schema 改动。全量 Vitest 的既有 provider 用例会用假 teacher id 发起 upsert 并按预期触发外键失败，未产生持久数据写入。
- 未启动 dev server；真实浏览器与真实 MiMo 凭据验证留给 Opus QA。
- 未 push。
- 协调方预置的 `.harness/spec-f1-stt.md` 未纳入代码 commit；本报告按要求在 commit 后生成。

## Opus QA 验证点

1. 在 `/sim/[id]` 点录音，说一句中文并停止：云端返回转写，文本进入输入框，MiMo 请求应为 HTTP 200。
2. 制造 MiMo 4xx：不应再出现“音频格式被拒”；支持 Web Speech API 的浏览器应自动进入实时识别，不支持时应允许手动输入。
3. 确认文字对话、停止录音、WAV 转码和发送消息流程无回归。

## 遗留：F-STT-04

本单元未改 F-STT-04：`lib/services/document-ingestion.service.ts` 的 OCR 回退及 `lib/services/ai-tool-settings.service.ts` 的教师端模型选项仍有 `mimo-v2-omni` 硬编码。它们需要先核对订阅端点实际支持的多模态/OCR 模型，再作为独立收尾项处理；不要把 ASR 模型直接替换到 OCR 路径。
