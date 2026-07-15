import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  History,
  Languages,
  MessageSquareText,
  Moon,
  PanelsTopLeft,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { SHORTS_TK_LABEL } from '../../constants';
import TeamContactDialog from './TeamContactDialog';

// ============================================================
// Content (from homepage-v2 design draft)
// ============================================================

const HERO_TABS = {
  ig: {
    label: 'IG 版本',
    score: '86',
    text: '返工赶时间，都想件装备够轻、够耐用。由朝早出门到夜晚收工，都唔使成日搵充电位。你最想试边个功能？',
  },
  fb: {
    label: 'Facebook',
    score: '84',
    text: '朝早挤港铁，夜晚加班，最怕随身电量见红。新系列续航够长、机身够轻，陪你由开会到放工。限时优惠，今日仲未试过？',
  },
  std: {
    label: '标准港式',
    score: '88',
    text: '全新系列现已推出：简约设计、长效续航，切合通勤与日常所需。把握限时优惠，立即选购。',
  },
} as const;

type HeroTabKey = keyof typeof HERO_TABS;

const LAB_VARIANTS: Record<1 | 3 | 5, Record<'活泼' | '稳妥' | '街坊', string>> = {
  1: {
    活泼: '新品上线啦！设计简约、续航给力，通勤日常都合适。限时优惠，先到先得。',
    稳妥: '新品现已上线。简约设计与长效续航，适合通勤与日常使用。欢迎把握限时优惠。',
    街坊: '新品到了！外观简洁，电量够用，上班落街都得。有优惠，有兴趣就睇下。',
  },
  3: {
    活泼: '新系列嚟啦！设计够简约，续航够硬净，返工出街都掂。限时优惠，快啲嚟试！',
    稳妥: '新系列现已推出：简约设计、续航可靠，适合通勤与日常。限时优惠进行中。',
    街坊: '新货到！外形清爽，电量稳阵，返工出街都用得。有优惠，有兴趣就过嚟睇下。',
  },
  5: {
    活泼: '新系列出街喇！轻身又够续航，朝早赶车夜晚开会都唔慌。限时优惠，你试未？',
    稳妥: '全新系列现已登场：机身轻巧、续航持久，切合通勤与日常所需。欢迎把握限时优惠。',
    街坊: '新嘢到！轻身长气，返工落街都得。有优惠，识货就快手啦～',
  },
};

const PLATFORMS = {
  ig: {
    title: 'IG · 场景钩子',
    body: '返工赶时间，都想件装备够轻、够耐用。由朝早出门到夜晚收工，都唔使成日搵充电位。你最想试边个功能？',
    emoji: '📸',
    label: 'IG',
    hint: '短钩 + 互动',
  },
  fb: {
    title: 'Facebook · 故事感',
    body: '朝早挤港铁，夜晚加班，最怕随身电量见红。新系列续航够长、机身够轻，陪你由开会到放工。限时优惠，今日仲未试过？',
    emoji: '👥',
    label: 'Facebook',
    hint: '故事感',
  },
  shorts: {
    title: `${SHORTS_TK_LABEL} · 口播节奏`,
    body: '三点讲清楚：轻身、长气、限时优惠。第一秒就亮产品，第三秒丢问题：你最怕边种低电量瞬间？',
    emoji: '🎬',
    label: SHORTS_TK_LABEL,
    hint: '口播节奏',
  },
  light: {
    title: '轻粤语 · 自然夹杂',
    body: '新系列上线了，设计简洁，续航很稳，通勤日常都合适。限时优惠，有兴趣可以先试下手感。',
    emoji: '💬',
    label: '轻粤语',
    hint: '自然夹杂',
  },
  std: {
    title: '标准港式 · 稳妥繁中',
    body: '全新系列现已推出：简约设计、长效续航，切合通勤与日常所需。把握限时优惠，立即选购。',
    emoji: '✍️',
    label: '标准港式',
    hint: '稳妥繁中',
  },
} as const;

type PlatKey = keyof typeof PLATFORMS;

const WORKFLOW = [
  ['01', '诊断原文', '语言、书面腔、品牌红线一次扫清。'],
  ['02', '生成变体', '五个平台版本并行产出，节奏各异。'],
  ['03', '质量审核', '港味、适配、安全门禁打分建议。'],
  ['04', '消费者反馈', '目标画像先读一遍，再人工定稿。'],
] as const;

