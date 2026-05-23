# build_snapshot-bugfix-slice-5.md

## Task

Slice 5 (Task #13): B4 删假占位「复制为新任务」按钮（review-pr13 F-7）。AlertDialog 内 disabled + `title="即将上线，敬请期待"` = UI 假承诺未实现功能。

## RED

新文件 `tests/snapshot-edit-sheet-buttons.test.ts`，4 测试：
- 不含 `data-action="copy-as-new"`
- 不含「即将上线」/「敬请期待」
- 不含 `<Button … disabled … title="即将上线…">` 模式
- 仍含「复制为新任务」字符串（保留 description 文字）

**RED 阶段**: 3 FAIL（占位按钮还在）+ 1 PASS（描述文字仍在）。

## GREEN

### `components/instance-detail/snapshot-edit-sheet.tsx`

删除 AlertDialogFooter 内 8 行：

```tsx
<Button
  variant="outline"
  disabled
  title="即将上线，敬请期待"
  data-action="copy-as-new"
>
  复制为新任务
</Button>
```

AlertDialogFooter 现为两按钮：`AlertDialogCancel`（取消）+ `AlertDialogAction`（我知道，仍然保存）。

### `tests/instance-snapshot-edit-sheet.test.ts` 同步更新

旧 test block `Unit A1 r1b · graded 警告 AlertDialog 三按钮` 含 2 个测试锁定 fake button（"三按钮文案" + "disabled + tooltip"），现已 stale。改为：
- `Unit A1 r1b · graded 警告 AlertDialog 两按钮`
- 1 测试: "含 AlertDialog + setWarningOpen(true)"（保持）
- 1 测试: "两按钮文案: 取消 / 我知道，仍然保存"（替换三按钮 + 删除 disabled + tooltip 断言）+ 仍验描述含「复制为新任务」

3 个旧 test → 2 个新 test（净 -1 test，但锁定的是正确行为）。

### 保留

- 3 处「复制为新任务」描述文字（line 197 dialog description / line 393 simulation form / line 484 quiz form）作建议路径提示
- `app/teacher/tasks/[id]/page.tsx` 的真按钮（task 编辑页是不同 feature，本 slice 不动）
- E2E `tests/e2e/qa-unit4-task-editing.spec.ts` / `unit4-verify.spec.ts`（测 task 页那个真按钮，与本 slice 无关）

## 验证

| 检查 | 结果 |
|---|---|
| 新 4 测试 PASS | ✅ |
| 全 vitest suite | ✅ 109 / 1130（Slice 4 baseline 108 / 1127 → +1 file / 4 new tests - 1 deleted = net +3 tests, 0 regression）|
| `npx tsc --noEmit` | ✅ 0 errors |
| eslint touched files | ✅ 0 errors / 0 warnings |
| iw-acceptance E2E grep | ✅ 无 stale 引用 |

## 改动文件

- `components/instance-detail/snapshot-edit-sheet.tsx` (-8 lines)
- `tests/instance-snapshot-edit-sheet.test.ts` (+5/-14, 3→2 测试)
- `tests/snapshot-edit-sheet-buttons.test.ts` 新建（4 测试，36 行）
- `.harness/plans/snapshot-bugfix-slice-5.md`
- `.harness/reports/build_snapshot-bugfix-slice-5.md`

## 不动 / 延后

- task 编辑页的真按钮（不同 feature）
- service / schema / 其它 UI
- E2E tests

## 不确定 / 注记

- coordinator 说"保留 4 处 description 文字"——实际仅 3 处（dialog description + 2 个 form 提示文字）；保留所有 3 处。`app/teacher/tasks/[id]/page.tsx:1632` 提到的"推荐复制为新任务再修改"是 task 编辑页的描述，不在本 slice 范围。
- dev server 不需要重启（仅 client 组件改动）。

## 整套 PR 状态

5 slice plan，4 个真 fix slice 已完成（Slice 1/2/4/5），Slice 3 跳过（B2 已在 PR #14 修过）。整 PR 闭环 review-pr13 F-3 (B1) + F-7 (B4) + review-arch F-4 (B3)。
