# QA Report — PR-1 Candidate A · 5 主线 smoke (r1)

> QA: qa-pr1-smoke · Branch under test: `claude-codequality-pr1` · PR #14
> Target: https://staging.finsim.anlanai.cn (deployed commit at QA time)
> Run cmd: `PLAYWRIGHT_BASE_URL=https://staging.finsim.anlanai.cn npx playwright test tests/e2e/smoke/0{1,2,3,4,5}-*.spec.ts`
> Accounts: seeded baseline (`teacher1@finsim.edu.cn` / `student1@finsim.edu.cn` / `admin@finsim.edu.cn` — password123). 未触碰 molly 演示数据.
> 监测：staging-deploy CI 仍在 pending (PR #14 同时跑 Playwright in CI on staging)，我跑的是本地客户端打 staging API 的独立验证.

## 结果总览

| # | smoke | verdict | 关键证据 |
|---|---|---|---|
| 01 | teacher 建任务 → 建实例 → publish | **FAIL** | `POST /api/tasks` 返回 400 VALIDATION_ERROR (`subjectiveConfig` schema mismatch) |
| 02 | teacher 建 sim → student 提交 | **FAIL** | `POST /api/tasks` 返回 400 VALIDATION_ERROR (`simulationConfig` schema mismatch) |
| 03 | teacher 手动 grade + release → student 看到分数 | **FAIL** | 同 01: `POST /api/tasks` (subjective) 返回 400 → 后续步骤连锁失败 (Cannot read properties of undefined 'id') |
| 04 | student 自由问 SB | **FAIL** | `POST /api/study-buddy/posts` 成功 (201)，但 list 返回 contract mismatch — spec 读 `data.items`, API 返 `data: [...]` |
| 05 | admin 触发 weekly-insight cron | **PASS** | 200, success=true, `data.results=[4 teachers, all ok]` 含 teacher1 + molly + admin + teacher2 |

**Overall: 1/5 PASS, 4/5 FAIL**

完整 playwright 输出: `.harness/screenshots/pr1-qa-smoke/playwright-output.log`
失败截图: `.harness/screenshots/pr1-qa-smoke/test-results/0{1,2,3,4}-*/test-failed-1.png` (4 张)

---

## 根因分析

**所有 4 FAIL 都不是 staging 环境问题；4 FAIL 全部是 candidate A 在 `tests/e2e/smoke/0{1,2,3,4}-*.spec.ts` 写的 payload / 响应解析与现行生产 schema 不一致**。

### Smoke-01 / Smoke-03 — `subjectiveConfig` schema mismatch

**Spec 发送**:
```ts
subjectiveConfig: {
  wordLimit: 100,                 // ← 字段不存在于 schema
  allowedAttachmentTypes: [],
}
```

**实际 `lib/validators/task.schema.ts` `subjectiveConfigSchema` 要求**:
```ts
{
  prompt: z.string().min(1, "题目提示不能为空"),  // ← REQUIRED
  allowTextAnswer: z.boolean().default(true),
  allowedAttachmentTypes: z.array(z.string()).default([]),
  referenceAnswer?: string,
  evaluatorPersona?: string,
  strictnessLevel?: enum (defaults MODERATE),
}
```

**API 返回**（我用 probe 抓的）:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "fieldErrors": {
      "subjectiveConfig": ["Invalid input: expected string, received undefined"]
    }
  }
}
```

→ 缺 `prompt` 字段；`wordLimit` 是无效字段名（schema 没有这个）。

**修法**:
```ts
subjectiveConfig: {
  prompt: "请回答 smoke 测试题目",
  allowedAttachmentTypes: [],
}
```

### Smoke-02 — `simulationConfig` schema mismatch

**Spec 发送**:
```ts
simulationConfig: {
  rounds: 3,                  // ← 字段不存在
  timeLimitSeconds: 600,      // ← 字段不存在
}
```

**实际 `simulationConfigSchema` 要求**:
```ts
{
  scenario: z.string().min(1, "场景描述不能为空"),    // ← REQUIRED
  openingLine: z.string().min(1, "开场白不能为空"),  // ← REQUIRED
  dialogueRequirements?: string,
  studyBuddyContext?: string,
  evaluatorPersona?: string,
  strictnessLevel?: enum,
  systemPrompt?: string,
}
```

**API 返回**:
```json
{
  "fieldErrors": {
    "simulationConfig": [
      "Invalid input: expected string, received undefined",
      "Invalid input: expected string, received undefined"
    ]
  }
}
```

→ 两个 required string (`scenario` + `openingLine`) 都缺；`rounds` / `timeLimitSeconds` 是无效字段名（runner 处的 `rounds` 概念跟 DB schema 没映射关系，这俩字段从来不在 DB-level Task simulationConfig 里）。

**修法**:
```ts
simulationConfig: {
  scenario: "smoke 测试场景：跟客户讨论分散投资策略",
  openingLine: "您好，今天想了解一下分散投资？",
}
```

### Smoke-04 — SB list 响应 shape mismatch

**Spec 读**:
```ts
const found = (listJson.data?.items ?? []).find(...)
```

**API 实际返回** (我用 probe 抓):
```json
{ "success": true, "data": [ { "id": "...", "title": "smoke-04-free-...", ... }, ... ] }
```

→ `data` 是数组，**不是 `{ items: [...] }`**。`listJson.data?.items` 永远是 undefined → `?? []` → `find` 返回 undefined → fail。

create 调用本身 (201, success=true, 列表里确实有刚建的 post) 都是正常的，bug 纯粹在断言侧。

**修法**: `const found = (listJson.data ?? []).find(...)`

**同时**: `_setup.ts:88` 的 `cleanupSmokeSbPosts` 也用错 shape — `const posts = json?.data?.items ?? []`，所以 cleanup 也不工作（导致 staging 上残留多个 smoke post，我已手动清理 6 个）。要同步修。

### Smoke-03 second-order failure

`03` 在 `const taskId = (await createTaskRes.json()).data.id` 处崩 `Cannot read properties of undefined ('id')`，因为它没 `expect(status).toBe(201)`，create 直接 400 → `data` 是 undefined。改完 subjectiveConfig 后会顺带解决，**但建议 03 spec 也加 `expect(createTaskRes.status()).toBe(201)`** 提前 bail-out，否则未来类似问题报错堆栈不直观。

### Smoke-05 PASS — 真的 PASS

我额外抓了 weekly-insight 响应：

```
status: 200
success: true
data.total/succeeded/failed/results
results: 4 teachers, all ok:true
  - molly@qq.com           (有提交数据 — spec acceptance "≥1 教师有提交" ✓)
  - admin@finsim.edu.cn
  - teacher1@finsim.edu.cn  (seeded teacher 主线)
  - teacher2@finsim.edu.cn
