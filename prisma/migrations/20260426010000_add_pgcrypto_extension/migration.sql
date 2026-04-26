-- gen_random_uuid() requires pgcrypto. Some minimal Postgres provisions
-- (fresh container without contrib loaded) ship without it.
-- IF NOT EXISTS makes this idempotent on environments that already have it.
-- 替代 ef820b5（直接修改了已 applied 的 backfill migration，违反 Prisma "never edit migration files manually"）。
CREATE EXTENSION IF NOT EXISTS pgcrypto;
