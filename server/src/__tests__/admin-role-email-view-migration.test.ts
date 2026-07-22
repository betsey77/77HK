import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  '../supabase/migrations/20260716150000_add_private_user_roles_email_view.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

describe('dashboard-only user role email lookup migration', () => {
  it('creates a security-invoker view in the private schema', () => {
    expect(sql).toMatch(
      /create\s+view\s+private\.user_roles_with_email\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)/i,
    );
  });

  it('joins live auth email to role assignments without copying auth data', () => {
    expect(sql).toMatch(/from\s+public\.user_roles\s+ur/i);
    expect(sql).toMatch(/join\s+auth\.users\s+u\s+on\s+u\.id\s*=\s*ur\.user_id/i);
    expect(sql).toMatch(/u\.email/i);
    expect(sql).not.toMatch(/encrypted_password|confirmation_token|recovery_token|refresh_token/i);
  });

  it('denies every Data API role', () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+table\s+private\.user_roles_with_email\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i,
    );
    expect(sql).not.toMatch(/grant\s+select/i);
  });
});
