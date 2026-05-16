# Spec — Code Quality PR-1 (2026-05-16)

> ⚠️ **行为底线**：不走捷径 — 任何跳过 / 接受 < 100% acceptance 必须先 ask 用户，结果立刻写进 `.harness/spec.md` + commit。

> Coordinator: claude (main agent) · Team: `probe-demo` (复用) · Branch: `claude-codequality-pr1`（base = main `56b49e8`）
> 用户标准: 长期效果好 + 稳定 + 高质量 + 不走捷径
> 来源: `.harness/spec-codereview-archive.md` 7 路 review + coordinator 综合 numbered candidates
> User staging 兜底: 1 次 (PR-1 进 staging 后 5-10 min 真浏览器主线点)

## 用户意图（原话）

> "希望长期功能效果好 + 稳定 + 代码质量高 + 不走捷径。每次 PR 后 e2e 真测过才进下一步。10 个候选不要分太多批，最多 2 PR。我顶多新开 session 或你并行处理。"

## 范围 — PR-1（4 候选并行）

| 候选 | 名 | 改什么 | builder | 风险 |
|---|---|---|---|---|
| **A** | CI 测试基础 | playwright.config.ts (官方) + 5 主线 smoke 进 CI + 90 个 mutation route 加 200/401/403 三角 + 删 21 个 readFileSync grep 守 + 加 lib/db/test-helpers.ts 共享 fixture | builder-test-infra | 极低 (纯加 + 删死代码) |
| **D** | 审计 default-on | 删 ENABLE_AUDIT_LOGS env gate + 合并 logAudit→logAuditForced (rename → logAuditEvent) + 给 publish/snapshot-update/title-update/grading 等漏掉 audit 的写操作补 audit + 加 actorRole 字段 | builder-audit | 极低 (审计表 append-only) |
| **E** | AI prompt 集中 | 新 lib/ai/prompts/ 目录 (12 feature builder 文件) + 35 处 inline prompt 提到 builder + lib/services/ai-tool-settings.ts basePromptPreview 改成从 builder import 派生 + 每 builder 加 promptVersion 写到 AiRun.promptVersion | builder-ai-prompts | 低 (重构 prompt 字字不变) |
| **I+J** | Schema 清理 | 删 TaskInstanceAnalytics 死表 + 删 Task.analytics 关系 + 删 Visibility enum + Task.visibility + 删 Task.courseName/chapterName 冗余 + 标 Course.classId deprecated（不删，留迁移期） + 改 5 处 OR pattern 收敛到 CourseClass + 删 Class.code/academicYear/departmentName 死字段 (verify 真死) | builder-schema-cleanup | 低 (Prisma 三步严格走 + 备份) |

## Acceptance criteria（每候选独立 100% PASS 才进 PR）

### 通用 acceptance（所有候选）
1. ✅ `npx tsc --noEmit` 0 new error (baseline 6 pre-existing study-buddy errors 维持)
2. ✅ `npx vitest run` 全过 + 0 regression
3. ✅ `npm run lint` 0 error
4. ✅ 改动 ≤ 1500 行 diff (单 PR 总和)
5. ✅ 任何 schema 改动严守 CLAUDE.md "Prisma 三步" (migrate dev + generate + 重启 dev server + 验证页面)

### A 专属 acceptance
- ✅ `playwright.config.ts` 存在且有效 (browser=chromium / 单 worker / staging URL)
- ✅ 5 主线 smoke 编写完: ① teacher login → 建 task instance → publish ② student login → 进 instance → 提交 simulation ③ AI grade → released ④ student SB 自由问 → AI reply ⑤ teacher 一周洞察 ≥1 教师有提交 → 出报告
- ✅ `.github/workflows/ci.yml` 增加 playwright 主线 smoke step (可 fail-on-error 或 warning, builder 决定 + ask coord)
- ✅ 90 mutation route 中至少 30 个有 200/401/403 三角测试 (按依赖热度选 + ask coord)
- ✅ 21 个 readFileSync grep 守 (`tests/pr-*.test.ts` 系列) 删除或重写为真 RTL test
- ✅ 加 `tests/_fixtures/prisma.ts` + `tests/_fixtures/users.ts` 共享 helper

