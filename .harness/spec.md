# Spec — FinSim 手机端双轨计划：PWA（即时可用）+ 微信小程序（主轨）(2026-07-07 r2)

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户。

> Coordinator: Fable 5（设计）· Builder/QA: **Opus**（kickoff 时改 `~/.claude/settings.json` `CLAUDE_CODE_SUBAGENT_MODEL` → `inherit` + builder/qa frontmatter `model: opus`）
> 前序: `.harness/spec-pr15-archive.md` · 状态: **r2 待用户确认两个决策点（主体方案 + PWA 替代 RN）**

## 用户原话与拍板记录

- 「做手机端 APP 供同学们下载」→ 微信小程序（2026-07-07 拍板）
- 「重点是稳定、体验和 UI 设计，推送最好有」
- 「是否能同时走小程序和 React Native，以免微信备案太慢」→ **coordinator 建议 hedge 改用 PWA，RN 不做**（见决策 D2，待确认）
- 「学生部分的功能尽量都包含」→ 功能全量，不做人为裁剪（v1 分批交付，见阶段表）
- sim 对话 v1 非流式：**用户同意**
- diff 150 行规则豁免：授权 coordinator 定 → **裁定**：miniapp/ 脚手架 unit 豁免；后续 miniapp unit ≤400 行/unit；`app/ lib/`（web 后端）改动仍守 ≤150 行

## 关键决策

### D1 · 小程序主体（⚠️ 原「个人」方案被新事实推翻，需重新拍板）

**事实**（2026-07-07 检索，微信开放社区多案例）：AI 问答功能必须补「深度合成」类目，**该类目对个人主体尚未开放**——个人主体 + AI 对话 = 提审即拒。AI 对话是 FinSim 核心，不可剥离。

| 方案 | 可行性 | 成本/周期 |
|---|---|---|
| **A. 个体工商户主体（推荐）** | 属企业型主体，可申请深度合成类目；引用大模型服务商（通义/DeepSeek 均有《互联网信息服务算法备案》）的备案材料，阿里云百炼有官方合规指引 | 注册几天~两周、成本低；小程序微信认证 300 元/年 |
| B. 现成公司主体 | 同上，若用户已有公司最快 | 营业执照 + 对公账户 |
| C. 学校主体 | 教育场景最正统（事业单位） | 学校行政流程，周期不可控 |
| D. 个人主体硬上 | **不可行** — 深度合成类目未开放，AI 功能提审被拒 | — |

### D2 · Hedge 轨道：PWA 替代 React Native（待用户确认）

用户问「能否同时走小程序 + RN」。**能**（Taro 3 甚至支持编译到 RN），但不建议，理由：

1. **hedge 的目的**是「微信审核/备案慢时学生仍能用」——PWA 以 ~1/4 成本完全覆盖此目的：零审核、零上架、当天可用、**功能天然 100% 全量**（就是现有 web 端），移动端摸底已确认学生页面基本就绪（只差 3 处修复 + manifest/图标/安装引导）
2. RN 是第三套前端：Taro→RN 编译约束多（NutUI 不支持 RN 端，UI 库另起）伤「UI 设计」优先级；独立 RN 更是双倍维护
3. RN 自身分发也有摩擦：Android 要签名分发，iOS 仍需 Apple 账号——「绕开备案」的收益主要只剩 Android 侧
4. P1 的 Bearer token 通道是通道无关的基础设施——若未来仍要 RN/原生壳，随时可启，前期投入不作废

**建议**：PWA hedge 立即开工（1 个 unit，学生第 1 周即可用）；RN 不立项；若 D1 主体路线全部受阻，再重开原生 APP 评估。

## 总体架构（代码事实见 2026-07-07 两轮调查报告）

| 决策 | 内容 |
|---|---|
| PWA 轨 | 现有 Next.js 加 manifest + 图标 + viewport/theme-color + 3 处移动修复（`h-screen`→`dvh`、StudyBuddy 触摸拖拽、quiz `calc(100vh)` 键盘弹出）+ 安装引导页。不引入 service worker 复杂缓存（避免缓存导致的"不稳定"，牺牲离线换稳定——用户第一优先级） |
| 小程序目录 | 仓库内 `miniapp/` 独立子项目（Taro 3 + React + TS + NutUI，finsim design token 移植） |
| API 复用 | 除登录外 100% 复用现有端点（统一信封已就绪，无浏览器独占假设）；服务端从 taskInstanceId 反推权威 taskType |
| 认证 | 新增 `POST /api/miniapp/auth/login`（复用 authorize 校验，jose 自签 JWT，`MINIAPP_JWT_SECRET`）+ `lib/auth/guards.ts` 加 Bearer 分支；不走 next-auth signIn（绕 cookie+CSRF）。**core-change**，web cookie 路径零回归 |
| Sim 对话 | v1 JSON 模式（`/api/ai/chat` 官方保留的非流式 fallback）+ 打字指示器；后期 `enableChunked` 真流式专项 |
| 对话状态 | transcript 小程序端全量维护（服务端裁最近 30 轮）；草稿 `wx.setStorageSync` |
| 附件 | `wx.uploadFile` → 现有 `POST /api/files/upload`（20MB，image/pdf/word） |
| 批改 | 复用异步 job：POST submissions → 1.6s 轮询 async-jobs → grades 为准；quiz 内联 `data.evaluation` 可选处理 |
| 推送 | 一次性订阅消息 ×2（新任务/截止 24h），自然时机引导订阅攒额度 |
| Subjective | 纯文本 textarea（契约 `textAnswer ≤20000` 一致） |
| 环境 | 开发: DevTools 关域名校验打 :3000；QA: staging 入合法域名；生产: finsim.anlanai.cn |

