import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Languages,
  MessageSquareText,
  PanelsTopLeft,
  ShieldCheck,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

const capabilities: Array<{ icon: LucideIcon; title: string; text: string; meta: string }> = [
  {
    icon: Languages,
    title: '先诊断，再港化',
    text: '识别书面腔、内地营销词和简繁问题，避免逐字翻译。',
    meta: 'DIAGNOSE',
  },
  {
    icon: PanelsTopLeft,
    title: '一次生成 5 个版本',
    text: '标准繁中、轻粤语、IG、Facebook、Shorts 各有自己的节奏。',
    meta: 'GENERATE',
  },
  {
    icon: ShieldCheck,
    title: '质量与品牌审核',
    text: '检查港味、平台适配、可读性和表达风险，并给出替换建议。',
    meta: 'REVIEW',
  },
  {
    icon: MessageSquareText,
    title: '消费者模拟反馈',
    text: '用目标消费者视角先读一次，再决定哪些建议值得采用。',
    meta: 'FEEDBACK',
  },
];

const workflow = [
  ['01', '贴上原文', '普通话、书面中文、粤语或英文 brief'],
  ['02', '设定语气', '选择平台、港味程度和目标消费者'],
  ['03', '生成与审核', '同时得到 5 类版本和质量检查'],
  ['04', '修改并定稿', '应用建议、查看差异、复制发布'],
];

const faqs = [
  ['它和普通翻译工具有什么不同？', '它会先诊断原文，再按品牌语气和平台结构生成多个版本，并提供审核与消费者反馈。'],
  ['一定要懂粤语才能用吗？', '不需要。你可以输入普通话或书面中文，并通过不同港味程度和审核结果理解输出。'],
  ['Free 和 Pro 已经开放付费了吗？', '目前只展示套餐方向，价格、额度和支付宝支付仍在开发，不会在本页发起真实扣款。'],
];

const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 light:bg-orange-500 light:text-white light:hover:bg-orange-600 light:focus-visible:ring-orange-500 light:focus-visible:ring-offset-white';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-900/60 px-5 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 light:border-gray-300 light:bg-white light:text-gray-700 light:hover:bg-gray-100';
const panel = 'border border-gray-800 bg-gray-900/45 light:border-gray-200 light:bg-white';

function SectionIntro({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-400 light:text-orange-600">{label}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-100 light:text-gray-900 sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-gray-400 light:text-gray-600">{text}</p>
    </div>
  );
}

