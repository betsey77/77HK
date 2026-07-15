/**
 * Slice E: PricingPage (/pricing)
 *
 * ⚠️ MOCK — displays plan comparison. No real payment is initiated.
 * All prices, quotas, and features are for demonstration only.
 */

import { useEffect, useState } from 'react';
import { Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { FREE_PLAN, PRO_PLAN, type PlanInfo } from '../types';
import TeamContactDialog from '../components/marketing/TeamContactDialog';

const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 light:bg-orange-500 light:text-white light:hover:bg-orange-600 light:focus-visible:ring-orange-500 light:focus-visible:ring-offset-white';

const secondaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-900/60 px-5 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 light:border-gray-300 light:bg-white light:text-gray-700 light:hover:bg-gray-100';

export default function PricingPage() {
  const [teamContactOpen, setTeamContactOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('hk-cantonese-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('hk-cantonese-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-gray-950 light:bg-white text-gray-100 light:text-gray-900">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 light:border-gray-200">
        <a href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-black">
            <img
              src="/brand/77-logo.png"
              alt=""
              className="h-full w-full scale-[1.035] object-cover"
            />
          </span>
          <div>
            <h1 className="text-sm font-bold tracking-tight">77港话通社媒文案器</h1>
            <p className="text-[10px] text-gray-600 light:text-gray-500">HK Cantonese Social Copywriter</p>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            className="rounded p-1.5 text-gray-500 hover:text-gray-300 light:hover:text-gray-700"
            aria-label="切换主题"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <a href="/login" className={secondaryButton}>登录</a>
          <a href="/signup" className={primaryButton}>免费注册</a>
        </div>
      </header>

      {/* ── Payment availability ── */}
      <div className="mx-auto mt-4 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
        <p className="flex items-center justify-center gap-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Pro 在线支付暂未开放；团队协作版通过微信联系人工开通，本站不会自动扣款。</span>
        </p>
      </div>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-400 light:text-orange-600">
          PRICING
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          简单透明的套餐
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-400 light:text-gray-600">
          从免费开始，按需升级。所有套餐包含完整的诊断、生成、审核和反馈功能。
        </p>
      </section>

      {/* ── Plan Cards ── */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <PlanCard plan={FREE_PLAN} theme={theme} isPrimary={false} />
          <PlanCard plan={PRO_PLAN} theme={theme} isPrimary={true} />
          <TeamPlanCard theme={theme} onContact={() => setTeamContactOpen(true)} />
        </div>

        {/* ── FAQ ── */}
        <div className="mt-16 border-t border-gray-800 light:border-gray-200 pt-12">
          <h3 className="text-lg font-semibold text-center mb-8">常见问题</h3>
          <dl className="max-w-2xl mx-auto space-y-6">
            {[
              ['Free 的 20 次是什么概念？', '每滚动 7 天内可完成最多 20 次完整生成流程（诊断→变体→审核→反馈）。到达上限后需等待周期刷新，或升级到 Pro。'],
              ['Pro 每月 250 次够用吗？', '按每个工作日生成约 11 篇文案计算，250 次可覆盖高频品牌运营的月度需求。自然月结束时自动重置。'],
              ['现在可以付费吗？', 'Pro 在线支付暂未开放。点击「升级到 Pro」可查看结算页面；正式支付开放前不会产生真实扣款。团队协作版通过微信联系人工开通。'],
              ['可以随时取消吗？', 'Pro 为月度订阅，MVP 阶段不支持降级到 Free。正式支付上线后将提供完整的自助管理功能。'],
              ['数据安全吗？', '我们使用 Supabase 提供数据隔离和 RLS 保护，你的文案和品牌数据只有你自己能访问。'],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="text-sm font-semibold text-gray-200 light:text-gray-800">{q}</dt>
                <dd className="mt-1 text-sm text-gray-400 light:text-gray-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 light:border-gray-200 px-4 py-6 text-center text-xs text-gray-600 light:text-gray-400">
        <p>© 2026 77港话通社媒文案器</p>
      </footer>
      <TeamContactDialog open={teamContactOpen} onClose={() => setTeamContactOpen(false)} />
    </div>
  );
}

function TeamPlanCard({ theme, onContact }: { theme: string; onContact: () => void }) {
  const dark = theme === 'dark';
  const features = ['审核分组', '管理员句子批注', '待审核队列与提醒'];

  return (
    <div className={`relative flex flex-col rounded-xl border-2 p-6 ${
      dark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-white'
    }`}>
      <h3 className="text-lg font-bold">团队协作版</h3>
      <p className="text-xs text-gray-500 light:text-gray-400">Team · 每自然月</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold">¥99</span>
        <span className="text-sm text-gray-500 light:text-gray-400">/月</span>
      </div>
      <p className="mt-1 text-xs text-gray-500 light:text-gray-400">人工联系开通</p>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <span className="text-gray-300 light:text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onContact}
        aria-label="联系开通团队协作版"
        className={`mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 px-5 text-sm font-semibold transition-colors ${
          dark
            ? 'border-gray-700 text-gray-200 hover:border-emerald-500 hover:text-emerald-300'
            : 'border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600'
        }`}
      >
        联系开通 <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-3 text-center text-[10px] text-gray-500">微信联系，非在线扣款</p>
    </div>
  );
}

/** Single plan card */
function PlanCard({ plan, theme, isPrimary }: { plan: PlanInfo; theme: string; isPrimary: boolean }) {
  const dark = theme === 'dark';

  return (
    <div
      className={`relative rounded-xl border-2 p-6 flex flex-col ${
        isPrimary
          ? dark
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-orange-500/50 bg-orange-50'
          : dark
            ? 'border-gray-700 bg-gray-900/40'
            : 'border-gray-200 bg-white'
      }`}
    >
      {isPrimary && (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-semibold ${
          dark ? 'bg-emerald-500 text-gray-950' : 'bg-orange-500 text-white'
        }`}>
          推荐
        </span>
      )}

      {/* Plan name */}
      <h3 className="text-lg font-bold">{plan.nameZh}</h3>
      <p className="text-xs text-gray-500 light:text-gray-400">{plan.name} · {plan.cycleDescription}</p>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold">¥{plan.priceCny}</span>
        {plan.priceCny > 0 && (
          <span className="text-sm text-gray-500 light:text-gray-400">/月</span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500 light:text-gray-400">
        {plan.quotaPerCycle} 次生成{plan.priceCny === 0 ? ' / 7天' : ' / 月'}
      </p>

      {/* Features */}
      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${
              isPrimary
                ? dark ? 'text-emerald-400' : 'text-orange-500'
                : 'text-gray-500'
            }`} />
            <span className="text-gray-300 light:text-gray-700">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {plan.priceCny === 0 ? (
        <a href="/signup?next=%2Fapp" className={`mt-8 flex items-center justify-center gap-2 rounded-md border-2 py-3 text-sm font-semibold transition-colors ${
          dark
            ? 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-gray-100'
            : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900'
        }`}>
          免费开始 <ArrowRight className="h-4 w-4" />
        </a>
      ) : (
        <a href="/login?next=%2Fapp%2Fbilling" className={`mt-8 inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors ${
          dark
            ? 'bg-emerald-400 text-gray-950 hover:bg-emerald-300'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}>
          升级到 Pro <ArrowRight className="h-4 w-4" />
        </a>
      )}

    </div>
  );
}
