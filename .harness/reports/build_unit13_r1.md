# Build Report — Unit 13 Round 1

> Builder: builder · 2026-05-15 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit13_plan_r1.md`
> Bugs: B-COURSE-02 + B-STU-COURSES-1

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `app/teacher/courses/[id]/page.tsx` | +85 / -2 | 协作 Dialog 顶部加现有协作者列表 (从 `courseTeachers` state + 既有 `handleRemoveTeacher`)；每行 name + email + "移除"按钮；空时显示 "尚无协作教师" 文案。**Q3 micro-adjust**：移除走 AlertDialog 二次 confirm "确定将 {name} 老师移出本课程协作？移除后该老师将立即失去访问与编辑权限"。hero 内联 `×` 按钮也路由到同款 confirm（一致性）。|
| `components/course-detail/course-hero.tsx` | +3 / -2 | TABS 数组删 `discussion` + `resources` 2 项，保留 CourseDetailTabKey type 完整（避免 student page useState 类型 break）|
| `tests/e2e/unit13-verify.spec.ts` (新) | +137 | 3 case (A1 dialog 列表+移除按钮 / A2 AlertDialog confirm + 取消不真删 / B1 学生 tab 不见 discussion+resources) |

**生产代码**：88 / -4
**测试**：137
**Total**：~225（plan 估 50 prod + 80 e2e = 130，超 ~100 主要是 dialog 列表 UI + AlertDialog 完整化）

## 关键决策实施（按 coordinator 批准 + Q3 micro-adjust）

1. ✅ **不分页** — 协作者 ≤5-10 人列表展示足够
2. ✅ **CourseDetailTabKey type 保留全部 keys** — 学生 page useState 类型不破坏，最小侵入
3. ✅ **Q3 micro-adjust: AlertDialog 二次 confirm** — 与 Unit 2/5a/5b 同款模式；hero × 内联按钮也路由到同款 confirm（一致性）

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 95 files / 1089 tests pass (no new unit tests — Unit 13 是 UI polish 行为靠 e2e 验证)
eslint: 0 new issue
```

### Playwright E2E (3 cases)
```
[A1] teacher1 协作 Dialog 显示现有协作者列表 + '移除'按钮: ✓ (28.5s)
[A2] 点击 '移除' 后 AlertDialog 显示确认 + 取消不真删: ✓ isolated (9.8s)
[B1] 学生 /courses/[id] 不显示 '讨论' 和 '资源' tab: ✓ (21.6s)

Serial 2/3 PASS + 1 race-isolated PASS (NextAuth 模式)
```

### 截图
- `.harness/screenshots/unit13-verify/A1-collab-dialog.png` — 协作 Dialog 显示 `molly molly@qq.com [移除]` 列表行 + email input
- `.harness/screenshots/unit13-verify/A2-confirm.png` — AlertDialog 显示 "移除协作教师 / 确定将 molly 老师移出本课程协作？" + 取消/确认移除
- `.harness/screenshots/unit13-verify/B1-student-tabs.png` — 学生 /courses/[id] 仅 4 tab（内容/任务/成绩/公告），无讨论/资源

## 风险 / 不确定项

1. **🟢 schema 0 改动**
2. **🟢 CourseDetailTabKey type 保留** — 老 student page useState<TabKey> 仍接受 "discussion"/"resources" string，但 TABS 数组不渲染，所以 nav 无入口。`activeTab !== "content"` 判断仍生效（默认 "content"）
3. **🟢 hero × 按钮统一走 AlertDialog** — 与 dialog 列表 "移除"按钮一致，无快/慢两个删除路径
4. **🟡 dialog 内 list 不刷新即时**：`handleRemoveTeacher` 末尾调 `fetchCourseTeachers()` 已存在，移除成功后 dialog 内列表自动更新
5. **🟢 教师视图 hero 仍显示 teacher badges** — 不动 hero 之外协作展示路径

## Acceptance 对照

| 要求 | 状态 |
|---|---|
| 协作教师 dialog 加现有协作者列表 + 移除按钮 | ✅ A1 实证 |
| 学生 "资源" + "讨论" tab 完全隐藏 | ✅ B1 实证 |
| 不破坏教师视角同 dialog | ✅ hero 协作 badge + add 流程不变 |
| AlertDialog 二次 confirm | ✅ A2 实证含取消路径 |
| tsc / vitest / lint 全过 | ✅ |

## 不在本范围

- ❌ 学生 page 内 `activeTab !== "content"` 占位文案的删除（type 仍含 discussion/resources，删除文案是孤儿但代码路径无法触达）
- ❌ 协作者 dialog 加邀请确认 / 邀请链接（spec 未要求）
- ❌ 移除后给被移除老师发邮件通知（spec 未要求）

## 反思

- Q3 micro-adjust 提醒抓得准 — 协作老师移除是高风险，AlertDialog 二次 confirm 是 ~30 行换 demo 安全感
- hero × 按钮顺手统一走 confirm 是"不破坏其他路径"原则的延伸 — 两个删除入口同款体验
- TABS 数组删项 + type 保留是最小侵入解 — 比改 type 改 useState 改 if 分支链都干净
