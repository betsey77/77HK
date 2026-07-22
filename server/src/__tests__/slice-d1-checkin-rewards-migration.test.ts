import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260719090000_slice_d1_checkin_rewards.sql',
);

function readMigration(): string {
  expect(fs.existsSync(migrationPath)).toBe(true);
  return fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
}

function readFunction(sql: string, name: string): string {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  );
  return sql.match(pattern)?.[0] ?? '';
}

describe('1.1.4.5 Slice D1 check-in and reward migration', () => {
  it('creates only the minimum check-in and lifetime reward records', () => {
    const sql = readMigration();

    expect(sql).toMatch(/create table public\.daily_checkins/i);
    expect(sql).toMatch(/checkin_date_hk date not null/i);
    expect(sql).toMatch(/streak_count integer not null[\s\S]*?check \(streak_count >= 1\)/i);
    expect(sql).toMatch(/streak_started_on date not null/i);
    expect(sql).toMatch(/unique \(user_id, checkin_date_hk\)/i);

    expect(sql).toMatch(/create table public\.membership_grants/i);
    expect(sql).toMatch(/source text not null[\s\S]*?check \(source = 'checkin_7day'\)/i);
    expect(sql).toMatch(/duration_days integer not null default 30[\s\S]*?check \(duration_days = 30\)/i);
    expect(sql).toMatch(/status text not null default 'pending'[\s\S]*?status in \('pending', 'applied'\)/i);
    expect(sql).toMatch(/unique \(user_id, source\)/i);
  });

  it('allows browser owners to read only their own rows while service_role owns writes', () => {
    const sql = readMigration();

    for (const table of ['daily_checkins', 'membership_grants']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(
        new RegExp(`create policy "${table} owner select"[\\s\\S]*?on public\\.${table}[\\s\\S]*?for select to authenticated[\\s\\S]*?auth\\.uid\\(\\)\\) = user_id`, 'i'),
      );
      expect(sql).toMatch(
        new RegExp(`revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role`, 'i'),
      );
      expect(sql).toMatch(new RegExp(`grant select on table public\\.${table} to authenticated`, 'i'));
      expect(sql).not.toMatch(
        new RegExp(`grant (insert|update|delete)[^;]*on table public\\.${table} to authenticated`, 'i'),
      );
    }

    expect(sql).toMatch(/grant select, insert on table public\.daily_checkins to service_role/i);
    expect(sql).toMatch(/grant select, insert, update on table public\.membership_grants to service_role/i);
  });

  it('exposes only service-role invoker RPCs with an empty search path', () => {
    const sql = readMigration();
    const applySql = readFunction(sql, 'apply_daily_checkin');
    const claimSql = readFunction(sql, 'claim_checkin_membership_grant');

    expect(applySql).not.toBe('');
    expect(claimSql).not.toBe('');

    for (const body of [applySql, claimSql]) {
      expect(body).toMatch(/security invoker/i);
      expect(body).toMatch(/set search_path = ''/i);
      expect(body).not.toMatch(/security definer/i);
      expect(body).not.toMatch(/auth\.uid\(\)/i);
    }

    expect(sql).toMatch(
      /revoke all on function public\.apply_daily_checkin\(uuid\)\s+from public, anon, authenticated, service_role/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.apply_daily_checkin\(uuid\) to service_role/i,
    );
    expect(sql).toMatch(
      /revoke all on function public\.claim_checkin_membership_grant\(uuid, uuid\)\s+from public, anon, authenticated, service_role/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.claim_checkin_membership_grant\(uuid, uuid\) to service_role/i,
    );
    expect(sql).not.toMatch(/grant execute on function public\.(apply_daily_checkin|claim_checkin_membership_grant)[^;]*to (anon|authenticated)/i);
  });

  it('uses the Hong Kong server day, fixed lock order, and database idempotency', () => {
    const sql = readMigration();
    const applySql = readFunction(sql, 'apply_daily_checkin');
    const claimSql = readFunction(sql, 'claim_checkin_membership_grant');

    expect(applySql).toMatch(/timezone\('Asia\/Hong_Kong', _now\)/i);
    expect(applySql).toMatch(/pg_advisory_xact_lock[\s\S]*?hashtextextended/i);
    expect(claimSql).toMatch(/pg_advisory_xact_lock[\s\S]*?hashtextextended/i);

    for (const body of [applySql, claimSql]) {
      const subscriptionLock = body.search(/from public\.subscriptions[\s\S]*?for update of s/i);
      const grantWrite = body.search(/(insert into|update) public\.membership_grants/i);
      expect(subscriptionLock).toBeGreaterThanOrEqual(0);
      expect(grantWrite).toBeGreaterThan(subscriptionLock);
    }

    expect(applySql).toMatch(/where user_id = _user_id[\s\S]*?and checkin_date_hk = _today_hk/i);
    expect(applySql).toMatch(/on conflict \(user_id, checkin_date_hk\) do nothing/i);
  });

  it('distinguishes valid Pro from expired Pro and uses a fixed 30-day reward period', () => {
    const sql = readMigration();
    const applySql = readFunction(sql, 'apply_daily_checkin');
    const claimSql = readFunction(sql, 'claim_checkin_membership_grant');

    for (const body of [applySql, claimSql]) {
      expect(body).toMatch(/_plan_name = 'Pro'/i);
      expect(body).toMatch(/_subscription_status = 'active'/i);
      expect(body).toMatch(/_period_start <= _now/i);
      expect(body).toMatch(/_period_end > _now/i);
      expect(body).toMatch(/interval '30 days'/i);
      expect(body).toMatch(/quota_used = 0/i);
    }

    expect(applySql).toMatch(/'pending'/i);
    expect(applySql).toMatch(/'applied'/i);
    expect(claimSql).toMatch(/'active_pro'/i);
    expect(sql).not.toMatch(/interval '1 month'/i);
  });

  it('does not mutate the existing usage ledger or replace payment/quota functions', () => {
    const sql = readMigration();

    expect(sql).not.toMatch(/(insert into|update|delete from) public\.usage_ledger/i);
    expect(sql).not.toMatch(/create or replace function public\.(reserve_quota|consume_quota|release_quota|apply_alipay_payment)/i);
    expect(sql).not.toMatch(/drop (table|function|type)/i);
  });
});
