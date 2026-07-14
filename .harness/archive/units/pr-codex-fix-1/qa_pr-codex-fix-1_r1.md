# QA Report — PR-codex-fix-1 r1

Unit: PR-FIX-1 · Codex Batch A · 9 安全 finding（API guard）
Round: 1
Reviewer: qa-fix
Date: 2026-04-26
Builder report: `.harness/reports/build_pr-codex-fix-1_r1.md`

## Spec
9 个 route 加 guard（task-instances POST / submissions POST / markdown PUT / chapters POST / sections POST / announcements / schedule-slots / insights aggregate POST / ai chat）+ 5 新 error code + 20 新 unit tests。

## 检查清单

| Check | Verdict | Evidence |
|-------|---------|----------|
| 1. Spec compliance | PASS | 11 文件 / +319/-99 与 builder 报告一致；9 条 finding 全部对应 route 改动 + lib/api-utils.ts error code 映射；UX4 bonus（学生不允许传 systemPrompt） |
| 2. tsc --noEmit | PASS | 0 输出 |
| 3. vitest run | PASS | **38 files / 389 tests**（baseline 369 + 新增 20 · 零回归） |
| 4. npm run build | PASS | 25 routes 编译成功 |
| 5. 真 curl E2E | PASS | 见下方 9 条攻击矩阵 |
| 6. Cross-module regression | PASS | 学生 4 routes（/dashboard/courses/grades/schedule/study-buddy）+ 教师 8 routes（dashboard/courses/tasks/instances/announcements/schedule/groups/analytics）全 200；/login 200 |
| 7. /cso 安全 | PASS | OWASP A01 (Broken Access)：A1-A7 全部通过 owner/access guard 闭环；A03 (Injection)：A9 schema cap + 服务端 trim 双层；A05 (Security Misconfig)：A8 mutex+cache 防 DoS·Token 浪费；STRIDE Tampering: A2 服务端派生 taskId/taskType 强制比对，无 spoof 路径；无 High/Critical 新增 |
| 8. Finsim-specific | PASS | UI 中文（5 个新 error code 全中文）；Route Handler 仍薄壳；API success/error 格式一致；requireRole 守护齐全 |
| 9. Code patterns | PASS | 沿用 lib/auth/resource-access + course-access 模块；零新增 guard 函数；service 层零改动 |
| 10. Dev server alive | PASS | PID 2941（next-server v16.1.6）/login 200·/dashboard 200·全程未死 |

## 真 curl 攻击矩阵（teacher2 / student5 / unauth 三层）

测试帐号：T1=teacher1@（4dbbe635 / 拥有 course 940bbe23 + classA），T2=teacher2@（ebbbeb19 / 拥有 course 893aae18 + classB），S1=student1@（classA），S5=student5@（classB），ADMIN=admin@。

测试 fixture：临时为 T2 创建 task aefdd560，临时 chapter ec44046f + section 381df31d 在 T2 自己 course，QA 完毕全部清理。

### A1 task-instances POST（4 cases · 全 PASS）
- A1.1 T2 用 T1's taskId（a308c7ba）+ T2 own course → **403 FORBIDDEN**（assertTaskReadable 阻止跨户读 task）
- A1.2 T2 own task（aefdd560）+ T1's courseId（940bbe23）→ **403 FORBIDDEN**（assertCourseAccess 阻止跨户写 course）
- A1.OWN T1 own task + own course + own class → **201 created**（合法路径未被误杀）
- A1.UNAUTH 未登录 → **401 UNAUTHORIZED**

### A2 submissions POST（5 cases · 全 PASS）
- A2.1 student 缺 taskInstanceId → **400 TASK_INSTANCE_REQUIRED**（"必须提供任务实例 ID"）
- A2.2 S5（classB）用 classA's instance e34afdc0 → **403 FORBIDDEN**（assertTaskInstanceReadable: inst.classId !== user.classId）
- A2.3 S1 own instance + spoof taskId（a308c7ba 不属于该 instance）→ **403 FORBIDDEN**（服务端从 instance 派生 taskId 强制比对 / 防 spoof）
- A2.4 S1 own instance + spoof taskType（quiz 但 instance 是 simulation）→ **403 FORBIDDEN**（服务端比对 taskType）
- A2.5 unauth → **401 UNAUTHORIZED**

### A3 markdown PUT（4 cases · 全 PASS）
- A3.1 T2 + body.courseId=T2 自己 + sectionId=T1's section（1ace5e74）→ **403 FORBIDDEN**（assertSectionWritable 反查真 courseId）
- A3.2 T2 + own section + body.courseId=T1's → **403 FORBIDDEN**（一致性校验：sec.courseId !== body.courseId）
- A3.3 T2 own section + own course + own chapter → **200 success**
- A3.4 unauth → **401 UNAUTHORIZED**

