# Unit 7 Plan — 课表去重 + 一周洞察 meta footer

> Builder: builder · Round 1 · 2026-05-14
> Spec: `.harness/spec.md` Unit 7
> Bugs: B-DASH-01 / B-DASH-03 部分 / B-STU-SCHED-1 / probe r1 P1-1

## 关键 grep 发现

### A. 课表"去重"实际症状（probe r1 P1-1 + B-DASH-03）

- DB 现状：`(courseId, dayOfWeek, timeLabel)` 无任何重复行（grep 实证）
- 真实重复：**3 个不同 Course 行 createdBy 都是 teacher1，courseTitle 都叫"个人理财规划"**，molly 是其中 2 个的协作者
  - `940bbe23` / `ec619c34` / `e6fc049c` 都 title="个人理财规划"，class 都关联 "金融2024A班"
  - molly dashboard fetch `prisma.scheduleSlot.findMany({where: { course: teacherCourseFilter(molly) }})` 返回 2 个 slot 同 dayOfWeek + timeLabel + className，**展示时看起来重复**
- spec 写"按 scheduleSlotId + 日期 去重"字面**无效**（slotIds 不同）

### 务实方案

dedup key = **`(courseTitle, className, dayOfWeek, timeLabel, date)`** — 即"用户视觉上看起来一致的行"合并。
- 同课同班同时间真重复（数据冗余）→ 合并
- 不同 courseId 但 title/class/time 全一致 → 看起来重复，对用户也是合并最自然

记录"合并掉的源 slotIds"在保留行的 metadata 中（不展示，便于 audit）。

### B. 一周洞察 meta footer（B-DASH-01）

- `WeeklyInsightResult` 已有 `generatedAt: Date` / `cached: boolean`
- 缺：`modelUsed` / `durationMs`
- `getProviderForFeature("weeklyInsight", setting)` 在 service 中已调用，可拿到 provider.name + model
- duration：在 `aiGenerateJSON` 调用前后记 startedAt / now 计算

### C. modal 60s 冷却

- 前端 state：record lastGeneratedAt（modal data.generatedAt）
- "重新生成"按钮 disable 当 `Date.now() - lastGeneratedAt < 60_000`，显示剩余秒数
- 不动服务端（spec 写"服务端节流见 Unit 11"，本 unit 仅前端 UX）

## 改动文件清单

| 文件 | 改/新 | 说明 |
|---|---|---|
| `lib/utils/teacher-dashboard-transforms.ts` | 改 | `buildUpcomingSchedule` 输出去重逻辑（合并视觉上等价的行）|
| `lib/utils/schedule-transforms.ts` 或类似 | 改 (如有) | 学生侧 `buildTodaySchedule` / `buildThisWeekSchedule` 同款去重 |
| `lib/services/weekly-insight.service.ts` | 改 | `WeeklyInsightResult` 加 `modelUsed` / `durationMs`；service 内计时 + 读 provider/model |
| `components/teacher-dashboard/weekly-insight-modal.tsx` | 改 | footer 显示 meta（"由 {model} 生成 · 耗时 {N}s · 生成于 {N} 分钟前"）+ "重新生成"按钮 60s 冷却 |
| `tests/*` | 新/扩 | dedup unit test + service modelUsed/durationMs field |
| `tests/e2e/unit7-verify.spec.ts` | 新 | 4-6 case |

## 关键改动思路

### 1. buildUpcomingSchedule 去重

```typescript
// 在 candidates.push 之后、final sort 之前加
const seen = new Set<string>();
const deduped = candidates.filter((slot) => {
  const key = `${slot.courseTitle}|${slot.className ?? ""}|${slot.timeLabel}|${slot.date}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
deduped.sort(...);
return deduped.slice(0, count);
```

不动数据库或 schema。dedup 在 transform 层，纯前端/server-side derivation。

### 2. weekly-insight modelUsed / durationMs

```typescript
// service 内 — 包 aiGenerateJSON 调用
const startedAt = Date.now();
const { provider, model } = getProviderForFeature("weeklyInsight", setting);
let modelUsed: string | null = null;
let durationMs: number | null = null;