```

完全满足 acceptance "teacher 一周洞察 ≥1 教师有提交 → 出报告"。

---

## 8-dim checklist

| # | check | verdict | evidence |
|---|---|---|---|
| 1 | Spec compliance | **FAIL** | spec.md A 专属 acceptance: "5 主线 smoke 编写完" — 编写了, 但 4/5 不可用 |
| 2 | tsc --noEmit | N/A | QA scope = e2e on staging, 不跑 tsc |
| 3 | vitest run | N/A | QA scope = e2e on staging, 不跑 vitest |
| 4 | Browser (Playwright on staging) | **FAIL** | 1/5 PASS (smoke-05) · 4/5 FAIL (smoke-01,02,03,04). 详见上 |
| 5 | Cross-module regression | **PASS** | smoke specs 全部是新增, 删的 14 grep 守已经下线 (CI quality 已过). 0 影响生产代码 |
| 6 | Security (/cso) | N/A | smoke 不动 auth/perm/payment 模块 |
| 7 | Finsim-specific | **PASS** | 错误消息 API 返中文 ("请求参数错误")、`requireRole` 用法对、Route Handler 无业务逻辑 |
| 8 | Code patterns | **PASS** | smoke 自给自足 + 自清理 (设计上)、retry 3 防 NextAuth race、UUID v4 严格 — 模式都对, 只是 payload 内容错了 |

---

## Issues found (按优先级)

### P0 阻塞 — 4 个 smoke spec payload/contract bug

1. `tests/e2e/smoke/01-teacher-create-publish.spec.ts:30-39` — `subjectiveConfig` 缺 `prompt` + 含无效字段 `wordLimit`
2. `tests/e2e/smoke/02-student-submit-simulation.spec.ts:25-31` — `simulationConfig` 缺 `scenario` + `openingLine` + 含无效字段 `rounds`/`timeLimitSeconds`
3. `tests/e2e/smoke/03-ai-grade-release.spec.ts:22-29` — 同 01 (subjective)
4. `tests/e2e/smoke/04-sb-free-question.spec.ts:32` — `listJson.data?.items` 与 API 实际 `data: [array]` 不匹配
5. `tests/e2e/smoke/_setup.ts:88` — `cleanupSmokeSbPosts` 用同样错的 shape, cleanup 不工作 (我在 staging 上手动清了 6 个残留 post)

### P1 改进建议

6. `tests/e2e/smoke/03-ai-grade-release.spec.ts:30` — 在 `const taskId = (await createTaskRes.json()).data.id` 之前先 `expect(createTaskRes.status()).toBe(201)`，给后续 task 失败提供清晰报错堆栈
7. 这些 payload bug 在 builder 自测时一定不会过，**怀疑 candidate A 自测时只跑了 vitest，没用 `PLAYWRIGHT_BASE_URL=http://localhost:3000` 真跑过这 5 个 spec** — build report 里也明确说 "未跑 真 staging Playwright — 本地无 staging URL 凭证; 留给 CI 跑 / qa 验证"。这意味着 CI 上的 staging-deploy Playwright step 也会 4/5 红 → PR-1 整个 CI 红 → 阻塞 merge。

