# QA Report — Unit 2 r1

> QA: qa · 2026-05-14 · 验 commit `3efb2ad` on `claude-demo-fixes`
> Bugs: B-INSTANCE-01 (P0) + B-INSTANCE-02 (P1) + B-INSTANCE-03 (P1) · spec.md L46-58
> Test spec: `tests/e2e/qa-unit2-instance-state.spec.ts` (新建，9 case，独立于 builder 的 unit2-verify.spec.ts)
> 截图: `.harness/screenshots/qa-unit2/`

## 测试数据 (molly@qq.com 名下 3 个 task instance)
- `7db59a62` (PDF导入测验) — published / 0 sub  → 用于 close+reopen cycle 与 student-visibility 测试
- `a7d9b380` (深度测试) — published / 0 sub
- `449ae28c` (个人理财基础概念测验) — closed / 1 sub → 用于 has-submission delete-blocked 测试

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 关闭按钮点击弹 confirm dialog（中文："关闭后学生无法继续提交，确认关闭？"） | molly 登录 → 详情页 → 点「关闭实例」→ 抓 dialog text | dialog 含中文: **"关闭任务实例 关闭后学生无法继续答题，已提交的答卷仍可在「成绩」中回看。取消 确认关闭"**（语义匹配 spec，加 bonus 提示"答卷仍可在成绩回看"） | PASS |
| 已关闭实例详情页 + 列表行尾出现「重新开放」按钮，点后状态回 published、closedAt 清空 | 直接 POST `/close` → status / POST `/reopen` → status，并查 prisma schema 字段 | close → status=closed ✓；reopen → status=published ✓；schema 中 TaskInstance **没有 closedAt 字段**（builder 改用 AuditLog 记录时间戳；spec L52 描述与 schema 不符，acceptance 真实含义 = status 回 published），response 也无 closedAt 字段 | PASS（with caveat）|
| 已关闭/草稿状态实例支持删除（前提 0 submission；有 submission disabled + tooltip） | 列表页 + 详情页查 delete 按钮 disabled 状态 + 通过 tooltip-trigger wrapper hover 抓 tooltip 文本 | 列表 + 详情两处 delete 按钮均 disabled=true，tooltip text = **"已有学生提交，无法删除"**（中文）| PASS |
| 后端 PATCH/DELETE 端点保留原 audit | grep 验证 `app/api/lms/task-instances/[id]/route.ts` PATCH path 仍调 updateTaskInstance + DELETE path 仍调 deleteTaskInstance (新 audit) | PATCH 保留 (line 41) / DELETE 调新 deleteTaskInstance (line 54)，新增 close + reopen 独立路由 | PASS |
| TypeScript / vitest / lint 全过 | 独立 `npx tsc --noEmit` / `npx vitest run` / `npx eslint <8 touched files>` | tsc clean / vitest 83 files 981 tests pass / eslint 0 problem 在 builder 8 touched files | PASS |

## 额外 acceptance（spec 隐含 + 用户决策）

