import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  '../supabase/migrations/20260715121000_user_authored_review_queue.sql',
);

function readMigration(): string {
  expect(fs.existsSync(migrationPath)).toBe(true);
  return fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
}

describe('user-authored review queue migration', () => {
  it('adds only the minimum authored/review request fields with safe defaults', () => {
    const sql = readMigration();

    expect(sql).toMatch(/add column if not exists is_user_authored boolean not null default false/i);
    expect(sql).toMatch(/add column if not exists review_requested boolean not null default false/i);
    expect(sql).toMatch(/add column if not exists review_requested_at timestamptz null/i);
    expect(sql).toContain('favorites_review_request_timestamp_consistent');
    expect(sql).toMatch(/review_requested\s+and\s+review_requested_at is not null/i);
    expect(sql).toMatch(/not review_requested\s+and\s+review_requested_at is null/i);
  });

  it('adds a scoped partial index for pending queue ordering', () => {
    const sql = readMigration();

    expect(sql).toMatch(/create index if not exists idx_favorites_pending_review/i);
    expect(sql).toMatch(/on public\.favorites\s*\(owner_id, review_requested_at desc\)/i);
    expect(sql).toMatch(/where review_requested = true/i);
  });

  it('extends the R2 trigger without weakening content revision or review invalidation', () => {
    const sql = readMigration();

    expect(sql).toMatch(/create or replace function public\.reset_favorite_review_on_content_change\(\)/i);
    expect(sql).toMatch(/old\.content is distinct from new\.content/i);
    expect(sql).toMatch(/new\.content_revision := old\.content_revision \+ 1/i);
    expect(sql).toMatch(/delete from public\.favorite_admin_reviews[\s\S]*where favorite_id = old\.id/i);
    expect(sql).toMatch(/old\.review_requested is distinct from new\.review_requested/i);
    expect(sql).toMatch(/new\.settings->>'copyType'/i);
    expect(sql).toMatch(/new\.settings->>'publishPlatform'/i);
    expect(sql).toMatch(/new\.review_requested_at := now\(\)/i);
    expect(sql).toMatch(/new\.review_requested_at := null/i);
  });

  it('preserves existing R2 review intent without turning every legacy favorite into pending', () => {
    const sql = readMigration();

    expect(sql).toMatch(/update public\.favorites f[\s\S]*content_edited_at is not null[\s\S]*favorite_admin_reviews/i);
    expect(sql).toMatch(/review_requested = true/i);
    expect(sql).not.toMatch(/update public\.favorites\s+set\s+review_requested\s*=\s*true\s*;/i);
  });

  it('does not delete favorites, rewrite copy bodies, or change RLS policies/grants', () => {
    const sql = readMigration();

    expect(sql).not.toMatch(/delete from public\.favorites/i);
    expect(sql).not.toMatch(/\bcontent\s*=/i);
    expect(sql).not.toMatch(/create policy|drop policy|grant\s+(select|insert|update|delete)\s+on\s+table/i);
  });

});
