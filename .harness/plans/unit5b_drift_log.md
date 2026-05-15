# Unit 5b — Prisma migrate dev drift log

> 2026-05-14 · Builder 调研

## 当前状态

### `prisma migrate status` 输出
```
18 migrations found in prisma/migrations
Database schema is up to date!
```
✓ 说明 18 个 migration 都已应用到 DB。

### 但 `prisma migrate dev --name add_study_buddy_post_hidden_at` 报错
```
The migration `20260503011246_phase4_scope_analysis_report` was modified after it was applied.
We need to reset the "public" schema at "localhost:5432"
You may use prisma migrate reset to drop the development database.
All data will be lost.
```

### 根因（已验证）

DB 中 `_prisma_migrations` 表的全部 18 条 checksum 值：

```
20260221084930_init                                      692d6a8b...（正常 SHA-256）
20260221145732_add_semester_and_weektype                 ac7ef5ce...
20260224151747_add_simulation_system_prompt              d298f546...
20260225030039_add_course_teacher                        018f9e9a...
20260225034532_add_course_class                          480f82ac...
20260422041600_backfill_course_class                     ed809336...
20260425011913_add_analysis_aggregate_fields             586305d7...
20260425160756_add_mood_timeline                         87dfafdd...
20260426112144_add_analysis_report_unique_instance       1af3e8e5...
20260426010000_add_pgcrypto_extension                    e905aaea...
20260426162854_add_release_mode                          caec887a...
20260430090000_add_course_knowledge_sources              c83d5d75...
20260430170000_add_ai_tool_settings_and_ingestion_states e6aae4fc...
20260501031814_add_async_jobs_task_drafts_ai_runs        bd88ed26...
20260503090000_add_data_insight_advice_job_type          528ac88b...
20260503011246_phase4_scope_analysis_report              ★ phase4_scope_analysis_report_manual ★  ← 非 hash 字符串！
20260504150000_add_study_buddy_preview_flag              02db3c2c...（已由我刚才 resolve）
20260504152000_align_ai_material_schema                  8aea60fe...（已由我刚才 resolve）
```

**仅 `20260503011246_phase4_scope_analysis_report` 一条 checksum = `"phase4_scope_analysis_report_manual"`**，是一个字面字符串而非 SHA hash。说明这条 migration 曾被 **手动 INSERT** 到 `_prisma_migrations` 表（绕过 Prisma 命令），没有真实计算 .sql 文件的 hash。

`prisma migrate status` 不会校验 checksum 是否匹配，因此显示 "up to date"。但 `prisma migrate dev` 会校验，发现 manual checksum ≠ .sql 文件实际 hash，认定为"migration 已应用后被修改"。

## 不能继续按 plan 走

按 coordinator 指示 "resolve 后失败立刻停下来"，已停下。3 个可能动作（重发，请定）：

### 方案 1（推荐）：rolled-back → applied 二重 resolve
```bash
npx prisma migrate resolve --rolled-back 20260503011246_phase4_scope_analysis_report
npx prisma migrate resolve --applied 20260503011246_phase4_scope_analysis_report
```
- 第一步：把 _prisma_migrations 表对应行的 finished_at/rolled_back_at 置位，表示"未应用"
- 第二步：作为新应用重新登记，这时 Prisma 会计算 .sql 文件真实 hash 写入 checksum
- DB schema 不动；只动 `_prisma_migrations` 表
- 风险：低，纯元数据修复

### 方案 2：直接 SQL UPDATE _prisma_migrations
```sql
UPDATE "_prisma_migrations"
  SET checksum = '<sha-256 of 20260503011246_phase4_scope_analysis_report/migration.sql>'
  WHERE migration_name = '20260503011246_phase4_scope_analysis_report';
```
需要先算 .sql 文件的真实 SHA-256。侵入式，但单点精确。

### 方案 3：手动 reset _prisma_migrations 整表，按 .sql 文件重算所有 checksum
重 — 不推荐，但最干净。

请定，再发我确认。
