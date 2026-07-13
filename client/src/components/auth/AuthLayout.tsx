import { type ReactNode } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Shared left-right split layout for auth pages.
 * Ported from 总览/src/routes/login.tsx visual structure.
 * Left: brand / hero area. Right: form card.
 * Theme comes from ThemeContext — single source of truth.
 */

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { theme, isDark, toggleTheme } = useTheme();




  return (
    <div className={`relative min-h-full overflow-hidden ${isDark ? 'auth-bg-animate text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* ================================================================
           Dark mode: CSS animated gradient (DarkVeil approximation)
           Light mode: clean white/gray background
           ================================================================ */}
      {isDark && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          {/* Emulate DarkVeil with layered gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-transparent to-gray-950/60" />
          {/* Fade overlay: horizontal on desktop, vertical on mobile */}
          <div
            className="absolute inset-0 md:hidden"
            style={{
              background:
                'linear-gradient(180deg, rgba(10,15,10,0) 0%, rgba(10,15,10,0.1) 30%, rgba(10,15,10,0.55) 60%, rgba(10,15,10,0.9) 88%, rgba(10,15,10,1) 100%)',
            }}
          />
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(10,15,10,0) 0%, rgba(10,15,10,0.05) 35%, rgba(10,15,10,0.6) 60%, rgba(10,15,10,0.95) 80%, rgba(10,15,10,1) 100%)',
            }}
          />
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 py-4 lg:px-8">
        <a
          href="/"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500"
          aria-label="77港话通社媒文案器首页"
        >
          <strong className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            77港话通社媒文案器
          </strong>
        </a>
        <button
          type="button"
          onClick={toggleTheme}
          className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors ${
            isDark
              ? 'text-gray-500 hover:bg-white/10 hover:text-gray-200'
              : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500`}
          aria-label={isDark ? '切换至亮色模式' : '切换至暗色模式'}
          title={isDark ? '切换至亮色模式' : '切换至暗色模式'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Main content: left-right split */}
      <div className="relative z-10 grid min-h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — brand / hero */}
        <div className="flex flex-col justify-end px-6 pt-20 md:justify-center md:p-12 lg:p-20 xl:p-28">
          <div className="max-w-xl">
            <h1
              className={`tracking-tight leading-[0.98] text-5xl font-black md:text-[clamp(3rem,5.5vw,5.5rem)] md:leading-[0.95] [text-wrap:balance] ${
                isDark ? 'text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]' : 'text-gray-900'
              }`}
            >
              77港话通社媒文案器
            </h1>
            <p
              className={`mt-3 whitespace-nowrap text-sm font-semibold tracking-wide md:mt-6 md:text-lg ${
                isDark ? 'text-white/80' : 'text-gray-600'
              }`}
            >
              HK Cantonese Social Copywriter
            </p>
          </div>
        </div>

        {/* RIGHT — form panel */}
        <div className="flex flex-col justify-center px-6 pb-10 pt-2 md:p-12 lg:p-16">
          <div
            className={`w-full max-w-md md:ml-auto ${
              isDark
                ? 'md:rounded-3xl md:bg-white/[0.04] md:backdrop-blur-2xl md:ring-1 md:ring-white/10 md:p-10 md:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]'
                : 'md:rounded-3xl md:bg-white md:ring-1 md:ring-gray-200 md:p-10 md:shadow-sm'
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
