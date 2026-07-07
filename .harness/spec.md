# Spec — FinSim 微信小程序（学生端）v1 (2026-07-07)

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户。

> Coordinator: Fable 5（设计）· Builder/QA: **Opus**（执行前需改 `~/.claude/settings.json` `CLAUDE_CODE_SUBAGENT_MODEL` → `inherit` + builder/qa frontmatter `model: opus`，全局生效需用户点头）
> 前序 spec: `.harness/spec-pr15-archive.md` · 状态: **待用户确认，确认前不写应用代码**

## 用户原话

- 「做一个手机端 APP，供同学们下载到手机使用」→ 路线已选定：**微信小程序**
- 「安装包不是重点，重点是**稳定、体验和 UI 设计**。推送最好有」
- 「Fable 5 作为 coordinator 进行仔细的设计，用 opus 作为 Builder 和 QA」

## 目标 / 非目标

**目标**：学生在微信里完成核心闭环——登录 → 看任务 → 作答三类任务 → 提交 → 出分 → 看评分明细；订阅消息推送任务发布/截止提醒。
**非目标（v1 不做）**：老师端、支付、离线作答、语音输入（v1.5 用 `wx.getRecorderManager` 录 mp3 直传现有 API，浏览器转码逻辑不移植）、课程内容深度浏览、Study Buddy（后置）、课表、设置页改密码。

## 总体架构（事实依据见 2026-07-07 两轮代码调查）

| 决策 | 内容 | 依据 |
|---|---|---|
| 目录 | 仓库内 `miniapp/` 独立子项目（独立 package.json/tsconfig，不进 Next build） | 共享类型与 API 契约演进同步；CI 独立 workflow |
| 技术栈 | **Taro 3（生产主流）+ React + TS + NutUI-React**，自定义主题移植 finsim design token（brand/ochre/success/sim/brand-violet） | React 技能全复用；用户 UI 设计优先级高 → token 级对齐 |
| API 复用 | 除登录外 **100% 复用现有端点**（统一信封 `{success,data|error}` 已就绪）；服务端从 taskInstanceId 反推权威 taskType，不信任客户端 | 契约调查：全端点 JSON-in/out，无 redirect |
| 认证 | 新增 `POST /api/miniapp/auth/login`（邮箱+密码 → 复用 authorize 校验逻辑 → 自签 JWT，jose）+ `lib/auth/guards.ts` 扩展支持 `Authorization: Bearer`；**不走** next-auth signIn（绕开 cookie+CSRF 双假设，next-auth v5 beta 不给非浏览器客户端留路） | 唯一硬阻塞点；**core-change**（lib/auth/），web cookie 路径必须零回归 |
| Sim 对话 | v1 走 **JSON 模式**（不发 `Accept: text/event-stream`，官方保留的 fallback 路径）+「对方正在输入」指示器；P4 再上 `enableChunked` 真流式 | route 注释明确 JSON 路径为「任意非浏览器调用」保留；enableChunked 有真机/工具解码差异坑，不当 v1 阻塞项 |
| 对话状态 | transcript 由小程序端全量维护（服务端只裁最近 30 轮）；草稿持久化 `wx.setStorageSync`（对应 web localStorage 草稿键） | 契约调查 §1/§4 |
| 附件 | `wx.chooseMessageFile/chooseMedia` + `wx.uploadFile` → 现有 `POST /api/files/upload`（FormData `file` 字段，20MB，image/pdf/word） | 契约无障碍；存储是服务器本地磁盘，与小程序无关 |
| 批改结果 | 复用异步 job 轮询：POST /api/submissions → 1.6s 轮询 `GET /api/async-jobs/{id}` → grades 数据为准；quiz 响应内联 `data.evaluation` 当可选字段处理 | 契约调查 §5 |
| 推送 | **一次性订阅消息** ×2 模板（新任务发布 / 截止前 24h），自然时机（进任务页/提交后）引导勾选攒额度；长期订阅教育场景模板受限不可用 | WebSearch 2026-07 确认 |
| Subjective 答题 | v1 纯文本 textarea（与 `textAnswer: string ≤20000` 契约一致）；web 端富文本样式不移植 | 小程序无 contenteditable |
| 环境 | 开发: DevTools 关域名校验打本机:3000；QA: staging.finsim.anlanai.cn 入 request 合法域名；生产: finsim.anlanai.cn | 合法域名上限 20 条，够用 |

## 分阶段计划（P0 与 P1 并行启动）

### P0 — 微信侧行政准备（**用户亲办**，是唯一外部 critical path）
1. 注册小程序主体 — **决策点：个人主体**（身份证即可、快；无微信认证/支付/部分高级接口，本项目不需要）**vs 企业主体**（营业执照+对公账户；订阅消息模板池更宽）
2. 类目选「教育-学习辅导/题库」类（无办学许可证要求；避开「在线视频课程」类目）
3. **⚠️ 注册时咨询 AI 合规**：小程序含 AI 对话生成内容，2024 起微信对 AIGC 类功能有「深度合成算法备案/申报」收紧趋势——注册时问清是否需补充申报，这可能影响审核，是本计划最大外部不确定性
4. request/uploadFile 合法域名添加 staging + 生产双域名
5. 订阅消息模板申请 ×2；拿 AppID/AppSecret → 服务器 `.env`

