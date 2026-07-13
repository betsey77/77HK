import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadMigration() {
  const candidates = [
    path.resolve(process.cwd(), 'supabase/migrations/20260712072936_slice_h1_user_feedback.sql'),
    path.resolve(process.cwd(), '../supabase/migrations/20260712072936_slice_h1_user_feedback.sql'),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error('Slice H1 migration not found at expected path');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('Slice H1 migration static checks', () => {
  const sql = loadMigration();

  it('has valid 14-digit version filename (no XXXXXX placeholder)', () => {
    const filename = '20260712072936_slice_h1_user_feedback.sql';
    expect(filename).not.toContain('XXXXXX');
    expect(filename).toMatch(/^20260712\d{6}_slice_h1_user_feedback\.sql$/);
  });

  it('creates user_feedback table with RLS enabled', () => {
    expect(sql).toContain('create table if not exists public.user_feedback');
    expect(sql).toContain('alter table public.user_feedback enable row level security');
  });

  it('owner RLS: authenticated can only select own rows', () => {
    expect(sql).toContain('auth.uid()) = owner_id');
  });

  it('owner insert CHECK guards notify_* fields as defaults', () => {
    expect(sql).toContain("notify_status = 'pending'");
    expect(sql).toContain('notify_attempts = 0');
    expect(sql).toContain('notify_last_error is null');
    expect(sql).toContain('notified_at is null');
  });

  it('admin select uses the hardened private.has_any_role helper', () => {
    expect(sql).toContain('private.has_any_role');
    expect(sql).not.toContain('public.has_any_role');
    expect(sql).toContain("array['admin', 'super_admin']::public.app_role[]");
  });

  it('grants: authenticated insert+select only (no update/delete)', () => {
    expect(sql).toContain('grant select, insert on table public.user_feedback to authenticated');
    // Should NOT grant update/delete to authenticated
    const authGrantLine = sql.match(/grant [^;]* to authenticated/g)?.[0] ?? '';
    expect(authGrantLine).not.toContain('update');
    expect(authGrantLine).not.toContain('delete');
  });

  it('grants: service_role has full CRUD', () => {
    expect(sql).toContain('grant select, insert, update, delete on table public.user_feedback to service_role');
  });

  it('has rate-limit trigger function with advisory lock', () => {
    expect(sql).toContain('private.check_feedback_rate_limit');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('raise exception');
    expect(sql).toContain('rate_limit');
    expect(sql).toContain('max 20 feedback per hour');
  });

  it('rate-limit trigger fires before insert', () => {
    expect(sql).toContain('trg_user_feedback_rate_limit');
    expect(sql).toContain('before insert on public.user_feedback');
  });

  it('content length checks on title and content columns', () => {
    expect(sql).toContain('length(title) > 0 and length(title) <= 200');
    expect(sql).toContain('length(content) > 0 and length(content) <= 5000');
  });

  it('notify_status check constraint covers pending/sent/failed', () => {
    expect(sql).toContain("notify_status in ('pending', 'sent', 'failed')");
  });

  it('metadata JSON length check via octet_length', () => {
    expect(sql).toContain('octet_length(metadata::text) <= 8192');
  });

  it('has single composite index on owner_id + created_at desc', () => {
    expect(sql).toContain('idx_user_feedback_owner_created');
    expect(sql).toContain('owner_id, created_at desc');
  });
});
