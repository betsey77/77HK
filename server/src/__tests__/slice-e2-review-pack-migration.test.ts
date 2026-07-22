import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260722100000_slice_e_bad_case_review_packs.sql',
);

const TABLES = [
  'generation_artifact_snapshots',
  'bad_case_review_packs',
  'bad_case_findings',
  'bad_case_review_events',
] as const;

function readMigration(): string {
  expect(fs.existsSync(migrationPath)).toBe(true);
  return fs.readFileSync(migrationPath, 'utf8');
}

function readCreateTable(sql: string, table: string): string {
  const pattern = new RegExp(
    `create\\s+table\\s+public\\.${table}\\s*\\([\\s\\S]*?\\n\\);`,
    'i',
  );
  return sql.match(pattern)?.[0] ?? '';
}

describe('2.1 Slice E2 bad case review pack migration (static contract)', () => {
  it('creates the four local tables', () => {
    const sql = readMigration();
    for (const table of TABLES) {
      expect(sql).toMatch(new RegExp(`create\\s+table\\s+public\\.${table}`, 'i'));
      expect(readCreateTable(sql, table)).not.toBe('');
    }
  });

  it('snapshots store allowlisted manifests with one row per generation job', () => {
    const sql = readMigration();
    const table = readCreateTable(sql, 'generation_artifact_snapshots');

    expect(table).toMatch(/generation_job_id uuid not null references public\.generation_jobs\(id\)/i);
    expect(table).toMatch(/owner_id uuid not null references auth\.users\(id\)/i);
    expect(table).toMatch(/prompt_manifest jsonb not null/i);
    expect(table).toMatch(/rule_manifest jsonb not null/i);
    expect(table).toMatch(/knowledge_manifest jsonb not null/i);
    expect(table).toMatch(/model_policy_manifest jsonb not null/i);
    expect(table).toMatch(/schema_version integer not null/i);
    expect(table).toMatch(/content_hash text not null/i);
    expect(table).toMatch(/availability text not null/i);
    expect(table).toMatch(/unique\s*\(\s*generation_job_id\s*\)/i);
    expect(table).toMatch(/octet_length\s*\(\s*prompt_manifest::text\s*\)\s*<=\s*262144/i);
    expect(table).toMatch(/availability in\s*\(\s*'captured'\s*,\s*'legacy_unavailable'\s*\)/i);
  });

  it('review packs are one per job with constrained enums and indexes', () => {
    const sql = readMigration();
    const table = readCreateTable(sql, 'bad_case_review_packs');

    expect(table).toMatch(/generation_job_id uuid not null references public\.generation_jobs\(id\)/i);
    expect(table).toMatch(/subject_owner_id uuid not null references auth\.users\(id\)/i);
    expect(table).toMatch(/trigger_kind text not null/i);
    expect(table).toMatch(/score_below_threshold/i);
    expect(table).toMatch(/generation_failed/i);
    expect(table).toMatch(/criteria_failed/i);
    expect(table).toMatch(/manual/i);
    expect(table).toMatch(/status text not null/i);
    expect(table).toMatch(/owner_team text not null/i);
    expect(table).toMatch(/content_prompt/i);
    expect(table).toMatch(/knowledge_rules/i);
    expect(table).toMatch(/model_provider/i);
    expect(table).toMatch(/backend_platform/i);
    expect(table).toMatch(/frontend_experience/i);
    expect(table).toMatch(/unassigned/i);
    expect(table).toMatch(/analysis_status text not null/i);
    expect(table).toMatch(/criteria_version text not null/i);
    expect(table).toMatch(/unique\s*\(\s*generation_job_id\s*\)/i);
    expect(sql).toMatch(/create index[\s\S]*bad_case_review_packs[\s\S]*status/i);
  });

  it('findings require evidence/criterion/artifact refs and disposition constraints', () => {
    const sql = readMigration();
    const table = readCreateTable(sql, 'bad_case_findings');

    expect(table).toMatch(/review_pack_id uuid not null references public\.bad_case_review_packs\(id\)/i);
    expect(table).toMatch(/evidence_refs jsonb not null/i);
    expect(table).toMatch(/criterion_refs jsonb not null/i);
    expect(table).toMatch(/artifact_refs jsonb not null/i);
    expect(table).toMatch(/recommended_owner_team text not null/i);
    expect(table).toMatch(/jsonb_typeof\s*\(\s*evidence_refs\s*\)\s*=\s*'array'/i);
    expect(table).toMatch(/octet_length\s*\(\s*evidence_refs::text\s*\)\s*<=\s*65536/i);
    expect(table).toMatch(/confirmed/i);
    expect(table).toMatch(/false_positive/i);
  });

  it('events are append-only for service_role only', () => {
    const sql = readMigration();
    const table = readCreateTable(sql, 'bad_case_review_events');

    expect(table).toMatch(/review_pack_id uuid not null references public\.bad_case_review_packs\(id\)/i);
    expect(table).toMatch(/event_type text not null/i);
    expect(table).toMatch(/created_at timestamptz not null/i);
    expect(table).not.toMatch(/updated_at/i);
    expect(sql).toMatch(
      /grant select,\s*insert on table public\.bad_case_review_events to service_role/i,
    );
    expect(sql).not.toMatch(
      /grant[^;]*update[^;]*on table public\.bad_case_review_events to service_role/i,
    );
    expect(sql).not.toMatch(
      /grant[^;]*delete[^;]*on table public\.bad_case_review_events to service_role/i,
    );
  });

  it('enables RLS and denies browser roles on all four tables', () => {
    const sql = readMigration();

    for (const table of TABLES) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated, service_role`,
          'i',
        ),
      );
      expect(sql).not.toMatch(
        new RegExp(`grant [^;]* on table public\\.${table} to (anon|authenticated)`, 'i'),
      );
      expect(sql).not.toMatch(
        new RegExp(`create policy[\\s\\S]{0,80}on public\\.${table}`, 'i'),
      );
    }

    expect(sql).toMatch(
      /grant select,\s*insert,\s*update on table public\.generation_artifact_snapshots to service_role/i,
    );
    expect(sql).toMatch(
      /grant select,\s*insert,\s*update on table public\.bad_case_review_packs to service_role/i,
    );
    expect(sql).toMatch(
      /grant select,\s*insert,\s*update on table public\.bad_case_findings to service_role/i,
    );
  });

  it('forbids sensitive columns and destructive cleanup jobs', () => {
    const sql = readMigration();
    const forbidden = [
      'email',
      'jwt',
      'api_key',
      'secret',
      'raw_prompt',
      'raw_response',
      'thinking',
      'chain_of_thought',
      'password',
      'cookie',
    ];

    for (const table of TABLES) {
      const body = readCreateTable(sql, table);
      for (const col of forbidden) {
        expect(body).not.toMatch(new RegExp(`\\b${col}\\b`, 'i'));
      }
    }

    expect(sql).not.toMatch(/cron\.schedule|pg_cron/i);
    expect(sql).not.toMatch(/delete from public\.(generation_artifact_snapshots|bad_case_)/i);
  });
});