### P1 — 后端 token 通道 + 小程序骨架（unit: `miniapp-auth`、`miniapp-skeleton`）
- `POST /api/miniapp/auth/login` + guards Bearer 扩展 + vitest（200/401/403 + web cookie 路径回归）
- Taro 骨架 + design token 主题 + 登录页 + tab 架构（首页/任务/成绩/我的）+ API client 层（信封解析、token 注入、401 统一处理、**预留流式适配器接口**）

### P2 — 核心作答链路（三 unit，风险递增排序）
- `miniapp-quiz`：任务列表/详情 + Quiz（fixed 先行 → adaptive 两端点 `adaptive-quiz/next`+`questions/{id}/check` 同 unit 内跟进）+ 草稿 + 提交轮询卡
- `miniapp-subjective`：textarea 作答 + 附件上传 + 评分标准展示
- `miniapp-sim`：对话 UI（气泡/情绪/开场白）+ 资产配置面板 + JSON 模式对话 + 提交
- 共通 acceptance：真机（iOS+Android 微信各一）完成一次完整作答提交出分

### P3 — 成绩闭环 + 首页（unit: `miniapp-grades`、`miniapp-home`）
- 成绩列表 + 评分明细（rubric 逐维 / quiz 逐题 / sim 对话回放）
- 首页 dashboard lite：问候 + 待办任务（作答入口）+ 近期成绩 + 公告摘要

### P4 — 推送 + 流式增强（unit: `miniapp-push`、`miniapp-stream`）
- `User.wechatOpenId?` schema 变更（**Prisma 三步舞** + dev server 重启验证）+ wx.login 绑定 + wechat.service（stable_token 管理 + 订阅消息发送）+ 任务发布触发 + 截止前 24h 定时触发（单实例安全的调度机制，实现由 builder 定）
- sim 对话 `enableChunked` 真流式（专项攻坚：chunk 缓冲重组、DevTools `decoder.decode` vs 真机 `arrayBufferToString` 差异、`event: chunk/meta/done/error` 协议解析）

### P5 — 提审上线
- 体验版二维码 → 用户真机验收 → 提审（教育类目 1-7 天）→ 发布

## QA 策略

- 每 unit：**miniprogram-automator + WeChat DevTools CLI** 自动化（QA agent 可驱动、可截图）；后端改动跑 vitest 全量
- guards/schema 类改动：web 端登录+作答冒烟必须回归（core-change 铁律）
- 每 unit 出体验版/预览二维码给用户真机抽验；P2 起每 unit 附 iOS+Android 真机截图
- progress.tsv 每轮追加；dynamic exit 规则照旧（r1 PASS 收工 / r2 PASS 强制写 lesson / 同一 FAIL 三连回 spec）

## v1 总 Acceptance

1. 测试学生账号在**真机微信**完成：登录 → 任务列表 → 完成 quiz + subjective + simulation 各一次 → 提交 → 轮询出分 → 成绩页看到评分明细
2. web 端零回归：vitest 全绿 + web 登录/作答冒烟通过
3. UI：finsim design token 对齐，iPhone SE(375px)~Pro Max 无破版；交互符合小程序惯例（下拉刷新、返回手势不丢草稿）
4. 推送：订阅后老师发布任务，学生微信服务通知收到提醒
5. 稳定性（用户第一优先级）：弱网重试与错误提示全中文化；对话中断可恢复（transcript 本地持久化）

## 风险登记

| 风险 | 应对 |
|---|---|
| AI 内容合规申报（深度合成备案）影响审核 | P0 注册时先问清；若需备案，评估周期后再定提审时间，**不阻塞 P1-P4 开发** |
| guards.ts 是 core-change，动错伤 web 全站 | Bearer 分支纯增量、cookie 路径字节不动；vitest + web 冒烟双回归 |
| next-auth v5 beta 行为漂移 | 不依赖其内部 API，自签 JWT 用 jose 独立 secret（`MINIAPP_JWT_SECRET`） |
| enableChunked 真机差异 | 隔离在 P4 独立 unit，v1 JSON 模式保底可用 |
| Study Buddy 发帖是长耗时同步请求 | v1 不做 Study Buddy，规避 |
| CLAUDE.md「diff ≤150 行」对 Taro 脚手架不可行 | **约定调整（需用户点头）**：miniapp/ 内首次脚手架 unit 豁免，后续 unit 恢复 ≤300 行/unit 粒度；`app/ lib/` 内改动仍守 150 行 |
| 审核被拒风险（教育类目对 UGC/AI 要求） | 提审前跑一遍微信《小程序运营规范》自查清单，体验版先行内测不受审核影响 |

## 执行编排

- 分支 `claude-miniapp-p{N}`，每 phase 一个 PR（squash merge 惯例）
- 模型：builder/qa 钉 **opus**（执行 kickoff 时改全局 subagent 配置，需用户确认）；coordinator 保持 Fable 5
- 工期粗估（wall-clock，agent 执行 + 用户真机验收节奏）：P1 ~2-3 天 · P2 ~1-1.5 周 · P3 ~2-3 天 · P4 ~4-5 天 · P5 审核 1-7 天 → **全程 3-5 周**；P0 用户侧最好本周启动（类目+备案咨询是长杆）
