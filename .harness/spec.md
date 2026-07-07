# Spec — 微信小程序（学生端）规划中 (2026-07-07)

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户。

> Coordinator: Fable 5 · 状态: **规划阶段，未定稿** — 等代码侧 API 契约调查回报后写详细设计，用户确认前不写任何应用代码
> 前序 spec: `.harness/spec-pr15-archive.md`（PR-15 已于 5/19 作为 #15 合入 main）

## 用户原话

- 「做一个手机端 APP，供同学们下载到手机使用」→ 技术路线用户已选定：**微信小程序**
- 「安装包不是重点，重点是稳定、体验和 UI 设计。推送最好有」
- 执行编排：Fable 5 做 coordinator 设计，**Opus 跑 Builder 和 QA**

## 已确认的方向性决策

| 决策 | 结论 | 依据 |
|---|---|---|
| 技术栈 | Taro 3（生产主流）+ React + NutUI，自定义主题对齐 finsim design token | 团队 React 技能复用；2026 年 React 系小程序主流方案 |
| 推送 | 一次性订阅消息（「新任务通知」+「截止提醒」两模板，自然时机引导订阅攒额度） | 长期订阅仅开放线下公共服务，教育模板受限 |
| 类目 | 教育-学习辅导/题库类（无办学许可证要求；避开「在线视频课程」类目） | 类目审核 1-7 天 |
| 流式对话 | wx.request `enableChunked` + `onChunkReceived` 适配层（chunk 缓冲重组 + 真机/工具解码差异处理） | 小程序无原生 SSE，此为成熟社区方案 |
| 范围 | 仅学生端；老师端继续用网页 | 用户目标是「供同学们下载使用」 |

## 待定（进详细 spec 前需补齐）

1. 代码侧 API 契约调查（后台 agent 进行中）：simulation 流式机制、附件上传、学生端 /api/* 全量清单、quiz/subjective payload
2. 小程序主体选择：个人（快，无微信认证/支付/部分高级接口）vs 企业（要营业执照）— 用户决策
3. 认证通道设计：NextAuth v5 是 cookie session，小程序需新增 token 通道（触碰 `lib/auth/` = core-change）
4. 执行前模型配置：`~/.claude/settings.json` 的 `CLAUDE_CODE_SUBAGENT_MODEL` 改 `inherit` + builder/qa 钉 opus — 需用户确认（全局生效）

## 本单元当前 acceptance

- 详细设计 spec 写入本文件并获用户确认 — 在此之前**不产生任何应用代码 diff**
