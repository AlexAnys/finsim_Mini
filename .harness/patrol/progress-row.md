# 巡检的 progress.tsv 一行格式

> 每次巡检收尾追加**一行**到 `.harness/progress.tsv`。该文件是 **TSV（制表符分隔）**，7 列，第 1 行是表头。

## 列定义（顺序固定，制表符 `\t` 分隔）

| # | 列（表头名） | 巡检填什么 |
|---|---|---|
| 1 | `timestamp` | UTC ISO8601，如 `2026-05-25T07:45:00Z` |
| 2 | `unit` | 巡检单元名，如 `patrol-feedback`、`patrol-capability`（自验巡检能力本身用这个） |
| 3 | `round` | `r1`/`r2`…（同一 unit 多轮巡检递增） |
| 4 | `verdict` | `PASS` / `FAIL` / `BLOCKED`（staging 502 或未 seed → BLOCKED） |
| 5 | `cost_usd`（表头）/ **实为产出角色** | ⚠️ 见下「列 5 漂移」。近期行填**产出角色**（如 `builder-patrol`/`qa`），不是金额 |
| 6 | `description` | 一行摘要：验了几条、过几条、关键证据、失败指哪步。用 `;` 分隔子项（沿用既有行风格），**不要带制表符/换行** |
| 7 | `git_commit` | 被验改动的短 SHA；纯巡检无 commit 填 `-` |

## ⚠️ 列 5 漂移（实测，别盲信表头）
表头第 5 列写 `cost_usd`，但**近期行（2026-05 起）该列实际填的是产出角色**（`qa`/`builder-patrol`/`coordinator`），早期行才是金额。**追加时先 `tail` 看最近 3-5 行的实际写法，对齐它们**——当前约定填角色名。

## 追加方式
- 用 Write/`printf >>` 在文件**末尾**加一行（别动表头和已有行）。
- 列之间是**真实制表符**，不是空格。`printf` 写法：`printf 'col1\tcol2\t...\n' >> .harness/progress.tsv`。
- 追加后 `tail -1` 确认是真 Tab 分隔（不是空格）。

## 示例行（制表符在此用 `→` 标示，实际写真 Tab）

PASS（已 dogfood 验证的真实行，2026-05-25）：
```
2026-05-25T07:45:00Z→patrol-capability→r1→PASS→builder-patrol→巡检能力 dry-run 端到端真浏览器自验 PASS(staging #23,只读):teacher1 登录→/teacher/dashboard 重定向+三页200 console0err;跨角色硬重置后 student1→/dashboard 200;student1→/teacher/dashboard 渲染403;截图01-06;严格只读0数据0富课接触跑完登出→-
```

BLOCKED（staging 不可达）：
```
2026-05-25T07:30:00Z→patrol-capability→r1→BLOCKED→builder-patrol→staging 502不可达(Caddy活/上游app挂),3账号登不进;骨架已离线交付,真dogfood待staging恢复→-
```

FAIL（指明哪步+现象）：
```
2026-05-25T09:00:00Z→patrol-feedback→r1→FAIL→qa→反馈巡检第3步管理员收件箱500:console Prisma runtime undefined(疑schema改了dev server没重启);其余6点PASS;截图03→<PR短SHA>
```
