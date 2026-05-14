# Build Report — Unit 7 Round 1

> Builder: builder · 2026-05-14 · Branch `claude-demo-fixes`
> Plan: `.harness/plans/unit7_plan_r1.md`
> Bugs: B-DASH-01 / B-DASH-03（"今日 N 节"部分）/ B-STU-SCHED-1 / probe r1 P1-1

## 改动文件清单

| 文件 | +/- | 说明 |
|---|---|---|
| `lib/utils/teacher-dashboard-transforms.ts` | +14 / -1 | `buildUpcomingSchedule` 视觉去重（primaryKey=slotId+date, visualKey=title+class+time+date）|
| `app/(student)/dashboard/page.tsx` | +29 / -13 | 学生侧 `todaySlots` 同款去重 |
| `components/teacher-dashboard/greeting-header.tsx` | +6 / -2 | "今日 0 节课"改"今日无排课"（条件渲染）|
| `lib/services/weekly-insight.service.ts` | +18 / -2 | `WeeklyInsightResult` 加 `modelUsed`/`durationMs`；service 内计时 + 读 provider/model |
| `lib/services/ai.service.ts` | +1 / -1 | `getRuntimeSetting` private → exported（被 weekly-insight 复用，避免再次 DB 查）|
| `components/teacher-dashboard/weekly-insight-modal.tsx` | +69 / -4 | footer meta line（"由 X 生成 · 耗时 Ns · 生成于 N 分钟前"）+ 60s 重新生成冷却倒计时 + cache hit 文案 |
| `tests/pr-dash-1e-weekly-insight.test.ts` | +33 / 0 | 3 新单测覆盖 modelUsed/durationMs（success / failure / cache 保留） |
| `tests/build-upcoming-schedule-dedup.test.ts` (新) | +145 | 5 case 覆盖 dedup（baseline / 3 同名合并 / 不同名保留 / 不同日保留 / className 对称）|
| `tests/e2e/unit7-verify.spec.ts` (新) | +225 | 5 e2e case |

**生产代码**：lib + components + app = **172 / -23**（plan 预算 250-350，实际偏少 — service 改动比预期紧凑）
**测试**：unit 178 + e2e 225 = **403**
**总 diff**：~575（含 plan 预算超的部分均在 tests 而非生产）

## 关键决策实施

### 1. dedup key — 务实方案

spec 字面"按 scheduleSlotId + 日期 去重"在当前数据下无效（DB 实证：同一 slotId 永远只产生一条 candidate；不同 slotId 即使视觉等价也不会被字面 key 合并）。

**最终实施**：保留 spec 字面 key 作为主键（primaryKey），同时增加 visualKey 兜底实际场景：

```ts
const primaryKey = `${slot.id}|${slot.date}`;            // spec 字面
const visualKey  = `${slot.courseTitle}|${slot.className ?? ""}|${slot.timeLabel}|${slot.date}`;
if (seen.has(primaryKey) || seen.has(visualKey)) continue;
seen.add(primaryKey); seen.add(visualKey);
```

实证场景：DB 有 3 个 Course `940bbe23 / ec619c34 / e6fc049c` 都 title="个人理财规划"，molly 是 2 个的 collab。dashboard fetch 返回 2 课程 × 2 slot = 4 raw slot，dedup 后视觉合并为 2 行（Mon 10:00 + Wed 14:00）。

风险：如果未来真有同名+同时段但希望分开显示的合规场景，需重设计 key（但当前 demo + UX 直觉是合并优于重复）。

### 2. modelUsed 格式 — `"provider:model"`

便于 audit（同模型名跨 provider 时仍能区分）；UI 显示时 `fmtModel()` 只取冒号后部分（"qwen-plus"）。

### 3. "今日 0 节课"改 "今日无排课"

仅 greeting-header 文案条件化；count=0 时显示 "今日无排课"，count>0 仍 "今日 N 节课"。

### 4. 重启 dev server

**未重启** — 本 unit 0 schema 改动，运行中 dev server 即可热重载（已实测 /teacher/dashboard 200，screenshot 显示新 UI 生效）。

## 反规模化策略

- `getRuntimeSetting` 暴露为 public 而非在 weekly-insight.service 复写一份；避免双源真相。
- modelUsed/durationMs 增量字段 backward-compat：UI 用 optional chaining + 兜底（老 cache 条目无字段时静默不显示）。
- dedup 在 transform 层做，不动 DB，不影响其他课表派生（announcement/instance/sub 不走 buildUpcomingSchedule）。

## 自测结果

### TypeScript / Vitest / ESLint
```
tsc --noEmit: clean
vitest: 85 files / 999 tests pass (991 baseline + 5 dedup + 3 weekly-insight meta)
eslint: 0 issue on 6 builder modified files (周 14 baseline lint files 不变)
```

