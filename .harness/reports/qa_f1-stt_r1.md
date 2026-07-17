# QA Report — F1 语音识别修复 · r1

- **角色**：Opus QA（三方流水线：Fable5 plan / Codex build / Opus 验收）
- **Worktree**：`/Users/yangsenan/dev/finsim-f1-stt`（分支 `codex-stt-fix`，基线 `b87f11c`，被测 commit `f699eb5`）
- **dev server**：http://localhost:3011（coordinator 起，未 kill/未重启）
- **验收方式**：真实 MiMo ASR 端到端（2 次真实调用）+ 真浏览器（student1）+ tsc/vitest + git diff 反捷径核查
- **总判：PASS（5/5）**

---

## 逐条验收

### 1. 端到端真实转写（决定性）— PASS
- 造音频：`say "你好，这是一段语音识别测试" → afconvert WAVE LEI16@16000 mono` → 合法 RIFF WAVE 16-bit mono 16kHz（90KB）。
- 教师登录：NextAuth credentials 流（CSRF + callback）拿到 `authjs.session-token`，`/api/auth/session` 确认 `role=teacher`。
- `POST :3011/api/ai/speech-to-text`（带 teacher cookie，multipart wav）→ **HTTP 200**：
  ```json
  {"success":true,"data":{"text":"你好，这是一段语音识别测试。","provider":"mimo","model":"mimo-v2.5-asr","canFallback":false,"message":"语音已转成文字，请确认后发送。"}}
  ```
  转写文本与所说内容**逐字一致**；`model=mimo-v2.5-asr`（走的是修复后的 ASR 模型）。
- dev log 佐证：`POST /api/ai/speech-to-text 200 in 1440ms`。
- **「body 无 text 部分」的决定性证据**：根因报告 TEST3 证明 `mimo-v2.5-asr` 一旦携带 text 部分即返回 400（`ASR request must not include text parts`）。本次真实调用返回 200 且转写正确 → 出站 body 必然是纯 `input_audio`，无 text 部分。F-STT-01/02 修复成立。

### 2. 错误路径文案 + 兜底 — PASS
- 真实 4xx：传入非法音频（ZZQA 垃圾字节，标记 `audio/wav`）→ MiMo 真实返回 400（dev log：`[speech-to-text] mimo returned 400 {"...invalid audio format..."}`）。
- route 响应：`{"text":"","canFallback":true,"message":"云端语音识别暂不可用，可改用浏览器语音或手动输入。"}`
  - 文案**不再是**「音频格式被拒 / 拒绝当前音频格式」，改为中性中文；关键点：即便 MiMo 原始 message 恰好含 "audio format"，route **不透传**该误导性原文，用中性文案。
  - `canFallback=true`（4xx 放开兜底），修复前为 `res.status>=500`（400 时 false → 学生卡死）。
- 单测佐证（`tests/speech-to-text-route.test.ts`）：mock MiMo 400 `Unsupported model mimo-v2.5-asr`（即生产原始 bug 形态）→ 断言 `canFallback===true`、`message` 为中性文案且 `not.toContain("音频格式")`。真实路径与生产 bug 形态双覆盖。

### 3. 浏览器渲染 — PASS
- 真浏览器 student1（张三）登录成功 → 导航 `/sim/8a7d8c43-1dc8-4cfa-acc6-fb81fdf111fe`（客户理财咨询模拟练习，DB SELECT 得到的 student1 班级可访问的 simulation 实例）。
- 全屏 SimulationRunner 正常加载：背景情景 / 对话目标(4) / 评分对照 / 客户开场消息 / 配资滑杆面板 / 输入框。
- **语音录音按钮在位**：accessibility tree 见 `button "语音转文字" [ref_5]`，输入框右侧「语音」按钮渲染正常。
- **console 无 error**：`onlyErrors` 无输出；全量 console 仅 React DevTools 提示 / `[HMR] connected` / `[Fast Refresh]` 等 dev 噪音，无错误、无 STT 相关告警。
- F-STT-03 自动兜底链路（代码核对）：`recorder.onstop → transcribeAudio(blob).then(ok => if(!ok) startBrowserSpeechToText())`；`transcribeAudio` 中 `text=="" && canFallback` → return false → 触发浏览器语音。route 放开 4xx 后此链贯通。**Codex 不改 `simulation-runner.tsx` 的判断正确**（前端本已具备兜底分发，route 改 canFallback 即打通）。

### 4. 基线 — PASS
- `npx tsc --noEmit` → **0 error**（TSC_EXIT=0）。
- `QWEN_MODEL= npx vitest run` → **125 files / 1267 tests PASS**（含新增 `tests/speech-to-text-route.test.ts` 2 tests）。stderr 中 `mimo returned 400` 系 400-分支测试的预期 console.error，非失败。
- 模拟对话页真浏览器加载正常，无回归。

### 5. 反捷径核查 — PASS
- `git diff --name-only origin/main..HEAD` → **仅 2 文件**：`app/api/ai/speech-to-text/route.ts` + `tests/speech-to-text-route.test.ts`（110 insertions / 34 deletions）。
- `git diff origin/main..HEAD -- components/simulation/simulation-runner.tsx` → **空**（前端 webm→wav 转码逻辑零改动，符合 spec OUT）。
- `.env` / `.env.example` **未改**。
- 未放松无关校验：唯一校验变更 16MB→10MB 是**收紧**（对齐 MiMo ASR 10MB 上限），非放松；删除的 `normalizeTranscription`（prompt-echo 检测）与删除 text prompt 强耦合（text 没了，echo 检测才可删），属正确修复而非「为消除报错放松校验」。
- 工作树干净（仅 `.harness/` 未跟踪计划文档）。

---

## 非阻塞观察（供 coordinator）

1. **`.env.example` 未补 `MIMO_STT_MODEL`**：spec IN#3 要求补 `MIMO_STT_MODEL=mimo-v2.5-asr` 注释，build 报告将其与 GH Secrets/staging/prod 同步一并**留给 coordinator**。**非阻塞**：route 默认值已是 `mimo-v2.5-asr`，不设 env 也能工作。建议 coordinator 收尾时统一补 env 文档（当前 `.env.example:43` 仍只有 `MIMO_OCR_MODEL=mimo-v2-omni`）。
2. **F-STT-04 遗留（OUT，正确延后）**：`lib/services/document-ingestion.service.ts`（OCR 回退）、`lib/services/ai-tool-settings.service.ts`（教师端下拉）、`.env.example` `MIMO_OCR_MODEL` 仍硬编码 `mimo-v2-omni`。当前 `OCR_PROVIDER=qwen` 未触发；需先核对订阅端点支持的多模态模型再独立处理，勿把 ASR 模型直接塞进 OCR 路径。
3. **陈旧注释（cosmetic）**：`simulation-runner.tsx:1240` 注释仍写「mimo Omni 只接受…」。前端按 spec OUT 未动，无害；下次触及前端顺手更正即可。

---

## 数据纪律
- 真实 MiMo ASR 调用共 2 次（1 成功转写 + 1 触发 400 兜底），配额消耗可忽略。
- 测试音频/垃圾音频置于 scratchpad（ZZQA 前缀），未落库；DB 仅 SELECT（查 simulation 实例 id）。
- 未 kill/重启任何 dev server；未改任何应用代码。
