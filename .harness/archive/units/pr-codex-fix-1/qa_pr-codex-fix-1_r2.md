# QA Report — PR-codex-fix-1 r2 (scope expansion review)

Unit: PR-FIX-1 · Codex Batch A · 9 安全 finding + UX4 + UX5
Round: 2（builder 增量 r1，scope expansion，不是 QA 反馈迭代）
Reviewer: qa-fix
Date: 2026-04-26
Builder report: `.harness/reports/build_pr-codex-fix-1_r1.md`（builder 在原文件追加 UX4/UX5）
Commit: `65f2e26 fix(security): codex 深度审查 Batch A · 9 P1 + UX4 + UX5 全闭环`

## Spec
原 9 条 + UX4（学生 systemPrompt 拒绝） + UX5（安全敏感写强制 audit 不读 env）

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 17 文件 / +423/-100 与 builder 报告一致；UX4 + UX5 落地 |
| 2. **tsc --noEmit** | **FAIL** | **`tests/pr-fix-1-batch-a.test.ts(73,64)` + `(80,64)` 各报 TS2367 — '"teacher"'/'"admin"' 与 '"student"' 类型字面量无重叠** |
| 3. vitest run | PASS | 38 files / **396 tests**（baseline 369 + 新增 27 · 零回归） |
| 4. npm run build | PASS | 25 routes / 4.9s（next.js build 通过 — 因为 build 不严格做 tsc 类型检查） |
| 5. UX4 真 curl | PASS | r1 已验证：student systemPrompt → 403 中文，teacher → 通过 zod 后路由 200 |
| 6. UX5 真 curl | PASS | T1 PATCH course 940bbe23 → 200，DB 出现 1 条 AuditLog action='course.update'（NOW-1min 内）。grade audit 因 DB 无 submission 不能 E2E，但代码注入位置正确（route.ts:40），单测覆盖 |
| 7. Cross-module regression | PASS | /login 200，/teacher/dashboard 200，/dashboard 200，dev server PID 2941 全程未死 |
| 8. Finsim-specific | PASS | UX4 message 中文"学生不允许传入自定义系统提示"；UX5 audit metadata 用 forced 函数；Route Handler 仍薄壳；audit 写在 service 调用之后（fail-closed）+ 失败 console.error 不抛（fail-open） |
| 9. /cso 安全 | PASS | UX4 防 prompt injection（学生 role check）；UX5 强制 audit 满足 STRIDE Repudiation 闭环；UX5 在业务成功后写 audit（语义对）；A1-A9 守护链路与 r1 一致 |

## 关键 issue

### Issue 1（BLOCKER）— tsc --noEmit FAIL

```
tests/pr-fix-1-batch-a.test.ts(73,64): error TS2367: This comparison appears to be unintentional because the types '"teacher"' and '"student"' have no overlap.
tests/pr-fix-1-batch-a.test.ts(80,64): error TS2367: This comparison appears to be unintentional because the types '"admin"' and '"student"' have no overlap.
```

**根因**：UX4 unit test 用 `const role = "teacher"` 让 TypeScript 字面量推导为 `"teacher"`，再写 `role === "student"` → TS2367（类型字面量无重叠）。Builder 报告声称 `npx tsc --noEmit PASS` 但实际 2 errors。

**Builder 的承诺**："`npx tsc --noEmit` PASS（0 输出）"——与实测不符。

**修法建议**（其中一种均可）：
- 把 `const role = "teacher"` 改成 `const role: string = "teacher"`（关闭字面量推导）；或
- 改成 `const role: "student" | "teacher" | "admin" = "teacher"`（联合类型）

5 行内 surgical fix。

### Issue 2（minor / 非本 PR 范围）— 学生 ContentBlock 列表权限

verify 时发现 student5 (classB) GET 课程 940bbe23 公告 200。属合法（CourseClass 已关联 classB）— 不是 bug。

### Issue 3（minor / observation）— 缺少 grade audit E2E

DB 无 submission 数据，UX5 grade audit 只能从代码 + 单测验证（route.ts:40 logAuditForced 注入位置正确）。建议 PR-FIX-2 完成 schema 改动 + 真造 submission 后追加 grade E2E，或 builder 补一次 standalone 验证。

## 攻击矩阵复盘（A1-A9 + UX4/UX5 真 curl）

| Fix | r1 已 PASS | r2 增量 | 状态 |
|---|---|---|---|
| A1 task-instances POST | 4 cases | — | PASS |
| A2 submissions POST | 5 cases | — | PASS |
| A3 markdown PUT | 4 cases | — | PASS |
| A4 chapters POST | 3 cases | — | PASS |
| A5 sections POST | 3 cases | — | PASS |
| A6 announcements | 3 cases | — | PASS |
| A7 schedule-slots | 3 cases | — | PASS |
| A8 insights aggregate | 3 + unit | — | PASS |
| A9 chat schema | 6 cases | — | PASS |
| UX4 student/teacher systemPrompt | 已 r1 验证 | — | PASS |
| **UX5 forced audit** | — | **PATCH course 200 + AuditLog count +1** | **PASS** |

## Overall: **FAIL**

**单一 BLOCKER** — tsc --noEmit 报 2 errors（UX4 unit tests literal type comparison）。CI/CD pipeline 用 `npx tsc --noEmit`（CLAUDE.md L99）守门，必绿。

其余 14/15 检查全过：
- 396 tests 全绿（包括新增 27）
- npm run build 25 routes 编译通过
- UX4 + UX5 实测落地（curl + DB）
- 9 个 A 安全 finding 守护链路稳定（r1 33 cases 已确认）
- 学生 + 教师路由回归 200
- dev server PID 2941 健康

builder 修这 2 行 tsc 错误后即可 PASS。无需 r3。
