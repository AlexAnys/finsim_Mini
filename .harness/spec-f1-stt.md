# Spec — F1 语音识别修复（Codex 单元）

> 流水线：Fable5 plan → Codex 执行 → Opus 真浏览器验收。根因详见只读报告（绝对路径）：
> `/Users/yangsenan/dev/Finsim-Mini/.harness/reports/staging-findings-2026-07/stt.md`（含 3 次真实探针证据 TEST1/2/3）

## 背景与根因（已探针验证，非猜测）
staging 实测：AI 文字对话正常，语音转文字失败，弹「云端语音识别拒绝当前音频格式，请改用浏览器语音或手动输入。」
根因**不是音频格式**：STT 端点把音频发给模型 `mimo-v2-omni`，该模型在订阅端点 `token-plan-cn.xiaomimimo.com/v1` **不存在** → HTTP 400 `Unsupported model mimo-v2-omni`；后端把所有 400 误报成「格式被拒」。正确模型是 **`mimo-v2.5-asr`**，且 ASR 模型**禁止携带 text 部分**（gateway 自注入）。前端 webm→wav 转码/上传/鉴权全部正常，不要改。

## 已验证可用的请求体（报告 TEST2 返回 HTTP 200）
```json
{"model":"mimo-v2.5-asr","messages":[{"role":"user","content":[
  {"type":"input_audio","input_audio":{"data":"<raw base64 wav>","format":"wav"}}]}],
  "asr_options":{"language":"zh"}}
```

## 范围（IN）
仅两文件：`app/api/ai/speech-to-text/route.ts`、`components/simulation/simulation-runner.tsx`
1. **F-STT-01/02**：模型默认 `mimo-v2-omni`→`mimo-v2.5-asr`（route.ts:42）；删掉 content 里的 text 部分与 `STT_PROMPT`（route.ts:6,53-59）；content 只留 `input_audio`；加 `asr_options:{language:"zh"}`；删 ASR 不需要的 `thinking`/`temperature`/`max_completion_tokens`（用上面验证过的干净 body）；上传上限 16MB→10MB（route.ts:16，MiMo ASR 上限）。
2. **F-STT-03**：400 误报文案改中性（透传 MiMo 真实 message 或「云端语音识别暂不可用，可改用浏览器语音或手动输入」）；`canFallback` 对 4xx 也放开（route.ts:80），使前端云端失败后能自动/可选走浏览器语音兜底，避免「录音→400→再录」死循环。
3. env 文档：`.env.example` 补 `MIMO_STT_MODEL=mimo-v2.5-asr` 并注释；（部署侧 GH Secrets/prod/staging 的 env 同步由 coordinator 处理，不在本单元）。

## 范围（OUT）
- 前端 webm→wav 转码逻辑（正常，别动）
- F-STT-04（`mimo-v2-omni` 在 OCR 回退/教师端下拉的硬编码）——独立收尾项，本单元只在报告里记一句，不改
- 换 Qwen ASR（路径 C，不需要）

## 硬规则
1. 不放松校验来"消除报错"；根因是模型名+请求形状，按上面已验证 body 修。
2. 最小 diff；不碰无关文件；中文 UI。
3. commit 前 `npx tsc --noEmit && QWEN_MODEL= npx vitest run` 全绿（QWEN_MODEL 置空规避既有环境污染，见 R2 报告）。STT 逻辑若可单测则补一条（如"ASR body 不含 text 部分"）。
4. 纪律：不 push；不动 `.env`（已在 worktree）；DB 只 SELECT。dev server 由 QA 起，勿在本 worktree 长驻。

## 验收标准（Opus QA 真浏览器）
1. `/sim/[id]` 对话框点录音 → 说一句中文 → 云端识别返回转写文本填入输入框（真实 MIMO ASR 200）
2. 断网/模型错等 4xx 场景：错误文案不再是「音频格式被拒」；能落到浏览器语音/手动输入兜底，不卡死
3. tsc 0 错 + vitest 全绿（含新增用例）；模拟对话其余流程无回归

## 产出
分支 `codex-stt-fix`；commit `fix:` 中文；不 push。报告 `.harness/reports/build_f1-stt_r1.md`（根因确认引用探针 + 每处改动 + 测试结果 + 遗留 F-STT-04 备注）。
