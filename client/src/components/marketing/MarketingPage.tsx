import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SHORTS_TK_LABEL } from '../../constants';
import '../../styles/MarketingPageV4.css';
import TeamContactDialog from './TeamContactDialog';

const WORKBENCH_TABS = {
  ig: {
    label: 'IG',
    score: '86',
    text: '返工赶时间，都想件装备够轻、够耐用。由朝早出门到夜晚收工，都唔使成日搵充电位。你最想试边个功能？',
  },
  fb: {
    label: 'Facebook',
    score: '84',
    text: '朝早挤港铁，夜晚加班，最怕随身电量见红。新系列续航够长、机身够轻，陪你由开会到放工。限时优惠，今日仲未试过？',
  },
  shorts: {
    label: SHORTS_TK_LABEL,
    score: '85',
    text: '三点讲清楚：轻身、长气、限时优惠。第一秒亮产品，第三秒直接问：你最怕边种低电量瞬间？',
  },
} as const;

type WorkbenchTab = keyof typeof WORKBENCH_TABS;
type LabTone = '活泼' | '稳妥' | '街坊';
type CaseFilter = 'all' | 'home' | 'hit';

const LAB_VARIANTS: Record<1 | 3 | 5, Record<LabTone, string>> = {
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

const CASES = [
  {
    filter: 'home' as const,
    badge: 'IG 主页',
    title: '思念香港 · Instagram 主页',
    description: '观察主页视觉、栏目编排与长期内容节奏。',
    src: '/brand/cases/synear-instagram.webp',
  },
  {
    filter: 'home' as const,
    badge: `${SHORTS_TK_LABEL} 主页`,
    title: `思念香港 · ${SHORTS_TK_LABEL} 主页`,
    description: '查看短视频封面如何形成稳定的系列辨识度。',
    src: '/brand/cases/synear-shorts.webp',
  },
  {
    filter: 'hit' as const,
    badge: '达人 · IG',
    title: '思念香港 · 达人 IG 内容',
    description: '对照达人合作内容的场景切入与互动表达。',
    src: '/brand/cases/synear-creator-instagram.webp',
  },
  {
    filter: 'hit' as const,
    badge: `ASMR · ${SHORTS_TK_LABEL}`,
    title: `思念香港 · ASMR ${SHORTS_TK_LABEL} 内容`,
    description: '分析 ASMR 内容的开场钩子、节奏与产品露出。',
    src: '/brand/cases/synear-asmr-shorts.webp',
  },
] as const;

const NAV_ITEMS = [
  ['工作台', '#showcase'],
  ['案例', '#cases'],
  ['实验室', '#lab'],
  ['流程', '#flow'],
  ['方案', '#pricing'],
] as const;

const TYPE_PHRASES = ['雷猴啊！', '港式文案', '五平台', 'HK 节奏', '质量门禁', '77 港话通'];
const THEME_STORAGE_KEY = 'hk-cantonese-theme';
const LEGACY_MARKETING_THEME_KEY = 'marketing-theme';

function delayStyle(value: string): CSSProperties {
  return { '--d': value } as CSSProperties;
}

function closestLabLevel(value: number): 1 | 3 | 5 {
  if (value <= 2) return 1;
  if (value <= 4) return 3;
  return 5;
}

export default function MarketingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const harbourRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
        ?? window.localStorage.getItem(LEGACY_MARKETING_THEME_KEY);
      return storedTheme === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('ig');
  const [termStep, setTermStep] = useState(0);
  const [typedPhrase, setTypedPhrase] = useState('港式文案');
  const [labTone, setLabTone] = useState<LabTone>('活泼');
  const [labLevel, setLabLevel] = useState(4);
  const [labOut, setLabOut] = useState('调整参数后，点击「港化一下」查看示例结果。');
  const [labLoading, setLabLoading] = useState(false);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [openCaseIndex, setOpenCaseIndex] = useState<number | null>(null);
  const [teamContactOpen, setTeamContactOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in private browsing and test environments.
    }
  }, [theme]);

  useEffect(() => {
    const panels = Array.from(pageRef.current?.querySelectorAll<HTMLElement>('.panel-in') ?? []);
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      panels.forEach((panel) => panel.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.14 },
    );
    panels.forEach((panel) => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let phraseIndex = 0;
    let characterIndex = (TYPE_PHRASES[0] ?? '').length;
    let deleting = true;
    let timer = 0;
    const tick = () => {
      const phrase = TYPE_PHRASES[phraseIndex] ?? TYPE_PHRASES[0] ?? '';
      characterIndex += deleting ? -1 : 1;
      setTypedPhrase(phrase.slice(0, Math.max(0, characterIndex)));
      if (!deleting && characterIndex >= phrase.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1300);
        return;
      }
      if (deleting && characterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % TYPE_PHRASES.length;
        timer = window.setTimeout(tick, 260);
        return;
      }
      timer = window.setTimeout(tick, deleting ? 48 : 92);
    };
    timer = window.setTimeout(tick, 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTermStep((step) => (step + 1) % 3), 1500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (navigator.userAgent.includes('jsdom')) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const snippets = ['diagnose(copy)', 'variant.platform', 'quality.score', 'tone.hk', 'feedback.read()', 'brand.safe'];
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.font = '12px ui-monospace, SFMono-Regular, Consolas, monospace';
      context.fillStyle = theme === 'dark' ? 'rgba(133, 226, 185, .09)' : 'rgba(50, 91, 77, .09)';
      for (let y = 24, row = 0; y < rect.height; y += 34, row += 1) {
        for (let x = -40 + (row % 2) * 70, col = 0; x < rect.width; x += 210, col += 1) {
          context.fillText(snippets[(row + col) % snippets.length] ?? '', x, y);
        }
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [theme]);

  useEffect(() => {
    const nav = pageRef.current?.querySelector<HTMLElement>('#site-nav');
    const harbour = harbourRef.current;
    const onScroll = () => {
      nav?.classList.toggle('scrolled', window.scrollY > 20);
      if (!harbour) return;
      const rect = harbour.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      harbour.style.setProperty('--hb-pos-y', `${42 + progress * 16}%`);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (openCaseIndex === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenCaseIndex(null);
      if (event.key === 'ArrowLeft') moveCase(-1);
      if (event.key === 'ArrowRight') moveCase(1);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openCaseIndex]);

  const tabData = WORKBENCH_TABS[workbenchTab];
  const visibleCases = CASES.filter((item) => caseFilter === 'all' || item.filter === caseFilter);
  const openCase = openCaseIndex === null ? null : CASES[openCaseIndex];

  function runLab() {
    setLabLoading(true);
    window.setTimeout(() => {
      setLabOut(LAB_VARIANTS[closestLabLevel(labLevel)][labTone]);
      setLabLoading(false);
    }, 360);
  }

  function moveCase(direction: -1 | 1) {
    setOpenCaseIndex((current) => {
      if (current === null) return null;
      return (current + direction + CASES.length) % CASES.length;
    });
  }

  return (
    <div className="page" ref={pageRef}>
      <a className="sr-only" href="#main-content">跳到主要内容</a>
      <header className="nav" id="site-nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#intro" aria-label="77港话通社媒文案器首页">
            <span className="logo-box"><img src="/brand/77-logo.png" alt="" /></span>
            <span><strong>77 港话通</strong><span className="sub">HK Social Copy</span></span>
          </a>
          <nav className="nav-links" aria-label="主导航">
            {NAV_ITEMS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="nav-actions">
            <a className="nav-login" href="/login">登录</a>
            <button type="button" className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="切换浅色/深色主题" title="切换主题">
              <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" /></svg>
            </button>
            <a className="btn btn-primary" href="/app">进入工作台</a>
            <button type="button" className="menu-btn" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? '关闭菜单' : '打开菜单'} aria-expanded={menuOpen} aria-controls="mobile-drawer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-drawer${menuOpen ? ' open' : ''}`} id="mobile-drawer" hidden={!menuOpen}>
        {NAV_ITEMS.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <a href="/login" onClick={() => setMenuOpen(false)}>登录</a>
        <a className="btn btn-primary drawer-cta" href="/app">进入工作台</a>
      </div>

      <main id="main-content">
        <section className="snap intro" id="intro" aria-label="开场">
          <div className="code-field" aria-hidden="true"><canvas ref={canvasRef} /></div>
          <div className="wrap">
            <div className="intro-glow" aria-hidden="true" />
            <div className="intro-inner panel-in">
              <div className="intro-type" aria-live="polite">
                <span className="sym-gt">&gt;</span><span className="sym-lp">(</span><span className="phrase">{typedPhrase}</span><span className="caret" aria-hidden="true" /><span className="sym-rp">)</span><span className="sym-eq">=</span>
              </div>
              <div className="eyebrow"><i /> FOR HONG KONG BRAND TEAMS</div>
              <h1 className="intro-title">把内地腔，写回<br /><em>香港人会点赞</em>的节奏</h1>
              <p className="intro-lead">诊断 → 五平台变体 → 质量门禁 → 消费者反馈。港式社媒文案，一次出稿。</p>
              <div className="intro-cta"><a className="btn btn-primary" href="/app">免费开写 →</a><a className="btn btn-secondary" href="#lab">试试港化实验室</a></div>
              <div className="intro-meta"><div><strong>5</strong>平台版本一次出</div><div><strong>4</strong>阶段质量闭环</div><div><strong>人</strong>工保留最终判断</div></div>
            </div>
          </div>
          <div className="scroll-hint" aria-hidden="true"><span>Scroll</span><i /></div>
        </section>

        <section id="showcase" className="snap compact" aria-label="工作台">
          <div className="wrap">
            <div className="sec-head panel-in"><div className="sec-kicker">Workbench</div><h2>原文进，港式出</h2><p>同一卖点按 IG、Facebook、{SHORTS_TK_LABEL} 等平台改写，生成、审核与反馈集中查看。</p></div>
            <div className="stage panel-in" style={delayStyle('80ms')} data-testid="marketing-product-stage" aria-label="产品示意">
              <div className="stage-bar"><div className="dots" aria-hidden="true"><span /><span /><span /></div><div className="title">77 工作台 · 港式文案生成</div></div>
              <div className="stage-body">
                <div className="pane"><div className="pane-label">INPUT · 原文</div><div className="src-box">新品正式上线！简约设计，超长续航，满足您的通勤和日常使用需求。立即购买，享受限时优惠。</div><div className="chip-row"><span className="chip on">港味 4/5</span><span className="chip">IG</span><span className="chip">品牌安全</span></div></div>
                <div className="pane">
                  <div className="pane-label">OUTPUT · 港式变体</div>
                  <div className="out-tabs" role="tablist" aria-label="平台版本">
                    {(Object.keys(WORKBENCH_TABS) as WorkbenchTab[]).map((key) => <button key={key} type="button" className={`out-tab${workbenchTab === key ? ' active' : ''}`} role="tab" aria-selected={workbenchTab === key} onClick={() => setWorkbenchTab(key)}>{WORKBENCH_TABS[key].label}</button>)}
                  </div>
                  <div className="out-card"><div className="score"><span>{tabData.label} 版本</span><b>{tabData.score}</b></div><pre>{tabData.text}</pre></div>
                  <div className="term-mini" aria-hidden="true"><div className={termStep === 0 ? 'on' : ''}><span className="t-d">[DIAGNOSE]</span> 原文诊断完成</div><div className={termStep === 1 ? 'on' : ''}><span className="t-v">[VARIANT]</span> 五平台生成完成</div><div className={termStep === 2 ? 'on' : ''}><span className="t-q">[QUALITY]</span> 门禁检查通过</div></div>
                </div>
              </div>
              <div className="float-badge"><span className="dot" /> stage · success</div>
            </div>
          </div>
        </section>

        <aside className="brand-rail" aria-label="案例库收录品牌"><div className="brand-rail-head">Cases · 案例库收录品牌</div><div className="brand-marquee"><div className="brand-track">{Array.from({ length: 4 }, (_, index) => <span key={`synear-${index}`} className="brand-chip brand-synear">思念香港 · 社媒运营</span>)}{Array.from({ length: 4 }, (_, index) => <span key={`cofco-${index}`} className="brand-chip brand-cofco">中粮家佳康 · 营销文案</span>)}</div></div></aside>

        <div className="harbour-band" aria-label="维港场景带" ref={harbourRef}>
          <section id="cases" className="snap compact" aria-label="品牌内容案例">
            <div className="wrap">
              <div className="sec-head panel-in"><div className="sec-kicker">Cases · 示例品牌</div><h2>品牌内容案例</h2><p>以思念香港为例，查看主页、短视频与达人内容的表达差异。</p></div>
              <div className="case-tabs panel-in" style={delayStyle('50ms')} role="tablist" aria-label="案例筛选">{([['all', '全部'], ['home', '主页'], ['hit', '内容']] as const).map(([key, label]) => <button key={key} type="button" className={`case-tab${caseFilter === key ? ' active' : ''}`} onClick={() => setCaseFilter(key)}>{label}</button>)}</div>
              <div className="case-grid panel-in" style={delayStyle('100ms')}>{visibleCases.map((item) => { const index = CASES.indexOf(item); return <button key={item.src} type="button" className="case-card" onClick={() => setOpenCaseIndex(index)} aria-label={`查看${item.title}`}><div className="thumb"><img src={item.src} alt="" loading="lazy" /></div><div className="meta"><span className="badge">{item.badge}</span><h3>{item.title}</h3><p>{item.description}</p></div></button>; })}</div>
            </div>
          </section>

          <section id="lab" className="snap compact" aria-label="港化实验室">
            <div className="wrap">
              <div className="sec-head panel-in"><div className="sec-kicker">Interactive Lab</div><h2>港化实验室</h2><p>先快速预览港味与语气方向，确认后进入工作台完成五版本与审核。</p></div>
              <div className="lab panel-in" style={delayStyle('70ms')}><div className="lab-grid">
                <div><label htmlFor="lab-in">贴一段你的文案</label><textarea id="lab-in" defaultValue="新品正式上线！简约设计，超长续航，满足您的通勤和日常使用需求。立即购买，享受限时优惠。" /><div className="lab-tools"><div className="seg" role="group" aria-label="语气">{(['活泼', '稳妥', '街坊'] as LabTone[]).map((tone) => <button key={tone} type="button" className={labTone === tone ? 'active' : ''} onClick={() => setLabTone(tone)}>{tone}</button>)}</div><label className="level-ctrl">港味<input type="range" min="1" max="5" value={labLevel} onChange={(event) => setLabLevel(Number(event.target.value))} /><b>{labLevel}</b></label><button type="button" className={`btn btn-primary${labLoading ? ' is-loading' : ''}`} onClick={runLab} disabled={labLoading}>{labLoading ? '港化中…' : '港化一下'}</button></div></div>
                <div><label>预览输出</label><div className={`lab-result${labLoading ? ' is-loading' : ''}`} aria-live="polite">{labOut}</div></div>
              </div></div>
            </div>
          </section>
        </div>

        <div className="amb-band">
          <section id="flow" className="snap compact"><div className="wrap"><div className="sec-head panel-in"><div className="sec-kicker">Flow</div><h2>四步，可追踪</h2><p>从诊断到反馈，每一步都留下可回看的记录。</p></div><div className="steps">
            <article className="step panel-in" style={delayStyle('0ms')}><div className="n">01</div><h3>诊断原文</h3><p>定位书面腔、表达风险和品牌红线。</p></article>
            <article className="step panel-in" style={delayStyle('70ms')}><div className="n">02</div><h3>生成变体</h3><p>IG / FB / {SHORTS_TK_LABEL} 等平台版本并行产出。</p></article>
            <article className="step panel-in" style={delayStyle('140ms')}><div className="n">03</div><h3>质量审核</h3><p>检查港味、平台适配和品牌安全。</p></article>
            <article className="step panel-in" style={delayStyle('210ms')}><div className="n">04</div><h3>消费者反馈</h3><p>参考目标消费者反馈，由你完成最终判断。</p></article>
          </div></div></section>

          <section id="pricing" className="snap compact"><div className="wrap"><div className="sec-head panel-in"><div className="sec-kicker">Plans</div><h2>选适合你的产能</h2><p>额度、能力与协作方式清晰对比。</p></div><div className="price-grid panel-in" style={delayStyle('80ms')}>
            <article className="price"><p className="who">适合试用与轻量需求</p><h3>Free</h3><div className="amt">¥0 <small>/ 滚动额度</small></div><div className="quota">每 7 天 20 次生成</div><ul><li>完整生成工作流</li><li>基础历史与收藏</li><li>单人使用</li></ul><a className="btn btn-secondary btn-block" href="/app">开始免费创作</a></article>
            <article className="price pro"><span className="tag">推荐</span><p className="who">适合高频运营与个人创作者</p><h3>Pro</h3><div className="amt">¥19 <small>/ 月</small></div><div className="quota">每自然月 250 次生成</div><ul><li>完整收藏与历史</li><li>高频运营产能</li><li>已有 Pro 当前周期立即生效</li></ul><a className="btn btn-primary btn-block" href="/app/billing">充值 Pro</a></article>
            <article className="price team"><span className="tag team-tag">团队</span><p className="who">适合品牌与代理协作</p><h3>团队协作版</h3><div className="amt">¥99 <small>/ 月</small></div><div className="quota">含 Pro 产能 · 团队协作</div><ul><li>审核分组</li><li>管理员句子批注</li><li>待审核队列与提醒</li></ul><button type="button" className="btn btn-secondary btn-block" onClick={() => setTeamContactOpen(true)} aria-label="联系开通团队协作版">联系开通</button></article>
          </div><div className="pricing-more"><a href="/pricing">了解套餐详情</a></div></div></section>

          <section id="cta" className="snap compact"><div className="wrap"><div className="cta-band panel-in"><h2>从一段原文开始，完成第一轮港式文案</h2><p>进入工作台，把内地腔写回香港节奏。</p><div className="cta-actions"><a className="btn btn-primary" href="/app">进入工作台</a><a className="btn btn-secondary" href="/pricing">查看完整定价与额度</a></div></div></div></section>
        </div>
      </main>

      <div className="wrap"><footer><div className="foot-brand"><span className="logo-box"><img src="/brand/77-logo.png" alt="" /></span><div><strong style={{ fontSize: 14 }}>77 港话通</strong><p>港式社媒文案创作、审核与协作工作台</p></div></div><div className="foot-links">{NAV_ITEMS.slice(0, 3).map(([label, href]) => <a key={href} href={href}>{label}</a>)}<a href="/pricing">定价</a><a href="/login">登录</a><a href="/app">进入应用</a></div><div className="foot-meta"><div>© 77 港话通</div><div data-testid="admin-review-contact" style={{ marginTop: 4 }}>团队需要管理员审核功能？请联系产品开发：TEL：<a href="tel:18595680518">18595680518</a></div></div></footer></div>

      <div className={`lightbox${openCase ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="案例预览" hidden={!openCase} onClick={(event) => { if (event.target === event.currentTarget) setOpenCaseIndex(null); }}>
        {openCase && <div className="lightbox-panel"><div className="lightbox-media"><button type="button" className="lb-nav prev" onClick={() => moveCase(-1)} aria-label="上一张">‹</button><img src={openCase.src} alt={openCase.title} /><button type="button" className="lb-nav next" onClick={() => moveCase(1)} aria-label="下一张">›</button></div><div className="lightbox-side"><h3>{openCase.title}</h3><div className="tags"><span>{openCase.badge}</span><span>思念香港</span></div><p>{openCase.description}</p><button type="button" className="btn btn-secondary lightbox-close" onClick={() => setOpenCaseIndex(null)}>关闭</button></div></div>}
      </div>
      <TeamContactDialog open={teamContactOpen} onClose={() => setTeamContactOpen(false)} />
    </div>
  );
}
