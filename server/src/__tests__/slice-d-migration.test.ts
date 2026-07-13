import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadMigration() {
  const candidates = [
    path.resolve(process.cwd(), 'supabase/migrations/20260712070000_slice_d_cloud_sync.sql'),
    path.resolve(process.cwd(), '../supabase/migrations/20260712070000_slice_d_cloud_sync.sql'),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error('Slice D migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('Slice D migration safety', () => {
  const sql = loadMigration();

  it('enforces owner RLS on all three cloud-sync tables', () => {
    for (const table of ['favorites', 'saved_configs', 'brand_profiles']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql.match(/auth\.uid\(\)\) = owner_id/g)?.length).toBeGreaterThanOrEqual(12);
  });

  it('limits direct Data API JSON and reason tag payloads', () => {
    for (const column of ['settings', 'variant_meta', 'scores', 'consumer_feedback', 'config']) {
      expect(sql).toContain(`octet_length(${column}::text)`);
    }
    expect(sql).toContain('reason_tags varchar(100)[]');
    expect(sql).toContain('cardinality(reason_tags) <= 20');
    expect(sql).toContain("array_position(reason_tags, ''::varchar) is null");
  });

  it('serializes the 20-config limit per owner and permits existing upserts', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toMatch(/where owner_id = new\.owner_id and client_id = new\.client_id[\s\S]*?if found then[\s\S]*?return new/);
    expect(sql).toMatch(/select count\(\*\)[\s\S]*?where owner_id = new\.owner_id[\s\S]*?_current_count >= 20/);
    expect(sql).toContain("raise exception 'config_limit_exceeded'");
  });

  it('does not expose the trigger function for direct API execution', () => {
    expect(sql).toContain('revoke all on function public.check_config_limit()');
    expect(sql).not.toMatch(/grant execute on function public\.check_config_limit/);
  });
});
