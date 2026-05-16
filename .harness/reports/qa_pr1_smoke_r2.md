# QA Report — PR-1 Candidate A · 5 主线 smoke (r2)

> QA: qa-pr1-smoke · Branch under test: `claude-codequality-pr1` @ `c86f996`
> Target: https://staging.finsim.anlanai.cn (deployed @ 07:03 UTC)
> Run cmd: `PLAYWRIGHT_BASE_URL=https://staging.finsim.anlanai.cn npx playwright test tests/e2e/smoke/0{1,2,3,4,5}-*.spec.ts --workers=1`
> Accounts: seeded baseline (`teacher1@finsim.edu.cn` / `student1@finsim.edu.cn` / `admin@finsim.edu.cn` — password123). 未触碰 molly 演示数据.
> r1 verdict (this session 早): 4/5 FAIL → 退回 builder r2

## 结果总览

| # | smoke | r1 verdict | r2 Run 1 | r2 Run 2 | 关键证据 |
|---|---|---|---|---|---|
| 01 | teacher 建任务 → 建实例 → publish | FAIL | **PASS 2.9s** | **PASS 2.4s** | subjective `prompt` 字段 + `cleanupPublishedTaskAndInstance` helper |
| 02 | teacher 建 sim → student 提交 | FAIL | **PASS 4.5s** | **PASS 3.7s** | sim `scenario`+`openingLine` + student-class-match + `transcript` 字段 |
| 03 | teacher 手动 grade + release → student 看到分数 | FAIL | **PASS 5.6s** | **PASS 4.2s** | sub `prompt` + class-match + `Number(score)` (Prisma Decimal) |
| 04 | student 自由问 SB | FAIL | **PASS 2.6s** | **PASS 1.9s** | list shape `data ?? []` |
| 05 | admin 触发 weekly-insight cron | PASS | **PASS 2.4s** | **PASS 1.8s** | (r1 已 PASS, 无改动) |

**Overall: 5/5 PASS ✓** (Run 1: 19.5s · Run 2: 15.0s)

CI staging-deploy job (gh run 25955477054): **GREEN** — Playwright step 跑 16 tests (5 主线 + 4 pr1_qa_regression + 6 pr1_schema-cleanup_verify + 1 sanity) 全过 2.8m

完整 playwright 输出: `.harness/screenshots/pr1-qa-smoke/r2-playwright-output.log`

---

## r1 → r2 修法验证

| r1 P0 | r1 spec 错误 | r2 修法 (确认已生效) | QA 验证 |
|---|---|---|---|
| 01 / 03 | subjectiveConfig 缺 `prompt` + 含无效 `wordLimit` | `subjectiveConfig: { prompt: "smoke 测试: 请回答下方主观题", allowedAttachmentTypes: [] }` | r2 Run 1+2 POST /api/tasks 全 201 |
| 02 | simulationConfig 缺 `scenario`+`openingLine` + 含无效 `rounds`/`timeLimitSeconds` | `simulationConfig: { scenario: "smoke 测试场景...", openingLine: "您好..." }` | r2 Run 1+2 POST /api/tasks 全 201 |
| 04 + _setup | `listJson.data?.items` ↔ API 实际 `data: [array]` | 02/04 spec + `_setup.ts:111` 都改为 `(json?.data ?? []).find(...)` | r2 Run 1+2 find 成功 |
| 02 hidden | dialogue field name wrong | 改 `transcript: [{ id, role: "student"/"ai", text, timestamp }]` | r2 Run 1+2 submit 全 200 |
| 03 hidden | Prisma Decimal score JSON-stringify | `expect(Number(studentJson.data.score)).toBe(85)` | r2 Run 1+2 release+grade 全 200 |
| 02 hidden | student/teacher class mismatch (random course → 403) | `getOwnClassId(sr)` student 先登录拿 classId → teacher `courses.find(c.classId === studentClassId)` | r2 Run 1+2 submit 不再 403 |
| smoke-01/02/03 hidden | task delete blocked by published instance | `cleanupPublishedTaskAndInstance(close → delete inst → delete task)` helper | 详见 Issues |

---

## Issues found

### P2 minor — `cleanupPublishedTaskAndInstance` 偶发 race: task delete 失败但被吞 (1/16 CI 实测)

**现象**:
- CI 跑 smoke-01 (07:00:34 → 07:00:45)，cleanup 后 staging 留 1 task: `smoke-01-task-1778914843787` (createdAt 07:00:43.930Z)
- 该 task 的 instance 已删（detail 查 `instances: []`），但 task 本身没删
- 我自己手动 delete `/api/tasks/{id}` 立即返回 200, 没有任何错误 — 说明 delete 路径本身正常
- 我自己复现的 trace test (close → del inst → del task) 4 步全 200，cleanup 工作

**根因怀疑** (lib/services/task.service.ts:407-413):
```ts
const instanceCount = await prisma.taskInstance.count({ where: { taskId } });
if (instanceCount > 0) {
  throw new Error("TASK_HAS_INSTANCES");
}
```
- 在 `DELETE instance` 返回 200 之后**立即**调 `DELETE task`，instanceCount 在某些 race 下还看到 1 → 拒删
- 同时 helper 用 `.catch(() => {})` 把 throw 静默吃掉 (`_setup.ts:99`)，所以 spec 看不到失败
- spec 仍 PASS，但 task 残留