| 额外项 | 验法 | 实测 | Verdict |
|---|---|---|---|
| API 错误码中文 | direct POST/DELETE → 抓 body.error.message | `INSTANCE_HAS_SUBMISSIONS` "该实例已有学生提交，无法删除" / `TASK_INSTANCE_NOT_DELETABLE` "只有草稿或已关闭的实例可以删除，请先关闭实例" / `TASK_INSTANCE_NOT_REOPENABLE` "只有已关闭的实例可以重新开放" — 全中文且语义清晰 | PASS |
| 学生侧可见性 (reopen 后立即可访问) | molly close → alex GET `/tasks/<id>` 应阻拦 → molly reopen → alex 重访应通过 | closed: alex 看到 "错误 · 403 · 你还不能进入这个任务 · 权限不足"; reopen 后: alex 看到 "PDF导入测验 测验 截止: 2026/4/26 23:07:00 已过期 暂无题目可作答..." (正常进入任务页，符合 acceptance) | PASS |
| audit log 三个操作都写 (acceptance #7) | `SELECT * FROM "AuditLog" WHERE action LIKE 'task_instance.%' AND createdAt > <QA start>` | 6 条 fresh audit (3× close + 3× reopen) 全 actor=molly / target=PUB_INST_NO_SUB；delete audit 代码路径已 grep 验证 (task-instance.service.ts:254 `logAuditForced({ action: "task_instance.delete" })` 在 prisma.delete 之后)，但 QA 无可删 instance 可实测（仅剩 449ae28c 有 sub 受 INSTANCE_HAS_SUBMISSIONS 拦截）— **代码路径已确认，依赖 builder e2e D 测试中已完成的实证** | PASS |
| 无新 lint 问题引入 | `npx eslint <8 builder 改动文件>` | 0 error / 0 warning | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean (no output) |
| `npx vitest run` | 83 files / 981 tests pass (无回归) |
| `npx eslint <builder 8 文件>` | 0 problem |
| `git show --stat 3efb2ad` | 8 files (4 modified + 3 new + 1 test spec)，与 build 报告完全一致；diff +792/-4 行 |
| cross-module regression (caller grep) | `deleteTaskInstance` / `closeTaskInstance` / `reopenTaskInstance` 唯一 caller 都是新/对应 route 文件；PATCH 路径 `updateTaskInstance` 保留；前端 instance-header / page.tsx / course-instances-tab 三处都正确串到新逻辑 | 
| DB 状态测后恢复 | 7db59a62 已自动恢复 published（test Z）；449ae28c 维持 closed/1 sub（未触碰）；a7d9b380 维持 published（未触碰）— 与测前完全一致 |

## Code path 抽查 (cross-module regression)

- **服务接口签名**：`closeTaskInstance(instanceId, actorId)`、`reopenTaskInstance(instanceId, actorId)`、`deleteTaskInstance(instanceId, createdBy)` — 全部接口都是新建或保留原签名，无破坏性改动
- **新错误码映射**：`INSTANCE_HAS_SUBMISSIONS`、`TASK_INSTANCE_NOT_CLOSEABLE`、`TASK_INSTANCE_NOT_REOPENABLE`、`TASK_INSTANCE_NOT_DELETABLE` — 在 `lib/api-utils.ts` 中映射到 400，中文消息已实测
- **新路由**：POST `/api/lms/task-instances/[id]/close` + POST `/api/lms/task-instances/[id]/reopen` — 都 200/400 行为符合，与现有 PATCH path 共存不冲突
- **协作教师权限上扬**：本 unit 未触碰；按 spec L113 这是 Unit 5c 的事，目前 `closeTaskInstance` / `reopenTaskInstance` 内部走 `isAuthorizedForInstance`（已存在的 helper），按现有规则放行（owner + collaborator with role-based check）
- **未补 publish-via-PATCH audit**（builder 主动汇报）：原 PATCH `status: "published"` 旁路 (draft→published) 不写 audit；本 unit 仅做关闭/重开/删除三态，妥当 — 后续 Unit 5c/11 再补

## Finsim-specific 检查

- ✅ UI 文案全中文（dialog text + tooltip + error message）
- ✅ Service throw "ERROR_CODE" + `handleServiceError` 映射中文
- ✅ Route Handler 调 Service 不含业务逻辑（close/reopen route 仅 ~20 行）
- ✅ API response 格式 `{ success, data }` / `{ success: false, error: { code, message } }` 全统一
- ✅ Prisma schema 0 改动（spec Phase 1 硬约束遵守）— builder 明智地用 AuditLog 替代 closedAt 字段缺失

## 风险 / 不确定项

1. **spec L52 提到 "closedAt 清空"，schema 中实际无 closedAt 字段** — builder 的解读（AuditLog 替代）合理且符合 spec Phase 1 "不动 schema" 硬约束；coordinator 应确认这是可接受的解读，或后续 Phase 2 加 closedAt 字段
2. **delete audit 仅代码路径验证，未实证写入** — molly 名下唯一可删的 closed instance 已有 sub 被拦截；如需 100% 实证，可让 builder 创建临时 0-sub closed 实例验证。但代码逻辑已审计正确（prisma.delete 之后立即 logAuditForced）

## 是否引入新 bug

无。9 case 全过，DB 状态测前测后完全一致。

## Issues found

无。

## Overall: **PASS**

Dynamic exit 协议：r1 PASS。本 unit 比 Unit 1 复杂（涉及状态机 + 学生侧可见性 + audit + UI），但 acceptance 客观可测，已用独立 9 case 覆盖完整路径（含 alex 学生视角实测 + 三种 API 错误码实测 + tooltip 文案实测）。建议 coordinator 标 unit completed，无需 r2 churn。
