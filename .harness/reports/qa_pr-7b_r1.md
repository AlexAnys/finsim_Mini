# QA Report — PR-7B · Mood + Hint AI 真接入（schema + Prisma 三步）r1

**Owner**: qa-p7 · **Date**: 2026-04-26 00:25Z · **Build report ref**: `.harness/reports/build_pr-7b_r1.md`

## Spec: 把 Sim Runner 的 mood / hint 从前端占位升级为真 AI 输出 + DB 持久化。8 档 mood 枚举（向后兼容 5 档）、B3 hint 节流（service 端控频）、`AnalysisReport.moodTimeline JSON` 持久化、Prisma 三步严格走完。

## 验证结果矩阵

| Check | Verdict | Evidence |
|---|---|---|
| 1. Spec compliance | **PASS** | 7 文件 +378/-49（schema +1 / migration +2 / lib/types +13/-2 / ai.service +183/-30 / chat route +13/-3 / insights.service +88/-2 / sim runner +66/-25）；schema 加 `moodTimeline Json?`；migration `20260425160756_add_mood_timeline/migration.sql` 真存在；DB 真有 `moodTimeline | jsonb` 列；8 档 mood mapping 与 spec D1 完全对齐（平静/放松/兴奋/犹豫/怀疑/略焦虑/焦虑/失望 → HAPPY/RELAXED/EXCITED/NEUTRAL/SKEPTICAL/CONFUSED/ANGRY/DISAPPOINTED） |
| 2. tsc --noEmit | **PASS** | exit 0 无输出 |
| 3. vitest run | **PASS** | 366/366 PASS · 1.38s · 与基线一致 |
| 4. Browser (`/qa-only`) | **PASS** | 真登录 student1 → /sim/{e34afdc0...} 200；真 4 轮对话：(1) 良好开局→ topbar "客户情绪 平静 1 轮" + AI bubble2 下"情绪 平静"绿色 chip fg=rgb(10,90,66)；(2) "今天天气怎么样" → "犹豫 2 轮"；(3) "您要不要直接买点比特币" → topbar "略焦虑 3 轮" + 8 段 mood meter 第 6 档 (CONFUSED) 高亮 + AI bubble 下"情绪 略焦虑" warn chip + **学习伙伴卡（Sparkles + 暖赭背景）"孩子三年后要用的钱，能承受本金大幅波动吗？"**（D2 Socratic 单句疑问）；console 0 错；POST /api/ai/chat ×3 全 200（4493ms / 4730ms / 5229ms 含 hint 最长 485B）；初始 mood meter 不再 PLACEHOLDER；截图 `/tmp/qa-7b-good.png` `/tmp/qa-7b-hint.png` |
| 5. Cross-module regression | **PASS** | 9 路由真登录 cookie regression 全 200（5 student + 4 teacher）；chatReply 唯一 caller `app/api/ai/chat/route.ts` 已同步签名（return type Promise<string> → ChatReplyResult）；MoodType 3 callers（lib/types + simulation-runner + insights.service）全对齐 8 档；老 5 档值仍合法（type union superset）；EvaluationView/StudyBuddyPanel/course-analytics-tab.tsx 不动 |
| 6. Security (/cso) | **N/A** | `/api/ai/chat` 仍 `requireAuth()`，权限语义零变化；新增请求字段 lastHintTurn (int nonneg) + objectives (max 20 strings) 都有 zod 严格校验；新增响应字段全 server 计算只读返回；moodTimeline 写入用 Prisma 参数化（Prisma.InputJsonValue），无 raw SQL；不改任何 auth guard / route guard — 不命中 cso 触发条件 |
| 7. Finsim-specific | **PASS** | 8 mood 中文 label 在 service + runner 共 34 处命中；UI text 全中文；4 处 service throw 用 ENG_CODE（NO_GRADED_SUBMISSIONS / INSTANCE_NOT_FOUND / NO_CONCEPT_TAGS / RATE_LIMIT_EXCEEDED / AI_PROVIDER_NOT_CONFIGURED）经 handleServiceError 映射为中文用户提示；route 用 success/validationError/handleServiceError；Route Handler 无业务逻辑（parse → call service → return）；prod build 25 routes 全成功 |
| 8. Code patterns / anti-regression | **PASS** | 7 核心 handler 字节级 EQ：handleAllocationChange 397B / handleSubmitAllocation 360B / handleResetAllocation 301B / handleFinishConversation 2309B / handleSubmit 989B / handleRedo 452B / handleClose 50B 全 EQ；handleSend 改动合理（新增 lastHintTurn 推断 + objectives 传递 + payload.mood/.hint 解析，API endpoint /api/ai/chat 不变 + 错误流转不变 + setMessages/inputValue/setIsSending 路径不变）；stripLegacyMoodTag 保留兼容老格式；MoodType 5 档历史值零迁移 |