**影响**:
- staging baseline 漂移 (积累 smoke task)
- 不影响 PR-1 acceptance (spec 仍 5/5 PASS)，不阻塞 merge
- **不是 r2 builder 新引入** — r1 cleanup 是直接 `delete instance` 也会同款 race，只是 r1 因为前置 create 阶段就 400, helper 根本没机会跑

**建议（不阻塞 PR-1，给后续 PR 跟进）**:
1. helper 加 retry-on-TASK_HAS_INSTANCES (2 retry + 1s 间隔)
2. 或 helper 把 `.catch(() => {})` 改为 `.catch(e => console.warn(...))` 以便 CI 日志可见
3. 或 service `deleteTask` 改为软删 / 用 transaction 把 count + delete 串起来

**清理**: 我已 hard-delete 1 个 CI 残留 task. Staging baseline now: 0 smoke task / 0 instance / 0 visible SB post.

### P3 note — soft-delete SB 残留 (设计如此)

`DELETE /api/study-buddy/posts/{id}` 是 hide (设 `hiddenAt`)，不是 hard-delete。每次 smoke-04 run 后会留 1 个 hidden SB post (audit append-only 设计)。

- visible 列表 (我用 `/api/study-buddy/posts?take=200`) **看不到** hidden post，所以这不影响下次 smoke
- 与 r1 一致行为，builder 在 r2 build report L100 也确认是设计

---

## 8-dim checklist

| # | check | verdict | evidence |
|---|---|---|---|
| 1 | Spec compliance | **PASS** | A 专属 acceptance "5 主线 smoke 编写完" 全过；spec.md QA 段 "在 staging 跑 5 条主线 smoke" 100% PASS |
| 2 | tsc --noEmit | N/A | QA scope = e2e on staging |
| 3 | vitest run | N/A | QA scope = e2e on staging |
| 4 | Browser (Playwright on staging) | **PASS** | 5/5 × 2 runs (Run 1: 19.5s / Run 2: 15.0s) + CI staging-deploy job 16/16 PASS @ 2.8m |
| 5 | Cross-module regression | **PASS** | r2 改动仅 5 smoke spec + `_setup.ts`; 0 影响生产代码; grep -L 改动文件 = 0 in lib/app/components |
| 6 | Security (/cso) | N/A | smoke 不动 auth/perm/payment 模块。**Bonus**: r2 加 student-class-match 实际**收紧**了覆盖 — 验证了 assertTaskInstanceReadable 真实 enforce |
| 7 | Finsim-specific | **PASS** | 中文 UI 保留; Route Handler 0 改动; API `{success, data/error}` 格式保留; `requireRole` 用法 (后端) 不变 |
| 8 | Code patterns | **PASS** | `_setup.ts` 新加 `getOwnClassId`+`cleanupPublishedTaskAndInstance` helper 抽取得当 (共享, 3 specs 复用); 5 smoke 独立无 inter-spec dependency; cleanup cascade 顺序 (submission → close → del inst → del task) 符合 finsim service constraint (P2 race 是 service 层 instanceCount race, 不是 helper 设计错) |

---

## Staging side-effect 审计 (run 后)

| 资源 | r2 创建 (Run 1+2 × 5 specs = 10 次主线) | 我 cleanup 后 | 残留 (写入时刻) |
|---|---|---|---|
| Task (smoke-01/02/03) | 6 (smoke-01:2, smoke-02:2, smoke-03:2) | hard-delete 0 (helper 全删) + 1 CI 残留 (我手动删) | **0** |
| TaskInstance | 6 | 同上 | **0** |
| Submission (smoke-02/03) | 4 | 同上 | **0** |
| SB Post visible (smoke-04) | 2 | API DELETE = soft hide | **0 visible** (2 hidden, audit append-only 设计) |
| AuditLog | ~30 (每 publish/create/delete 各 1 行) | append-only by design | **保留** (与 finsim 标准一致) |

---

## Overall: **PASS** ✓

**理由**:
- 5/5 主线 smoke 在 staging 真栈 PASS × 2 idempotent
- 所有 r1 P0 (5 个) 全部 r2 已修
- 4 个 r2 顺手抓的 hidden bug (class-match / transcript / Decimal score / cleanup cascade) 验证全部生效
- CI staging-deploy job GREEN 与我本地结果完全一致 (CI 16/16, 包括 pr1_qa_regression + pr1_schema-cleanup_verify)
- 1 个 P2 minor (cleanup race) 不阻塞 PR-1, 建议后续 PR 跟进

PR-1 A 候选 → done. 等其他 candidate QA 完后 PR-1 整体可 merge.

---

## 给 team-lead 的总结一句

**qa-smoke r2 PASS 5/5** — Run 1 19.5s / Run 2 15.0s idempotent; CI staging-deploy 16/16 同款 GREEN; 1 P2 minor cleanup race (CI 残留 1 task 已手动清, 不阻塞 PR-1, 建议后续小 PR 修).
