import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

// Aligned to remote migration version (was local 20260714000000; remote applied as 20260714052140)
const FILENAME = '20260714052140_w2_case_library.sql';

function loadMigration() {
  const candidates = [
    path.resolve(process.cwd(), `supabase/migrations/${FILENAME}`),
    path.resolve(process.cwd(), `../supabase/migrations/${FILENAME}`),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error(`W2 migration not found: ${FILENAME}`);
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('W2 case library migration static checks', () => {
  const sql = loadMigration();

  it('has valid timestamped filename', () => {
    expect(FILENAME).toMatch(/^20260714\d{6}_w2_case_library\.sql$/);
  });

  it('creates case_library_entries with required columns', () => {
    expect(sql).toContain('create table public.case_library_entries');
    expect(sql).toContain('owner_id uuid not null references auth.users(id)');
    expect(sql).toContain('case_type');
    expect(sql).toContain('title');
    expect(sql).toContain('body');
    expect(sql).toContain('reason');
    expect(sql).toContain('tags jsonb');
    expect(sql).toContain('created_at');
    expect(sql).toContain('updated_at');
    expect(sql).toContain('deleted_at');
  });

  it('enforces field length and case_type checks', () => {
    expect(sql).toContain("case_type in ('good', 'bad')");
    expect(sql).toContain('length(title) <= 120');
    expect(sql).toContain('length(body) >= 20 and length(body) <= 5000');
    expect(sql).toContain('length(reason) >= 1 and length(reason) <= 500');
    expect(sql).toContain('private.case_library_tags_valid');
  });

  it('has updated_at trigger and enables RLS', () => {
    expect(sql).toContain('trg_case_library_entries_updated');
    expect(sql).toContain('public.set_updated_at()');
    expect(sql).toContain('alter table public.case_library_entries enable row level security');
  });

  it('owner RLS only for select/insert/update; soft-delete via update', () => {
    expect(sql).toContain('case_library owner select');
    expect(sql).toContain('case_library owner insert');
    expect(sql).toContain('case_library owner update');
    expect(sql).toContain('auth.uid()) = owner_id');
    expect(sql).toContain('deleted_at is null');
    // No physical delete policy for authenticated
    expect(sql).not.toContain('case_library owner delete');
    expect(sql).not.toMatch(/for delete to authenticated/);
  });

  it('grants authenticated select/insert/update but not delete', () => {
    expect(sql).toContain(
      'grant select, insert, update on table public.case_library_entries to authenticated',
    );
    const authGrants = sql.match(/grant [^;]* to authenticated/g) ?? [];
    const tableGrant = authGrants.find((g) => g.includes('case_library_entries')) ?? '';
    expect(tableGrant).not.toContain('delete');
  });

  it('does not add public or anon select policies', () => {
    expect(sql).not.toContain('to public');
    expect(sql).not.toMatch(/for select to anon/);
    expect(sql).not.toMatch(/for select to public/);
    expect(sql).toContain('revoke all on table public.case_library_entries from public, anon');
  });

  it('does not add admin case body access policies (W4 deferred)', () => {
    expect(sql).not.toContain('admin_view_case_library');
    expect(sql).not.toContain('has_any_role');
    // No role-based SELECT policies beyond owner
    expect(sql).not.toMatch(/create policy[^;]*admin/i);
  });
});
