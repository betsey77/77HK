import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260716142256_harden_platform_rls_auto_enable_acl.sql',
);

describe('platform RLS auto-enable ACL migration', () => {
  it('conditionally removes direct execution from API roles', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/to_regprocedure\('public\.rls_auto_enable\(\)'\)/i);
    expect(sql).toMatch(
      /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated, service_role/i,
    );
    expect(sql).not.toMatch(/drop\s+(event\s+trigger|function)/i);
  });
});
