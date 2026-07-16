import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import CaseLibraryPanel from '../components/input/CaseLibraryPanel';
import ConfigManager from '../components/input/ConfigManager';
import {
  deriveCaseDisplayName,
  validateCaseLibraryForm,
  CASE_LIBRARY_LIMITS,
  reconcileSelectedCaseIds,
} from '../utils/caseLibrary';
import { normalizeSettings } from '../context/AppContext';
import { DEFAULT_SETTINGS } from '../constants';
import type { CaseLibraryEntry, SavedConfig } from '../types';
import { buildWorkbenchSnapshotFromHistory } from '../services/workbenchSnapshot';
import type { GenerationJob } from '../types';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../services/caseLibraryApi', () => ({
  listCaseLibrary: (...args: unknown[]) => mockList(...args),
  createCaseLibraryEntry: (...args: unknown[]) => mockCreate(...args),
  updateCaseLibraryEntry: (...args: unknown[]) => mockUpdate(...args),
  deleteCaseLibraryEntry: (...args: unknown[]) => mockDelete(...args),
}));

vi.mock('../hooks/useGenerate', () => ({
  useGenerate: () => ({
    generate: vi.fn(),
    isLoading: false,
    canGenerate: true,
    quotaDialogOpen: false,
    closeQuotaDialog: vi.fn(),
  }),
}));

function makeEntry(overrides: Partial<CaseLibraryEntry> = {}): CaseLibraryEntry {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    caseType: 'good',
    title: null,
    body: '这是一条足够长度的正例正文内容用于测试校验',
    reason: '结构清晰节奏好',
    tags: ['钩子'],
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T01:00:00.000Z',
    ...overrides,
  };
}

describe('W2 case library utils', () => {
  it('validates fields and derives unnamed display names', () => {
    expect(deriveCaseDisplayName('good', null)).toBe('未命名正例');
    expect(deriveCaseDisplayName('bad', '')).toBe('未命名反例');

    const bad = validateCaseLibraryForm({
      caseType: 'good',
      title: '',
      body: 'short',
      reason: '',
      tagsRaw: 'a,b,c,d,e,f,g,h,i',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.body).toBeTruthy();
      expect(bad.errors.reason).toBeTruthy();
      expect(bad.errors.tags).toBeTruthy();
    }

    const ok = validateCaseLibraryForm({
      caseType: 'bad',
      title: '',
      body: 'x'.repeat(CASE_LIBRARY_LIMITS.bodyMin),
      reason: '避免硬广',
      tagsRaw: '硬广',
    });
    expect(ok.ok).toBe(true);
  });

  it('reconcile drops deleted ids without silent replacement of others', () => {
    const { next, dropped } = reconcileSelectedCaseIds(
      ['a', 'missing', 'b'],
      new Set(['a', 'b']),
    );
    expect(next).toEqual(['a', 'b']);
    expect(dropped).toBe(1);
  });
});