## Prisma 三步真闭环

```
Step 1 · migrate dev ✓ migration 20260425160756_add_mood_timeline 文件存在
Step 2 · generate ✓ Prisma Client v6.19.2 (auto-run)
Step 3 · 重启 dev server ✓ kill PID 70137 → fresh PID 2941 → /login 200 + /sim/{id} 200
DB 真验证 ✓ docker exec finsim-postgres-1 psql \d "AnalysisReport" → moodTimeline | jsonb
```

## 真 AI E2E 矩阵（5 场景）

| # | 场景 | currentTurn | lastHintTurn | studentPerf | deviated | mood | hintTriggered | hint 内容 | HTTP / 时延 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 良好开局 | 1 | undefined | 0.6 | [] | 平静(0.2)/HAPPY | **false** | - | 200 / 3.27s |
| 2 | 比特币 + 跑题 | 3 | undefined | 0.2 | 2 项 | 怀疑(0.45)/SKEPTICAL | **true** | "您觉得100万中最多能接受亏损多少，才不影响生活？" | 200 / 8.20s |
| 3 | 节流 lastHintTurn=2 | 3 | 2 | 0.2 | 2 项 | 怀疑(0.45)/SKEPTICAL | **false** ← 1<3 节流生效 | - | 200 / 3.37s |
| 4 | 节流 lastHintTurn=3 | 4 | 3 | 0.2 | 2 项 | 犹豫(0.35)/NEUTRAL | **false** ← 1<3 节流生效 | - | 200 / 3.60s |
| 5 | 缺省早轮 currentTurn=2 | 2 | undefined | 0.2 | 1 项 | 怀疑(0.45)/SKEPTICAL | **false** ← 2<3 早轮放宽 | - | 200 / 3.33s |
| 6 | 缺省 currentTurn=3 触发 | 3 | undefined | 0.2 | 1 项 | 怀疑(0.55)/SKEPTICAL | **true** | "咱们是不是该先理清您家的收支情况再聊投资？" | 200 / 5.11s |

**B3 hint 触发判定全核验**：(student_perf<0.5 || deviated_dim≥1) && turnsSinceHint≥3 — 触发条件、节流条件、早轮放宽三条路径全 PASS。

## moodTimeline DB 持久化 E2E（场景 4）

1. seed graded sim submission：transcript 含 5 条消息 (3 AI 含 mood/hint 字段)
2. teacher1 POST `/api/lms/task-instances/{id}/insights/aggregate` → HTTP 200, 8.21s, `moodTimelineCount: 1`, reportId=546e8d30-...
3. **DB 真查询持久化数据**：

```jsonc
[{
  "studentId": "dcb6638a-...",
  "studentName": "张三",
  "submissionId": "a22e3657-...",
  "points": [
    { "turn": 1, "score": 0.05, "label": "HAPPY", "hint": null },
    { "turn": 2, "score": 0.18, "label": "RELAXED", "hint": null },
    { "turn": 3, "score": 0.62, "label": "CONFUSED", "hint": "您是否考虑客户的风险偏好？" }
  ]
}]
```

