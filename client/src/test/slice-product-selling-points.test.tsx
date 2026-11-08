import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import ProductSellingPointsInput from '../components/input/ProductSellingPointsInput';

const mocks = vi.hoisted(() => ({
  localizeSellingPoint: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  localizeSellingPoint: mocks.localizeSellingPoint,
}));

const OWNER_ID = 'selling-points-user';

function Harness() {
  const { state } = useContext(AppContext);
  return (
    <>
      <pre data-testid="selling-points-state">
        {JSON.stringify(state.settings.productSellingPoints)}
      </pre>
      <ProductSellingPointsInput />
    </>
  );
}

function renderInput() {
  return render(
    <AppProvider ownerId={OWNER_ID}>
      <Harness />
    </AppProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('产品卖点输入与港化', () => {
  it('新增卖点后调用鉴权 API，并同时保留原文与港话表达', async () => {
    mocks.localizeSellingPoint.mockResolvedValue('真係夠輕身，拎出街都唔使煩');
    renderInput();

    await userEvent.type(
      screen.getByPlaceholderText('输入一条产品卖点（最多 200 字）'),
      '轻便易携带',
    );
    await userEvent.click(screen.getByRole('button', { name: '添加并港化' }));

    await waitFor(() => expect(screen.getByText('真係夠輕身，拎出街都唔使煩')).toBeInTheDocument());
    expect(screen.getByText('轻便易携带')).toBeInTheDocument();
    expect(mocks.localizeSellingPoint).toHaveBeenCalledWith('轻便易携带');
    expect(screen.getByTestId('selling-points-state')).toHaveTextContent('"status":"ready"');
  });

  it('港化失败时保留原文，并可重试成功和删除', async () => {
    mocks.localizeSellingPoint
      .mockRejectedValueOnce(new Error('模型暂时不可用'))
      .mockResolvedValueOnce('朝早用都夠方便');
    renderInput();

    await userEvent.type(
      screen.getByPlaceholderText('输入一条产品卖点（最多 200 字）'),
      '早上使用方便',
    );
    await userEvent.click(screen.getByRole('button', { name: '添加并港化' }));

    await waitFor(() => expect(screen.getByText('港化失败，可重试')).toBeInTheDocument());
    expect(screen.getByText('早上使用方便')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重试港化' }));
    await waitFor(() => expect(screen.getByText('朝早用都夠方便')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '删除卖点' }));
    expect(screen.queryByText('早上使用方便')).not.toBeInTheDocument();
  });

  it('拒绝超过 200 字的输入，并在已有 10 条时禁止继续添加', async () => {
    renderInput();
    const input = screen.getByPlaceholderText('输入一条产品卖点（最多 200 字）');

    fireEvent.change(input, { target: { value: '卖'.repeat(201) } });
    fireEvent.click(screen.getByRole('button', { name: '添加并港化' }));
    expect(screen.getByText('每条卖点最多 200 字')).toBeInTheDocument();
    expect(mocks.localizeSellingPoint).not.toHaveBeenCalled();

    const points = Array.from({ length: 10 }, (_, index) => ({
      id: `point-${index}`,
      sourceText: `卖点 ${index + 1}`,
      cantoneseText: `賣點 ${index + 1}`,
      status: 'ready',
    }));
    localStorage.setItem(
      `hk-cantonese-settings:${OWNER_ID}`,
      JSON.stringify({ settings: { productSellingPoints: points } }),
    );

    render(
      <AppProvider ownerId={OWNER_ID}>
        <ProductSellingPointsInput />
      </AppProvider>,
    );
    expect(screen.getByText('已达 10 条上限')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '删除卖点' })).toHaveLength(10);
  });
});
