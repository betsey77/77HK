/**
 * R1 — Migration static contracts for review_group + favorite_admin_reviews.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260714190000_review_groups_admin_notes.sql',
);
const HOTFIX_MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260714190100_fix_review_actor_role_type.sql',
);

let sql = '';

beforeAll(() => {
  sql = fs.readFileSync(MIGRATION, 'utf-8');
});

describe('R1 migration — profiles.review_group', () => {
  it('adds review_group column with format CHECK and index', () => {
    expect(sql).toMatch(/add column if not exists review_group text null/i);
    expect(sql).toContain('profiles_review_group_format');
    expect(sql).toMatch(/\^\[a-z0-9\]\[a-z0-9_-\]\{0,31\}\$/);
    expect(sql).toMatch(/idx_profiles_review_group/);
  });
});

describe('R1 migration — favorite_admin_reviews', () => {
  it('creates table with status/note constraints and updated_at trigger', () => {
    expect(sql).toMatch(/create table if not exists public\.favorite_admin_reviews/i);
    expect(sql).toMatch(/review_status text not null/i);
    expect(sql).toMatch(/'adopted',\s*'changes_requested'/);
    expect(sql).toMatch(/char_length\(note\) <= 2000/);
    expect(sql).toMatch(/favorite_admin_reviews_changes_note_required/);
    expect(sql).toMatch(/trg_favorite_admin_reviews_updated/);
    expect(sql).toMatch(/enable row level security/i);
  });

  it('reviewer_id is nullable with on delete set null (account purge must not block)', () => {
    expect(sql).toMatch(
      /reviewer_id\s+uuid\s+null\s+references\s+auth\.users\(id\)\s+on\s+delete\s+set\s+null/i,
    );
    expect(sql).not.toMatch(/reviewer_id\s+uuid\s+not\s+null/i);
  });

  it('indexes reviewer/status/updated_at without duplicating PK on favorite_id alone as only index', () => {
    expect(sql).toMatch(/idx_favorite_admin_reviews_status/);
    expect(sql).toMatch(/idx_favorite_admin_reviews_updated/);
    expect(sql).toMatch(/idx_favorite_admin_reviews_reviewer/);
  });

  it('owner SELECT policy exists; no authenticated write policies', () => {
    expect(sql).toMatch(/favorite_admin_reviews owner select/);
    expect(sql).toMatch(/favorite_admin_reviews admin select/);
    // No INSERT/UPDATE/DELETE policies for authenticated
    expect(sql).not.toMatch(/for insert\s+to authenticated/i);
    expect(sql).not.toMatch(/for update\s+to authenticated/i);
    expect(sql).not.toMatch(/for delete\s+to authenticated/i);
    expect(sql).toMatch(/grant select on table public\.favorite_admin_reviews to authenticated/i);
  });

  it('RLS scopes via role checks + same_nonnull_review_group only (no profile_review_group)', () => {
    expect(sql).not.toMatch(/profile_review_group/i);
    expect(sql).toMatch(/private\.same_nonnull_review_group/);
    expect(sql).toMatch(/private\.has_any_role/);
    const adminPolicy = sql.slice(
      sql.indexOf('favorite_admin_reviews admin select'),
      sql.indexOf('No INSERT/UPDATE/DELETE'),
    );
    expect(adminPolicy).toMatch(/same_nonnull_review_group/);
    expect(adminPolicy).toMatch(/has_any_role/);
  });
});

describe('R1 migration — admin_update_favorite_review RPC', () => {
  it('is SECURITY DEFINER with empty search_path and service_role only', () => {
    expect(sql).toMatch(/create or replace function public\.admin_update_favorite_review/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).toMatch(
      /revoke all on function public\.admin_update_favorite_review[\s\S]*from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.admin_update_favorite_review[\s\S]*to service_role/i,
    );
  });

  it('validates admin role, same-group for ordinary admin, and writes review + audit atomically', () => {
    expect(sql).toMatch(/from public\.user_roles/);
    expect(sql).toMatch(/super_admin/);
    expect(sql).toMatch(/actor\.review_group|actor_group/);
    expect(sql).toMatch(/owner_group/);
    expect(sql).toMatch(/insert into public\.favorite_admin_reviews|delete from public\.favorite_admin_reviews/i);
    expect(sql).toMatch(/insert into public\.audit_log/);
    expect(sql).toMatch(/admin_update_favorite_review/);
    expect(sql).toMatch(/old_note_length/);
    expect(sql).toMatch(/new_note_length/);
    // Must not dump full note/content into audit
    expect(sql).not.toMatch(/diff.*note\s*,/i);
  });

  it('audit_log.entity_id uses uuid favorite id, never _favorite_id::text', () => {
    // audit_log.entity_id is uuid; casting to text would fail at runtime
    expect(sql).not.toMatch(/entity_id[^\n]*_favorite_id::text|_favorite_id::text/i);
    // Both audit inserts should pass uuid expression directly
    const auditBlocks = sql.match(
      /insert into public\.audit_log\s*\([\s\S]*?\)\s*values\s*\([\s\S]*?\)/gi,
    );
    expect(auditBlocks).not.toBeNull();
    expect(auditBlocks!.length).toBeGreaterThanOrEqual(2);
    for (const block of auditBlocks!) {
      expect(block).not.toMatch(/_favorite_id::text/);
      expect(block).toMatch(/_favorite_id/);
    }
  });

  it('RPC insert/upsert always writes reviewer_id from current actor', () => {
    expect(sql).toMatch(
      /insert into public\.favorite_admin_reviews\s*\(\s*favorite_id,\s*reviewer_id,/i,
    );
    expect(sql).toMatch(/_favorite_id,\s*_actor_id,\s*_status/);
    expect(sql).toMatch(/reviewer_id\s*=\s*excluded\.reviewer_id/);
  });

  it('private helpers: only same_nonnull_review_group; no profile_review_group leak', () => {
    expect(sql).not.toMatch(/profile_review_group/i);
    expect(sql).toMatch(/private\.same_nonnull_review_group/);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).toMatch(/revoke all on function private\.same_nonnull_review_group/i);
    expect(sql).toMatch(
      /grant execute on function private\.same_nonnull_review_group\(uuid\) to authenticated, service_role/i,
    );
  });
});

describe('R1.1 migration — audit actor role type hotfix', () => {
  it('replaces the RPC after R1 and casts both audit actor roles to app_role', () => {
    const hotfixSql = fs.readFileSync(HOTFIX_MIGRATION, 'utf-8');
    expect(HOTFIX_MIGRATION).toContain('20260714190100');
    expect(hotfixSql).toMatch(/create or replace function public\.admin_update_favorite_review/i);
    expect(hotfixSql.match(/_actor_role::public\.app_role/g)).toHaveLength(2);
  });

  it('preserves the service-role-only security boundary', () => {
    const hotfixSql = fs.readFileSync(HOTFIX_MIGRATION, 'utf-8');
    expect(hotfixSql).toMatch(/security definer/i);
    expect(hotfixSql).toMatch(/set search_path = ''/);
    expect(hotfixSql).toMatch(
      /revoke all on function public\.admin_update_favorite_review[\s\S]*from public, anon, authenticated/i,
    );
    expect(hotfixSql).toMatch(
      /grant execute on function public\.admin_update_favorite_review[\s\S]*to service_role/i,
    );
  });
});