### A4 chapters POST（3 cases · 全 PASS）
- A4.1 T2 POST chapter to T1's course（940bbe23）→ **403 FORBIDDEN**（assertCourseAccess）
- A4.2 T2 POST chapter to own course → **201 created**
- A4.3 unauth → **401 UNAUTHORIZED**

### A5 sections POST（3 cases · 全 PASS）
- A5.1 T2 + body.courseId=T2 自己 + chapter=T1's（d73bf6ea）→ **400 CHAPTER_COURSE_MISMATCH**（"章节不属于该课程"）
- A5.2 T2 + own chapter + body.courseId=T1's → **403 FORBIDDEN**（assertCourseAccess）
- A5.3 T2 own course + own chapter → **201 created**

### A6 announcements GET/POST（4 cases · 全 PASS）
- A6.1 T2 GET ?courseId=T1's → **403 FORBIDDEN**（teacher 传 courseId 走 assertCourseAccess）
- A6.2 T2 POST 公告到 T1's course → **403 FORBIDDEN**
- A6.3 T2 GET ?courseId=own → **200 success（[]）**
- 学生侧：S5 GET ?courseId=940bbe23 → 200（合法 — course 940bbe23 通过 CourseClass 关联了 classB，所以 S5 有权访问，不是漏洞）

### A7 schedule-slots GET/POST（4 cases · 全 PASS）
- A7.1 T2 GET ?courseId=T1's → **403 FORBIDDEN**
- A7.2 T2 POST schedule-slot 到 T1's → **403 FORBIDDEN**
- A7.3 T2 GET ?courseId=own → **200 success（[]）**

### A8 insights aggregate POST auth + cache（3 + unit cases · PASS）
- A8.1 T2 POST T1's instance → **403 FORBIDDEN**（assertTaskInstanceReadableTeacherOnly）
- A8.2 student POST → **403 FORBIDDEN**（teacher-only guard 拒 student）
- A8.3 unauth → **401 UNAUTHORIZED**
- 缓存 freshness < 5min / mutex TTL：unit tests 覆盖（tests/pr-fix-1-batch-a.test.ts L92-128 共 5 cases）。当前 DB 无 graded submission 不能跑真 AI 闭环，单测可信。

### A9 ai/chat schema（6 cases · 全 PASS）
- A9.1 transcript 51 entries（>50）→ **400 VALIDATION_ERROR**（"对话历史超长"）
- A9.2 单条 text 2001 字符（>2000）→ **400 VALIDATION_ERROR**（"单条消息超长"）
- A9.3 scenario 4001 字符（>4000）→ **400 VALIDATION_ERROR**（"场景描述超长"）
- A9.4 教师传 systemPrompt 4001 字符 → **400 VALIDATION_ERROR**（"系统提示超长"）
- A9.UX4 学生传 systemPrompt（任意长度）→ **403 FORBIDDEN**（"学生不允许传入自定义系统提示"）— UX4 决策项 builder 主动落地
- A9.unauth → **401 UNAUTHORIZED**

## 不直观决策评审

| Builder 选择 | QA 评审 |
|---|---|
| A2 hybrid（保留 zod discriminator + 服务端比对） | 合理 — 保留 schema 便利性同时兜底 spoof |
| A3 sectionId 反查 + body 一致性双校验 | 合理 — markdown PUT 是 upsert，path id 不一定有，sectionId 反查更准 |
| A8 force flag 双通道（query + body） | 合理 — 两侧接住更鲁棒，query 优先（更显式） |
| A8 in-memory Map mutex / 5min TTL | 单进程 finsim 可用，多 worker 部署需 redis-lock 升级（builder 自承认 P3 范围外） |
| A9 服务端 slice(-30) 双保险 | 合理 — 即使 zod 被绕过仍兜底 |
| A6/A7 admin GET 不加 teacherId 过滤 | 与原代码一致，spec 未要求改 — 保持向后兼容 |
| 5 个新 error code 状态码（MISMATCH 400 / TOO_FREQUENT&IN_PROGRESS 429 / TOO_LARGE 400 / TASK_INSTANCE_REQUIRED 400） | HTTP 语义正确 |

## Issues found

无 — 9 个 fix 全部 E2E 验证通过，无回归，无新增 High/Critical 安全问题。

## Cleanup

- T2 临时 task `aefdd560-a0d6-449e-a7a8-22815e19b9cd` 已删
- T2 临时 chapter `ec44046f` + section `381df31d` + 衍生的 chapter 3d36648f / section 932c43e8 + content block 已删
- T1 测试 instance `4222adbd / 97f66cb4` 已删
- DB 测试数据零残留

## Overall: PASS

PR-FIX-1 Batch A 9 条安全 finding 全部修复闭环：cross-tenant 写阻塞 + spoof taskId/taskType 阻塞 + chat schema cap + UX4 学生 systemPrompt 拒绝。Builder 报告与实测严格一致；攻击矩阵完整；零回归；新 20 tests 通过。可推进 PR-FIX-2。

---
追加一行到 `.harness/progress.tsv`。
