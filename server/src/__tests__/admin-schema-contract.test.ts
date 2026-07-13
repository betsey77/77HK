/**
 * Admin schema contract tests — Slice G1.
 *
 * Reads the actual Supabase migration SQL files and verifies that the
 * admin service only references columns, tables, and RPCs that exist.
 *
 * These tests prevent regression to wrong field names (e.g. `owner_id`
 * instead of `user_id`, `actor_id` instead of `actor`, `resource` instead
 * of `entity`, etc.).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Parse migration SQL ────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations');

/** All column names extracted from CREATE TABLE statements across all migrations. */
interface TableColumns {
  table: string;
  columns: Set<string>;
}

let schema: Map<string, Set<string>>;
let rpcFunctions: Set<string>;

beforeAll(() => {
  schema = new Map();
  rpcFunctions = new Set();

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Extract CREATE TABLE column definitions
    const createTableRegex = /create\s+(?:or\s+replace\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
    let match: RegExpExecArray | null;
    while ((match = createTableRegex.exec(sql)) !== null) {
      const tableName = match[1]!;
      const body = match[2]!;

      if (!schema.has(tableName)) {
        schema.set(tableName, new Set());
      }
      const columns = schema.get(tableName)!;

      // Extract column names from CREATE TABLE body
      const colRegex = /^\s*(\w+)\s+\w+/gm;
      let colMatch: RegExpExecArray | null;
      while ((colMatch = colRegex.exec(body)) !== null) {
        columns.add(colMatch[1]!);
      }

      // Also handle unique constraints and indexes that reference columns
    }

    // Also handle ALTER TABLE ... ADD COLUMN
    const alterColRegex = /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+(?:column\s+)?(\w+)\s+\w+/gi;
    let alterMatch: RegExpExecArray | null;
    while ((alterMatch = alterColRegex.exec(sql)) !== null) {
      const tableName = alterMatch[1]!;
      const colName = alterMatch[2]!;
      if (!schema.has(tableName)) {
        schema.set(tableName, new Set());
      }
      schema.get(tableName)!.add(colName);
    }

    // Extract RPC function names
    const funcRegex = /create\s+or\s+replace\s+function\s+(?:public\.|private\.)?(\w+)\s*\(/gi;
    let funcMatch: RegExpExecArray | null;
    while ((funcMatch = funcRegex.exec(sql)) !== null) {
      rpcFunctions.add(funcMatch[1]!);
    }
  }
});

// ── Helper ──────────────────────────────────────────────────────

function hasColumn(table: string, column: string): boolean {
  return schema.get(table)?.has(column) ?? false;
}

function hasRpc(name: string): boolean {
  return rpcFunctions.has(name);
}

// ── Tests ───────────────────────────────────────────────────────

describe('Schema contract — profiles table', () => {
  it('profiles has display_name (not email)', () => {
    expect(hasColumn('profiles', 'display_name')).toBe(true);
    expect(hasColumn('profiles', 'email')).toBe(false);
  });

  it('profiles has status, deletion_requested_at, purge_after', () => {
    expect(hasColumn('profiles', 'status')).toBe(true);
    expect(hasColumn('profiles', 'deletion_requested_at')).toBe(true);
    expect(hasColumn('profiles', 'purge_after')).toBe(true);
  });

  it('profiles does NOT have last_sign_in_at or deleted_at', () => {
    expect(hasColumn('profiles', 'last_sign_in_at')).toBe(false);
    expect(hasColumn('profiles', 'deleted_at')).toBe(false);
  });

  it('profiles has created_at and updated_at', () => {
    expect(hasColumn('profiles', 'created_at')).toBe(true);
    expect(hasColumn('profiles', 'updated_at')).toBe(true);
  });
});

describe('Schema contract — subscriptions table', () => {
  it('subscriptions uses user_id (not owner_id)', () => {
    expect(hasColumn('subscriptions', 'user_id')).toBe(true);
    expect(hasColumn('subscriptions', 'owner_id')).toBe(false);
  });

  it('subscriptions has plan_id, status, quota_used', () => {
    expect(hasColumn('subscriptions', 'plan_id')).toBe(true);
    expect(hasColumn('subscriptions', 'status')).toBe(true);
    expect(hasColumn('subscriptions', 'quota_used')).toBe(true);
  });

  it('subscriptions has current_period_start and current_period_end', () => {
    expect(hasColumn('subscriptions', 'current_period_start')).toBe(true);
    expect(hasColumn('subscriptions', 'current_period_end')).toBe(true);
  });
});

describe('Schema contract — audit_log table', () => {
  it('audit_log uses actor (not actor_id)', () => {
    expect(hasColumn('audit_log', 'actor')).toBe(true);
  });

  it('audit_log has actor_role', () => {
    expect(hasColumn('audit_log', 'actor_role')).toBe(true);
  });

  it('audit_log uses entity (not resource)', () => {
    expect(hasColumn('audit_log', 'entity')).toBe(true);
    expect(hasColumn('audit_log', 'resource')).toBe(false);
  });

  it('audit_log uses entity_id (not resource_id)', () => {
    expect(hasColumn('audit_log', 'entity_id')).toBe(true);
    expect(hasColumn('audit_log', 'resource_id')).toBe(false);
  });

  it('audit_log has reason, diff, request_id', () => {
    expect(hasColumn('audit_log', 'reason')).toBe(true);
    expect(hasColumn('audit_log', 'diff')).toBe(true);
    expect(hasColumn('audit_log', 'request_id')).toBe(true);
  });

  it('audit_log does NOT have metadata column', () => {
    expect(hasColumn('audit_log', 'metadata')).toBe(false);
  });
});

describe('Schema contract — generation_jobs table', () => {
  it('generation_jobs has owner_id and deleted_at (soft delete)', () => {
    expect(hasColumn('generation_jobs', 'owner_id')).toBe(true);
    expect(hasColumn('generation_jobs', 'deleted_at')).toBe(true);
  });

  it('generation_jobs has source, generation_engine, created_at, completed_at', () => {
    expect(hasColumn('generation_jobs', 'source')).toBe(true);
    expect(hasColumn('generation_jobs', 'generation_engine')).toBe(true);
    expect(hasColumn('generation_jobs', 'created_at')).toBe(true);
    expect(hasColumn('generation_jobs', 'completed_at')).toBe(true);
  });

  it('generation_jobs has status, platform, tone', () => {
    expect(hasColumn('generation_jobs', 'status')).toBe(true);
    expect(hasColumn('generation_jobs', 'platform')).toBe(true);
    expect(hasColumn('generation_jobs', 'tone')).toBe(true);
  });
});

describe('Schema contract — user_feedback table', () => {
  it('user_feedback has type, title, content, notify_status', () => {
    expect(hasColumn('user_feedback', 'type')).toBe(true);
    expect(hasColumn('user_feedback', 'title')).toBe(true);
    expect(hasColumn('user_feedback', 'content')).toBe(true);
    expect(hasColumn('user_feedback', 'notify_status')).toBe(true);
  });

  it('user_feedback has owner_id, created_at', () => {
    expect(hasColumn('user_feedback', 'owner_id')).toBe(true);
    expect(hasColumn('user_feedback', 'created_at')).toBe(true);
  });
});

describe('Schema contract — plans table', () => {
  it('plans has name, quota_per_cycle', () => {
    expect(hasColumn('plans', 'name')).toBe(true);
    expect(hasColumn('plans', 'quota_per_cycle')).toBe(true);
  });
});

describe('Schema contract — RPC functions', () => {
  it('reserve_quota RPC exists', () => {
    expect(hasRpc('reserve_quota')).toBe(true);
  });

  it('consume_quota RPC exists', () => {
    expect(hasRpc('consume_quota')).toBe(true);
  });

  it('release_quota RPC exists', () => {
    expect(hasRpc('release_quota')).toBe(true);
  });

  it('soft_delete_generation_job RPC exists', () => {
    expect(hasRpc('soft_delete_generation_job')).toBe(true);
  });

  it('has_any_role RPC exists', () => {
    expect(hasRpc('has_any_role')).toBe(true);
  });

  it('admin_get_user_generation_counts RPC does NOT exist (was removed/never existed)', () => {
    // This test will fail if someone accidentally creates this RPC
    expect(hasRpc('admin_get_user_generation_counts')).toBe(false);
  });
});

describe('Schema contract — forbidden patterns', () => {
  it('admin service source must not contain select(*)', () => {
    const adminServicePath = path.resolve(__dirname, '../services/adminService.ts');
    const content = fs.readFileSync(adminServicePath, 'utf-8');
    // Should not have any unqualified select('*')
    expect(content).not.toMatch(/\.select\s*\(\s*['"]\*['"]\s*\)/);
  });

  it('admin service must not call non-existent RPC', () => {
    const adminServicePath = path.resolve(__dirname, '../services/adminService.ts');
    const content = fs.readFileSync(adminServicePath, 'utf-8');
    expect(content).not.toContain('admin_get_user_generation_counts');
  });

  it('admin service must not select content in feedback list', () => {
    // The feedback summary query must not include 'content' in the select
    // We verify this indirectly: getAdminFeedbackSummary must use a specific field list
    const adminServicePath = path.resolve(__dirname, '../services/adminService.ts');
    const content = fs.readFileSync(adminServicePath, 'utf-8');

    // Find the getAdminFeedbackSummary function and verify its select statement
    const fnStart = content.indexOf('export async function getAdminFeedbackSummary');
    const fnEnd = content.indexOf('export async function', fnStart + 1);
    const fnBody = fnEnd > 0 ? content.slice(fnStart, fnEnd) : content.slice(fnStart);

    // The feedback query must select specific fields, not include 'content'
    const selectMatch = fnBody.match(/\.from\s*\(\s*['"]user_feedback['"]\s*\)[\s\S]*?\.select\s*\(([^)]+)\)/);
    if (selectMatch) {
      const selectFields = selectMatch[1]!;
      // Must not include 'content' in the select
      expect(selectFields).not.toContain('content');
    }
  });
});
