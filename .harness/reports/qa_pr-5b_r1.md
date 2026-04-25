# QA Report — pr-5b r1

**Unit**: `pr-5b`
**Round**: `r1`
**Date**: 2026-04-25
**QA agent**: qa-p5

## Spec

Phase 5 · PR-5B — 实例详情页 Submissions tab 重写 + 批改 drawer + 虚拟化（参考 spec L50-71）：
- 表格列：学生 / 用时 / 状态 / AI 初判分 / 教师分 / 操作
- 虚拟化（>50 行 `@tanstack/react-virtual`）
- 行 click → drawer 打开
- 评分保存调 POST `/api/submissions/[id]/grade`
- 批量选择 + "批量批改"

## Verification matrix

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 3 新组件（submissions-tab/grading-drawer/submissions-utils）+ 21 unit tests，全 spec 项落地：filter bar（搜索+状态 4 tab+排序+导出+批量批改）/ 8 列表格 / >50 行虚拟化阈值 / drawer Sheet 1000px 左右 1.4:1 grid（type dispatch sim 气泡 / quiz 题目卡 / subjective 长文+附件）/ AI 建议默认显示可折叠（B6 决策落地）/ 评分初值 = AI 建议 / 保存 + 跳过 + 保存&下一份 / 行内 "批改/复评" 按钮按 graded 状态切换。 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | **321 passed / 0 failed / 32 files**（300 baseline + 21 new for submissions-utils：normalize 4 + filter 4 + sort 5 + statusCounts 2 + formatDuration 4 + scoreDiff 3 = 22 实测，build report 报 21 — 计数差 1 但全 PASS） |
| 4. Browser / 真 curl E2E | PASS | **关键：dev server 启动验证** — Builder PR 加 `@tanstack/react-virtual` 依赖后 PID 59187 已死（curl :3000 返 502 + lsof 空），QA 重启 dev server PID 51695 验证。teacher1 真登录 → `/teacher/instances/[id]` 200 / 39917 byte → API `/api/submissions?...&pageSize=100` 200。**真造一份 quiz submission 走全 drawer flow**：student1 → POST `/api/submissions` 201（quiz 6 题真答案，duration 420s） → AI grading 后 → teacher1 GET 列表 200（status=submitted/grading）→ teacher1 POST `/api/submissions/[id]/grade` 200（score=75/100, feedback 中文）→ list 反映 status=graded score=75/100。Drawer GET `/api/submissions/[id]` 200 返回 detail（quiz answers 6 个 + scoringCriteria 空 → drawer 走 "未配置评分维度" placeholder）。测试数据已 cleanup 0 残留。 |
| 5. Cross-module regression | PASS | 9 回归路由 `/teacher/{dashboard,courses,instances,tasks,tasks/new}` `/dashboard` `/schedule` `/courses` `/grades` 全 200。后端 API/service/schema 字节零改动（diff stat：page.tsx + package*）。Phase 5 PR-5A 的 `OverviewTab/InstanceHeader/InstanceTabsNav` 字节零改 — 复合 tab 切换无回归。 |
| 6. Security (/cso) | PASS | unauth 3 endpoint（list/single/grade）全 401。teacher2 跨户 POST grade /api/submissions/[id]/grade → **403 FORBIDDEN**（PR-SEC3 guard 仍生效）。drawer 附件链接 `target="_blank" rel="noopener noreferrer"` 防 reverse-tabnabbing。AI 建议 fetch + 评分 POST 都走 cookie session（无新攻击面）。无 schema/auth 改动 → 无需 /cso 深审。 |
| 7. Finsim-specific | PASS | UI 全中文（待批改/批改中/已出分/批改失败/搜索学生姓名/最新提交/分数从高到低/批量批改/AI 评分建议/置信度/教师评语/合计/未配置评分维度/学生答卷/AI 客户/正确/错误/未作答/暂无作答/题目/文本作答/附件/未知任务类型/已是最后一份待批改/评分已保存/已开始批改 N 份）。Route Handler 零改。无 schema 改动。Service 零改。API 响应格式不变。 |
| 8. Code patterns | PASS | 0 硬编码色（无 `#xxx` / `rgb()` / Tailwind 原色 *-N 命名）；avatar 用 dynamic `hsl(${hash%360}, 40%, 88%)` 走 inline style，是 procedurally-generated 头像背景标准模式（不是品牌色硬编码，**记观察**：未来可抽 `lib/style/avatar-color.ts`）；ARIA `role="tabpanel" + aria-labelledby="tab-submissions"`；Sheet drawer 用现有 `components/ui/sheet.tsx`；handler 都中文 toast；AnswerPanel 按 type dispatch；虚拟化 50 阈值 + 64px 行高 + 8 overscan + flat 渲染 fallback；批量选择不选 graded（toggleSelectAll L199 跳过 graded）。 |

