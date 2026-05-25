# 巡检的 progress.tsv 一行格式

> 每次巡检收尾追加**一行**到 `.harness/progress.tsv`。该文件是 **TSV（制表符分隔）**，7 列，第 1 行是表头。

## 列定义（顺序固定，制表符 `\t` 分隔）

| # | 列 | 巡检填什么 |
|---|---|---|
| 1 | `timestamp` | UTC ISO8601，如 `2026-05-25T07:30:00Z` |
| 2 | `unit` | 巡检单元名，如 `patrol-feedback`、`patrol-capability`（自验巡检能力本身用这个） |
| 3 | `round` | `r1`/`r2`…（同一 unit 多轮巡检递增） |
| 4 | `verdict` | `PASS` / `FAIL` / `BLOCKED`（staging 502 或未 seed → BLOCKED） |
| 5 | `cost_usd` | 本轮花费，无则 `0.00` |
| 6 | `description` | 一行摘要：验了几条、过几条、关键证据、失败指哪步。用 `;` 分隔子项（沿用既有行风格），**不要带制表符/换行** |
| 7 | `git_commit` | 被验改动的短 SHA；纯巡检无 commit 填 `-` |

## 追加方式
- 用 Edit/Write 在文件**末尾**加一行（别动表头和已有行）。
- 列之间是**真实制表符**，不是空格。

## 示例行（制表符在此用 `→` 标示，实际写真 Tab）
```
2026-05-25T08:00:00Z→patrol-feedback→r1→PASS→0.00→反馈巡检 7/7 真浏览器过:三角色见钮+提交落库带URL/角色/截图/UA+管理员收件箱可见+非管理员403+全屏sim不遮挡+截图降级+学生限频;截图条 screenshots/patrol-feedback/;test反馈条cleanup 0残留未碰富课→<PR短SHA>
```

```
2026-05-25T07:30:00Z→patrol-capability→r1→BLOCKED→0.00→staging 502不可达(Caddy活/上游app挂),3账号登不进;runbook+格式骨架已离线交付,真dogfood待staging恢复→-
```

```
2026-05-25T09:00:00Z→patrol-feedback→r1→FAIL→0.00→反馈巡检第3步管理员收件箱500:console Prisma runtime undefined(疑schema改了dev server没重启);其余6点PASS;截图 screenshots/patrol-feedback/03→<PR短SHA>
```
