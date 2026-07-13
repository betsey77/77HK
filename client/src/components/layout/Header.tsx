import { useContext } from 'react';
import { Star, Clock } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import HeaderMenu from './HeaderMenu';

interface HeaderProps {
  onLogout?: () => void;
  userEmail?: string | null;
  onOpenFeedback?: () => void;
}

export default function Header({ onLogout, userEmail, onOpenFeedback }: HeaderProps) {
  const { state } = useContext(AppContext);

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 light:border-gray-200 bg-gray-950 light:bg-white shrink-0">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-2">
        <a href="/" className="flex h-8 shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500" aria-label="返回官网首页">
          <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-black">
            <img
              src="/brand/77-logo.png"
              alt=""
              className="h-full w-full scale-[1.035] object-cover"
            />
          </span>
        </a>
        <div>
          <h1 className="text-sm font-bold text-gray-100 light:text-gray-900 tracking-tight">
            77港话通社媒文案器
          </h1>
          <p className="text-[10px] text-gray-600 light:text-gray-500 -mt-0.5">
            HK Cantonese Social Copywriter
          </p>
        </div>
      </div>

      {/* Right: High-frequency actions + engine status + menu */}
      <div className="flex items-center gap-2">
        {/* History */}
        <a
          href="/app/history"
          className="flex min-h-7 items-center gap-1.5 rounded px-2 text-[10px] text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-200 light:hover:text-gray-800"
          title="生成历史"
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">历史</span>
        </a>

        {/* Favorites button */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('toggle-favorites'));
          }}
          className="relative flex items-center gap-1.5 text-[10px] px-2 py-1 rounded text-gray-500 hover:text-amber-400 light:hover:text-amber-600 hover:bg-gray-800 light:hover:bg-gray-200 transition-colors cursor-pointer"
          title="文案收藏库"
        >
          <Star className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">收藏库</span>
          {state.bookmarkedCopies.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-amber-500 text-[8px] text-black font-bold px-0.5">
              {state.bookmarkedCopies.length}
            </span>
          )}
        </button>

        {/* Engine status indicator (compact) */}
        {state.generationEngine === 'self-hosted-cantonese' ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400" title="本地 4B 模型">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden lg:inline">本地 4B</span>
          </span>
        ) : state.generationEngine === 'featherless-cantonese' ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400" title="CantoneseLLMChat 32B">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="hidden lg:inline">32B</span>
          </span>
        ) : state.generationEngine === 'deepseek' ? (
          <span className="flex items-center gap-1 text-[10px] text-gray-500" title="DeepSeek">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <span className="hidden lg:inline">DeepSeek</span>
          </span>
        ) : state.generationEngine === 'rules' ? (
          <span className="flex items-center gap-1 text-[10px] text-amber-400" title="快速规则引擎">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="hidden lg:inline">规则</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-gray-600" title="待命">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
            <span className="hidden lg:inline">待命</span>
          </span>
        )}

        {/* Account / More menu */}
        <HeaderMenu userEmail={userEmail} onLogout={onLogout} onOpenFeedback={onOpenFeedback} />
      </div>
    </header>
  );
}
