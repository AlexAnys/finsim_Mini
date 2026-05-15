# QA Report — Unit 13 r1

> QA: qa · 2026-05-15 · 验 commit `f94750d` on `claude-demo-fixes` (Phase 4 第五个 unit)
> Bugs: B-COURSE-02 (协作 dialog 不完整) + B-STU-COURSES-1 (学生 资源/讨论 tab 暴露)
> Test spec: `tests/e2e/qa-unit13-collab-tabs.spec.ts` (4 case，独立于 builder unit13-verify.spec.ts)

## 测试数据 baseline

- **COURSE_ID** `940bbe23-6172-40bf-bc7f-b22a1840a1de` (个人理财规划, teacher1 owns, **molly 1 collab**)
- alex 在 deedd844 班级，可见该课程作为学生

## Spec acceptance 逐条对照

| spec acceptance | 验法 | 实测 | Verdict |
|---|---|---|---|
| 协作 Dialog 顶部加现有协作者列表 + 移除按钮 | teacher1 点 "协作教师" → 抓 dialog content | dialog text: **"添加协作教师 输入教师邮箱，添加为课程协作教师。已添加 1 位协作教师 molly molly@qq.com 移除 教师邮箱 取消 添加"** ✓ | PASS |
| "已添加 N 位" counter 文案 | dialog 内 | "已添加 **1** 位协作教师" 正确 ✓ | PASS |
| 协作者行: name + email + "移除" 按钮 | DOM grep | molly + molly@qq.com + 移除 button (count=1) ✓ | PASS |
| 移除走 AlertDialog 二次 confirm | 点击移除按钮 | AlertDialog text: **"移除协作教师 确定将 molly 老师移出本课程协作？移除后该老师将立即失去访问与编辑权限。取消 确认移除"** — 与 build 报告完全一致 ✓ | PASS |
| AlertDialog 三按钮 (取消 + 确认移除) | 抓按钮 | cancel × 1 + confirm × 1 ✓ | PASS |
| 取消按钮不真删 | 点取消 + 查 API | DB collaborators count=1 维持，molly 仍是 collab ✓ | PASS |
| hero × 按钮统一走 AlertDialog (一致性) | hero × click | × count=1, AlertDialog visible=1 — **hero × 也走 AlertDialog** ✓ | PASS |
| 学生 /courses/[id] 不显示 "讨论" / "资源" tab | alex 进 course detail page | tabs = **["内容", "任务6", "成绩", "公告"]** — NO 讨论/资源 ✓ | PASS |
| 学生 4 tab 完整 (内容/任务/成绩/公告) | role=tab count | count=4 ✓ | PASS |
| TypeScript / Vitest / ESLint 全绿 | 独立运行 | tsc 0 / **vitest 95 files / 1089 tests pass** / 0 lint error | PASS |

## 独立运行验证

| 检查项 | 结果 |
|---|---|
| `npx tsc --noEmit` | clean ✓ |
| `npx vitest run` | **95 files / 1089 tests pass** (baseline 不变，Unit 13 UI polish 不增单测) |
| `npx eslint <3 builder files + QA spec>` | 0 error / 0 warning |
| `git show --stat f94750d` | 3 files +232/-3 与 build 报告完全一致 |
| Schema 改动 | 0 ✓ |
| DB 测前测后 | molly 仍是 collab (count=1)，取消按钮验证 ✓ |

## DOM 实证 — 协作 Dialog

```
添加协作教师
输入教师邮箱，添加为课程协作教师。

已添加 1 位协作教师              ← Counter 文案
molly                            ← 协作者 name
molly@qq.com                     ← 协作者 email
[移除]                           ← 移除 button

教师邮箱 *
[Input field]
[取消] [添加]
```

## DOM 实证 — AlertDialog

```
移除协作教师
确定将 molly 老师移出本课程协作？
移除后该老师将立即失去访问与编辑权限。
[取消] [确认移除]
```

## DOM 实证 — 学生 tabs (B-STU-COURSES-1)

```
[内容] [任务6] [成绩] [公告]      ← 4 tab，无 讨论/资源
```

## Cross-module / Backward Compat

- `CourseDetailTabKey` type 保留全部 keys (含 "discussion" / "resources") — 学生 page useState 类型不破坏，最小侵入
- TABS 数组删 discussion + resources 2 项 — nav 无入口但 type 保留
- `activeTab !== "content"` 判断仍生效 (默认 "content")
- hero × 按钮 + dialog 列表 "移除" 按钮 — 双入口统一走 AlertDialog confirm (一致性 ✓)
- handleRemoveTeacher 末尾 fetchCourseTeachers() — 列表自动刷新

## Finsim-specific 检查

- ✅ UI 文案全中文 (协作教师/已添加/移除/确定将/移出/失去权限)
- ✅ AlertDialog 模式与 Unit 2/5a/5b 同款一致
- ✅ Schema 0 改动
- ✅ 双入口 (hero × + dialog 列表 移除) 统一 AlertDialog
- ✅ TABS 删除最小侵入 (type 保留)

## 风险 / 不确定项

1. **🟢 Schema 0 改动**
2. **🟢 CourseDetailTabKey type 保留**: 老 student page useState<TabKey> 仍接受 "discussion"/"resources" string, 但 TABS 数组不渲染所以无 nav 入口
3. **🟢 hero × 与 dialog 列表 移除 统一 AlertDialog**: 一致性确认
4. **🟡 NextAuth race (B test serial)**: 已知 finsim 模式，isolated 100% PASS
5. **🟢 取消按钮不真删 DB 验证**: API 查 collaborators count=1 维持 ✓

## 是否引入新 bug

无。3 files +232/-3 scope 严格按 plan；vitest 1089 全过；DOM 实证 + DB 验证完整；测试 0 副作用。

## Issues found

无 blocker。

## Overall: **PASS**

**判断标准对照 (r1 即收 3 条件 — 无 schema 版)**：
1. ✅ QA 4 case (dialog 列表 + AlertDialog confirm + 学生 tab + hero × 一致性) vs builder 3 e2e — 独立证据链
2. ✅ DOM 文本精确 / tab labels / button count / API DB 验证 全 deterministic
3. ✅ DB cleanup 完整 (取消不真删)

**建议 r1 PASS 收工**。Phase 4 第五个 unit 干净结束。

Phase 4 进度: Unit 17 ✅ / Phase3-A ✅ / Unit 12 ✅ / Unit 15 ✅ / Unit 13 ✅ / Unit 14/Phase3-B/Unit 16 待开。