### D 专属 acceptance
- ✅ `ENABLE_AUDIT_LOGS` env gate 删除 (audit.service.ts + .env.example + .env.production.example)
- ✅ `logAudit` 函数删除 (rename `logAuditForced` → `logAuditEvent`，所有 caller 同步)
- ✅ 给 PR #13 留下的两个 mutation 路径 (updateTaskInstance/updateTaskInstanceSnapshot) 加 audit
- ✅ 给 grading auto-grade (gradeSimulation/gradeQuiz/gradeSubjective) 加 audit (action: ai_grading.complete with model+tokens metadata)
- ✅ logAuditEvent 接口加 `actorRole` field (wrapper 内 fall back 用 getCourseActorRole 自动推导)
- ✅ vitest 覆盖: assert publish/ai-grade/snapshot-update 在 ENABLE_AUDIT_LOGS 任意值都写 AuditLog
- ✅ 真浏览器: molly 改 instance title → /admin/audit 看到 audit 行 + actorRole=owner

### E 专属 acceptance
- ✅ `lib/ai/prompts/` 目录建立, 12 个 feature 各 1 文件: `simulation-chat.ts` / `simulation-evaluate.ts` / `quiz-short-answer-grade.ts` / `quiz-concept-tags.ts` / `quiz-question-tagger.ts` / `subjective-grade.ts` / `study-buddy-reply.ts` / `study-buddy-summary.ts` / `socratic-hint.ts` / `weekly-insight.ts` / `insights-aggregate.ts` / `scope-insights.ts` (其余按 review-ai F-3 列表补)
- ✅ 每个 builder 文件 export `{ buildSystemPrompt(opts), buildUserPrompt(opts), version: "v1" }`
- ✅ 12 service 内 35 处 inline prompt 全部改成调 builder
- ✅ AiRun.promptVersion 写真版本 (从 builder 取，不再硬编码 "v1")
- ✅ `AI_TOOL_DEFINITIONS.basePromptPreview` 字段改成从 builder.buildSystemPrompt({}) 截取或派生 (单源)
- ✅ vitest snapshot test 每 builder 一组 (锁 prompt 内容防漂移)
- ✅ 真浏览器: molly /teacher/ai-settings 看到的 preview 与运行时 prompt 第一段一致 (人工 diff)

### I+J 专属 acceptance
- ✅ migration 包含: `DROP TABLE TaskInstanceAnalytics CASCADE` + `ALTER TABLE Task DROP COLUMN visibility, DROP COLUMN courseName, DROP COLUMN chapterName` + `DROP TYPE Visibility` + 标记 `Course.classId` deprecated 注释
- ✅ Prisma 三步严格走: migrate dev + generate + 重启 dev server + 验证页面
- ✅ Course.classId + CourseClass 双源 OR pattern 5 处 (dashboard.service.ts:184-185,224,237 / course.service.ts:199-202) 收敛到 CourseClass-only 查询
- ✅ Class.code/academicYear/departmentName 验证真死后删 (grep 全 codebase 确认无 reader 后再删)
- ✅ 旧 reader (dashboard.service computeLiveAnalytics 注释 "TaskInstanceAnalytics 死表") 注释清理
- ✅ vitest 全过 + 真浏览器: molly /teacher/dashboard / /teacher/courses / /teacher/instances 完整加载

### Cross-builder coordination
- E 改 `lib/services/ai.service.ts` 内 prompt 段, D 也可能改 ai.service 的 audit 写入 — 两人 schedule 错开 commit (D 先 commit 然后 E rebase, 或 E 在不同 function 工作)
- I+J 改 schema, 其他 builder vitest 跑前必须 `npx prisma generate` (CLAUDE.md "Prisma Gotchas")
- A builder 完成后, 其他 builder 可以用 A 提供的 fixtures 写 vitest

