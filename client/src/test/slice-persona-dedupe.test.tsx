/**
 * Slice B: Preset consumer persona templates must not duplicate on re-click
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, type ReactNode } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import PersonaManager from '../components/input/PersonaManager';
import { personaTemplateFingerprint } from '../components/input/PersonaManager';

const mocks = vi.hoisted(() => ({
  authApiFetch: vi.fn(),
}));

vi.mock('../services/api', () => ({
  authApiFetch: mocks.authApiFetch,
}));

const OWNER_ID = 'persona-dedupe-user';

function AppWrapper({ children }: { children: ReactNode }) {
  return <AppProvider ownerId={OWNER_ID}>{children}</AppProvider>;
}

function CountHarness() {
  const { state } = useContext(AppContext);
  return (
    <>
      <span data-testid="persona-count">{state.settings.consumerPersonas.length}</span>
      <ul data-testid="persona-names">
        {state.settings.consumerPersonas.map((p) => (
          <li key={p.id}>{p.name || '(empty)'}</li>
        ))}
      </ul>
      <PersonaManager />
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('PersonaManager preset dedupe', () => {
  async function expand() {
    await userEvent.click(screen.getByRole('button', { name: /目标消费者画像/ }));
  }

  it('places the expand indicator after the label', () => {
    render(<CountHarness />, { wrapper: AppWrapper });

    expect(screen.getByRole('button', { name: /目标消费者画像/ })).toHaveTextContent(
      /目标消费者画像（可选）\s*▶/,
    );
  });

  it('clicking the same preset twice keeps a single entry', async () => {
    render(<CountHarness />, { wrapper: AppWrapper });
    await expand();

    const addMay = screen.getByRole('button', { name: /本地师奶阿May/ });
    await userEvent.click(addMay);
    await userEvent.click(addMay);

    expect(screen.getByTestId('persona-count')).toHaveTextContent('1');
    expect(screen.getByText('该示例已加入')).toBeInTheDocument();
    const names = within(screen.getByTestId('persona-names')).getAllByText('本地师奶阿May');
    expect(names).toHaveLength(1);
  });

  it('different presets can each be added once', async () => {
    render(<CountHarness />, { wrapper: AppWrapper });
    await expand();

    await userEvent.click(screen.getByRole('button', { name: /本地师奶阿May/ }));
    await userEvent.click(screen.getByRole('button', { name: /职场白领Jason/ }));

    expect(screen.getByTestId('persona-count')).toHaveTextContent('2');
  });

  it('after remove, the same preset can be added again', async () => {
    render(<CountHarness />, { wrapper: AppWrapper });
    await expand();

    await userEvent.click(screen.getByRole('button', { name: /本地师奶阿May/ }));
    expect(screen.getByTestId('persona-count')).toHaveTextContent('1');

    // Remove first persona card
    const removeButtons = screen.getAllByRole('button', { name: '✕' });
    await userEvent.click(removeButtons[0]);
    expect(screen.getByTestId('persona-count')).toHaveTextContent('0');

    await userEvent.click(screen.getByRole('button', { name: /本地师奶阿May/ }));
    expect(screen.getByTestId('persona-count')).toHaveTextContent('1');
  });

  it('custom empty personas are not blocked by preset dedupe', async () => {
    render(<CountHarness />, { wrapper: AppWrapper });
    await expand();

    await userEvent.click(screen.getByRole('button', { name: '+ 自定义' }));
    await userEvent.click(screen.getByRole('button', { name: '+ 自定义' }));

    expect(screen.getByTestId('persona-count')).toHaveTextContent('2');
  });

  it('AI parsing appends exactly one new persona without replacing existing personas', async () => {
    mocks.authApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        personas: [
          { name: 'AI 阿晴', ageRange: '25-34', occupation: '设计师', habits: '爱逛展', apps: 'IG', notes: '重视审美' },
          { name: '不应出现', ageRange: '35-44', occupation: '', habits: '', apps: '', notes: '' },
        ],
      }),
    } as Response);

    render(<CountHarness />, { wrapper: AppWrapper });
    await expand();
    await userEvent.click(screen.getByRole('button', { name: /本地师奶阿May/ }));

    expect(screen.getByText(/每次只生成 1 个人设/)).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText('描述你的目标消费者，任意格式都得...'),
      '二十八岁香港设计师，喜欢周末逛展览和在 Instagram 分享生活',
    );
    await userEvent.click(screen.getByRole('button', { name: /AI 智能解析/ }));

    expect(screen.getByTestId('persona-count')).toHaveTextContent('2');
    expect(screen.getByTestId('persona-names')).toHaveTextContent('本地师奶阿May');
    expect(screen.getByTestId('persona-names')).toHaveTextContent('AI 阿晴');
    expect(screen.getByTestId('persona-names')).not.toHaveTextContent('不应出现');
  });

  it('fingerprint is stable for identical template fields', () => {
    const a = {
      name: 'X',
      ageRange: '20',
      occupation: 'o',
      habits: 'h',
      apps: 'a',
      notes: 'n',
    };
    expect(personaTemplateFingerprint(a)).toBe(personaTemplateFingerprint({ ...a }));
    expect(personaTemplateFingerprint(a)).not.toBe(
      personaTemplateFingerprint({ ...a, notes: 'other' }),
    );
  });
});
