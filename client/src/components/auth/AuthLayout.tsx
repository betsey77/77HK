import { useEffect, useState, type ReactNode } from 'react';
import { Sun, Moon, Layers, ShieldCheck, MessageSquareText } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Shared left-right split layout for auth pages.
 * Visual language aligns with MarketingPage (restrained dark tech) without copying marketing copy.
 * Left: compact brand + ≤3 capabilities. Right: form card (children).
 */

interface AuthLayoutProps {
  children: ReactNode;
  variant?: 'default' | 'login-v4';
}

const CAPABILITIES = [
  { icon: Layers, label: '五平台变体一次生成' },
  { icon: ShieldCheck, label: '审核评分与安全门禁' },
  { icon: MessageSquareText, label: '消费者反馈视角' },
] as const;

export default function AuthLayout({ children, variant = 'default' }: AuthLayoutProps) {
  const { isDark, toggleTheme } = useTheme();
  const [loginPhrase, setLoginPhrase] = useState('77港话通\n社媒文案器');

  useEffect(() => {
    if (variant !== 'login-v4') return;
    const root = document.documentElement;
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let targetX = 0.32;
    let targetY = 0.48;
    let currentX = 0.32;
    let currentY = 0.48;
    let frame = 0;
    const applyPointer = () => {
      currentX += (targetX - currentX) * 0.07;
      currentY += (targetY - currentY) * 0.07;
      root.style.setProperty('--mx', currentX.toFixed(4));
      root.style.setProperty('--my', currentY.toFixed(4));
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = window.requestAnimationFrame(applyPointer);
      } else {
        frame = 0;
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX / Math.max(window.innerWidth, 1);
      targetY = event.clientY / Math.max(window.innerHeight, 1);
      if (!frame) frame = window.requestAnimationFrame(applyPointer);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty('--mx');
      root.style.removeProperty('--my');
    };
  }, [variant]);

  useEffect(() => {
    if (
      variant !== 'login-v4'
      || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) return;
    const phrases = ['77港话通\n社媒文案器', '港式语气\n一次出稿', '五平台\n一键生成'];
    let phraseIndex = 0;
    let characterIndex = (phrases[0] ?? '').length;
    let deleting = true;
    let timer = 0;
    const tick = () => {
      const phrase = phrases[phraseIndex] ?? phrases[0] ?? '';
      characterIndex += deleting ? -1 : 1;
      setLoginPhrase(phrase.slice(0, Math.max(characterIndex, 0)));
      if (!deleting && characterIndex >= phrase.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1450);
      } else if (deleting && characterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timer = window.setTimeout(tick, 280);
      } else {
        timer = window.setTimeout(tick, deleting ? 46 : 88);
      }
    };
    timer = window.setTimeout(tick, 1400);
    return () => window.clearTimeout(timer);
  }, [variant]);

  if (variant === 'login-v4') {
    return (
      <div className="login-v4-root">
        <div className="toolbar" role="toolbar" aria-label="登录导航">
          <strong>登录</strong><span className="sep" aria-hidden="true" /><a className="link" href="/">← 返回首页</a>
        </div>
        <div className="veil" aria-label="登录页品牌背景">
          <div className="veil-parallax"><div className="veil-mesh" /><div className="veil-bloom-soft" /><div className="veil-flowers" /></div>
          <div className="veil-soften" /><div className="veil-grain" /><div className="veil-read" />
        </div>
        <div className="page">
          <div className="page-main">
            <section className="hero">
              <div className="hero-inner">
                <div className="logo-row"><span className="logo-box"><img src="/brand/77-logo.png" alt="" /></span><span>77 港话通</span></div>
                <div className="type-wrap" aria-live="polite"><h1 className="type-title"><span className="type-text">{loginPhrase}</span><span className="caret" aria-hidden="true" /></h1></div>
                <p className="tagline"><span className="hl">HK Cantonese Social Copywriter</span></p>
              </div>
            </section>
            <section className="auth"><div className="panel">{children}</div></section>
          </div>
          <footer className="site-foot">
            <p className="admin-line">需要团队管理员权限，请联系<a className="tel" href="tel:18595680518">VX&amp;Tel: 18595680518</a></p>
            <p className="credit">团队协作版 ¥99/月 · 人工确认后开通</p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-full overflow-hidden ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Restrained brand glow — no extra color system beyond the design tokens. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {isDark ? (
          <>
            <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-emerald-400/5 blur-3xl" />
          </>
        ) : (
          <>
            <div className="absolute -right-20 top-1/3 h-56 w-56 rounded-full bg-orange-400/10 blur-3xl" />
          </>
        )}
      </div>

      {/* Top bar: back to marketing + theme */}
      <div className="relative z-20 flex items-center justify-between border-b border-white/10 px-5 py-3.5 light:border-black/10 lg:px-8">
        <a
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500"
          aria-label="77港话通社媒文案器首页"
        >
          <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-black">
            <img
              src="/brand/77-logo.png"
              alt=""
              className="h-full w-full scale-[1.035] object-cover"
            />
          </span>
          <strong className={`truncate text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            77港话通社媒文案器
          </strong>
        </a>
        <button
          type="button"
          onClick={toggleTheme}
          className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors ${
            isDark
              ? 'text-gray-500 hover:bg-white/10 hover:text-gray-200'
              : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500`}
          aria-label={isDark ? '切换至亮色模式' : '切换至暗色模式'}
          title={isDark ? '切换至亮色模式' : '切换至暗色模式'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Main: left brand / right form */}
      <div className="relative z-10 grid min-h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.05fr_1fr]">
        {/* LEFT — compact brand */}
        <div className="flex flex-col justify-center px-6 py-10 md:p-12 lg:px-16 lg:py-16">
          <div className="max-w-md">
            <span className="mb-5 flex h-12 w-12 overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
              <img
                src="/brand/77-logo.png"
                alt=""
                className="h-full w-full scale-[1.035] object-cover"
              />
            </span>
            <h1 className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl light:from-orange-600 light:to-amber-500">
              77港话通社媒文案器
            </h1>
            <p
              className={`mt-1.5 text-xs font-medium tracking-[0.12em] uppercase md:text-sm ${
                isDark ? 'text-emerald-400/80' : 'text-orange-600/80'
              }`}
            >
              HK Cantonese Social Copywriter
            </p>
            <ul className="mt-8 space-y-3">
              {CAPABILITIES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  data-testid="auth-capability"
                  className={`flex items-center gap-3 text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isDark
                        ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                        : 'bg-orange-50 text-orange-600 ring-1 ring-orange-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RIGHT — form panel */}
        <div className="flex flex-col justify-center px-6 pb-12 pt-2 md:p-12 lg:p-16">
          <div
            className={`w-full max-w-md md:ml-auto ${
              isDark
                ? 'md:rounded-2xl md:bg-white/[0.04] md:p-9 md:shadow-[0_24px_64px_-28px_rgba(0,0,0,0.65)] md:ring-1 md:ring-white/10 md:backdrop-blur-xl'
                : 'md:rounded-2xl md:bg-white md:p-9 md:shadow-sm md:ring-1 md:ring-black/5'
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