### P2 风险登记

8. 因为 fail-on-error 硬阻塞已设, CI 这一轮 Playwright 必然 fail → PR #14 不能 merge 直到 builder 修这 4 spec。这与 builder 在 build_pr1_test-infra_r1.md 里写的 "fail-on-error 硬阻塞" 政策一致, 系统按预期行为运作 (但本应在 builder 自测时拦下)。

---

## Staging side-effect 审计

| 资源 | 创建 | 是否清理 | 残留 |
|---|---|---|---|
| Task (smoke-01,02,03) | 0 (POST /api/tasks 都 400 失败) | 无需 | 无 |
| TaskInstance | 0 | 无需 | 无 |
| Submission | 0 | 无需 | 无 |
| SB Post (smoke-04 + probe) | 6 (probe 4 + smoke-04 2) | 手动 delete 全清 | **0** ✓ |
| Audit log | smoke-04 create/delete 各 1 行 (append-only, 不可删) | 无法清理 (append-only by design) | 留痕 (低危, 标识为 smoke 测试) |

Audit 表 append-only 是设计，与 finsim qa cleanup 标准一致 (audit 不还原)。

---

## Overall: **FAIL**

**理由**:
- A 专属 acceptance "5 主线 smoke 编写完" 字面上完成 (5 个 spec 文件确实存在 + 内容覆盖 5 主线)
- 但 4/5 实际跑 staging 立即 fail — 这等于 staging-deploy 的 Playwright step 红 → PR-1 CI 红 → 无法 merge
- spec.md "Workflow" L77: "PASS 100% → 该候选 done; FAIL 同样问题连续 3 轮 → coord 介入重 plan"
- 这是 r1 (第一轮) → 应回 builder-test-infra 修, 不需要重 plan

## 给 builder-test-infra 的修复指引

1. **不要新增功能、不要重构 — 只改 4 个 spec 的 payload + 1 个 setup 的 cleanup 解析**
2. 修完本地用 `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke/0{1,2,3,4}-*.spec.ts` 真跑过 4 个 (5 已 PASS) 再交 r2
3. 每个 spec 修改前后 diff 应 < 10 行
4. r2 完成后 SendMessage 给 team-lead, 我接 r2 QA

---

## 我的工具/记录

- 没编辑任何生产代码 (Edit 工具未启用)
- 临时 probe spec 用完即删 (`_qa-probe-tmp.spec.ts`, `_qa-cleanup-tmp.spec.ts`)
- 4 张失败截图 + playwright output log 全在 `.harness/screenshots/pr1-qa-smoke/`
- PR #14 状态 (QA 时点): quality pass / staging-deploy pending — staging-deploy 完成时 Playwright step 必然红 (跟我本地结果一致)
