import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260719120000_slice_d4_activity_model_telemetry.sql',
);

function readMigration(): string {
  expect(fs.existsSync(migrationPath)).toBe(true);
  return fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
}

function readCreateTable(sql: string, table: string): string {
  const pattern = new RegExp(
    `create\\s+table\\s+public\\.${table}\\s*\\([\\s\\S]*?\\n\\);`,
    'i',
  );
  return sql.match(pattern)?.[0] ?? '';
}

function readFunction(sql: string, name: string): string {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  );
  return sql.match(pattern)?.[0] ?? '';
}

describe('1.1.4.5 Slice D4 activity and model telemetry migration', () => {
  it('stores one activity row per user and Hong Kong day', () => {
    const sql = readMigration();
    const table = readCreateTable(sql, 'app_activity_daily');

    expect(table).not.toBe('');
    expect(table).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    expect(table).toMatch(/activity_date_hk date not null/i);
    expect(table).toMatch(/first_seen_at timestamptz not null default now\(\)/i);
    expect(table).toMatch(/last_seen_at timestamptz not null default now\(\)/i);
    expect(table).toMatch(/primary key \(user_id, activity_date_hk\)/i);
    expect(sql).toMatch(/create index app_activity_daily_date_user_idx[\s\S]*?\(activity_date_hk, user_id\)/i);
  });

  it('derives the activity date in the database and preserves first_seen_at', () => {
    const sql = readMigration();
    const fn = readFunction(sql, 'record_app_activity');

    expect(fn).not.toBe('');
    expect(fn).toMatch(/security invoker/i);
    expect(fn).toMatch(/set search_path = ''/i);
    expect(fn).toMatch(/at time zone 'Asia\/Hong_Kong'/i);
    expect(fn).toMatch(/on conflict \(user_id, activity_date_hk\)[\s\S]*?do update[\s\S]*?last_seen_at/i);
    expect(fn).not.toMatch(/do update[\s\S]*?first_seen_at\s*=/i);
    expect(sql).toMatch(/revoke all on function public\.record_app_activity\(uuid\)[\s\S]*?from public, anon, authenticated, service_role/i);
    expect(sql).toMatch(/grant execute on function public\.record_app_activity\(uuid\) to service_role/i);
    expect(sql).not.toMatch(/grant execute on function public\.record_app_activity\(uuid\) to (anon|authenticated)/i);
  });

  it('creates a constrained model-attempt log without sensitive content columns', () => {
    const sql = readMigration();
    const table = readCreateTable(sql, 'model_call_logs');

    expect(table).not.toBe('');
    expect(table).toMatch(/job_id uuid references public\.generation_jobs\(id\) on delete set null/i);
    expect(table).toMatch(/request_id uuid not null/i);
    expect(table).toMatch(/operation text not null[\s\S]*?check \(operation in \(/i);
    expect(table).toMatch(/provider text not null[\s\S]*?check \(provider in \(/i);
    expect(table).toMatch(/status text not null[\s\S]*?check \(status in \('success', 'error'\)\)/i);
    expect(table).toMatch(/error_class text[\s\S]*?check \(error_class is null or error_class in \(/i);
    expect(table).toMatch(/latency_ms integer not null[\s\S]*?check \(latency_ms >= 0\)/i);
    expect(table).toMatch(/attempt smallint not null[\s\S]*?check \(attempt >= 1\)/i);
    expect(table).toMatch(/prompt_tokens bigint[\s\S]*?completion_tokens bigint[\s\S]*?total_tokens bigint/i);
    expect(table).toMatch(/cache_hit_tokens bigint[\s\S]*?cache_miss_tokens bigint/i);
    expect(table).toMatch(/usage_source text not null[\s\S]*?check \(usage_source in \('provider', 'unavailable'\)\)/i);
    expect(table).toMatch(
      /usage_source = 'provider'[\s\S]*?prompt_tokens is not null[\s\S]*?completion_tokens is not null[\s\S]*?total_tokens is not null[\s\S]*?cache_hit_tokens is not null[\s\S]*?cache_miss_tokens is not null/i,
    );

    for (const forbidden of [
      'user_id', 'review_group', 'prompt', 'response', 'content', 'raw_error',
      'email', 'jwt', 'api_key', 'secret',
    ]) {
      expect(table).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'i'));
    }
  });

  it('keeps telemetry tables private and grants trusted writes only', () => {
    const sql = readMigration();

    for (const table of ['app_activity_daily', 'model_call_logs']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(
        new RegExp(`revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role`, 'i'),
      );
      expect(sql).not.toMatch(
        new RegExp(`grant [^;]* on table public\\.${table} to (anon|authenticated)`, 'i'),
      );
    }

    expect(sql).toMatch(/grant select, insert, update on table public\.app_activity_daily to service_role/i);
    expect(sql).toMatch(/grant select, insert on table public\.model_call_logs to service_role/i);
  });

  it('documents retention without scheduling destructive cleanup', () => {
    const sql = readMigration();

    expect(sql).toMatch(/app_activity_daily[\s\S]*?15 months/i);
    expect(sql).toMatch(/model_call_logs[\s\S]*?90 days/i);
    expect(sql).not.toMatch(/cron\.schedule|pg_cron|delete from public\.(app_activity_daily|model_call_logs)/i);
  });
});