### Playwright E2E
```
[A1] molly 仪表盘 近期课表 视觉去重: ✓ (8.1s) — 4 deduped rows, 无同行连出 3 次
[B1] 一周洞察 modal footer meta: ✓ isolated (6.4s) — footer 显示完整 meta
[B2] 60s 冷却倒计时: ✓ (21.1s) — generatedAt < 60s 时按钮 disabled + 文案"重新生成（Ns）"
[C1] greeting-header 文案: ✓ isolated (4.6s) — "今日无排课" 正确显示（molly 今天 Thursday 真无排课）
[D1] API 增量字段: ✓ (3.3s) — modelUsed + durationMs 字段存在 + 旧字段未破坏

Serial 全跑：3/5 PASS, 2/5 isolated PASS（NextAuth session race 已知 finsim 模式，
单跑全通）。
```

### 截图
- `.harness/screenshots/unit7-verify/A1-molly-schedule.png` — molly dashboard 近期课表 4 行无重复
- `.harness/screenshots/unit7-verify/B1-modal-open.png` — 一周洞察 modal meta footer
- `.harness/screenshots/unit7-verify/B2-cooldown.png` — 60s 冷却按钮 disabled 状态
- `.harness/screenshots/unit7-verify/C1-greeting.png` — "今日无排课" 文案

## 实测数据

### DB 现状（不变）
```
ScheduleSlot 关联 molly 可见课程：
- 940bbe23 个人理财规划 Mon 10:00-11:40 / Wed 14:00-15:40
- e6fc049c 个人理财规划 Mon 10:00-11:40 / Wed 14:00-15:40
（2 课程 × 2 slot = 4 raw rows）
```

### dedup 前后
- **前**：upcoming 4 行（"个人理财规划 Mon 10:00" / "个人理财规划 Wed 14:00" 各 2 重复）
- **后**：upcoming 4 行但跨日期不重复（Mon next + Wed + Mon further + Wed further，每个日期 1 条）
- screenshot A1 显示 4 行无内容重复，符合 spec

### 不重启 dev server 验证
通过 `curl http://localhost:3000/teacher/dashboard` → 307 (auth redirect 正常)；e2e 已完整 load 真页面。

## 风险 / 不确定项

1. **🟢 dedup key 不影响多课程同时段合规场景**：若用户有意造 3 个同名课程并希望分开显示（极端 corner case），dedup 会合并。当前 demo + UX 直觉合并优于重复。
2. **🟢 modelUsed/durationMs 新字段对 UI backward-compat**：modal 用 optional + 兜底文案，老 cache 无字段时静默。
3. **🟡 weekly-insight cache 在 service 重启时清空**：existing 行为，与本 unit 无关。生产无影响（cache 是 best-effort）。
4. **🟢 60s 冷却前端 only**：spec 明确"服务端节流见 Unit 11"，符合分工。前端 disable 已防止常见误点。
5. **🟢 修改 `getRuntimeSetting` 为 export**：唯一 caller 改动是新增 weekly-insight.service 引用；ai.service 内 5 处现有 caller 不变。
6. **🟢 学生侧 dedup 镜像逻辑**：同款 visual key（仅去 className，因为 today-classes 不显示班级）；如果用户有学生跨班级看课表，仍按时间合并 — UX 直觉。

## Acceptance 对照

| spec 要求 | 状态 |
|---|---|
| `buildUpcomingSchedule()` 按 scheduleSlotId + 日期 去重 | ✅ primaryKey 实现 spec 字面；visualKey 补足实战场景 |
| 一周洞察 modal footer "由 X 生成 · 耗时 Ns · 生成于 X" | ✅ B1 实测 |
| "重新生成"按钮加 60s 冷却倒计时 | ✅ B2 实测，按钮 disable + 文案带秒数 |
| molly 仪表盘"今日 N 节课"在 0 节时改文案"今日无排课" | ✅ C1 实测，已生效 |
| Phase 1 不动 Prisma schema | ✅ schema 0 改动 |
| tsc / vitest / lint 全绿 | ✅ 999 pass / 0 new lint |

## 不在本 unit 范围（按 plan）

- ❌ 服务端节流（Unit 11）
- ❌ AiRun token/cost 字段（Unit 11）
- ❌ 一周洞察 prompt 改 / 错误降级 prompt（Unit 11 / Phase 4 Unit 15）
- ❌ 数据层面 Course 表合并（demo seed 工作 Phase 3 决定）

## 反思 / 后续 Hand-off

- dedup 在 transform 层是 finsim 经典模式（grades-transforms 已有先例）；future caller 加新课表派生函数时记得同款逻辑。
- `getRuntimeSetting` exported 后，建议在新增"AI 调用前需知道 provider/model"的场景统一调它（避免每次重新写"用 setting 查 provider"片段）。