try {
  const ai = await aiGenerateJSON("weeklyInsight", teacherId, ...);
  modelUsed = `${provider.name}:${model}`;  // e.g. "qwen:qwen-plus-2025-09-11"
  durationMs = Date.now() - startedAt;
  payload = { ...ai };
} catch (err) {
  modelUsed = null;
  durationMs = Date.now() - startedAt;
  // ... fallback
}

const result: WeeklyInsightResult = {
  payload,
  generatedAt: now,
  modelUsed,         // new
  durationMs,        // new
  ...
};
```

### 3. modal footer + 冷却

```tsx
// modal footer
{data && (
  <div className="text-[11px] text-ink-5">
    {data.cached ? "已缓存" : "本次生成"} ·{" "}
    {data.modelUsed && `由 ${data.modelUsed.split(":")[1]} 生成`} ·{" "}
    {data.durationMs != null && `耗时 ${(data.durationMs / 1000).toFixed(1)}s`} ·{" "}
    生成于 {formatRelativeTime(data.generatedAt)}
  </div>
)}

// 重新生成 button
const [cooldownUntil, setCooldownUntil] = useState<number>(0);
useEffect(() => {
  if (data?.generatedAt) {
    setCooldownUntil(new Date(data.generatedAt).getTime() + 60_000);
  }
}, [data?.generatedAt]);
const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
<Button disabled={remaining > 0} onClick={onRegenerate}>
  {remaining > 0 ? `重新生成 (${remaining}s)` : "重新生成"}
</Button>
```

## 风险点

1. **🟢 dedup 不动 schema** — 仅 transform 层
2. **🟢 modal meta 增量字段 backward-compat** — UI 用 optional chaining 兼容老缓存（generatedAt 在内存 cache 里没有 modelUsed/durationMs 时显示降级）。新生成时填上。
3. **🟡 cache 老条目无 modelUsed/durationMs**：暂时显示降级文案，新生成时填上。或主动 clearCache（不必）。
4. **🟢 modal 60s 冷却前端 only** — 用户不能 spam；服务端节流是 Unit 11 范围。
5. **🟡 dedup key 选择 (courseTitle, className, time, date)**：不动 courseId — 防 3 个真不同课程被误合。
6. **🟢 "今日 0 节"文案改"今日无排课"**：仅文案改，不动逻辑。dashboard B-DASH-03 文案部分。

## 自测计划

### 自动化
1. tsc + vitest + eslint
2. e2e 4-6 case

### e2e 计划
- **A**: 课表去重 — molly dashboard 近期课表"个人理财规划 10:00" 不再连出 3 行（应只 1 行）
- **B**: weekly-insight modal 打开后 footer 显示 "耗时 / 生成于"
- **C**: "重新生成"60s 冷却 — 第一次生成后立即点应 disabled
- **D**: 学生 dashboard 今日课表（如有相同 dedup）— 不重复
- **E**: 顶部"今日 N 节课" — 0 时显示"今日无排课"（如本 unit 改文案）
- **F**: 老条目无 modelUsed 时 footer 不报错

## 不在本 unit 范围

- ❌ 服务端节流（Unit 11）
- ❌ Schema 改动
- ❌ 一周洞察 prompt（Unit 11 同时做）
- ❌ Course 表合并 / 数据 dedup（数据层面 vs transform 层面，仅 transform）

## diff 预算

预计 250-350 行：
- transform 改 ~40
- service 改 ~30
- modal 改 ~80
- tests ~120

## 待 coordinator 确认

1. **dedup key `(courseTitle, className, dayOfWeek, timeLabel, date)`** vs spec 字面 `scheduleSlotId + 日期` —我倾向务实方案（spec 字面在当前数据下无效）。如要求严格按 spec，则不改 transform（仅文案改）+ 写 follow-up note 等数据修复
2. **modelUsed 格式 `"provider:model"`** vs 仅 model（不含 provider）—我倾向带 provider 便于 audit
3. **"今日 N 节课"0 → "今日无排课"**：是否在本 unit 做？probe 标这是文案改，简单做掉。
