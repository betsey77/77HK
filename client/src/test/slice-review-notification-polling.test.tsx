import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from '../hooks/useVisiblePolling';

function PollHarness({ task, enabled = true }: {
  task: () => Promise<boolean | void>;
  enabled?: boolean;
}) {
  useVisiblePolling(task, enabled);
  return null;
}

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('审核通知可见页面轮询', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('可见时每 15 秒执行，隐藏暂停，重新可见和 focus 立即执行', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    render(<PollHarness task={task} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
    expect(task).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(task).toHaveBeenCalledTimes(1);

    act(() => setVisibility('hidden'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(task).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));
    expect(task).toHaveBeenCalledTimes(2);

    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('失败后按 15/30/60 秒退避，成功后恢复 15 秒', async () => {
    const task = vi.fn()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce(false)
      .mockResolvedValue(undefined);
    render(<PollHarness task={task} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(task).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
    expect(task).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(task).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(task).toHaveBeenCalledTimes(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(task).toHaveBeenCalledTimes(5);
  });

  it('卸载后清理 timer 和事件监听', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const view = render(<PollHarness task={task} />);
    view.unmount();

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    window.dispatchEvent(new Event('focus'));
    expect(task).not.toHaveBeenCalled();
  });
});
