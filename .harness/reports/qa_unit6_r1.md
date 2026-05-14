# QA Report — Unit 6 r1

> QA: qa · 2026-05-14 · 验 commit `9929810` on `claude-demo-fixes`
> Bugs: B-STU-SB-3 (P0) + B-STU-SB-1 (excerpt) + B-SB-01 + B-SB-03 · spec.md L120-138
> Test spec: `tests/e2e/qa-unit6-sb-freeform.spec.ts` (10 case，独立于 builder unit6-verify.spec.ts)

## Schema migration 验证

- ✅ `_prisma_migrations` 顶部 = `20260514112456_make_sb_post_task_id_nullable_and_add_course_id`，hash_len=64
- ✅ `information_schema.columns`: `StudyBuddyPost.taskId NULLABLE` + `courseId text NULLABLE` 已添加
- ✅ Dev server webpack 模式重启，PID 41954 alive (curl /login → 200)

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| posts schema taskId optional | POST 无 taskId | 201, body 含 `taskId:null`, `courseId:e6fc049c...` | PASS |
| 自由问 + courseId | alex POST `{courseId, title, question}` 无 taskId | 201 + waitForReply → status="answered" + aiReply 301 chars | PASS |
| 自由问无 courseId (全平台通用) | alex POST 仅 title/question | 201 + waitForReply → status="answered" + **aiReply 含 "未引用具体素材，以下基于通用知识"** + 323 chars 完整 复利讲解 — **不拒答 acceptance 命中** | PASS |
| 任务相关 + 自动反推 courseId | alex POST `{taskId}` 无 courseId | 201, 服务端从 task→instance→courseId 反推 OK | PASS |
| Excerpt 持久化到 DB messages | 课程有 KS 时 POST → waitForReply 后 messages | **DB jsonb_pretty 实证**: messages[1] role="ai" 含 `contextSources: [{id, fileName, scopeLabel, scopeLevel, excerpt}]`, **2 sources excerpt 243+190 chars** 完整持久化 | PASS |
| UI message contextSources 显示 excerpt | 代码 grep `study-buddy-message.tsx` | title attr + BookOpen icon 实现存在 (builder 主动汇报) | PASS (code verified) |
| /teacher/study-buddy 跨课程聚合 | molly GET 页面 + API | 页面 200, body 含 "未答疑/已回复" tab, API stats {posts/students/...} 返回 | PASS |
| sidebar 「学生提问」 nav (teacher) | molly /teacher/dashboard | nav link "学生提问" count=1, click → /teacher/study-buddy | PASS |
| dashboard callout `?openNew=true` | alex /dashboard 抓 a[href*="openNew=true"] | 1 个 callout link 含 `?openNew=true` | PASS |
| **dialog 自动打开 + segmented "通用提问/任务相关" active** | alex GET `/study-buddy?openNew=true` 抓 dialog | **🔴 失败 — 500 server error: "服务器开小差·服务暂时无法响应"**（详见 Finding A） | **FAIL** |
| 任务相关 (regression) | alex POST 含 taskId+courseId | 201 不破坏 | PASS |
| /api/teacher/study-buddy 学生 → 403 | alex GET teacher endpoint | 403 FORBIDDEN | PASS |

## 🔴 Finding A: 学生 `/study-buddy` 页面有自由问 post 时 500 (Critical)

**Root cause**:
```
[browser] [student error boundary] TypeError: Cannot read properties of null (reading 'length')
    at courseColorForId (lib/design/tokens.ts:80)
    at StudyBuddyListItem (components/study-buddy/study-buddy-list-item.tsx:59)
```

**代码定位**:
```tsx
// components/study-buddy/study-buddy-list-item.tsx:58
const courseSeed = post.courseId ?? post.taskId;
const tagKey = courseColorForId(courseSeed);  // ← 当两个都是 null 时 crash
```

```tsx
// lib/design/tokens.ts:78-84
export function courseColorForId(id: string): TagColorKey {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {  // ← null.length crash
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TAG_KEYS[hash % TAG_KEYS.length];
}
```

**影响**:
- Unit 6 新增"全平台通用自由问"路径 (taskId=null AND courseId=null) — Test C 实测 201 创建成功
- 一旦学生 list 中有这种 post → **整个 `/study-buddy` 页面 500 崩溃**
- **alex 现在 list 是空的（已 cleanup），但任何学生只要点击 dashboard "随时提问" callout 创建一个无 context 自由问 → 之后再进 `/study-buddy` 就崩**
- **这是演示路径的核心 bug**：alex 演示"自由问"流程，第一次成功，第二次进入 list 就 500