## Workflow（每 builder 严格遵守）

1. **Builder 接手 spec** → 写 plan 报告 `.harness/plans/pr1_{name}_plan_r1.md` (实现方案 + 文件清单 + 风险) → SendMessage coord 1 句 plan summary
2. **Coordinator 审 plan** → 批准/反馈 → builder 开始
3. **Builder 实现** → 单 commit 或多 commit (按需，每 commit 跑 tsc + vitest 单 file) → 完成报告 `.harness/reports/build_pr1_{name}_r1.md`
4. **Builder SendMessage coord** → "build done, ready for QA"
5. **Coordinator spawn QA** (待 builder 全完成后批量 spawn 2 qa)
6. **QA 真浏览器跑 acceptance** → 写 `.harness/reports/qa_pr1_{name}_r1.md`
7. **Dynamic exit**: PASS 100% → 该候选 done; FAIL 同样问题连续 3 轮 → coord 介入重 plan
8. **每候选 done 写一行 progress.tsv**
9. **任何想 skip 任何 acceptance 必须先 ask coordinator，coord 必须 ask 用户**

## QA 阶段（builder 全完成后）

- **qa-pr1-smoke**: 在 staging 跑 5 条主线 smoke (Playwright on staging.finsim.anlanai.cn)
  - 必须用真账号 (molly@qq.com / alex@qq.com 等 demo 账号)
  - 任何 e2e 失败 → block PR
- **qa-pr1-regression**: 全量 vitest + 4 候选每个的核心路径真浏览器抽样
  - PR-1 整体 commit 后跑全量, 不分 candidate
  - 抽样: A→CI 红绿验证 / D→/admin/audit 显示新 audit / E→teacher ai-settings preview / I+J→死表死字段读路径不挂

## PR 推送

- 4 candidate + qa 全 PASS → push 触发 GitHub PR 自动开
- CI quality job (vitest + tsc + lint) + staging-deploy job 双绿
- @用户 staging URL 5-10 min 真浏览器主线点
- 用户 OK → squash merge → main → 生产部署 (~4 min)

## 不在 PR-1 范围（明确排除）

- 候选 B (JSON 边界) → PR-2
- 候选 C (route 搬 service) → 长期 backlog 5-10 小 PR
- 候选 F (AI 安全) → PR-2
- 候选 G (权限合并 + JWT) → PR-2
- 候选 H (PR #13 followup) → PR-2 (PR #13 已 merge, 可顺手做)

## 风险登记

- **Schema 改动 destructive**：I+J 删 4 个表/字段，**必须 prod DB 备份后** migrate (CI staging 自动用 ephemeral DB，prod 用户 merge 前必须备份；coord 在 PR description 显式写 "需 prod 备份"提醒用户)
- **Audit 表写入压力**：D default-on 后 audit 量上升，监测 audit 表大小与查询性能 (review-arch 已确认 (action) + (createdAt) 索引匹配)
- **prompt registry 改动**：E 改 prompt 字字不变，但若 builder 误改单个字符，AI 行为可能漂移 — vitest snapshot test 防止
- **CI playwright fail-on-error**：A 加 playwright 进 CI 可能 flaky (staging 共享栈)，builder 决策 fail-on-warn 还是 fail-on-error — ask coord 后定
- **跨 worktree commit 顺序**：A/D/E/I+J 4 个 builder 用 isolation: "worktree" 隔离工作, coord 整合时按依赖序 cherry-pick (建议: A → D → I+J → E, 因为 E 可能用到 A 的 fixtures + D 的 audit 已落地)

## 接力

会话结束前 coord 更新 `.harness/HANDOFF.md`，列:
- PR-1 进度 (which candidate done / qa pending / merged?)
- PR-2 候选清单 (待 PR-1 merge 后做)
- Backlog 候选 C 长期跟踪