const FAQS = [
  [
    '和 ChatGPT 直接写有什么不同？',
    '通用模型不懂你的品牌红线与香港平台节奏。77 把诊断、多版本、审核、消费者视角串成固定工作流，并保留人工定稿权。',
  ],
  [
    '不会粤语也能用吗？',
    '可以。输入普通话或书面中文即可；用港味滑杆与审核结果理解输出差异。',
  ],
  [
    '终端日志是实时模型思考吗？',
    '不是。那是本地预估阶段状态，帮助你感知进度；真实生成以结果与错误提示为准。',
  ],
] as const;

// ============================================================
// Small helpers
// ============================================================

function useScrollReveal(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = root.querySelectorAll<HTMLElement>('[data-reveal]');
    if (reduce || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-in');
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [rootRef]);
}

function Reveal({
  children,
  className = '',
  delayMs,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      data-reveal
      className={`marketing-reveal ${className}`}
      style={delayMs != null ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function MarketingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('hk-cantonese-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [heroTab, setHeroTab] = useState<HeroTabKey>('ig');
  const [labTone, setLabTone] = useState<'活泼' | '稳妥' | '街坊'>('活泼');
  const [labLevel, setLabLevel] = useState(4);
  const [labIn, setLabIn] = useState(
    '新品正式上线！简约设计，超长续航，满足您的通勤和日常使用需求。立即购买，享受限时优惠。',
  );
  const [labOut, setLabOut] = useState('按「港化一下」生成本地 mock 结果');
  const [labTyping, setLabTyping] = useState(false);
  const [plat, setPlat] = useState<PlatKey>('ig');
  const [teamContactOpen, setTeamContactOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('hk-cantonese-theme', theme);
  }, [theme]);

  useScrollReveal(pageRef);

  function runLab() {
    const key: 1 | 3 | 5 = labLevel <= 2 ? 1 : labLevel <= 4 ? 3 : 5;
    const text = LAB_VARIANTS[key][labTone];
    setLabTyping(true);
    setLabOut('');
    let i = 0;
    const tick = () => {
      i += 1;
      if (i <= text.length) {
        setLabOut(text.slice(0, i));
        window.setTimeout(tick, 14);
      } else {
        setLabTyping(false);
      }
    };
    tick();
  }

  const hero = HERO_TABS[heroTab];
  const platData = PLATFORMS[plat];

  return (
    <div
      ref={pageRef}
      className="marketing-home min-h-full bg-[#0a0c10] text-gray-100 light:bg-[#f7f5f2] light:text-gray-900"
    >
      <style>{`
        .marketing-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1);
        }
        .marketing-reveal.is-in {
          opacity: 1;
          transform: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .marketing-reveal { opacity: 1; transform: none; transition: none; }
          .marketing-marquee { animation: none !important; }
        }
        @keyframes marketing-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marketing-marquee {
          animation: marketing-marquee 28s linear infinite;
        }
        .marketing-caret {
          display: inline-block;
          width: 7px;
          height: 1em;
          margin-left: 2px;
          vertical-align: -2px;
          background: currentColor;
          animation: marketing-caret 1s step-end infinite;
        }
        @keyframes marketing-caret {
          50% { opacity: 0; }
        }
      `}</style>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-gray-950"
      >
        跳到主要内容
      </a>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0c10]/90 backdrop-blur light:border-black/10 light:bg-[#f7f5f2]/90">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5 lg:px-6">
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
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold tracking-tight text-gray-100 light:text-gray-900">
                77港话通社媒文案器
              </strong>
              <span className="hidden text-[10px] tracking-[0.12em] text-gray-500 uppercase light:text-gray-500 sm:block">
                HK Social Copy
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-5 text-xs text-gray-400 lg:flex" aria-label="官网导航">
            <a className="transition-colors hover:text-gray-100 light:text-gray-600 light:hover:text-gray-900" href="#lab">
              港化实验室
            </a>
            <a className="transition-colors hover:text-gray-100 light:text-gray-600 light:hover:text-gray-900" href="#flow">
              工作流
            </a>
            <a className="transition-colors hover:text-gray-100 light:text-gray-600 light:hover:text-gray-900" href="#platforms">
              平台
            </a>
            <a className="transition-colors hover:text-gray-100 light:text-gray-600 light:hover:text-gray-900" href="#plans">
              套餐
            </a>
            <a className="transition-colors hover:text-gray-100 light:text-gray-600 light:hover:text-gray-900" href="/pricing">
              定价
            </a>
            <a className="transition-colors hover:text-gray-100 light:text-gray-600 light:hover:text-gray-900" href="#faq">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:border-black/10 light:text-gray-600 light:hover:bg-black/5 light:hover:text-gray-900 light:focus-visible:ring-orange-500"
              aria-label={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
              title={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a
              href="/app"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-400 px-4 text-xs font-semibold text-gray-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600 light:focus-visible:ring-orange-500"
            >
              进入工作台 <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-white/10 light:border-black/10">
          <div
            className="pointer-events-none absolute -right-20 top-0 h-[420px] w-[420px] rounded-full bg-emerald-500/15 blur-3xl light:bg-orange-400/20"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 h-[320px] w-[320px] rounded-full bg-orange-500/10 blur-3xl light:bg-sky-400/15"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-[1120px] items-center gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-6 lg:py-20">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-emerald-300 light:bg-orange-500/10 light:text-orange-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse light:bg-orange-500" />
                FOR HONG KONG BRAND TEAMS
              </div>
              <h1 className="mt-4 max-w-xl text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-gray-50 light:text-gray-950 sm:text-5xl lg:text-[3.4rem]">
                把内地腔，写回
                <br />
                <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent light:from-orange-600 light:to-amber-500">
                  香港人会点赞
                </span>
                的节奏
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-gray-300 light:text-gray-600">
                不是词典替换，是一条可定稿的创作流水线：诊断 → 五平台变体 → 质量门禁 → 消费者模拟反馈。
                把「港式社媒语感」做成可点的工作台。
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <a
                  href="/app"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-gray-950 transition hover:bg-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
                >
                  免费开写 <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#lab"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-gray-100 transition hover:bg-white/10 light:border-black/10 light:bg-white light:text-gray-800 light:hover:bg-gray-50"
                >
                  先玩 10 秒实验室
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-6 text-xs text-gray-400 light:text-gray-500">
                <div>
                  <strong className="block text-lg text-gray-100 light:text-gray-900">5</strong>
                  平台版本一次出
                </div>
                <div>
                  <strong className="block text-lg text-gray-100 light:text-gray-900">4</strong>
                  阶段质量闭环
                </div>
                <div>
                  <strong className="block text-lg text-gray-100 light:text-gray-900">人</strong>
                  工保留最终判断
                </div>
              </div>
            </Reveal>

            {/* Product stage mock — sharp CSS, not blurry photo */}
            <Reveal delayMs={100} className="min-w-0">
              <div
                className="overflow-hidden rounded-[22px] border border-white/10 bg-[#171b24] shadow-2xl shadow-black/40 light:border-black/10 light:bg-white light:shadow-gray-200/80"
                aria-label="产品示意"
                data-testid="marketing-product-stage"
              >
                <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-3.5 py-3 light:border-black/10 light:bg-gray-50">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                  </span>
                  <span className="text-[11px] text-gray-500">77 工作台 · 实时预览（Mock）</span>
                </div>
                <div className="grid min-h-[300px] sm:grid-cols-[1fr_1.15fr]">
                  <div className="border-b border-white/10 p-3.5 sm:border-r sm:border-b-0 light:border-black/10">
                    <p className="mb-2.5 text-[10px] font-bold tracking-[0.12em] text-gray-500">INPUT · 原文</p>
                    <div className="min-h-[110px] rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-gray-300 light:border-black/10 light:bg-gray-50 light:text-gray-700">
                      新品正式上线！简约设计，超长续航，满足您的通勤和日常使用需求。立即购买，享受限时优惠。
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300 light:border-orange-300 light:bg-orange-50 light:text-orange-700">
                        港味 4/5
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 light:border-black/10 light:text-gray-600">
                        IG
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 light:border-black/10 light:text-gray-600">
                        品牌安全
                      </span>
                    </div>
                  </div>
                  <div className="bg-black/15 p-3.5 light:bg-gray-50/80">
                    <p className="mb-2.5 text-[10px] font-bold tracking-[0.12em] text-gray-500">OUTPUT · 港式变体</p>
                    <div className="mb-2.5 flex flex-wrap gap-1" role="tablist" aria-label="变体预览">
                      {(Object.keys(HERO_TABS) as HeroTabKey[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={heroTab === k}
                          onClick={() => setHeroTab(k)}
                          className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] transition-colors ${
                            heroTab === k
                              ? 'border-emerald-500/40 bg-emerald-500/15 font-bold text-emerald-300 light:border-orange-300 light:bg-orange-50 light:text-orange-700'
                              : 'border-white/10 text-gray-500 hover:text-gray-300 light:border-black/10 light:text-gray-500 light:hover:text-gray-800'
                          }`}
                        >
                          {k === 'ig' ? 'IG' : k === 'fb' ? 'Facebook' : '标准港式'}
                        </button>
                      ))}
                    </div>
                    <div className="min-h-[120px] rounded-xl border border-white/10 bg-[#0f131a] p-3 light:border-black/10 light:bg-white">
                      <div className="mb-2 flex items-center justify-between text-[10px] text-gray-500">
                        <span>{hero.label}</span>
                        <b className="text-sm text-emerald-300 light:text-orange-600">{hero.score}</b>
                      </div>
                      <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-gray-100 light:text-gray-800">
                        {hero.text}
                      </p>
                    </div>
                    <div className="mt-2.5 max-h-[72px] overflow-hidden rounded-[10px] border border-white/10 bg-[#0b1220] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-slate-300">
                      <div>
                        <span className="text-orange-400">[DIAGNOSE]</span> 原文诊断完成，已提取关键约束。
                      </div>
                      <div>
                        <span className="text-sky-400">[VARIANT_ENGINE]</span> 平台差异化表达生成完成。
                      </div>
                      <div>
                        <span className="text-amber-400">[QUALITY_GATE]</span> 质量门禁检查通过。
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Marquee */}
        <div className="overflow-hidden border-b border-white/10 bg-[#12151c] py-3.5 light:border-black/10 light:bg-white" aria-hidden="true">
          <div className="marketing-marquee flex w-max gap-10 text-xs font-semibold tracking-wide text-gray-500">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex gap-10">
                <span>
                  <b className="text-gray-300 light:text-gray-700">诊断原文</b> · 抓书面腔
                </span>
                <span>
                  <b className="text-gray-300 light:text-gray-700">五平台</b> · IG / FB / {SHORTS_TK_LABEL}
                </span>
                <span>
                  <b className="text-gray-300 light:text-gray-700">质量门禁</b> · 港味与品牌安全
                </span>
                <span>
                  <b className="text-gray-300 light:text-gray-700">消费者反馈</b> · 师奶 / 白领 / 斜杠
                </span>
                <span>
                  <b className="text-gray-300 light:text-gray-700">人工定稿</b> · 最终判断留给你
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Why / Bento — ambient */}
        <section className="relative scroll-mt-16 overflow-hidden border-b border-white/10 py-16 light:border-black/10 lg:py-20">
          <div className="pointer-events-none absolute -right-24 -top-16 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl light:bg-emerald-400/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl light:bg-orange-300/15" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal className="mb-8 max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-400 uppercase light:text-orange-600">Why 77</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                把「懂香港」做成按钮，而不是提示词玄学
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-300 light:text-gray-600">
                每个模块干一件可感知的事。你负责品牌判断，流水线负责语感与平台节奏。
              </p>
            </Reveal>
            <div className="grid gap-3 md:grid-cols-12">
              <Reveal className="md:col-span-7" delayMs={40}>
                <article className="h-full rounded-2xl border border-white/10 bg-[#171b24] p-5 transition hover:-translate-y-0.5 light:border-black/10 light:bg-white">
                  <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-500/15 text-emerald-300 light:bg-orange-50 light:text-orange-600">
                    <Languages className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-100 light:text-gray-900">先诊断，再生成</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-400 light:text-gray-600">
                    识别简繁、内地营销词与硬广 CTA，再进入港式重写。避免「先出稿再补锅」。
                  </p>
                  <div className="mt-4 space-y-2">
                    {[
                      ['书面腔', 78, '高'],
                      ['平台适配', 64, '中'],
                      ['品牌风险', 22, '低'],
                    ].map(([label, w, tag]) => (
                      <div key={String(label)} className="grid grid-cols-[72px_1fr_28px] items-center gap-2 text-[11px] text-gray-500">
                        <span>{label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10 light:bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 light:from-orange-500 light:to-amber-400"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                        <span>{tag}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </Reveal>
              <Reveal className="md:col-span-5" delayMs={90}>
                <article className="h-full rounded-2xl border border-white/10 bg-[#171b24] p-5 light:border-black/10 light:bg-white">
                  <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-500/15 text-emerald-300 light:bg-orange-50 light:text-orange-600">
                    <PanelsTopLeft className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-100 light:text-gray-900">一次五版本</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-400 light:text-gray-600">
                    标准港式、轻粤语、IG、Facebook、{SHORTS_TK_LABEL}——同一信息，不同呼吸。
                  </p>
                </article>
              </Reveal>
              {[
                { icon: ShieldCheck, title: '质量门禁', text: '港味、可读性、品牌安全与互动引导，逐项打分并给替换建议。' },
                { icon: MessageSquareText, title: '消费者模拟', text: '用师奶 / 白领 / 斜杠视角先读一遍，再决定哪些建议值得采纳。' },
                { icon: History, title: '历史与收藏', text: '好句子可收藏注入下一次生成；Free / Pro 额度清晰可见。' },
              ].map((item, i) => (
                <Reveal key={item.title} className="md:col-span-4" delayMs={120 + i * 50}>
                  <article className="h-full rounded-2xl border border-white/10 bg-[#171b24] p-5 light:border-black/10 light:bg-white">
                    <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-500/15 text-emerald-300 light:bg-orange-50 light:text-orange-600">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-100 light:text-gray-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400 light:text-gray-600">{item.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Lab — dense, no heavy ambient */}
        <section id="lab" className="scroll-mt-16 border-b border-white/10 py-16 light:border-black/10 lg:py-20">
          <div className="mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal className="mb-8 max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-400 uppercase light:text-orange-600">Interactive Lab</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                港化实验室：拖动滑杆，听文案换口音
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-300 light:text-gray-600">
                纯前端演示，不调用 API。感受「港味强度」如何改变节奏——确认方向后再进真实工作台。
              </p>
            </Reveal>
            <Reveal>
              <div className="rounded-[22px] border border-white/10 bg-[#12151c] p-4 shadow-xl light:border-black/10 light:bg-white sm:p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="lab-in" className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      贴一段你的文案
                    </label>
                    <textarea
                      id="lab-in"
                      value={labIn}
                      onChange={(e) => setLabIn(e.target.value)}
                      rows={5}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 light:border-black/10 light:bg-gray-50 light:text-gray-900 light:focus:border-orange-400 light:focus:ring-orange-500/20"
                    />
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5 light:border-black/10 light:bg-gray-100" role="group" aria-label="语气">
                        {(['活泼', '稳妥', '街坊'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setLabTone(t)}
                            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs transition ${
                              labTone === t
                                ? 'bg-[#171b24] font-bold text-gray-100 shadow light:bg-white light:text-gray-900'
                                : 'text-gray-500 hover:text-gray-300 light:hover:text-gray-700'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-400 light:text-gray-600">
                        港味
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={labLevel}
                          onChange={(e) => setLabLevel(Number(e.target.value))}
                          className="w-24 accent-emerald-400 light:accent-orange-500"
                        />
                        <b className="tabular-nums text-gray-200 light:text-gray-800">{labLevel}</b>
                      </label>
                      <button
                        type="button"
                        onClick={runLab}
                        className="cursor-pointer rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-gray-950 transition hover:bg-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
                      >
                        港化一下
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-gray-500">演示输出</p>
                    <div
                      className="min-h-[120px] rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm leading-7 text-gray-100 light:border-orange-300 light:bg-orange-50 light:text-gray-800"
                      aria-live="polite"
                    >
                      {labOut}
                      {labTyping && <span className="marketing-caret text-emerald-400 light:text-orange-500" />}
                    </div>
                    <p className="mt-2.5 text-[11px] text-gray-500">
                      提示：真实产品会走诊断→五版本→审核全链路；此处只展示语感变化的趣味预览。
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Flow — ambient grid */}
        <section
          id="flow"
          className="scroll-mt-16 border-b border-white/10 py-16 light:border-black/10 lg:py-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        >
          <div className="mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal className="mb-8 max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-400 uppercase light:text-orange-600">Workflow</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                四步，像 Agent Terminal 一样可追踪
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-300 light:text-gray-600">
                进度条与终端日志是预估状态，不是 SSE 伪装思考——但用户应该永远知道「现在卡在哪」。
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map(([n, title, text], i) => (
                <Reveal key={n} delayMs={i * 60}>
                  <article className="h-full rounded-2xl border border-white/10 bg-[#171b24]/90 p-4 light:border-black/10 light:bg-white">
                    <div className="font-mono text-[11px] font-bold text-emerald-400 light:text-orange-600">{n}</div>
                    <h3 className="mt-2.5 text-sm font-semibold text-gray-100 light:text-gray-900">{title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-gray-400 light:text-gray-600">{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section id="platforms" className="relative scroll-mt-16 overflow-hidden border-b border-white/10 py-16 light:border-black/10 lg:py-20">
          <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl light:bg-orange-300/20" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal className="mb-8 max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-400 uppercase light:text-orange-600">Channels</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                点一下平台，看同一卖点怎么变脸
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {(Object.keys(PLATFORMS) as PlatKey[]).map((key, i) => {
                const p = PLATFORMS[key];
                const active = plat === key;
                return (
                  <Reveal key={key} delayMs={i * 50}>
                    <button
                      type="button"
                      onClick={() => setPlat(key)}
                      className={`w-full cursor-pointer rounded-[14px] border px-2.5 py-3.5 text-center transition ${
                        active
                          ? 'border-emerald-500/45 bg-emerald-500/15 light:border-orange-300 light:bg-orange-50'
                          : 'border-white/12 bg-[#1c2230] hover:-translate-y-0.5 light:border-black/10 light:bg-white'
                      }`}
                    >
                      <div className="mb-1.5 text-[22px] leading-none" aria-hidden="true">
                        {p.emoji}
                      </div>
                      <b
                        className={`block text-xs font-bold ${
                          active
                            ? 'text-emerald-200 light:text-orange-700'
                            : 'text-gray-50 light:text-gray-900'
                        }`}
                      >
                        {p.label}
                      </b>
                      <small
                        className={`mt-0.5 block text-[10px] ${
                          active
                            ? 'text-emerald-100/80 light:text-orange-700/80'
                            : 'text-gray-300 light:text-gray-600'
                        }`}
                      >
                        {p.hint}
                      </small>
                    </button>
                  </Reveal>
                );
              })}
            </div>
            <Reveal delayMs={180}>
              <div className="mt-3.5 min-h-[120px] rounded-2xl border border-white/12 bg-[#1c2230] p-5 light:border-black/10 light:bg-white">
                <h4 className="text-sm font-bold text-gray-50 light:text-gray-900">{platData.title}</h4>
                <p className="mt-2 text-sm leading-7 text-gray-300 light:text-gray-700">{platData.body}</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Plans — dense, clean */}
        <section id="plans" className="scroll-mt-16 border-b border-white/10 py-16 light:border-black/10 lg:py-20">
          <div className="mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal className="mb-8 max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-400 uppercase light:text-orange-600">Plans</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                先跑通闭环，再升级产能
              </h2>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Reveal>
                <article className="h-full rounded-[20px] border border-white/10 bg-[#171b24] p-6 light:border-black/10 light:bg-white">
                  <h3 className="text-lg font-semibold text-gray-100 light:text-gray-900">Free</h3>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-50 light:text-gray-950">
                    ¥0 <small className="text-sm font-medium text-gray-500">/ 滚动额度</small>
                  </div>
                  <ul className="mt-4 space-y-0 text-sm text-gray-400 light:text-gray-600">
                    {['完整体验：诊断→生成→审核→反馈', '每 7 天 20 次完整生成', '最近收藏 / 历史有限访问'].map((f) => (
                      <li key={f} className="flex gap-2 border-t border-white/10 py-2 light:border-black/10">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400 light:text-orange-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/app"
                    className="mt-2 inline-flex w-full min-h-11 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-gray-100 transition hover:bg-white/5 light:border-black/10 light:text-gray-800 light:hover:bg-gray-50"
                  >
                    开始免费创作
                  </a>
                </article>
              </Reveal>
              <Reveal delayMs={70}>
                <article className="relative h-full overflow-hidden rounded-[20px] border border-emerald-500/40 bg-[#171b24] p-6 shadow-xl light:border-orange-300 light:bg-white">
                  <span className="absolute top-3.5 right-3.5 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-gray-950 light:bg-orange-500 light:text-white">
                    推荐
                  </span>
                  <h3 className="text-lg font-semibold text-gray-100 light:text-gray-900">Pro</h3>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-50 light:text-gray-950">
                    ¥19 <small className="text-sm font-medium text-gray-500">/ 月</small>
                  </div>
                  <ul className="mt-4 space-y-0 text-sm text-gray-400 light:text-gray-600">
                    {['每月 250 次完整生成', '解锁全部收藏与历史', '高频品牌运营向产能'].map((f) => (
                      <li key={f} className="flex gap-2 border-t border-white/10 py-2 light:border-black/10">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400 light:text-orange-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="/app/billing"
                    className="mt-2 inline-flex w-full min-h-11 items-center justify-center rounded-full bg-emerald-400 text-sm font-semibold text-gray-950 transition hover:bg-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
                  >
                    充值 Pro
                  </a>
                </article>
              </Reveal>
              <Reveal delayMs={140}>
                <article className="flex h-full flex-col rounded-[20px] border border-white/10 bg-[#171b24] p-6 light:border-black/10 light:bg-white">
                  <h3 className="text-lg font-semibold text-gray-100 light:text-gray-900">团队协作版</h3>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-gray-50 light:text-gray-950">
                    ¥99 <small className="text-sm font-medium text-gray-500">/ 月</small>
                  </div>
                  <ul className="mt-4 flex-1 space-y-0 text-sm text-gray-400 light:text-gray-600">
                    {['审核分组', '管理员句子批注', '待审核队列与提醒'].map((feature) => (
                      <li key={feature} className="flex gap-2 border-t border-white/10 py-2 light:border-black/10">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400 light:text-orange-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setTeamContactOpen(true)}
                    aria-label="联系开通团队协作版"
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-gray-100 transition hover:border-emerald-500/60 hover:text-emerald-300 light:border-black/10 light:text-gray-800 light:hover:border-orange-400 light:hover:text-orange-600"
                  >
                    联系开通
                  </button>
                </article>
              </Reveal>
            </div>
            <Reveal>
              <a
                href="/pricing"
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 light:text-orange-600 light:hover:text-orange-700"
              >
                查看完整定价与额度 <ArrowRight className="h-3 w-3" />
              </a>
            </Reveal>
          </div>
        </section>

        {/* FAQ — dense */}
        <section id="faq" className="scroll-mt-16 border-b border-white/10 py-16 light:border-black/10 lg:py-20">
          <div className="mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal className="mb-8 max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-400 uppercase light:text-orange-600">FAQ</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                开始之前
              </h2>
            </Reveal>
            <Reveal>
              <div className="space-y-2">
                {FAQS.map(([q, a], i) => (
                  <details
                    key={q}
                    className="group rounded-xl border border-white/10 bg-[#171b24] px-4 light:border-black/10 light:bg-white"
                    open={i === 0}
                  >
                    <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold text-gray-100 focus-visible:outline-none light:text-gray-900">
                      {q}
                      <span className="text-lg font-light text-gray-500 transition group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="max-w-3xl pb-4 text-sm leading-6 text-gray-400 light:text-gray-600">{a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-16 lg:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.12),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(251,146,60,0.1),transparent_40%)] light:bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.12),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(16,185,129,0.08),transparent_40%)]" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1120px] px-5 lg:px-6">
            <Reveal>
              <div className="rounded-3xl border border-white/10 bg-[#171b24]/90 px-6 py-10 text-center shadow-2xl light:border-black/10 light:bg-white">
                <h2 className="text-2xl font-semibold tracking-tight text-gray-50 light:text-gray-950 sm:text-3xl">
                  从一段原文开始，完成第一轮港式文案
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-gray-400 light:text-gray-600">
                  无需注册，先体验生成、审核与反馈流程。
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                  <a
                    href="/app"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-gray-950 transition hover:bg-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
                  >
                    进入工作台 <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="/pricing"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-gray-100 transition hover:bg-white/5 light:border-black/10 light:text-gray-800 light:hover:bg-gray-50"
                  >
                    了解套餐详情
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 light:border-black/10">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-5 py-6 text-[10px] text-gray-500 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <span>77港话通社媒文案器</span>
          <p data-testid="admin-review-contact" className="text-[10px] text-gray-500">
            团队需要管理员审核功能？请联系产品开发：TEL：
            <a
              href="tel:18595680518"
              className="text-emerald-400 underline-offset-2 hover:underline light:text-orange-600"
            >
              18595680518
            </a>
          </p>
          <span>HK Cantonese Social Copywriter · 产品预览版</span>
        </div>
      </footer>
      <TeamContactDialog open={teamContactOpen} onClose={() => setTeamContactOpen(false)} />
    </div>
  );
}