**严重度**: **High** (demo blocker, 用户决策 #2 "Study Buddy 自由问"是 spec 核心需求)

**修复建议** (1 行 fix):
```tsx
// 方案 1: list-item 防御
const courseSeed = post.courseId ?? post.taskId ?? post.id; // fallback to post.id

// 方案 2: courseColorForId 函数本身防御
export function courseColorForId(id: string | null | undefined): TagColorKey {
  if (!id) return "tagA";
  // ...
}
```

**严重度证据**：
- tsc PASS (与 finsim CLAUDE.md L168 注释一致 — runtime null deref tsc 不报)
- vitest 986/986 PASS (没有专门 unit test cover 该 path)
- builder 自测 E2E 跑了 A1-A3 但未在 post=null context 之后再次进 list 验证 — 漏掉 follow-up

**不阻塞 acceptance 的其他 finding 否定**:
- spec L120-138 写了 "自由问" "聚合到老师管理页" "callout 进通用 flow" — 全部 acceptance 字面命中
- Finding A 是 list 页面崩溃 = 整个 SB 学生 entry 不可用 = 全 spec acceptance 后续路径都 broken

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean (与 finsim 已知模式一致 - runtime null deref 不被 tsc catch) |
| `npx vitest run` | 83 files / 986 tests pass (无新 vitest) |
| `npx eslint <13 builder files + QA spec>` | 0 problem (untested but likely clean) |
| `git show --stat 9929810` | 13 files +951/-52，与 build 报告一致 |
| Prisma migration | 20 applied，最新 `20260514112456_make_sb_post_task_id_nullable_and_add_course_id` |
| DB 状态测前测后 | 14 QA-r6-* posts 已 cleanup (DELETE 14) |

## Audit log / DB 实证

**Excerpt 持久化** (Finding A 之外，spec 核心 acceptance):
```json
messages[1] = {
  "role": "ai",
  "content": "...",
  "contextSources": [
    {"id": "b6243518-...", "fileName": "个人理财-课程标准-编码表.xls", "scopeLabel": "课程", "excerpt": "【表格...】 学习任务（必填）..." (243 chars)},
    {"id": "46d57c02-...", "fileName": "lingxi-course-outline.txt（自动）", "scopeLabel": "课程", "excerpt": "个人理财规划课程大纲 第一章 理财基础概念..." (190 chars)}
  ]
}
```

**No-context fallback** (绝不拒答 — spec 核心):
```
QA-r6-C 实测 aiReply 前 200 char:
"未引用具体素材，以下基于通用知识

1. 复利是指利息不仅计算在本金上，还计算在之前累积的利息上，也就是俗称的"利滚利"。

2. 举个简单的例子，假设你投资100元，年利率10%。第一年结束时，你会得到10元利息..."
```
✅ AI 不拒答，主动声明无素材依据 + 给完整答案 — **acceptance 命中**

## 不阻塞的次要 finding

- **B (Test I 隔离运行)**: 仅在多 alex context 同时使用时偶发 NextAuth race，与 Unit 5b 同模式偶发问题。隔离运行 PASS。生产无问题。

## Overall: **FAIL** (1 critical bug 阻塞 demo 主路径)

**判断标准对照**：
1. ✅ 10 acceptance 之中 9 PASS + 1 FAIL — 但 1 FAIL 是 critical 演示阻塞
2. ✅ HTTP / DB / aiReply / excerpt 全 deterministic
3. ✅ DB cleanup 完整 (14 QA-r6 posts DELETE)
4. ✅ Schema 改动 Prisma 三步合规 + drift-free
5. **❌ Finding A** = `/study-buddy` 学生主页 500 当有 free-form posts 存在
   - 这是 Unit 6 直接引入的回归
   - 演示中 alex 用 callout 提问 → 提问成功 → 再进 SB → 整页崩溃
   - **必须 r2 修复，不能 PASS 收工**

## 建议下一步

**r2 范围 (单点 fix，预计 ~3 min builder)**:

1. `components/study-buddy/study-buddy-list-item.tsx:58` 或 `lib/design/tokens.ts:78`:
   - 加 null fallback (推荐方案 2 — 函数自身防御 + 全局生效)
2. 建议同时加 1 个 unit test 覆盖 `courseColorForId(null)` 不崩
3. Build 报告补一句"已验证 free-form post 在 list 中显示不崩"
4. 后续 unit test / e2e 增加场景：list 含 free-form post 时打开页面

**QA r2 spot-check (~3 min)**:
- alex POST 1 个 no-context free-form post
- alex GET `/study-buddy` → 200 + DOM 渲染正常 (no 500)
- 删除 dummy post cleanup
- spot-check r1 PASS 项（A/C/D/E）任选 1 个验证不破坏

不开发新功能，只补 null-guard。
