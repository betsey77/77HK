import fs from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketingPage from '../components/marketing/MarketingPage';
import PricingPage from '../pages/PricingPage';

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  localStorage.clear();
});

describe('Team plan contact flow', () => {
  it('ships the project-owned WeChat QR asset', () => {
    const qrPath = path.resolve(process.cwd(), 'public/brand/wechat-team-contact-qr.png');
    expect(fs.existsSync(qrPath)).toBe(true);
    expect(fs.statSync(qrPath).size).toBeGreaterThan(10_000);
  });

  it('shows the monthly team offer on Pricing without a payment link', async () => {
    const user = userEvent.setup();
    render(<PricingPage />);

    expect(screen.getByRole('heading', { name: '团队协作版' })).toBeInTheDocument();
    expect(screen.getByText('¥99')).toBeInTheDocument();
    expect(screen.getByText('审核分组')).toBeInTheDocument();
    expect(screen.getByText('管理员句子批注')).toBeInTheDocument();
    expect(screen.getByText('待审核队列与提醒')).toBeInTheDocument();

    const contactButton = screen.getByRole('button', { name: '联系开通团队协作版' });
    expect(contactButton.closest('a')).toBeNull();
    await user.click(contactButton);

    const dialog = screen.getByRole('dialog', { name: '联系开通团队协作版' });
    expect(within(dialog).getByText('vx：18595680518')).toBeInTheDocument();
    expect(within(dialog).getByAltText('团队协作版微信联系二维码')).toHaveAttribute(
      'src',
      '/brand/wechat-team-contact-qr.png',
    );
    expect(dialog).toHaveTextContent('不会发起支付宝付款');
  });

  it('copies the WeChat ID and reports success', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<PricingPage />);

    await user.click(screen.getByRole('button', { name: '联系开通团队协作版' }));
    await user.click(screen.getByRole('button', { name: '复制微信号' }));

    expect(writeText).toHaveBeenCalledWith('18595680518');
    expect(await screen.findByText('已复制微信号')).toBeInTheDocument();
  });

  it('reports clipboard failure without closing the dialog', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    writeText.mockRejectedValueOnce(new Error('clipboard blocked'));
    render(<PricingPage />);

    await user.click(screen.getByRole('button', { name: '联系开通团队协作版' }));
    await user.click(screen.getByRole('button', { name: '复制微信号' }));

    expect(await screen.findByText('复制失败，请手动选择微信号')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '联系开通团队协作版' })).toBeInTheDocument();
  });

  it('focuses the close control and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<PricingPage />);

    await user.click(screen.getByRole('button', { name: '联系开通团队协作版' }));
    const closeButton = screen.getByRole('button', { name: '关闭联系弹窗' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '联系开通团队协作版' })).not.toBeInTheDocument();
  });

  it('opens the same contact dialog from the public homepage', async () => {
    const user = userEvent.setup();
    render(<MarketingPage />);

    expect(screen.getByRole('heading', { name: '团队协作版' })).toBeInTheDocument();
    expect(screen.getByText('¥99')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '联系开通团队协作版' }));
    expect(screen.getByRole('dialog', { name: '联系开通团队协作版' })).toBeInTheDocument();
  });
});
