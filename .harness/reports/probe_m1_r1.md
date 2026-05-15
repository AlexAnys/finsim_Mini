# Probe Report — M1 仪表盘 + 一周洞察 (r1)

调研日期 2026-05-14 ｜ 账号 teacher1@finsim.edu.cn ｜ 真浏览器 + API 实测
代码入口：`app/teacher/dashboard/page.tsx`、`app/api/lms/weekly-insight/route.ts`、`lib/services/weekly-insight.service.ts`、`lib/services/dashboard.service.ts`
截图：`.harness/screenshots/probe-m1/`（01–12）；Playwright spec：`tests/e2e/probe-m1-*.spec.ts`

## 演示视频要求对照

| 演示中提到 | 实测结果 |
|---|---|
| 课程任务进度卡 | 在（`AttentionList`，命名「任务列表」）|
| 近期课表卡 | 在（命名「近期课表」，未来 4 节）|
| 学生提交动态卡 | 在（命名「动态」，最近 4 条）|
| 「生成一周洞察」按钮 | 在（顶部 chip，aria-label="生成一周洞察"）|
| LLM 报告含 完成率偏低章节 / 异常学生 / 下周建议 | 仅提供 `weakConceptsByCourse` / `studentClusters` / `upcomingClassRecommendations` 三段，**结构和演示对得上**；但因数据条件严苛（见 P0-2）当前几乎都是空的占位文案 |

总体：演示能复现，但若不修 P0 几乎每次都是空报告。

---

## P0 — 必修

### P0-1 「一周洞察」无任何节流，每次 `force=true` 都真烧 token
- 症状：教师反复点「重新生成」按钮无任何限流；连续 3 次 `?force=true` 真实耗时 19s / 15.5s / 15.7s，全部走完 LLM。
- 证据：`tests/e2e/probe-m1-data.spec.ts` M1-data-2 输出；`lib/services/weekly-insight.service.ts:218` 的 `setWeeklyLoading(true)` 仅 disable 按钮，未做服务端速率限制；service 层无 IP / 用户级 throttle。
- 根因：service 只用了 7 天 cache 作"省钱"机制；`force=true` 是无密码后门，前端按钮可以无脑连点。
- 优化：服务端按 teacherId 节流（同一教师 60s 内最多触发 1 次 force）；UI「重新生成」按钮按 cooldown 显示倒计时；或要求二次确认。

### P0-2 报告几乎永远是空 — 过滤条件 `releasedAt: not null` 在播种数据下无人达标
- 症状：教师 1 有 23 条 graded submissions（dashboard stats），但 `/api/lms/weekly-insight` 返回 `submissionCount: 0`、`weakConceptsByCourse: []`、`classDifferences: []`、`studentClusters: []`，AI 自己写"过去7天无任何作业或测验提交"。
- 证据：M1-3 API 测；M1-data 测显示 10 条 recentSubmissions 里 `releasedAt: null` 占 7/10；最新 gradedAt = 2026-05-07T01:39，刚好等于 7 天窗口下界。
- 根因：`weekly-insight.service.ts:282` 同时要 `status=graded` + `releasedAt: not null` + `gradedAt: gte windowStart`。在 demo / 试用数据里，教师批改完往往不 release（手动公布默认 manual），导致整个 AI 报告 100% 走空数据降级路径。**这是演示场景下最致命的 UX 失败**。
- 优化：(a) seed 脚本里给一部分 graded submissions 写 releasedAt；(b) 前端检测到 `submissionCount=0` 时不要让 LLM 编建议，直接显示一段「本周尚无已公布提交，先去任务详情公布成绩」+ 链接到 release 页面；(c) 或者放宽过滤到 `status=graded`（即使未 release），洞察对教师内部可见，演示也能跑起来。

### P0-3 教师任务列表全是"已过期"红色色块，体验不像"进行中"
- 症状：`AttentionList` 卡片 17 条任务全部带"已过期"红 badge（截图 `06-dashboard-full.png`），dueAt 都在 2026 年 2–5 月，"完成度 0%(0/10)"。
- 证据：M1-detail-1 文本提取；截图 06、08。
- 根因：演示数据 dueAt 都在过去；同时完成度全 0 — 提示要么 enrollment / submission 关联 0 学生，要么 due 计算口径有问题。
- 优化：seed 一批 dueAt 在未来 + 部分 submitted 的实例；UI 上对全过期场景增加「全部已过期，去发布新任务」空状态 + CTA。

---

## P1 — 高影响

### P1-1 近期课表卡里同 slot 同时段重复 3 次
- 症状：5/18 周一 10:00 个人理财规划 金融楼 301 连出 3 行；截图 `06-dashboard-full.png` 中部右侧、`08-dashboard-mobile-375.png`「近期课表」整段。
- 证据：M1-detail-1 提取 `5/18周一个人理财规划10:00·金融2024A班 · 金融楼 3015/18周一...5/18周一...`。
- 根因：`buildUpcomingSchedule()` 用 `scheduleSlots`（DB 里有多条重复 slot 记录），未按 `slotId + 日期` 去重。
- 优化：transform 层加 `dedupeBy(scheduleSlotId + date)`；或上游 ScheduleSlot 表去重。

