# Build Report — PR-5B · 实例详情 Submissions tab + 批改 drawer · r1

**Unit**: `pr-5b`
**Round**: `r1`
**Date**: 2026-04-25

## Scope

Phase 5 · PR-5B — Submissions tab 完整重做 + 批改 drawer：

- 提交列表表格（学生 / 用时 / 状态 / 教师分 / AI 初判 / 分差 / 提交时间 / 操作）
- 过滤 bar：搜索框 + 状态 tab（全部/待批改/批改中/已出分）+ 排序下拉 + 导出 + 批量批改
- 虚拟化：>50 行用 `@tanstack/react-virtual`，<=50 行用 flat 渲染
- 批量选择：Checkbox + 全选当前页（已批改的不会被加入全选）
- 批改 drawer：Sheet 右侧 1000px 宽，左侧学生答卷（按 task type dispatch），右侧评分表（criteria 维度 + 总评 + AI 置信度 badge）+ 保存/跳过/保存 & 下一份

## Files changed

### 新文件（`components/instance-detail/`）

- `components/instance-detail/submissions-tab.tsx`（350 行）— 表格 shell + filter bar + 虚拟化分支
- `components/instance-detail/grading-drawer.tsx`（391 行）— Sheet drawer + AnswerPanel（sim 气泡 / quiz 题目卡 / subjective 长文 + 附件）+ 评分表
- `components/instance-detail/submissions-utils.ts`（135 行，pure utils，可测）
- `tests/instance-detail-submissions.test.ts`（193 行，21 unit tests）

### 修改

- `app/teacher/instances/[id]/page.tsx`：替换 submissions tab 旧 Card+Table → `<SubmissionsTab>` + `<GradingDrawer>`，新增 `handleOpenGrading / handleDrawerSaved / handleDrawerNext / handleBulkGrade`，pageSize 100 一次拉满便于客户端虚拟化（不再翻页）
- `package.json` / `package-lock.json` / `node_modules`：新增 `@tanstack/react-virtual ^3.13.24` 依赖（dev 跑 npm install）

### 未动

- `app/api/submissions/[id]/grade` 等所有后端 API、service 层、auth、db schema 字节零改
- `OverviewTab` / `InstanceHeader` / `InstanceTabsNav` 字节零改

## Non-obvious decisions

1. **虚拟化库选择 `@tanstack/react-virtual`**
   - 原因：TanStack 家族（项目已用 zustand-style state），支持自定义 key + 测量 + 动态高度（未来扩展）；轻量（~13KB gzip），SSR 安全（首屏 0 项目，hydrate 后注入）
   - 阈值 50：低于即用 flat 渲染（避免 transform 计算开销和滚动容器嵌套），高于走绝对定位 + transform translateY
   - 行高固定 64px：能满足头像 32 + 文字双行；如果未来 row 内放更多元数据可改 dynamic measure

2. **服务器分页 → 客户端单次 fetch + 虚拟化**
   - 原 page 用 `pageSize=20` 翻页，本 PR 改为 `pageSize=100` 一次拉满。理由：单次实例提交量 ≤ 200（一个班级最多 ~80 学生，可能多次尝试 = 200）；100 一次拉够，避免翻页 + 切换状态过滤后丢失数据的问题
   - 风险：如果一个 instance 真的 >100 提交，目前会丢尾。**Open**：QA 注意到该 case 应建议 PR-5C 之前补"加载更多"或提升上限到 500
   - DB 当前 0 行（seed 没造），所有 QA 真浏览器路径会进入 "暂无提交记录" 空态

3. **bulk grade = 打开第一份 + 引导跳到下一份**
   - 没改后端，没批量接口；选择 N 个后点"批量批改"会打开第一份的 drawer，"保存 & 下一份"自动跳到下个 selected 项中未批改的
   - 真正的 bulk async grading（一键 AI 重批 N 份）属于未来 PR

4. **drawer = `<Sheet side=right max-w-[1000px]>` + 左右 1.4:1 grid**
   - 默认 Sheet 是 `w-3/4 sm:max-w-sm`（窄）。我用 `className="w-full max-w-[1000px] sm:max-w-[1000px]"` 覆盖
   - 移动端（< md）单列：左右改成 column 布局——只显示学生答卷在上、评分在下
   - 关闭 X 用 Sheet 自带（右上角）

5. **AI 建议默认显示 + 老师可折叠（B6 决策落地）**
   - drawer 顶部一个 sim-soft 卡片显示 AI 总分 + 反馈 + 置信度 badge
   - 教师点 "折叠/展开" 按钮可隐藏（不会污染评分流）
   - 评分表每个 criterion 下方显示对应 AI 建议（"AI 建议 X/Y · comment"）

