import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

describe('R2/R2.1 database and BFF contracts', () => {
  it('adds revision metadata, constrained annotations and review invalidation', () => {
    const sql = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260714190200_r2_inline_review_favorite_edit.sql'),
      'utf8',
    );

    expect(sql).toMatch(/add column if not exists content_revision integer/i);
    expect(sql).toMatch(/add column if not exists content_edited_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists annotations jsonb/i);
    expect(sql).toMatch(/jsonb_typeof\(annotations\)\s*=\s*'array'/i);
    expect(sql).toMatch(/old\.content is distinct from new\.content/i);
    expect(sql).toMatch(/delete from public\.favorite_admin_reviews/i);
    expect(sql).toMatch(/create or replace function public\.admin_save_favorite_review/i);
    expect(sql).toMatch(/security definer[\s\S]*set search_path\s*=\s*''/i);
    expect(sql).toMatch(/revoke all on function public\.admin_save_favorite_review[\s\S]*public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.admin_save_favorite_review[\s\S]*service_role/i);
  });

  it('exposes an owner-only content endpoint and keeps admin fields out of the owner body', () => {
    const route = fs.readFileSync(path.resolve(__dirname, '../routes/sync.ts'), 'utf8');
    const service = fs.readFileSync(path.resolve(__dirname, '../services/cloudSyncService.ts'), 'utf8');

    expect(route).toMatch(/router\.put\('\/sync\/favorites\/:clientId\/content'/);
    expect(route).toContain('updateFavoriteContent');
    expect(service).toContain(".eq('owner_id', ownerId)");
    expect(service).toContain(".eq('client_id', clientId)");
    expect(service).toContain(".update({ content, review_requested: true })");
  });

  it('saves inline annotations through one service-role RPC, not route-level table writes', () => {
    const route = fs.readFileSync(path.resolve(__dirname, '../routes/admin.ts'), 'utf8');
    const service = fs.readFileSync(path.resolve(__dirname, '../services/adminService.ts'), 'utf8');

    expect(route).toContain('annotations');
    expect(service).toContain("rpc('admin_save_favorite_review'");
    const start = route.indexOf("router.put('/favorites/:id/review'");
    const end = route.indexOf("router.get('/case-library/:id'", start);
    const block = route.slice(start, end);
    expect(block).not.toMatch(/from\(['\"]favorite_admin_reviews['\"]\)/);
    expect(block).not.toContain('writeAdminAuditLog');
  });
});
