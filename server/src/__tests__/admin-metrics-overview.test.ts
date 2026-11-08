import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = { from: vi.fn() };

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => mockDb,
}));

import {
  AdminMetricsError,
  getAdminMetricsOverview,
  parseAdminMetricsRange,
} from '../services/adminMetricsService.js';

type Row = Record<string, unknown>;

function makeDatabase(tables: Record<string, Row[]>) {
  const queryLog: Array<{ table: string; filters: Array<[string, string, unknown]> }> = [];

  mockDb.from.mockImplementation((table: string) => {
    const filters: Array<[string, string, unknown]> = [];
    let selected = '';
    const query = {
      select(fields: string) {
        selected = fields;
        return query;
      },
      eq(field: string, value: unknown) {
        filters.push(['eq', field, value]);
        return query;
      },
      gte(field: string, value: unknown) {
        filters.push(['gte', field, value]);
        return query;
      },
      lte(field: string, value: unknown) {
        filters.push(['lte', field, value]);
        return query;
      },
      lt(field: string, value: unknown) {
        filters.push(['lt', field, value]);
        return query;
      },
      in(field: string, values: unknown[]) {
        filters.push(['in', field, values]);
        return query;
      },
      async maybeSingle() {
        const rows = applyFilters(tables[table] ?? [], filters);
        queryLog.push({ table, filters: [...filters] });
        return { data: rows[0] ?? null, error: null };
      },
      async range(start: number, end: number) {
        const rows = applyFilters(tables[table] ?? [], filters)
          .slice(start, end + 1)
          .map((row) => pickFields(row, selected));
        queryLog.push({ table, filters: [...filters] });
        return { data: rows, error: null };
      },
    };
    return query;
  });

  return queryLog;
}

function applyFilters(rows: Row[], filters: Array<[string, string, unknown]>): Row[] {
  return rows.filter((row) => filters.every(([operator, field, expected]) => {
    const actual = row[field];
    if (operator === 'eq') return actual === expected;
    if (operator === 'in') return (expected as unknown[]).includes(actual);
    if (operator === 'gte') return String(actual) >= String(expected);
    if (operator === 'lte') return String(actual) <= String(expected);
    if (operator === 'lt') return String(actual) < String(expected);
    return false;
  }));
}

function pickFields(row: Row, selected: string): Row {
  const fields = selected.split(',').map((field) => field.trim()).filter(Boolean);
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}

const RANGE = { from: '2026-07-01', to: '2026-07-19' } as const;
const TABLES: Record<string, Row[]> = {
  profiles: [
    { id: 'admin-a', review_group: 'group-a' },
    { id: 'user-a', review_group: 'group-a' },
    { id: 'user-b', review_group: 'group-b' },
  ],
  app_activity_daily: [
    { user_id: 'user-a', activity_date_hk: '2026-07-19' },
    { user_id: 'user-a', activity_date_hk: '2026-07-15' },
    { user_id: 'user-b', activity_date_hk: '2026-07-19' },
  ],
  membership_grants: [
    { user_id: 'user-a', status: 'applied', created_at: '2026-07-10T02:00:00Z' },
    { user_id: 'user-b', status: 'pending', created_at: '2026-07-11T02:00:00Z' },
  ],
  usage_ledger: [
    { user_id: 'user-a', event_type: 'consume', amount: 2, created_at: '2026-07-12T02:00:00Z' },
    { user_id: 'user-a', event_type: 'reserve', amount: 7, created_at: '2026-07-12T02:00:00Z' },
    { user_id: 'user-b', event_type: 'consume', amount: 9, created_at: '2026-07-12T02:00:00Z' },
  ],
  subscriptions: [
    { user_id: 'user-a', plan_id: 'free', status: 'active', quota_used: 3 },
    { user_id: 'user-b', plan_id: 'pro', status: 'active', quota_used: 5 },
  ],
  plans: [
    { id: 'free', quota_per_cycle: 20 },
    { id: 'pro', quota_per_cycle: 250 },
  ],
};

describe('D6a admin metrics range', () => {
  it('uses Hong Kong today and a 30-day inclusive default window', () => {
    expect(parseAdminMetricsRange(undefined, undefined, new Date('2026-07-19T03:00:00Z')))
      .toEqual({ from: '2026-06-20', to: '2026-07-19' });
  });

  it.each([
    ['2026/07/01', '2026-07-19'],
    ['2026-07-20', '2026-07-19'],
    ['2026-04-20', '2026-07-19'],
    ['2026-07-01', '2026-07-20'],
  ])('rejects invalid or unsafe range %s..%s', (from, to) => {
    expect(() => parseAdminMetricsRange(from, to, new Date('2026-07-19T03:00:00Z')))
      .toThrow(AdminMetricsError);
  });
});

describe('D6a admin metrics aggregation and scope', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ordinary admin sees only owners in the current non-empty review group', async () => {
    const queryLog = makeDatabase(TABLES);
    const result = await getAdminMetricsOverview(
      { actorId: 'admin-a', actorRole: 'admin' },
      RANGE,
    );

    expect(result).toEqual({
      scope: 'group',
      reviewGroup: 'group-a',
      ...RANGE,
      activity: { dau: 1, wau: 1, mau: 1 },
      membershipGrants: { total: 1, pending: 0, applied: 1 },
      quota: { consumed: 2, remaining: 17 },
    });

    for (const entry of queryLog.filter((item) => item.table !== 'profiles' && item.table !== 'plans')) {
      const ownerFilter = entry.filters.find(([operator, field]) => operator === 'in' && field === 'user_id');
      expect(ownerFilter?.[2]).toEqual(expect.arrayContaining(['admin-a', 'user-a']));
      expect(ownerFilter?.[2]).not.toContain('user-b');
    }
  });

  it('super_admin receives global aggregates without a review-group filter', async () => {
    const queryLog = makeDatabase(TABLES);
    const result = await getAdminMetricsOverview(
      { actorId: 'super-1', actorRole: 'super_admin' },
      RANGE,
    );

    expect(result.scope).toBe('global');
    expect(result.reviewGroup).toBeNull();
    expect(result.activity).toEqual({ dau: 2, wau: 2, mau: 2 });
    expect(result.membershipGrants).toEqual({ total: 2, pending: 1, applied: 1 });
    expect(result.quota).toEqual({ consumed: 11, remaining: 262 });
    expect(queryLog.some((entry) => entry.filters.some(([operator]) => operator === 'in'))).toBe(false);
  });

  it('fails closed before reading business metrics when ordinary admin has no group', async () => {
    const queryLog = makeDatabase({ profiles: [{ id: 'admin-a', review_group: null }] });

    await expect(getAdminMetricsOverview(
      { actorId: 'admin-a', actorRole: 'admin' },
      RANGE,
    )).rejects.toMatchObject({ status: 403, code: 'admin_review_group_required' });

    expect(queryLog.map((entry) => entry.table)).toEqual(['profiles']);
  });

  it('returns aggregate-only privacy-safe keys', async () => {
    makeDatabase(TABLES);
    const result = await getAdminMetricsOverview(
      { actorId: 'super-1', actorRole: 'super_admin' },
      RANGE,
    );
    const serialized = JSON.stringify(result).toLowerCase();
    for (const forbidden of ['email', 'userid', 'ownerid', 'prompt', 'response', 'jwt', 'api_key', 'metadata']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
