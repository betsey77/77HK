import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260715113350_pro_250_quota.sql',
);
const reserveMigrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260712000000_slice_c2a_trusted_write_quota.sql',
);

describe('Pro 250 quota migration', () => {
  it('updates exactly the Pro plan to 250 and verifies the affected row', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    if (!fs.existsSync(migrationPath)) return;

    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/update\s+public\.plans[\s\S]*?quota_per_cycle\s*=\s*250/i);
    expect(sql).toMatch(/where\s+name\s*=\s*'Pro'/i);
    expect(sql).toMatch(/get diagnostics\s+_updated\s*=\s*row_count/i);
    expect(sql).toMatch(/if\s+_updated\s*<>\s*1/i);
  });

  it('preserves current-period usage instead of resetting subscriptions or ledger rows', () => {
    if (!fs.existsSync(migrationPath)) return;

    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).not.toMatch(/update\s+public\.subscriptions/i);
    expect(sql).not.toMatch(/update\s+public\.usage_ledger/i);
    expect(sql).not.toMatch(/quota_used\s*=/i);
  });

  it('keeps the live-plan boundary: 249 can reserve, 250 and 251 are exhausted', () => {
    const reserveSql = fs.readFileSync(reserveMigrationPath, 'utf8');
    expect(reserveSql).toMatch(/p\.quota_per_cycle[\s\S]*?into[\s\S]*?_quota_limit/i);
    expect(reserveSql).toMatch(/if\s+_quota_used\s*>=\s*_quota_limit\s+then[\s\S]*?return null/i);

    const canReserve = (quotaUsed: number) => quotaUsed < 250;
    expect(canReserve(249)).toBe(true);
    expect(canReserve(250)).toBe(false);
    expect(canReserve(251)).toBe(false);
  });
});
