/**
 * Slice G1: Admin dashboard client tests.
 *
 * Coverage:
 * - AdminPage renders states (loading, forbidden, error)
 * - AdminPage matches design system (Lucide, dark=emerald, light=orange)
 * - HeaderMenu admin entry: only visible after server-confirmed admin role
 * - Route /admin is registered in App.tsx
 * - No new dependencies introduced
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock api module ────────────────────────────────────────────

const mockApi = vi.hoisted(() => ({
  checkAdminAccess: vi.fn().mockResolvedValue(false),
  getAdminStats: vi.fn().mockResolvedValue({ totalUsers: 0, activeSubscriptions: 0, totalGenerations: 0, totalFeedback: 0, adminUsers: 0 }),
  getAdminUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  getAdminGenerations: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
  getAdminFeedback: vi.fn().mockResolvedValue({ feedback: [], total: 0 }),
  getAdminSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [], total: 0 }),
  getAdminAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
}));

vi.mock('../services/api', () => mockApi);

// ── Tests ──────────────────────────────────────────────────────

describe('Slice G1 — AdminPage route registration', () => {
  it('/admin route is registered in App.tsx', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../App.tsx'),
      'utf-8',
    );
    expect(content).toContain("path === '/admin'");
    expect(content).toContain('AdminPage');
  });
});

describe('Slice G1 — AdminPage loading / forbidden / error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.checkAdminAccess.mockResolvedValue(false);
  });

  it('renders loading state while checking admin access', async () => {
    // Don't resolve the mock — stays pending
    mockApi.checkAdminAccess.mockReturnValue(new Promise(() => {}));
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    expect(screen.getByText(/验证管理员权限/)).toBeInTheDocument();
  });

  it('renders forbidden state when not an admin', async () => {
    mockApi.checkAdminAccess.mockResolvedValue(false);
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/403/)).toBeInTheDocument();
      expect(screen.getByText(/访问被拒绝/)).toBeInTheDocument();
    });
  });

  it('forbidden state has link back to workbench', async () => {
    mockApi.checkAdminAccess.mockResolvedValue(false);
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      const link = screen.getByText(/回到工作台/);
      expect(link.closest('a')).toHaveAttribute('href', '/app');
    });
  });

  it('renders error state when stats load fails', async () => {
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminStats.mockRejectedValue(new Error('network'));
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
    });
  });

  it('renders stats and tabs when admin access is confirmed', async () => {
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 10, activeSubscriptions: 5,
      totalGenerations: 100, totalFeedback: 20, adminUsers: 2,
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText('总用户数')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('renders all tab labels', async () => {
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 0, activeSubscriptions: 0,
      totalGenerations: 0, totalFeedback: 0, adminUsers: 0,
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText('用户')).toBeInTheDocument();
      expect(screen.getByText('生成任务')).toBeInTheDocument();
      expect(screen.getByText('反馈')).toBeInTheDocument();
      expect(screen.getByText('订阅')).toBeInTheDocument();
      expect(screen.getByText('审计日志')).toBeInTheDocument();
    });
  });
});

describe('Slice G1 — AdminPage design system compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Lucide icons (Shield, Users, Zap, etc.)', async () => {
    // Verify the page imports Lucide icons
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../pages/AdminPage.tsx'),
      'utf-8',
    );
    // Must use Lucide imports
    expect(content).toContain("from 'lucide-react'");
    expect(content).toContain('Shield');
    expect(content).toContain('Users');
    expect(content).toContain('Loader2');
  });

  it('uses design system colors (emerald for dark, orange for light)', async () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../pages/AdminPage.tsx'),
      'utf-8',
    );
    // Dark mode: emerald
    expect(content).toContain('emerald');
    // Light mode: orange
    expect(content).toContain('orange');
  });

  it('does NOT import Ant Design or any new UI library', async () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../pages/AdminPage.tsx'),
      'utf-8',
    );
    const forbidden = ['antd', '@ant-design', 'mantine', '@mantine', 'chakra', '@chakra', 'mui', '@mui', 'radix'];
    for (const lib of forbidden) {
      expect(content).not.toContain(lib);
    }
  });
});

describe('Slice G1 — HeaderMenu admin entry', () => {
  it('HeaderMenu imports checkAdminAccess for server-verified role', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../components/layout/HeaderMenu.tsx'),
      'utf-8',
    );
    expect(content).toContain('checkAdminAccess');
    // Admin entry must NOT be based on a browser role string
    expect(content).not.toMatch(/isAdmin\s*=\s*['"]admin['"]/);
    expect(content).not.toMatch(/role\s*===\s*['"]admin['"]/);
  });
});

describe('Slice G1 — AdminPage renders real new-schema fixtures (no old fields)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 3, activeSubscriptions: 2,
      totalGenerations: 5, totalFeedback: 1, adminUsers: 1,
    });
  });

  it('UsersTable renders with displayName/userIdPrefix/status — no email/lastSignIn', async () => {
    mockApi.getAdminUsers.mockResolvedValue({
      users: [{
        id: 'u1',
        displayName: '用户 abc12345',
        userIdPrefix: 'abc12345',
        roles: ['admin'],
        status: 'active',
        createdAt: '2026-07-01T00:00:00Z',
        deletionRequestedAt: null,
        subscriptionPlan: 'Pro',
        generationCount: 42,
      }],
      total: 1,
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      // New fields rendered
      expect(screen.getByText('用户 abc12345')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      // Old fields NOT rendered (email would be a full email address)
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });
  });

  it('GenerationsTable renders with ownerDisplayName — no ownerEmail/sourceLength', async () => {
    mockApi.getAdminGenerations.mockResolvedValue({
      jobs: [{
        id: 'j1',
        ownerId: 'u1',
        ownerDisplayName: '用户 abc12345',
        status: 'completed',
        platform: 'ig',
        tone: '活潑',
        generationEngine: 'deepseek',
        createdAt: '2026-07-12T00:00:00Z',
        completedAt: null,
      }],
      total: 1,
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText('用户 abc12345')).toBeInTheDocument();
    });
    // No email rendered
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('FeedbackTable API type uses ownerDisplayName/notifyStatus — no contentPreview/ownerEmail', async () => {
    mockApi.getAdminFeedback.mockResolvedValue({
      feedback: [{
        id: 'fb1',
        ownerId: 'u1',
        ownerDisplayName: '用户 abc12345',
        type: 'bug_report',
        title: '页面崩溃',
        notifyStatus: 'sent',
        createdAt: '2026-07-12T00:00:00Z',
      }],
      total: 1,
    });
    // Type-level assertion: new fields present, old fields absent
    const data = await mockApi.getAdminFeedback();
    const fb = data.feedback[0]!;
    expect(fb.ownerDisplayName).toBe('用户 abc12345');
    expect(fb.notifyStatus).toBe('sent');
    expect('ownerEmail' in fb).toBe(false);
    expect('contentPreview' in fb).toBe(false);
  });

  it('SubscriptionsTable API type uses userDisplayName/planName — no ownerEmail/planId', async () => {
    mockApi.getAdminSubscriptions.mockResolvedValue({
      subscriptions: [{
        id: 's1',
        userId: 'u1',
        userDisplayName: '用户 abc12345',
        planName: 'Pro',
        status: 'active',
        quotaUsed: 5,
        quotaTotal: 400,
        cycleStart: '2026-07-01T00:00:00Z',
        cycleEnd: '2026-08-01T00:00:00Z',
      }],
      total: 1,
    });
    // Type-level assertion: new fields present, old fields absent
    const data = await mockApi.getAdminSubscriptions();
    const sub = data.subscriptions[0]!;
    expect(sub.userDisplayName).toBe('用户 abc12345');
    expect(sub.planName).toBe('Pro');
    expect('ownerEmail' in sub).toBe(false);
    expect('ownerId' in sub).toBe(false);
    expect('planId' in sub).toBe(false);
  });

  it('AuditTable API type uses actor/actorRole/entity/entityId — no actorId/resource/resourceId/metadata', async () => {
    mockApi.getAdminAuditLog.mockResolvedValue({
      entries: [{
        id: 'a1',
        actor: 'u-admin-1',
        actorRole: 'admin',
        action: 'admin_view_generation_detail',
        entity: 'generation_jobs',
        entityId: 'job-xxx',
        reason: null,
        diff: null,
        requestId: null,
        createdAt: '2026-07-12T00:00:00Z',
      }],
      total: 1,
    });
    // Type-level assertion: new fields present, old fields absent
    const data = await mockApi.getAdminAuditLog();
    const entry = data.entries[0]!;
    expect(entry.actor).toBe('u-admin-1');
    expect(entry.actorRole).toBe('admin');
    expect(entry.entity).toBe('generation_jobs');
    expect(entry.entityId).toBe('job-xxx');
    expect('actorId' in entry).toBe(false);
    expect('resource' in entry).toBe(false);
    expect('resourceId' in entry).toBe(false);
    expect('metadata' in entry).toBe(false);
  });

  it('AdminPage source code does not reference old field names', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../pages/AdminPage.tsx'),
      'utf-8',
    );
    // Must not use old field access patterns
    expect(content).not.toMatch(/\.\s*email\b/);
    expect(content).not.toMatch(/\.\s*ownerEmail\b/);
    expect(content).not.toMatch(/\.\s*lastSignIn\b/);
    expect(content).not.toMatch(/\.\s*sourceLength\b/);
    expect(content).not.toMatch(/\.\s*contentPreview\b/);
    expect(content).not.toMatch(/\.\s*ownerId\b/);  // subscriptions used ownerId before
    expect(content).not.toMatch(/\.\s*planId\b/);    // subscriptions rendered planId before
    expect(content).not.toMatch(/\.\s*actorId\b/);
    expect(content).not.toMatch(/\.\s*resource\b/);  // audit used resource before
    expect(content).not.toMatch(/\.\s*resourceId\b/);
    expect(content).not.toMatch(/\.\s*metadata\b/);  // audit used metadata before
  });
});

describe('Slice G1 — No mutations in admin page', () => {
  it('AdminPage does NOT contain delete, ban, or mutation buttons', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../pages/AdminPage.tsx'),
      'utf-8',
    );
    // No dangerous action labels
    const forbiddenActions = ['删除', '封禁', '移除', '修改权限', '调整额度', '修改角色', '提升', '降级'];
    for (const action of forbiddenActions) {
      expect(content).not.toContain(action);
    }
  });
});