## 阶段计划

### Track A — PWA hedge（立即开工，与 P0/P1 并行）
- `pwa-hedge` 单 unit：manifest/图标/meta + 3 处移动修复 + 登录页「添加到主屏幕」引导（iOS Safari / Android 各浏览器文案）
- Acceptance：真机 iOS Safari + Android Chrome/微信内置浏览器完成登录→作答→出分全流程；添加到主屏幕后全屏无浏览器 UI；3 处修复各有截图证据；web 桌面端零回归
- **学生第 1 周即可使用全部功能**——小程序审批期间的正式使用通道

### Track B — 微信小程序（主轨）

| 阶段 | 内容 | 工期估 |
|---|---|---|
| **P0 用户亲办** | ① 按 D1 定主体并注册（推荐个体工商户）② 类目「教育-在线教育」+「深度合成-AI 问答」（引用通义/DeepSeek 算法备案，备好服务商备案号）③ 合法域名 staging+生产 ④ 订阅消息模板 ×2 ⑤ AppID/Secret → `.env` | 本周启动；深度合成类目审核是长杆 |
| P1 | token 通道 + guards Bearer（vitest 200/401/403 + web 回归）+ Taro 骨架/design token/登录/tab 架构 + API client（预留流式接口） | ~2-3 天 |
| P2 | 核心作答：quiz（fixed→adaptive）→ subjective（附件）→ simulation（JSON 对话+配置面板）+ 草稿 + 轮询卡 | ~1-1.5 周 |
| P3 | 成绩闭环（rubric/逐题/对话回放）+ 首页（待办/近期成绩/公告） | ~2-3 天 |
| P4 | 推送（`User.wechatOpenId?` schema **Prisma 三步舞** + wx.login 绑定 + wechat.service stable_token + 发布触发 + 24h 截止定时）+ sim `enableChunked` 真流式攻坚 | ~4-5 天 |
| P5 | **功能补全**（用户「尽量都包含」）：Study Buddy（含发帖长耗时同步请求的 timeout 处理）、课表、课程内容浏览、设置/改密码、语音输入（`wx.getRecorderManager` 录 mp3 直传现有 speech-to-text API） | ~1 周 |
| P6 | 体验版全量验收 → 提审 → 发布（审核周期取决 P0 类目结果） | 1-7 天+ |

开发（P1-P5）不被审核阻塞：开发版/体验版全程可真机测试，仅正式发布依赖 P0/提审。

## QA 策略

- 小程序每 unit：miniprogram-automator + WeChat DevTools CLI 自动化 + 截图；后端改动 vitest 全量
- PWA unit：真浏览器三端（iOS Safari / Android Chrome / 微信内置）+ 375px 无破版
- core-change（guards/schema）：web 登录+作答冒烟强制回归
- 每 unit 预览二维码给用户真机抽验；progress.tsv 每轮追加；dynamic exit 照旧

## 总 Acceptance

1. **PWA（第 1 周）**：学生真机完成全功能闭环，主屏图标全屏运行
2. **小程序 v1（P6 后）**：真机微信内登录→quiz+subjective+simulation 各完成一次→出分→评分明细；订阅后任务发布收到服务通知；学生端功能全量（含 SB/课表/课程浏览/设置/语音）
3. web 端零回归：vitest 全绿 + 登录/作答冒烟
4. UI：design token 对齐，375px~Pro Max 无破版，交互符合平台惯例
5. 稳定：弱网重试、错误全中文、对话中断可恢复（transcript 本地持久化）

## 风险登记

| 风险 | 应对 |
|---|---|
| **深度合成类目审核不过**（即便企业型主体） | 引用大模型服务商算法备案（阿里云百炼官方合规指引路径）；若仍受阻 → PWA 轨已是正式可用通道，小程序转长期跟进 |
| guards.ts core-change 伤 web | Bearer 纯增量分支，cookie 路径字节不动；双回归 |
| next-auth v5 beta 漂移 | 不碰其内部 API，jose 独立签发 |
| enableChunked 真机解码差异 | 隔离 P4 独立 unit，JSON 模式保底 |
| PWA 无推送（iOS 弱） | 推送由小程序轨承担；PWA 定位是全功能使用通道非通知通道 |
| 个体工商户注册周期 | 与 P1-P5 开发完全并行，不阻塞 |

## 执行编排

- 分支：`claude-pwa-hedge`、`claude-miniapp-p{N}`，每 phase 一 PR（squash）
- 团队：builder + qa（Opus），coordinator（Fable 5）监控 TaskList + progress.tsv
- 顺序：kickoff 后先 `pwa-hedge` + P1 并行（PWA 是纯前端修复+增量，P1 主战场在后端+Taro 骨架，无文件交集）