## Issues found

**无阻塞**。

### Pre-existing（不归本 PR）

- **GET `/api/submissions?taskInstanceId=X` 缺 owner guard**：teacher2 能拉到 teacher1 的 submissions 列表（200 + 完整数据），未做 instance owner 校验。`app/api/submissions/route.ts` 自 71b1ede 起未改，PR-5B diff 空。建议作为 PR-SEC4（独立 fix），非本 PR 引入。
- **Attachment URL scheme 白名单缺失**：drawer 渲染 `<a href={a.filePath}>`，若 filePath 是 `javascript:` 协议会 XSS。PR-5B 只读，attachment 写入端（Phase 4 SubjectiveSubmission）未做白名单 — 攻击面是 attachment 写入而非 drawer 渲染。建议未来 PR 在 attachment write 端加 scheme 白名单（仅 https:// + 自家 CDN）。

### Builder 流程问题（已 QA 自行修复，记录用于复盘）

- **新依赖 `@tanstack/react-virtual` 加完后 dev server PID 59187 死了未重启**。Builder report 写 "dev server PID 59187 仍 on :3000" 实际不属实（QA 验证时 :3000 502 + lsof 空 + ps -p 无）。CLAUDE.md L122 明确"在告知用户完成之前必须重启 dev server 并验证页面能正常加载"。QA 已重启 PID 51695 完成 E2E。**建议 builder 后续加新依赖必须重启 + curl 自验**。这是流程瑕疵，但不影响本 PR 代码正确性，故仍判 PASS。

### 观察（非 FAIL）

- pageSize=100 上限：spec 单实例 ≤80 学生，每人 1 次提交基本覆盖；多 attempts 场景（用户超 100）会丢尾。Builder 已在 build report L45 标记，PR-5C 之前可考虑提至 500 或加"加载更多"。
- 批量批改逻辑：当前是"打开第一份 + 引导跳到下一份"，不是真异步 AI 重批 N 份。Builder 已说明（build report L48-50），spec 也未硬要求。
- avatar 用 inline `style={{background: hsl(...)}}` — dynamic 着色不违反 token 原则，但单点出现，未来可抽公共 util。
- 虚拟化 >50 路径无法在真实 dev 数据下视觉验证（DB 仅 1 份测试用 submission，已 cleanup）。靠 unit test + 测试 type-check 兜底。

## Phase 5 敏感点预检

- 本 PR **未**改 schema，Prisma 三步未触发。
- conceptTags 隐性工作：本 PR 不涉及 AI evaluation prompt。
- PR-5C 下一轮注意：build report 提到附件 url scheme 白名单 → 若 PR-5C 不解决，建议作 PR-SEC4 收尾。

## Overall: **PASS**

- 321/321 tests · tsc 0 · build 25 routes 0 warnings
- 真造 1 份 quiz submission · 完整 drawer flow E2E（POST 创建 201 → GET detail 200 → POST grade 200 → status 转 graded）
- 9 回归路由 200 · 跨户 POST grade 403 · 3 endpoint unauth 401
- 0 硬编码色 · 中文 UI 齐 · ARIA tabpanel 正确 · 附件 noopener noreferrer
- 测试数据 cleanup 0 残留

Ship 建议：可 commit。下一 PR-5C（Insights + schema 改动）注意 Prisma 三步 + AI 聚合成本守护 + conceptTags prompt 注入。