describe('W2 CaseLibraryPanel UI', () => {
  const ownerId = 'w2-user';

  beforeEach(() => {
    localStorage.clear();
    mockList.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockList.mockResolvedValue([
      makeEntry(),
      makeEntry({
        id: '22222222-2222-4222-8222-222222222222',
        caseType: 'bad',
        title: '硬广反例',
        body: '这是一条足够长度的反例正文内容用于测试校验',
        reason: '太硬推销',
        tags: ['避免'],
      }),
    ]);
  });

  it('lists cases, supports search, max 3 selection, create validation, delete confirm', async () => {
    render(
      <AppProvider ownerId={ownerId}>
        <CaseLibraryPanel />
      </AppProvider>,
    );

    // Default collapsed: header only, list/search hidden until expand
    await waitFor(() => {
      expect(screen.getByTestId('case-library-panel')).toBeInTheDocument();
    });
    const toggle = screen.getByTestId('case-library-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('case-library-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('case-library-search')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await waitFor(() => {
      expect(screen.getByTestId('case-library-list')).toBeInTheDocument();
    });

    expect(screen.getByText('未命名正例')).toBeInTheDocument();
    expect(screen.getByText('硬广反例')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('case-library-search'), {
      target: { value: '硬广' },
    });
    expect(screen.queryByText('未命名正例')).not.toBeInTheDocument();
    expect(screen.getByText('硬广反例')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('case-library-search'), {
      target: { value: '' },
    });

    // select up to 3
    fireEvent.click(screen.getByTestId('case-library-select-11111111-1111-4111-8111-111111111111'));
    fireEvent.click(screen.getByTestId('case-library-select-22222222-2222-4222-8222-222222222222'));

    // add two more mock entries via re-render path — only 2 available; create a third via mock
    mockCreate.mockResolvedValue(
      makeEntry({
        id: '33333333-3333-4333-8333-333333333333',
        title: '第三',
        body: 'y'.repeat(CASE_LIBRARY_LIMITS.bodyMin),
        reason: '原因足够',
      }),
    );
    mockList.mockResolvedValue([
      makeEntry(),
      makeEntry({
        id: '22222222-2222-4222-8222-222222222222',
        caseType: 'bad',
        title: '硬广反例',
        body: '这是一条足够长度的反例正文内容用于测试校验',
        reason: '太硬推销',
      }),
      makeEntry({
        id: '33333333-3333-4333-8333-333333333333',
        title: '第三',
        body: 'y'.repeat(CASE_LIBRARY_LIMITS.bodyMin),
        reason: '原因足够',
      }),
      makeEntry({
        id: '44444444-4444-4444-8444-444444444444',
        title: '第四',
        body: 'z'.repeat(CASE_LIBRARY_LIMITS.bodyMin),
        reason: '原因足够',
      }),
    ]);

    fireEvent.click(screen.getByTestId('case-library-add'));
    fireEvent.change(screen.getByTestId('case-library-body'), {
      target: { value: 'y'.repeat(CASE_LIBRARY_LIMITS.bodyMin) },
    });
    fireEvent.change(screen.getByTestId('case-library-reason'), {
      target: { value: '原因足够' },
    });
    fireEvent.change(screen.getByTestId('case-library-title'), {
      target: { value: '第三' },
    });
    fireEvent.click(screen.getByTestId('case-library-save'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('第三')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('case-library-select-33333333-3333-4333-8333-333333333333'));
    // 4th should be blocked (disabled at cap)
    const fourth = screen.getByTestId('case-library-select-44444444-4444-4444-8444-444444444444');
    expect(fourth).toBeDisabled();

    // delete confirm dialog
    fireEvent.click(screen.getByTestId('case-library-delete-11111111-1111-4111-8111-111111111111'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('删除案例？')).toBeInTheDocument();
    mockDelete.mockResolvedValue(undefined);
    mockList.mockResolvedValue([
      makeEntry({
        id: '22222222-2222-4222-8222-222222222222',
        caseType: 'bad',
        title: '硬广反例',
        body: '这是一条足够长度的反例正文内容用于测试校验',
        reason: '太硬推销',
      }),
      makeEntry({
        id: '33333333-3333-4333-8333-333333333333',
        title: '第三',
        body: 'y'.repeat(CASE_LIBRARY_LIMITS.bodyMin),
        reason: '原因足够',
      }),
      makeEntry({
        id: '44444444-4444-4444-8444-444444444444',
        title: '第四',
        body: 'z'.repeat(CASE_LIBRARY_LIMITS.bodyMin),
        reason: '原因足够',
      }),
    ]);
    fireEvent.click(screen.getByText('确认删除'));
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    });
  });

  it('shows validation errors on short body', async () => {
    mockList.mockResolvedValue([]);
    render(
      <AppProvider ownerId={ownerId}>
        <CaseLibraryPanel />
      </AppProvider>,
    );
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    // Collapsed by default; "新增" expands and opens form
    expect(screen.getByTestId('case-library-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('case-library-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('case-library-add'));
    expect(screen.getByTestId('case-library-toggle')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByTestId('case-library-body'), {
      target: { value: '太短' },
    });
    fireEvent.change(screen.getByTestId('case-library-reason'), {
      target: { value: 'r' },
    });
    fireEvent.click(screen.getByTestId('case-library-save'));
    expect(screen.getByTestId('case-library-body-error')).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('W2 config save / load + deleted notice', () => {
  const ownerId = 'w2-config-user';

  beforeEach(() => {
    localStorage.clear();
    mockList.mockReset();
    mockList.mockResolvedValue([
      makeEntry({ id: '11111111-1111-4111-8111-111111111111', title: '仍在' }),
    ]);
    localStorage.setItem(
      `hk-cantonese-settings:${ownerId}`,
      JSON.stringify({
        settings: {
          ...DEFAULT_SETTINGS,
          selectedCaseLibraryIds: [
            '11111111-1111-4111-8111-111111111111',
            '99999999-9999-4999-8999-999999999999',
          ],
        },
      }),
    );
  });

  it('saves selectedCaseLibraryIds in config and prunes deleted on load with notice', async () => {
    function Tracker() {
      const { state } = React.useContext(AppContext);
      return (
        <div>
          <span data-testid="active-case-ids">
            {(state.settings.selectedCaseLibraryIds ?? []).join(',')}
          </span>
          <span data-testid="saved-case-ids">
            {(state.savedConfigs[0]?.selectedCaseLibraryIds ?? []).join(',')}
          </span>
        </div>
      );
    }

    render(
      <AppProvider ownerId={ownerId}>
        <Tracker />
        <CaseLibraryPanel />
        <ConfigManager />
      </AppProvider>,
    );

    // Notice is inside the expandable body; expand first
    await waitFor(() => {
      expect(screen.getByTestId('case-library-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('case-library-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('case-library-notice')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('case-library-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('case-library-notice')).toHaveTextContent('已忽略');
    });
    await waitFor(() => {
      expect(screen.getByTestId('active-case-ids')).toHaveTextContent(
        '11111111-1111-4111-8111-111111111111',
      );
    });

    fireEvent.click(screen.getByText('+ 储存当前配置'));
    // ConfigManager save name is the last textbox after opening save form
    const textboxes = screen.getAllByRole('textbox');
    const nameInput = textboxes[textboxes.length - 1]!;
    fireEvent.change(nameInput, { target: { value: '带案例配置' } });
    fireEvent.click(screen.getByText('储存'));

    await waitFor(() => {
      expect(screen.getByTestId('saved-case-ids')).toHaveTextContent(
        '11111111-1111-4111-8111-111111111111',
      );
    });
  });
});

describe('W2 settings / history / generate boundary', () => {
  it('normalizeSettings defaults selectedCaseLibraryIds', () => {
    const n = normalizeSettings({ platform: 'all', tone: '穩妥' });
    expect(n.selectedCaseLibraryIds).toEqual([]);
  });

  it('history workbench restore keeps case library IDs only', () => {
    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: 'j1',
      ownerId: 'u1',
      idempotencyKey: 'k1',
      status: 'completed',
      source: '原文',
      platform: 'all',
      tone: '穩妥',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 1,
      inputLanguage: 'mandarin',
      brandName: null,
      productName: null,
      brandRedLines: null,
      brief: {
        workbenchSettings: {
          ...DEFAULT_SETTINGS,
          selectedCaseLibraryIds: ['11111111-1111-4111-8111-111111111111'],
        },
      },
      diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
      variants: {
        standardHK: 'a',
        lightCantonese: 'b',
        ig: 'c',
        facebook: 'd',
        shorts: 'e',
      },
      audit: {
        thermometer: { overall: 80, dimensions: {} as never },
        issues: [],
        replacements: [],
        risks: [],
        comments: [],
      },
      scores: null,
      consumerFeedback: null,
      variantMeta: null,
      generationEngine: 'rules',
      errorMessage: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      deletedAt: null,
    };

    const restored = buildWorkbenchSnapshotFromHistory(job);
    expect(restored.snapshot?.settings.selectedCaseLibraryIds).toEqual([
      '11111111-1111-4111-8111-111111111111',
    ]);
    // no case body blob fields on snapshot settings
    expect(JSON.stringify(restored.snapshot?.settings)).not.toContain('caseLibraryEntries');
  });

  it('InputPanel wires CaseLibraryPanel near ReferenceCaseSelector in audience group', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const file = path.resolve(process.cwd(), 'src/components/input/InputPanel.tsx');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain('CaseLibraryPanel');
    expect(src).toContain('ReferenceCaseSelector');
    expect(src).toContain('ConfigManager');
    // CaseLibrary sits between reference cases and config manager
    const refIdx = src.indexOf('<ReferenceCaseSelector');
    const caseIdx = src.indexOf('<CaseLibraryPanel');
    const cfgIdx = src.indexOf('<ConfigManager');
    expect(refIdx).toBeGreaterThan(-1);
    expect(caseIdx).toBeGreaterThan(refIdx);
    expect(cfgIdx).toBeGreaterThan(caseIdx);
    // Accordion layout is authorized; groups keep all three components
    expect(src).toContain('目标受众与参考');
    expect(src).toContain('配置管理');
  });

  it('saved config shape retains selectedCaseLibraryIds', () => {
    const config: SavedConfig = {
      id: 'cfg1',
      name: 'w2',
      brandName: '',
      productName: '',
      brandRedLines: '',
      structuredBriefEnabled: false,
      creativityLevel: 1,
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      tone: '穩妥',
      platform: 'all',
      inputLanguage: 'mandarin',
      consumerPersonas: [],
      selectedCaseLibraryIds: ['a', 'b'],
      createdAt: new Date().toISOString(),
    };
    const n = normalizeSettings(config as unknown as Record<string, unknown>);
    expect(n.selectedCaseLibraryIds).toEqual(['a', 'b']);
  });
});

describe('W2/W3 does not put case body into generate client path', () => {
  it('useGenerate sends selectedCaseLibraryIds only — never case body/reason', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const file = path.resolve(process.cwd(), 'src/hooks/useGenerate.ts');
    const src = fs.readFileSync(file, 'utf8');
    expect(src).not.toMatch(/caseLibraryEntries|listCaseLibrary|caseLibraryApi/);
    // W3: explicit top-level IDs
    expect(src).toContain('selectedCaseLibraryIds');
    // referenceCases still for bookmarks
    expect(src).toContain('referenceCases');
    // workbenchSettings carries full settings (IDs ok; bodies not loaded into generate)
    expect(src).toContain('workbenchSettings: state.settings');
    // Must not construct body/reason fields for generate payload
    expect(src).not.toMatch(/body:\s*.*case|reason:\s*.*case|caseType:\s*.*case/i);
  });
});
