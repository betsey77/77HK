import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const migration = path.join(
  root,
  'supabase/migrations/20260723120000_favorite_admin_review_events.sql',
);

describe('favorite_admin_review_events migration (static contract)', () => {
  const sql = fs.readFileSync(migration, 'utf8');

  it('creates append-only events table with constrained event types', () => {
    expect(sql).toMatch(/create table if not exists public\.favorite_admin_review_events/i);
    expect(sql).toMatch(/event_type text not null/i);
    expect(sql).toMatch(/'save',\s*'clear',\s*'invalidated_by_edit'/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.favorite_admin_review_events[\s\S]*anon, authenticated/i);
    expect(sql).toMatch(/grant select on table public\.favorite_admin_review_events to service_role/i);
  });

  it('archives before wipe on content invalidation and on clear', () => {
    expect(sql).toMatch(/private\.archive_favorite_admin_review/i);
    expect(sql).toMatch(/invalidated_by_edit/i);
    expect(sql).toMatch(
      /perform private\.archive_favorite_admin_review\(old\.id,\s*'invalidated_by_edit'/i,
    );
    expect(sql).toMatch(
      /perform private\.archive_favorite_admin_review\(_favorite_id,\s*'clear'/i,
    );
  });

  it('appends a save event after upserting current review state', () => {
    expect(sql).toMatch(/event_type,\s*[\s\S]*'save'/i);
    expect(sql).toMatch(/insert into public\.favorite_admin_review_events/i);
    expect(sql).toMatch(/on conflict \(favorite_id\) do update set/i);
  });

  it('allows empty note for changes_requested (drops current-table note constraint)', () => {
    expect(sql).toMatch(
      /drop constraint if exists favorite_admin_reviews_changes_note_required/i,
    );
    expect(sql).not.toMatch(
      /if _status = 'changes_requested' and _new_note is null then\s*raise exception 'note_required'/i,
    );
  });

  it('keeps admin_save_favorite_review service_role-only', () => {
    expect(sql).toMatch(
      /revoke all on function public\.admin_save_favorite_review[\s\S]*public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.admin_save_favorite_review[\s\S]*service_role/i,
    );
  });
});
