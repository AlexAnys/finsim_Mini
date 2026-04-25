# QA Report — pr-sec4 r1

**Unit**: `pr-sec4`
**Round**: `r1`
**Date**: 2026-04-25
**QA agent**: qa-p5

## Spec

闭环 QA 在 PR-5B 发现的 pre-existing P1：`GET /api/submissions?taskInstanceId=X` 缺 owner guard，teacher2 能拉 teacher1 列表。修复策略：

- route handler GET 加 `assertTaskInstanceReadable` / `assertTaskReadable` 调用（teacher/admin 路径）
- 新增 "scope filter required" anti-broad-scan（teacher/admin 必须传 taskInstanceId / taskId / studentId 之一；student 自动 scope 自己 id 不受影响）

## Verification matrix

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | diff +30/-4，仅改 GET handler，POST/service/schema 字节零改。复用 SEC2 已落地的 2 guards（不新增 guard）。"必须提供 scope filter" 走 `error("FORBIDDEN", "必须提供 ...", 403)`，语义合理（拒绝广扫属"权限不足"非"格式错误"，build report L50 决策）。 |
| 2. tsc --noEmit | PASS | 0 errors |
| 3. vitest run | PASS | **328 passed / 0 failed / 33 files**（321 baseline + 7 new for sec4-submissions-list-guard：assertTaskInstanceReadable 5 例 teacher non-owner/owner/collab/admin bypass/404 + assertTaskReadable 2 例 non-creator/creator）。SEC4 单跑 7 PASS。 |
| 4. Browser / 真 curl E2E | PASS | **builder 报告的 10 场景攻击矩阵 100% 复现**（dev server PID 51695 仍活，无需重启）：[1] teacher1 own → 200 / [2] teacher2 cross-tenant → 403 + "权限不足" / [3] no filter → 403 + "必须提供 taskInstanceId / taskId / studentId 之一" / [4] unauth → 401 / [5] student own → 200 / [6] teacher2 → teacher1 task → 403 / [7] teacher1 own task → 200 / [8] admin → teacher1 instance → 200 bypass / [9] invalid instance id → 404 + "任务实例不存在" / [10] student no filter → 200 auto-scoped。**额外测**：student1 偷传 studentId=student2 → 仍 auto-scope 到自己（route L49-50 effectiveStudentId override 不可 spoof）；admin + bad instance → 200 + 0 items（assertTaskInstanceReadable 对 admin bypass 不查 DB，符合预期）；admin no filter → 403（builder L85 已说明，未来 PM 反对再补 admin bypass）。 |
| 5. Cross-module regression | PASS | 9 路由 teacher1 全 200；student1 `/grades` 200（auto-scope 不破学生 page 调用 `fetch("/api/submissions")`）；POST `/api/submissions` 字节零改仍走 createSubmissionSchema 验证（empty body → 400 中文 VALIDATION_ERROR）；service signature 字节零改。 |
| 6. Security (/cso) | PASS | OWASP A01 cross-tenant：SEC2/SEC3 + 本 PR 共同闭环 GET/POST 双向。A03 Injection：Prisma where 参数化无注入面。A05 Misconfig：anti-broad-scan 强制 scope 防全表 leak。STRIDE T：N/A（GET 无 mutation）。I：404 vs 403 语义合理（NOT_FOUND for invalid id; FORBIDDEN for cross-tenant）。D：anti-broad-scan 还附带 DOS 缓解。E：student auto-scope `effectiveStudentId = user.role === "student" ? user.id : studentId` 不可 spoof。无 High/Critical。 |
| 7. Finsim-specific | PASS | 中文错误："权限不足"（cross-tenant）/ "必须提供 taskInstanceId / taskId / studentId 之一" / "任务实例不存在"。Route handler 调 `requireAuth` + `assertTaskInstanceReadable` / `assertTaskReadable`，符合 CLAUDE.md 守护 pattern。无 schema 改动 → 无 Prisma 三步。 |
| 8. Code patterns | PASS | Surgical diff +30/-4：仅改 GET 内部，未触动 POST/import 顺序/error code 习惯。复用现有 guards 不引入新 abstraction。学生路径不重复 guard（service 层 effectiveStudentId override 已闭环，避免 1 次额外 DB 查询，build report L46 决策合理）。"FORBIDDEN" + 自定 message 走 `error()` helper 而非 throw → handleServiceError，code path 一致。 |

## Issues found

**无阻塞**。

### 观察（非 FAIL）

- **admin 也必须传 scope**：本 PR anti-broad-scan 对 admin 同样强制（builder L85 已声明）。如果未来 admin 后台需求"全局看所有 submissions"，需要单独 PR 加 `if (user.role === "admin") skip-check`。当前是合理保守默认（admin 通常不应批量拉）。
- **404 vs 403 信息泄漏微细差异**：teacher2 传 valid teacher1 instance → 403（暴露 instance 存在）；teacher2 传 nonexistent uuid → 404。技术上让 attacker 能区分 "is valid id" vs "is fake id"。但这是 SEC2 `assertTaskInstanceReadable` 的现有语义（先 findUnique 再 check owner），跟 PR-SEC1/SEC2 同 pattern 一致，**非本 PR 引入**。如要彻底闭，所有 cross-tenant 都返 404。当前 404/403 区分对 finsim 业务影响小，记观察不阻塞。

### Pre-existing 漏洞（独立 PR 候选，PR-5B QA 已记录）

- Attachment URL scheme 白名单缺失（drawer 渲染 `<a href={a.filePath}>` 若 `javascript:` 协议）— 攻击面在 attachment 写入端而非本 PR 范围。

## Phase 5 敏感点预检

- 本 PR **未**改 schema · Prisma 三步未触发
- conceptTags 隐性工作不涉及
- PR-5C schema 改动尚未启动

## Overall: **PASS**

- 328/328 tests · tsc 0 · build 0 warnings
- 10/10 攻击矩阵 PASS（额外验证 student spoofing + admin bad-id + admin no-filter）
- 9 回归路由 200 · student `/grades` 200 · SEC2/SEC3 守护仍生效
- OWASP A01/A03/A05 + STRIDE T/I/D/E 无 High
- diff surgical +30/-4，service signature 零改

Ship 建议：可 commit。**SEC4 闭环成功 — Phase 5 安全态势进一步收紧**。下一 PR-5C（带 schema 改动 + AI 聚合 + Prisma 三步）可启动，等 builder-p5 SendMessage 告知字段名。
