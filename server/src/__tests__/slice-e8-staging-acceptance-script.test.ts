import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../scripts/staging-slice-e8-acceptance.mjs',
);

describe('Slice E8 staging acceptance harness safety contract', () => {
  it('is staging-only and proves the public API, hook, audit, and cleanup boundaries', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("const expectedRef = 'wzpaghnxlpfjojvuxplx'");
    expect(source).toContain("const testPrefix = 'codex-staging-e8-'");
    expect(source).toContain('afterGenerationPersistReviewPack');

    for (const route of [
      '/admin/bad-case-review-packs',
      '/admin/bad-case-review-packs/diagnostics',
      '/assign',
      '/status',
      '/analyze',
      '/review',
      '/proposal',
    ]) {
      expect(source).toContain(route);
    }

    expect(source).toContain('CLEANUP_ZERO_RESIDUE');
    expect(source).toContain('service.auth.admin.deleteUser');
    expect(source).not.toMatch(/supabase\s+db\s+push|migration\s+up|vercel\s+(?:deploy|promote)/i);
  });
});