3 AI turn 全命中 + 8 档 mood label 正确 + score 真值保留 + hint 字段（turn 1/2 null, turn 3 真 Socratic 文案）+ studentName 中文+ submissionId 全保留 ✓

测试数据 cleanup 0 残留（Submission/SimulationSubmission/AnalysisReport 全 DELETE 1）。

## 真浏览器 UI 闭环（visual evidence）

- topbar "客户情绪 平静"（不再 PLACEHOLDER 的"犹豫"）+ 8 段 mood meter 第 1 档（HAPPY）高亮
- 良好开局 1 轮 → AI bubble 下"情绪 平静" green chip fg=rgb(10,90,66)
- 跑题 3 轮 → topbar 切到 mood meter 第 6 档（CONFUSED 略焦虑）+ AI bubble 下"情绪 略焦虑" warn chip
- **学习伙伴 hint 卡片真渲染**：暖赭背景 + Sparkles icon + "孩子三年后要用的钱，能承受本金大幅波动吗？"（D2 Socratic 单句疑问，非陈述句）
- console 0 错；3 次 POST /api/ai/chat 200（4493ms / 4730ms / 5229ms — 后者含 hint 调用最长）

## Issues found

无 P0/P1。

## Observations（非阻塞）

1. **mood_score 与 mood_label 一致性**（builder report L238 自报）：AI 偶尔给 score=0.45 但 label="怀疑"（理论 0.40-0.50 → "怀疑" 命中范围）。本批 6 场景全部一致；如长对话出现漂移可在 service 端用 score 反推 label。
2. **8 档 mood 实测覆盖 4/8**：本轮 QA 触达 平静（HAPPY 0.05-0.20）/ 犹豫（NEUTRAL 0.32-0.35）/ 怀疑（SKEPTICAL 0.45-0.55）/ 略焦虑（CONFUSED 0.6-0.62）；放松/兴奋/焦虑/失望 4 档未自然触达，但都在 MOOD_LABEL_TO_KEY 枚举内 + AI prompt 明确列出 — 长对话或更激烈场景应自然触达，不是 r1 阻断。
3. **`generateObject` 未用导入警告**（builder report L239 自报）：pre-existing 历史代码警告，非本 PR 引入，独立 PR 清理即可。
4. **evaluateSimulation 评分仍读老 [MOOD:] 标签**（builder report L244 自报）：客户端 PR-7A 已不再写老标签；但 DB 历史 transcript 可能仍含。`m.mood` 8 档英文 key 为新主路径，旧标签 fallback 路径仍兼容。留 PR-7C / Phase 8 顺手清。
5. **chatReply 单测缺**（builder report L243 自报）：service 调真 AI 难 mock；mood label/key 映射纯函数 MOOD_LABEL_TO_KEY 单语句 record，单测价值低。366/366 已稳。

## Overall: **PASS**

PR-7B r1 通过：
- Prisma 三步真闭环（migration 文件 + DB 真有 moodTimeline jsonb 列 + dev server PID 2941 重启验证）
- 6 个真 AI 场景全核验 B3 trigger / throttle / 早轮 (currentTurn<3) 放宽
- 真浏览器 UI 8 段 mood meter dispatch + 中文 chip + 学习伙伴 hint 卡（D2 Socratic）全可见
- moodTimeline DB 持久化 E2E（POST aggregate → 真 jsonb 写入 → 3 AI turn point + studentName/submissionId/hint 全保留）
- 7 核心 handler 字节级 EQ + handleSend 改动 spec 范围内
- 366/366 tests + tsc 0 + build 25 routes + 9 路由 200 + console 0 错

建议 commit 并启动 PR-7C（资产配置滑杆 debounce 持久化）。