export default function MarketingPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('hk-cantonese-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('hk-cantonese-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-full bg-gray-950 text-gray-100 light:bg-gray-50 light:text-gray-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-gray-950">
        跳到主要内容
      </a>

      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/95 backdrop-blur light:border-gray-200 light:bg-white/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 lg:px-6">
          <a href="/" className="flex min-w-0 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:focus-visible:ring-orange-500" aria-label="77港话通社媒文案器首页">
            <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-[9px] bg-black">
              <img
                src="/brand/77-logo.png"
                alt=""
                className="h-full w-full scale-[1.035] object-cover"
              />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-gray-100 light:text-gray-900">77港话通社媒文案器</strong>
              <span className="hidden truncate text-[9px] tracking-[0.14em] text-gray-600 light:text-gray-500 sm:block">HK CANTONESE SOCIAL COPYWRITER</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-xs text-gray-500 lg:flex" aria-label="官网导航">
            <a className="transition-colors hover:text-gray-200 light:hover:text-gray-900" href="#capabilities">核心能力</a>
            <a className="transition-colors hover:text-gray-200 light:hover:text-gray-900" href="#workflow">工作流程</a>
            <a className="transition-colors hover:text-gray-200 light:hover:text-gray-900" href="#plans">套餐预览</a>
            <a className="transition-colors hover:text-gray-200 light:hover:text-gray-900" href="/pricing">定价</a>
            <a className="transition-colors hover:text-gray-200 light:hover:text-gray-900" href="#faq">常见问题</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-900 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:hover:bg-gray-100 light:hover:text-gray-900 light:focus-visible:ring-orange-500"
              aria-label={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
              title={theme === 'dark' ? '切换至亮色模式' : '切换至暗色模式'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a href="/app" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-500/40 px-4 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:border-orange-300 light:text-orange-700 light:hover:bg-orange-50 light:focus-visible:ring-orange-500">
              进入工作台 <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="border-b border-gray-800 light:border-gray-200">
          <div className="mx-auto max-w-6xl px-5 py-20 lg:px-6 lg:py-24">
            <div className="max-w-4xl">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-400 light:text-orange-600">AI COPY WORKFLOW FOR HONG KONG</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-gray-50 light:text-gray-950 sm:text-5xl lg:text-6xl">
                把普通中文，写成香港人真正会看的社媒文案
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-gray-400 light:text-gray-600">
                先诊断原文，再生成 5 个港式平台版本，接着完成质量审核与消费者模拟反馈。不是逐字翻译，而是一套可以人工定稿的创作流程。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/app" className={primaryButton}>免费开始创作 <ArrowRight className="h-4 w-4" /></a>
                <a href="#comparison" className={secondaryButton}>查看前后对比</a>
              </div>
            </div>

            <dl className={`mt-14 grid overflow-hidden rounded-lg ${panel} sm:grid-cols-3`}>
              {[
                ['5 类', '港式平台版本'],
                ['完整', '生成—审核—反馈闭环'],
                ['人工', '保留最终品牌判断'],
              ].map(([value, label], index) => (
                <div key={label} className={`px-5 py-4 ${index > 0 ? 'border-t border-gray-800 light:border-gray-200 sm:border-l sm:border-t-0' : ''}`}>
                  <dt className="text-xs text-gray-500 light:text-gray-500">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-100 light:text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="comparison" className="scroll-mt-16 border-b border-gray-800 light:border-gray-200">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-6">
            <SectionIntro label="BEFORE / AFTER" title="不是换几个粤语词，而是重新组织表达" text="同一份产品信息，按香港用户的生活场景、平台节奏和互动习惯重写。" />
            <div className="mt-8 grid overflow-hidden rounded-lg border border-gray-800 light:border-gray-200 lg:grid-cols-2">
              <article className="bg-gray-900/35 p-6 light:bg-gray-100">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-gray-500">原始文案 · 书面表达</p>
                <blockquote className="mt-5 text-base leading-8 text-gray-300 light:text-gray-700">新品正式上线！简约设计，超长续航，满足您的通勤和日常使用需求。立即购买，享受限时优惠。</blockquote>
                <div className="mt-6 flex flex-wrap gap-2 text-[10px] text-gray-500"><span>直译感</span><span>·</span><span>泛化卖点</span><span>·</span><span>硬 CTA</span></div>
              </article>
              <article className="border-t border-emerald-500/30 bg-emerald-500/[0.04] p-6 light:border-orange-200 light:bg-orange-50 lg:border-l lg:border-t-0">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-400 light:text-orange-700">IG 版本 · 港式社媒表达</p>
                <blockquote className="mt-5 text-base leading-8 text-gray-200 light:text-gray-800">返工赶时间，都想件装备够轻、够耐用。由朝早出门到夜晚收工，都唔使成日搵充电位。你最想试边个功能？</blockquote>
                <div className="mt-6 flex flex-wrap gap-2 text-[10px] text-gray-500"><span>生活场景</span><span>·</span><span>自然港味</span><span>·</span><span>具体互动</span></div>
              </article>
            </div>
          </div>
        </section>

        <section id="capabilities" className="scroll-mt-16 border-b border-gray-800 light:border-gray-200">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-6">
            <SectionIntro label="ONE WORKFLOW" title="一张工作台，完成从原文到定稿" text="结构借鉴成熟 AI 营销工具的工作流表达，但只保留当前产品已经能跑通的核心能力。" />
            <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-gray-800 bg-gray-800 light:border-gray-200 light:bg-gray-200 md:grid-cols-2">
              {capabilities.map(({ icon: Icon, title, text, meta }) => (
                <article key={title} className="bg-gray-950 p-6 light:bg-white">
                  <div className="flex items-center justify-between gap-4">
                    <Icon className="h-4 w-4 text-emerald-400 light:text-orange-600" aria-hidden="true" />
                    <span className="text-[9px] font-semibold tracking-[0.16em] text-gray-600 light:text-gray-400">{meta}</span>
                  </div>
                  <h3 className="mt-6 text-base font-semibold text-gray-100 light:text-gray-900">{title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 light:text-gray-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-16 border-b border-gray-800 light:border-gray-200">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-6">
            <SectionIntro label="HOW IT WORKS" title="四步跑通一轮创作" text="过程像工作台一样清晰：输入、设定、生成、定稿，没有额外的营销层级。" />
            <ol className={`mt-8 grid overflow-hidden rounded-lg ${panel} lg:grid-cols-4`}>
              {workflow.map(([number, title, text], index) => (
                <li key={number} className={`p-5 ${index > 0 ? 'border-t border-gray-800 light:border-gray-200 lg:border-l lg:border-t-0' : ''}`}>
                  <span className="font-mono text-[10px] text-emerald-400 light:text-orange-600">{number}</span>
                  <h3 className="mt-6 text-sm font-semibold text-gray-100 light:text-gray-900">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-gray-500 light:text-gray-600">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="plans" className="scroll-mt-16 border-b border-gray-800 light:border-gray-200">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1fr_1.25fr] lg:px-6">
            <SectionIntro label="PLAN PREVIEW" title="先体验，再决定是否升级" text="当前只说明 Free 与 Pro 的定位；价格、额度和支付宝支付仍在开发。" />
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['FREE', '体验核心闭环', ['5 类文案结果', '基础审核与反馈', '本地收藏与配置']],
                  ['PRO', '面向高频创作', ['更高生成额度', '跨设备品牌档案', '长期偏好与历史']],
                ].map(([name, title, features]) => (
                  <article key={String(name)} className={`rounded-lg p-5 ${panel}`}>
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-400 light:text-orange-600">{String(name)}</p>
                    <h3 className="mt-3 text-base font-semibold text-gray-100 light:text-gray-900">{String(title)}</h3>
                    <ul className="mt-6 space-y-3 text-xs text-gray-400 light:text-gray-600">
                      {(features as string[]).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400 light:text-orange-600" />{feature}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
              <a
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 light:text-orange-600 light:hover:text-orange-700"
              >
                查看完整定价与额度 <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-16 border-b border-gray-800 light:border-gray-200">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-6">
            <SectionIntro label="FAQ" title="开始之前" text="只保留最常见的三个问题。" />
            <div className="mt-8 divide-y divide-gray-800 rounded-lg border border-gray-800 light:divide-gray-200 light:border-gray-200">
              {faqs.map(([question, answer], index) => (
                <details key={question} className="group bg-gray-900/30 px-5 light:bg-white" open={index === 0}>
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium text-gray-200 focus-visible:outline-none light:text-gray-800">
                    {question}<span className="text-lg font-light text-gray-500 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="max-w-3xl pb-5 text-sm leading-6 text-gray-500 light:text-gray-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 lg:px-6">
          <div className={`flex flex-col items-start justify-between gap-7 rounded-lg p-6 sm:flex-row sm:items-center ${panel}`}>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-400 light:text-orange-600">READY TO WRITE</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-100 light:text-gray-900">从一段原文开始，完成第一轮港式文案</h2>
              <p className="mt-2 text-sm text-gray-500 light:text-gray-600">无需注册，先体验生成、审核与反馈流程。</p>
            </div>
            <a href="/app" className={`${primaryButton} shrink-0`}><ClipboardCheck className="h-4 w-4" />免费开始创作</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800 light:border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[10px] text-gray-600 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <span>77港话通社媒文案器</span>
          <span>HK Cantonese Social Copywriter · 产品预览版</span>
        </div>
      </footer>
    </div>
  );
}