6. **评分初值 = AI 建议**
   - 打开 drawer 时把 `evaluation.rubricBreakdown` 里 AI 给的分数填入 `criteriaScores`，老师看到的是 AI 默认评，按需调整后保存
   - 如果没 AI 建议（grading 中或 AI 失败），全部 0 分

7. **CSV 导出 BOM 修复（沿用 PR-5A 修法）**
   - PR-5A 报告里 raised 过 BOM 字面字符串问题，已用 `"﻿"` (U+FEFF) 字面字符——本 PR 字节级保留

8. **mobile 表格水平滚动**
   - 表格 8 列固定 grid 总宽 ~820px，375px 屏会溢出。在表头+表体外层加 `overflow-x-auto` + `min-w-[820px]` 内层，让它在小屏可水平滚动而不破坏布局
   - 虚拟化容器（`max-h-[640px] overflow-y-auto`）在水平滚动外层之内 → 双轴独立滚动（垂直 virtualizer，水平 native）

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **321 passed / 0 failed / 32 files**（300 baseline + 21 new for submissions-utils） |
| `npm run build` | 0 errors / 0 warnings / 25 routes emitted |
| dev server | PID 59187 still on :3000，DB healthy |
| `/teacher/instances/[real-id]` HTTP 200 | 40.2 KB |
| `/api/submissions?taskInstanceId=...&pageSize=100` | 200 ·（DB 0 rows，正常空态） |
| 9 回归路由全 200 | dashboard / courses / instances / tasks / tasks/new / dashboard / schedule / courses / grades |

**单元测试覆盖 (21 new)**：
- `normalizeSubmission` 4 例（sim/quiz/subjective evaluation 抽取 + decimal score 转换 + null 处理）
- `filterSubmissions` 4 例（all / status / name 子串 / AND 组合）
- `sortSubmissions` 5 例（4 sort key + 不变性）
- `statusCounts` 2 例
- `formatDuration` 4 例（null / <60s / 分钟 / 小时）
- `scoreDiff` 3 例

## Open concerns / QA hints

1. **真浏览器无提交数据可测的盲点**：seed 没造任何 Submission 行，所有 instance 都是 0 提交。QA 真浏览器进任何 instance → submissions tab 看 "暂无提交记录" 空态 = 正常路径。**建议 QA 用一个 student1 跑一个 task 真提交一份（类似 Phase 4 PR-AUTH-fix r1-e2e 做过），然后回 teacher1 复现 drawer + grade flow**。或者 QA 直接 SQL 注一行假 Submission + SimulationSubmission 测 drawer

2. **虚拟化 >50 路径无法在真实 dev 数据上验证**：dev 没 50+ submission。本 PR 用 unit test + 测试 type-check 保证逻辑正确；视觉验证靠 mock data 或 future 真数据

3. **附件下载安全**：drawer 里附件 `<a href={attachment.filePath} target=_blank>`。如果 `filePath` 是公开 URL 直链，有路径泄漏风险——属于 SubjectiveSubmission attachment 写入端的设计（Phase 4 已落地），本 PR 不引入新攻击面。如果 QA 跑 OWASP/STRIDE 应注意是否做了授权访问 / signed URL（pre-existing question）

4. **未启动新 schema / 不需要 Prisma 三步**：本 PR 仅前端 + util + 测试 + 1 npm 依赖。dev server 可继续跑（已 verified HTTP 200）

5. **pageSize 100 上限**：见 decision #2。对于正常班级规模 ≤80 学生 + 单次提交 1 次，是充裕的。极端情况（多次 attempts）需要监控

## Deferred (not in this PR)

- "看对话" 单独按钮（设计稿 L201）—— 集成到了批改 drawer 的"学生答卷"面板内，无需单独路由
- "申诉中" 状态徽章 —— Submission 表无 `appealed` enum，是 mock 设计稿引入的虚拟字段。本 PR 不假装支持，等 schema 演进
- `flag: 'ai-low' | 'adjusted' | 'appeal' | 'missing'` 等设计稿 mock 字段 —— 同上，pre-existing schema 不支持，等真实业务需求
- 批量 AI 重批改异步 job（设计稿没明确，spec 也没强制）

## 状态

Ready for QA。Task #57 待 PASS 后标 completed，认领下一 PR-5C（带 schema 改动 + Prisma 三步 + AI 调用，会先 SendMessage 给 team-lead 告知字段名）。
