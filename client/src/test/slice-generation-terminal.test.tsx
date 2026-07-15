/**
 * Slice A: Generation progress terminal visual upgrade
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import type { GenerationProgress, StageProgress } from '../types';
import { buildTerminalLogs } from '../components/results/AgentTerminal';

function AppWrapper({ children }: { children: ReactNode }) {
  return <AppProvider ownerId="term-test-user">{children}</AppProvider>;
}

const STAGE_LABELS = {
  diagnosis: '诊断原文',
  generation: '生成变体',
  audit: '质量审核',
  feedback: '消费者反馈',
} as const;

function makeProgress(statuses: StageProgress['status'][]): GenerationProgress {
  const stages: StageProgress[] = (['diagnosis', 'generation', 'audit', 'feedback'] as const).map(
    (stage, i) => ({
      stage,
      label: STAGE_LABELS[stage],
      status: statuses[i] ?? 'pending',
    }),
  );
  return { stages, startedAt: Date.now(), isEstimated: true };
}

beforeEach(() => localStorage.clear());

describe('AgentTerminal + GenerationProgress', () => {
  it('renders terminal with logs derived from active stage', async () => {
    const { default: GenerationProgress } = await import(
      '../components/results/GenerationProgress'
    );
    const progress = makeProgress(['done', 'active', 'pending', 'pending']);
    render(<GenerationProgress progress={progress} />, { wrapper: AppWrapper });

    expect(screen.getByTestId('agent-terminal')).toBeInTheDocument();
    expect(screen.getByText('已启动预估流程（本地演示）')).toBeInTheDocument();
    expect(screen.getByText('原文诊断完成，已提取关键约束。')).toBeInTheDocument();
    expect(screen.getByText(/正在生成 5 个平台版本/)).toBeInTheDocument();
    expect(screen.getByText('预估流程')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-meta')).toHaveTextContent('stage · generation');
  });

  it('shows failed log without claiming success', async () => {
    const { default: GenerationProgress } = await import(
      '../components/results/GenerationProgress'
    );
    const progress = makeProgress(['done', 'done', 'failed', 'pending']);
    render(<GenerationProgress progress={progress} />, { wrapper: AppWrapper });

    expect(screen.getByText(/本阶段未完成/)).toBeInTheDocument();
    expect(screen.getByTestId('terminal-meta')).toHaveTextContent('stage · error');
  });

  it('exposes aria-live status text for accessibility', async () => {
    const { default: GenerationProgress } = await import(
      '../components/results/GenerationProgress'
    );
    const progress = makeProgress(['active', 'pending', 'pending', 'pending']);
    render(<GenerationProgress progress={progress} />, { wrapper: AppWrapper });

    const live = document.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toMatch(/诊断原文/);
  });

  it('keeps light-mode orange classes on active stage', async () => {
    const { default: GenerationProgress } = await import(
      '../components/results/GenerationProgress'
    );
    const progress = makeProgress(['active', 'pending', 'pending', 'pending']);
    const { container } = render(<GenerationProgress progress={progress} />, {
      wrapper: AppWrapper,
    });

    const active = container.querySelector('[data-stage-status="active"]');
    expect(active?.className).toMatch(/light:border-orange|light:bg-orange/);
    expect(container.innerHTML).toMatch(/light:text-orange|light:bg-orange/);
  });

  it('buildTerminalLogs maps done/active/failed correctly', () => {
    const logs = buildTerminalLogs(makeProgress(['done', 'active', 'failed', 'pending']).stages);
    expect(logs[0]?.message).toBe('已启动预估流程（本地演示）');
    // done stage emits both start + done lines
    const diagnose = logs.filter((l) => l.tag === 'DIAGNOSE');
    expect(diagnose.length).toBe(2);
    expect(logs.some((l) => l.tag === 'VARIANT_ENGINE' && l.active)).toBe(true);
    expect(logs.some((l) => l.tag === 'QUALITY_GATE' && l.failed)).toBe(true);
    expect(logs.some((l) => l.tag === 'AUDIENCE_SIM')).toBe(false);
  });

  it('still shows 预估 marker (UX-F1 regression)', async () => {
    const { default: GenerationProgress } = await import(
      '../components/results/GenerationProgress'
    );
    render(<GenerationProgress progress={makeProgress(['pending', 'pending', 'pending', 'pending'])} />, {
      wrapper: AppWrapper,
    });
    expect(screen.getByText(/预估阶段/)).toBeInTheDocument();
  });
});
