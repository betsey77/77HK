import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function projectFile(relativePath: string) {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '..', relativePath),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error(`Project file not found: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

describe('Phase 0 release baseline configuration', () => {
  it('defines a local Supabase project without production identifiers', () => {
    const config = projectFile('supabase/config.toml');

    expect(config).toContain('project_id = "77hk-local"');
    expect(config).toContain('[db.migrations]');
    expect(config).toContain('enabled = true');
    expect(config).toContain('site_url = "http://127.0.0.1:5173"');
    expect(config).toContain('http://localhost:5173/auth/callback');
    expect(config).toContain('http://localhost:5173/reset-password');
    expect(config).not.toContain('/**');
    expect(config).not.toMatch(/project_id\s*=\s*"[a-z0-9]{20}"/);
  });

  it('keeps CI read-only, reproducible, and free of deployment secrets', () => {
    const workflow = projectFile('.github/workflows/ci.yml');

    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toMatch(/actions\/checkout@[a-f0-9]{40}/);
    expect(workflow).toMatch(/actions\/setup-node@[a-f0-9]{40}/);
    expect(workflow).toContain('node-version: 22');

    const commands = [
      'npm ci',
      'npm run test',
      'npm run typecheck',
      'npm run build',
      'npm run audit:prod',
      'npm run audit:all',
    ];
    for (const command of commands) expect(workflow).toContain(`run: ${command}`);

    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).not.toContain('${{ secrets.');
    expect(workflow).not.toMatch(/supabase\s+(db push|migration repair)/i);
    expect(workflow).not.toMatch(/\bdeploy\b/i);
  });
});
