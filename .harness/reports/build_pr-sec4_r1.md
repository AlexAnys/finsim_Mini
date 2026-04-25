# Build Report — PR-SEC4 · GET /api/submissions owner guard · r1

**Unit**: `pr-sec4`
**Round**: `r1`
**Date**: 2026-04-25

## Scope

QA 在 PR-5B regression sweep 独立发现 pre-existing P1：

- **攻击**：`GET /api/submissions?taskInstanceId=X` 缺 owner 守护
- **后果**：teacher2 能拉 teacher1 的提交列表（200，含学生姓名/分数/时间），数据泄漏
- **修复**：route handler 加入 `assertTaskInstanceReadable` / `assertTaskReadable` 调用 + "至少一个 scope filter"防广扫

## Files changed

### 修改

- `app/api/submissions/route.ts`（GET handler）
  - import `assertTaskInstanceReadable` / `assertTaskReadable` / `error`
  - 新增 "scope filter required" 检查（teacher/admin 必须传 taskInstanceId / taskId / studentId 之一；student 始终自动 scope 到自己）
  - `taskInstanceId` 提供时，teacher/admin 跑 `assertTaskInstanceReadable`
  - `taskId` 提供时，teacher/admin 跑 `assertTaskReadable`
  - student 路径不变（service 层 OR 子句已自动用 studentId override）

### 新文件

- `tests/sec4-submissions-list-guard.test.ts`（7 tests）— 文档化新接入的两个 guard 调用语义

### 未动

- `app/api/submissions/route.ts` POST handler 字节零改
- service 层、submission.service / resource-access guards 字节零改（复用 SEC1/SEC2 已建立的 guards）
- 其他所有文件零改

## Non-obvious decisions

1. **"至少一个 scope filter" 的安全网**
   原 GET 没有任何 scope 时会 `findMany({ where: {} })` 一把扫整个 Submission 表。即便 service 加了 owner 检查也躲不开"未指明对象"的扫描风险。所以加了"必须 taskInstanceId / taskId / studentId 之一"。学生身份自动有隐式 studentId（=user.id），所以学生不受影响——已用真 curl 验证 `/grades` 页面（`fetch("/api/submissions?pageSize=100")`）继续 200。

2. **复用现有 guards，不新增**
   - `assertTaskInstanceReadable` 已在 SEC2 落地（用于 by-id GET），其语义"teacher must be creator/collab"恰好就是本次需要的访问规则
   - `assertTaskReadable` 同理（用于 task by-id GET）
   - 不需要写新 guard，diff 极小

3. **学生路径不动**
   原代码已经强制 `effectiveStudentId = user.id`（即 student 永远只能看自己的）。即便 student 传任意 `taskInstanceId`，service 的 where 子句会同时 AND `studentId = 自己`，泄漏面被 service 层 already 关闭。本 PR 不重复加 guard 给 student 路径（避免冗余调用 + 多 1 次 DB 查询）。

4. **error code "FORBIDDEN" + custom message**
   "必须提供 taskInstanceId / taskId / studentId 之一" 走 `error("FORBIDDEN", ..., 403)`，不是 400。理由：从外面看属于"权限不足"（拒绝广扫），不是请求格式错误。

## Verification

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **328 passed**（321 baseline + 7 new） |
| `npm run build` | 0 errors / 0 warnings |
| 9 回归路由（teacher1）| 全 200 |

### 真 curl 攻击矩阵（dev server PID 51695）

| # | 场景 | 期望 | 实际 |
|---|---|---|---|
| 1 | teacher1 own instance | 200 + items | ✅ 200 `{success:true,data:{items:[],...}}` |
| 2 | **teacher2 → teacher1 instance（SEC4 攻击）** | 403 | ✅ 403 `{code:"FORBIDDEN"}` |
| 3 | no filter（teacher1）| 403 | ✅ 403 `必须提供 taskInstanceId / taskId / studentId 之一` |
| 4 | unauth | 401 | ✅ 401 `UNAUTHORIZED` |
| 5 | student1 own instance | 200 (auto-scoped) | ✅ 200 |
| 6 | **teacher2 → teacher1 task（taskId 攻击）** | 403 | ✅ 403 |
| 7 | teacher1 own task | 200 | ✅ 200 |
| 8 | admin → teacher1 instance | 200（bypass）| ✅ 200 |
| 9 | invalid instance id | 404 | ✅ 404 `任务实例不存在` |
| 10 | student no filter | 200（auto-scoped）| ✅ 200 |

10/10 通过。

### 单元测试覆盖（7 new）

- assertTaskInstanceReadable 5 例（teacher non-owner FORBIDDEN / teacher owner OK / teacher collab OK / admin bypass / 404）
- assertTaskReadable 2 例（teacher non-creator FORBIDDEN / creator OK）

## Open concerns / QA hints

1. **零 scope 防扫策略**：本 PR 强制要求至少 1 个 scope。如果未来管理员页有"全局看所有 submissions" 需求，**需要为 admin 显式 bypass 该检查**——目前 admin 也必须传至少 1 个 scope（场景 3 说明）。这是设计选择：admin 通常应该指定查询对象，不应该批量拉。如果 PM 反对该收紧，下一次 PR 加 `if (user.role === "admin") skip-check`。

2. **service 层无须改**：原 service 接口签名不变（`getSubmissions({ taskInstanceId, studentId, taskId, status, page, pageSize })`），调用代码 byte-identical。

3. **dev server 无须重启**：route 文件改动在 Next.js 文件 watcher 范围内自动 pick up；已用真 curl 矩阵验证不需要 cold restart。

## 状态

Ready for QA。Task #62 待 PASS 后标 completed，回到 PR-5C（带 schema 改动 + Prisma 三步 + AI 调用，开工前先 SendMessage team-lead 告知字段名）。
