# Unit A2 — Mini Plan (r1)

> builder@instance-workbench · 2026-05-15

## 目标
overview 标题旁加 pen icon 入口；inline rename；保存 → PATCH `/api/lms/task-instances/{id}` → 本地 state 立即更新；其他 5 处显示位（dashboard / `/teacher/tasks` / `/teacher/instances` / `/grades` / sidebar 面包屑）下次加载自动从 DB 读取新值。

## 改动文件

| 文件 | 改动 | 估行 |
|---|---|---|
| `components/instance-detail/instance-header.tsx` | 加 inline `EditableTitle` 子组件 + `onTitleSave` prop + 接 `Pencil` 入口 | +60 |
| `app/teacher/instances/[id]/page.tsx` | 接 `handleTitleSave` + 传 `onTitleSave` | +25 |
| `tests/instance-header-editable-title.test.tsx` | vitest 渲染测试 ≥1 | +60 |

总 ~145 行（单 commit）。

## 关键决策

1. **EditableTitle 内置 `instance-header.tsx`** —— 不抽独立文件
2. **Saving state**：组件本地 `isSaving` + 父组件 `onTitleSave` 返回 Promise；error toast 由父统一处理
3. **Validation**：trim + 长度 1-200（与 Zod schema 一致）
4. **键盘**：Enter 保存、Esc 取消（IME composition guard）
5. **乐观更新**：保存成功后立即 `setInstance(prev => ({...prev, title: next}))`
6. **breadcrumb 同步**：父页 L129 `{instance.title}` 直接读 state
7. **不动后端**：PATCH endpoint + Zod schema + service 全已就绪
