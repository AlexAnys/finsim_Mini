#!/usr/bin/env node
/** Migrate only explicit MiMo text settings. Default is a read-only dry run.
 * Apply requires the fresh private successful probe emitted by probe-deepseek.py.
 * No API keys, user IDs or prompt text are written to stdout.
 */
import { readFile, mkdir, chmod, open } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const policy = JSON.parse(readFileSync(new URL('../../lib/ai/text-model-policy.json', import.meta.url), 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function migrationPlan(rows) {
  return rows.filter((row) => row.provider === 'mimo' && Object.hasOwn(policy.tools, row.toolKey))
    .map((row) => ({ row, provider: policy.provider, model: policy.tools[row.toolKey] }));
}

async function verifyProbe(path) {
  if (!path) throw new Error('A verified DeepSeek probe file is required for apply');
  const probe = JSON.parse(await readFile(path, 'utf8'));
  const age = Date.now() - Date.parse(probe.at);
  const url = new URL(probe.baseURL);
  const configured = new URL(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1');
  const normalizedBase = (base) => {
    const pathname = base.pathname.replace(/\/+$/, '');
    return base.origin + (pathname === '/v1' ? '' : pathname) + base.search;
  };
  if (probe.ok !== true || !Number.isFinite(age) || age < 0 || age > 10 * 60_000 ||
      url.protocol !== 'https:' || url.hostname !== 'api.deepseek.com' || normalizedBase(url) !== normalizedBase(configured) ||
      !['deepseek-v4-flash', 'deepseek-v4-pro'].every((model) => probe.models?.includes(model)) ||
      (process.env.APP_GIT_SHA && probe.gitSha !== process.env.APP_GIT_SHA) ||
      !process.env.DEEPSEEK_API_KEY || probe.keySha256 !== sha256(process.env.DEEPSEEK_API_KEY)) {
    throw new Error('DeepSeek probe is missing, expired or does not match the active key');
  }
}

async function privateJson(path, value) {
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

export async function restoreTextAiSettings(client, receiptPath) {
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  if (receipt.schema !== 1 || receipt.databaseSha256 !== sha256(process.env.DATABASE_URL || '') || !Array.isArray(receipt.changes)) {
    throw new Error('Migration receipt does not match this database');
  }
  return client.$transaction(async (tx) => {
    let restored = 0;
    for (const change of receipt.changes) {
      const result = await tx.aiToolSetting.updateMany({
        where: { id: change.id, provider: change.after.provider, model: change.after.model, updatedAt: new Date(change.after.updatedAt) },
        data: { provider: change.before.provider, model: change.before.model },
      });
      restored += result.count;
    }
    return { restored, skipped: receipt.changes.length - restored };
  });
}

/** Injectable client permits tests to verify backup/CAS behavior without a database. */
export async function migrateTextAiSettings(client, options = {}) {
  const rows = await client.aiToolSetting.findMany({
    where: { provider: 'mimo', toolKey: { in: Object.keys(policy.tools) } }, orderBy: { id: 'asc' },
  });
  const plan = migrationPlan(rows);
  if (plan.length === 0 || (!options.apply && !options.backupDir)) return { dryRun: !options.apply, planned: plan.length, changed: 0 };
  if (options.apply) await verifyProbe(options.probeResult);
  if (!options.backupDir || !isAbsolute(options.backupDir) || /(?:^|\/)public(?:\/|$)/.test(options.backupDir)) {
    throw new Error('An absolute private backup directory outside public is required');
  }
  await mkdir(options.backupDir, { recursive: true, mode: 0o700 });
  await chmod(options.backupDir, 0o700);
  const backupPath = join(options.backupDir, `text-ai-settings-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`);
  await privateJson(backupPath, { schema: 1, at: new Date().toISOString(), policySha256: sha256(JSON.stringify(policy)), rows: plan.map((item) => item.row) });
  if (!options.apply) return { dryRun: true, planned: plan.length, changed: 0, backupPath };
  const receiptPath = options.receiptPath || backupPath.replace(/\.json$/, ".receipt.json");
  if (!isAbsolute(receiptPath) || !resolve(receiptPath).startsWith(resolve(options.backupDir) + '/')) {
    throw new Error('Receipt must stay in the private backup directory');
  }
  const changed = await client.$transaction(async (tx) => {
    let count = 0;
    const changes = [];
    for (const item of plan) {
      // Abort the entire migration if a teacher changed a setting after the backup snapshot.
      const result = await tx.aiToolSetting.updateMany({
        where: { id: item.row.id, provider: 'mimo', model: item.row.model, updatedAt: item.row.updatedAt },
        data: { provider: item.provider, model: item.model },
      });
      if (result.count !== 1) throw new Error('AI setting changed after backup; transaction rolled back, retry with a fresh snapshot');
      count += result.count;
      const after = await tx.aiToolSetting.findUnique({ where: { id: item.row.id }, select: { provider: true, model: true, updatedAt: true } });
      changes.push({ id: item.row.id, before: { provider: item.row.provider, model: item.row.model }, after });
    }
    // Flush the receipt and its directory entry before asking the database to commit.
    await privateJson(receiptPath, { schema: 1, at: new Date().toISOString(), databaseSha256: sha256(process.env.DATABASE_URL || ''), changes });
    return count;
  }, { maxWait: 10_000, timeout: 60_000 });
  return { dryRun: false, planned: plan.length, changed, backupPath, receiptPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (key) => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1]; };
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ log: [] });
  try {
    const result = args.includes('--restore-receipt')
      ? await restoreTextAiSettings(client, value('--restore-receipt'))
      : await migrateTextAiSettings(client, { apply: args.includes('--apply'), backupDir: value('--backup-dir'), probeResult: value('--probe-result'), receiptPath: value('--receipt-path') });
    console.log(JSON.stringify(result));
  } catch {
    console.error('Text AI settings migration did not finish normally. Check the private receipt and database state before retrying or restoring.');
    process.exitCode = 1;
  } finally { await client.$disconnect(); }
}
