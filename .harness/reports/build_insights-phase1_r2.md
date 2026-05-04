# Build Report — insights-phase1 r2

**Builder**: claude-opus-4-7[1m] · **Date**: 2026-05-03 · **Worktree**: `.claude/worktrees/elastic-davinci-a0ee14` · **Round**: r2（修 r1 BLOCKER）

## 修复对象

QA r1 verdict = FAIL，1 BLOCKER。详见 [.harness/reports/qa_insights-phase1_r1.md](.harness/reports/qa_insights-phase1_r1.md)。

| Issue | 类别 | 修复 |
|---|---|---|
| §E.16 切课程 race condition stale classIds | BLOCKER | 见 §1 |
| breadcrumb `analytics-v2` 仍写「洞察实验」 | Minor 1 | 见 §2 |

## §1 BLOCKER 修复 — auto-fill effect 加 diagnosis.scope.courseId 守卫

**根因复盘**（与 QA 一致）：

- 用户从 A 课切到 B 课时，`onValueChange` 在 InsightsFilterBar 的 course Select 里 dispatch `replaceQuery({ courseId: B, classIds: null, ... })`
- searchParams update → `courseId` derived state from "A" → "B"，`classIds` 变成 `[]`
- 同时 fetchDiagnosis effect (deps: `[courseId, searchParams]`) 启动 B 的 fetch（async）
- **此时 `diagnosis` state 仍是旧 A 的值**，scope.courseId 还是 "A"
- auto-fill effect 触发（deps 含 `courseId` 和 `diagnosis`）：
  - ref ("A") !== courseId ("B") → 不跳出
  - diagnosis truthy → 不跳出
  - classIds.length === 0 → 进入"写默认全部班"分支
  - **从 stale 的 A diagnosis 拿 filterOptions.classes**（A 班 id）→ 写回 URL `?courseId=B&classIds=A班id`
- B 的 fetch 完成 setDiagnosis(B) 后，auto-fill effect 再触发，但此时 `defaultClassIdsAppliedRef.current` 已被刚才的 stale 路径设成 "B"，触发 `current === courseId` 跳出 → 不再修正

**修复**：在 auto-fill effect 内 `if (!diagnosis) return;` 之后插入

```ts
if (diagnosis.scope.courseId !== courseId) return;
```

效果：当 diagnosis 与当前 URL 的 courseId 不一致（即 fetch 还没刷新到新 course），effect 直接 return 等下一次 re-fire（diagnosis 真正切到新 course 后）。这样无 stale 数据可用、无错误写入。

**为什么选这个 fix（vs setDiagnosis(null)）**：

- 不引入额外 loading flash（spec 强调"质量 > 稳定 > 效率"，UI 平滑切换更重要）
- 单点防御 + 1 行 diff，最小改动
- 副效益：未来如果有别的来源会让 diagnosis state 过时，这个 guard 也能挡住

**改动位置**：[components/analytics-v2/analytics-v2-dashboard.tsx:357-380](components/analytics-v2/analytics-v2-dashboard.tsx)（在 effect 内加 1 行）

## §2 Minor 1 修复 — 面包屑「洞察实验」→「数据洞察」

**改动**：[lib/layout/breadcrumbs.ts:17](lib/layout/breadcrumbs.ts) `"analytics-v2": "洞察实验"` → `"数据洞察"`

**注意**：line 16 老 `analytics` 路由 label 已经是「数据洞察」，与新 sidebar 同名。这是 OK 的，因为面包屑只渲染当前 path，两条路由是不同 URL，用户不会同时看到两个「数据洞察」。phase 6 决定老路由清理时再处理同名问题。

## 验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors / 0 warnings** |
| 单元测试 | `npx vitest run` | **782 / 782 passed** |
| Worktree dev server | `curl :3031/teacher/analytics-v2` | HTTP 307 → /login（auth 重定向，正常）|

## 边界场景自验（针对 BLOCKER fix 的逻辑追踪）

| 场景 | 行为 | 结果 |
|---|---|---|
| 1. 首次进 `?courseId=A`（无 classIds） | ref=null → diagnosis=null wait → A's diagnosis 到 → courseId 匹配 → 写 A 的 classIds → ref=A | ✅ |
| 2. **A→B 切课**（BLOCKER 场景）| ref=A, courseId=B → diagnosis 还是 A 的 → guard `"A" !== "B"` return → 等 B 的 diagnosis → 重新 fire → match → 写 B 的 classIds → ref=B | ✅ 修复 |
| 3. 用户手动 cancel-all（A 课内）| ref=A, courseId=A → ref === courseId 跳出 → 不重写 URL | ✅ |
| 4. 重置按钮 | ref=null, URL 只剩 `?courseId=A` → A 的 diagnosis 已在 → effect fire → 匹配 → 写全部 A 班 → ref=A | ✅ |
| 5. legacy `?classId=A` | classIds memo 返回 `[A]`（fallback）→ effect fire → diagnosis 匹配 → classIds.length > 0 → 设 ref=courseId 直接 return（不重写 URL）→ legacy 形式保留 | ✅ |

## 改动文件清单（r2 增量，仅 2 个文件）

| 文件 | 改动行数 | 类型 |
|---|---|---|
| `components/analytics-v2/analytics-v2-dashboard.tsx` | +1 line（auto-fill effect 加 1 行 guard） | edit |
| `lib/layout/breadcrumbs.ts` | 1 line（label 字串） | edit |

总计 2 文件 / ~2 行 diff，对 BLOCKER 是最小修复。

## Dev Server 重启

**不需要**。无 schema 改动，仅 .ts/.tsx，Next.js fast refresh 自动 pick up。worktree 独立 dev server 已经在 3031 alive（QA r1 启动）。

## 反退化检查

- [x] r1 已 PASS 的 29 项 acceptance 没有改动到（只动 1 行 guard + 1 行 label）
- [x] auto-fill effect 主体逻辑（ref guard / classIds.length / writeURL）完全保留
- [x] 测试套件 782/782 仍 pass
- [x] 类型 + lint 0 errors

## 下一步

通知 QA 复测 §E.16（切课程后 stale classIds 残留问题）+ 顺手验下 breadcrumb 是否变「数据洞察」。其他 29 项 r1 已固化无需回归。