### P1-2 KPI「待批 0 份」与 stats 不一致
- 症状：截图 `06-dashboard-full.png` 头部副标题写「待批 0 份」，但 dashboard summary 接口 `stats.pendingCount = 2`、`submittedCount = 2`。
- 证据：M1-3 API；截图 06、08（待批数字旁也是 0）。
- 根因：`buildKpiSummary()` 与 service 层 `stats.pendingCount` 用不同口径；KPI strip 自己重算了 pendingCount，可能没把 `submitted`/`grading` 都算进去。
- 优化：统一为 service 层 `stats.pendingCount` 一个来源；transform 不做二次聚合。

### P1-3 LLM 报告里"下周建议"机械重复，未真用班级数据
- 症状：在 0 数据降级时，LLM 把 6 节课的建议全用「同上，缺乏历史数据支撑」开头，6 条建议本质同一个意思；不是降级文案，是 LLM 真在重复编造。
- 证据：M1-2 modal text 全文（5 月 18 个人理财规划三次、5 月 20 三次）。
- 根因：prompt 让 AI 必须输出 `upcomingClassRecommendations`；同一节课多 slot（见 P1-1）+ prompt 没说"空数据时返回空数组"。
- 优化：service 层在 `submissionCount=0` 时不调 AI，直接返回空数组；prompt 增加"空数据返回空数组而非占位文案"约束。

### P1-4 力洞察按钮 24s 加载期间无 loading 占位 / 进度感知
- 症状：点开 modal 后第一屏停留在「正在生成本周洞察...」纯 spinner 24s（M1-2 实测 23.5s），无渐进提示（如"正在拉取数据"→"正在调 LLM"）。
- 证据：截图 04-after-click-loading.png；M1-2 输出 `点击→结果耗时: 23463 ms`。
- 根因：UI 只有 single state；service 也是同步串行。
- 优化：modal 内拆 2 段进度条；或骨架占位先出"时间窗口/数据条数"基础信息，AI 段落最后流式注入。

### P1-5 「AI 调用留痕」缺失 — 没有可见的 token / 耗时 / model 显示
- 症状：modal 内仅显示「时间窗口 / 提交数 / 缓存」徽章；不显示当次用了哪个 model、token 估算、耗时 — 与演示视频说的"教师主导"原则不符（教师应能感知 AI 在花谁的额度）。
- 证据：M1-2 全文；component `weekly-insight-modal.tsx:117`。
- 根因：service `WeeklyInsightResult` 类型未带 modelUsed / tokenEstimate / durationMs；不写 AIUsage / FeatureUsageEvent。
- 优化：service 内 `aiGenerateJSON` 后回填 model + duration；UI 在元数据条 + 一个折叠区显示"AI 服务详情"。

---

## P2 — Polish

### P2-1 移动端 modal 内容溢出
- 截图 `08-dashboard-mobile-375.png` 显示 modal 默认 `sm:max-w-3xl` 在 375 宽下需要左右滚动，弱概念 / 学生聚类两栏在 md: 才横排，375 下纵排但留白偏多。
- 优化：modal 在 `<sm` 时改成全屏抽屉；元数据条用纵向 stack。

### P2-2 「重新生成」按钮无可视 cooldown / 当前缓存命中态下也可点
- 现状：缓存有效期内点重新生成会浪费 18s+ 重算（即使数据没变）。
- 优化：cached=true 时按钮文案换成「强制重算（覆盖 7 天缓存）」+ 加确认弹窗。

### P2-3 错误降级文案过于通用
- service 层 LLM 失败时 fallback 是「本周洞察 AI 服务暂不可用，请稍后重新生成。」— 没区分超时 / 配额耗尽 / 模型未配置。
- 优化：在 catch 里依 err.message 分桶映射出中文化、可操作的错误码。

### P2-4 学生权限测试 PASS 但错误码使用一致性可校
- M1-4：student 调 weekly-insight 返回 403 + `{success:false,error:{code:"FORBIDDEN",message:"权限不足，无法访问此资源"}}` ✓ 符合规范。无需修，留作正向证据。

---

## 测试覆盖矩阵
- M1-1 教师 dashboard 渲染 ✅
- M1-2 一周洞察 UI 点击→结果 ✅ （23.5s）
- M1-3 API 直调 ✅ （cache 命中 19ms vs force 18s）
- M1-4 student 403 ✅
- M1-data 提交数据真实分布 ✅（10 条中 7 条 releasedAt=null）
- M1-data-2 节流验证 ✅（3 次 force 均真烧 LLM）
- M1-detail-1/2/3 卡片文本 / 视口 / modal 交互 ✅

## Overall
演示可复现；但 P0-1（无节流）和 P0-2（过滤太严永远空报告）是真上线前必修，否则用户/家长一连点就把 token 烧光，演示场景下教师还看不到任何 AI 洞察价值。
