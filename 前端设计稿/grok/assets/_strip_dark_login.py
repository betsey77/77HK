# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(__file__).resolve().parent.parent / "login-page.html"
t = p.read_text(encoding="utf-8")

t = t.replace('<html lang="zh-Hant" data-theme="dark">', '<html lang="zh-Hant">', 1)

t = re.sub(
    r"\n    /\* ── Dark:.*?── \*/\n    \[data-theme=\"dark\"\] \{.*?\n    \}\n",
    "\n",
    t,
    count=1,
    flags=re.S,
)

old_root = """    :root {
      --font: \"PingFang HK\", \"Microsoft YaHei\", \"Segoe UI\", system-ui, sans-serif;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
      --radius-panel: 24px;
      --mx: 0.32;
      --my: 0.48;
    }"""

light_vars = """    :root {
      --font: \"PingFang HK\", \"Microsoft YaHei\", \"Segoe UI\", system-ui, sans-serif;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
      --radius-panel: 24px;
      --mx: 0.32;
      --my: 0.48;
      /* Light only · 白橙 soft flower */
      --bg: #f3ebe3;
      --page-ink: #1c1410;
      --ink: #1c1410;
      --ink-2: rgba(28, 20, 16, 0.72);
      --ink-3: rgba(28, 20, 16, 0.48);
      --ink-4: rgba(28, 20, 16, 0.34);
      --line: rgba(28, 20, 16, 0.1);
      --accent: #ea580c;
      --accent-2: #f97316;
      --accent-3: #fb923c;
      --accent-ink: #fff;
      --panel: rgba(255, 255, 255, 0.88);
      --panel-ring: rgba(234, 88, 12, 0.12);
      --panel-shadow: 0 24px 56px -24px rgba(154, 52, 18, 0.14);
      --secondary-bg: #ffffff;
      --secondary-hover: #fffaf6;
      --secondary-ink: #1c1410;
      --secondary-ring: rgba(28, 20, 16, 0.1);
      --hero-title: #1c1410;
      --tagline: #c2410c;
      --logo-label: rgba(154, 52, 18, 0.55);
      --credit: #ea580c;
      --credit-glow: rgba(234, 88, 12, 0.4);
      --tel-bg: rgba(234, 88, 12, 0.1);
      --tel-border: rgba(234, 88, 12, 0.3);
      --cursor: #ea580c;
      --foot-bg: rgba(255, 255, 255, 0.78);
      --foot-line: rgba(28, 20, 16, 0.08);
      --foot-ink: rgba(28, 20, 16, 0.72);
      --foot-muted: rgba(28, 20, 16, 0.42);
      --toolbar-bg: rgba(255, 255, 255, 0.86);
      --toolbar-ink: rgba(28, 20, 16, 0.7);
      --toolbar-strong: #1c1410;
      --toolbar-line: rgba(28, 20, 16, 0.1);
      --mesh-edge: #f7f0e8;
      --grain-opacity: 0.12;
      --flower-opacity: 0.78;
      --flower-filter: saturate(1.06) contrast(0.98) brightness(1.02);
      --flower-url: url(\"assets/ref-soft-flowers.png\");
      --read-tint: rgba(247, 240, 232, 0.62);
      --mesh-base: #f3ebe3;
      --mesh-a: rgba(255, 160, 100, 0.55);
      --mesh-b: rgba(255, 190, 140, 0.45);
      --mesh-c: rgba(150, 185, 230, 0.5);
      --mesh-d: rgba(190, 170, 230, 0.28);
      --mesh-e: rgba(255, 130, 80, 0.32);
    }"""

if old_root not in t:
    raise SystemExit("old_root not found")
t = t.replace(old_root, light_vars, 1)

t = re.sub(
    r"\n    /\* ── Light:.*?── \*/\n    \[data-theme=\"light\"\] \{.*?\n    \}\n",
    "\n",
    t,
    count=1,
    flags=re.S,
)

t = re.sub(
    r"\n    /\* 亮：与花图同系.*?\n    \[data-theme=\"light\"\] \{.*?\n    \}\n    /\* 暗：深绿雾底.*?\n    \[data-theme=\"dark\"\] \{.*?\n    \}\n",
    "\n",
    t,
    count=1,
    flags=re.S,
)

flowers = """    /* 主花层 · 亮版 soft flowers */
    .veil-flowers {
      position: absolute;
      left: 50%;
      top: 50%;
      width: min(100vmin, 820px);
      height: min(100vmin, 820px);
      margin: 0;
      background: var(--flower-url) center / cover no-repeat;
      opacity: 0.82;
      filter: var(--flower-filter) blur(3px);
      mix-blend-mode: multiply;
      transform:
        translate(
          calc(-50% + (var(--mx) - 0.5) * 18px),
          calc(-50% + (var(--my) - 0.5) * 14px)
        )
        scale(1.28);
      transition: transform 0.7s var(--ease), opacity 0.35s ease;
      mask-image: radial-gradient(
        ellipse 72% 72% at 50% 48%,
        #000 0%,
        #000 32%,
        rgba(0, 0, 0, 0.88) 48%,
        rgba(0, 0, 0, 0.45) 64%,
        rgba(0, 0, 0, 0.1) 78%,
        transparent 92%
      );
      -webkit-mask-image: radial-gradient(
        ellipse 72% 72% at 50% 48%,
        #000 0%,
        #000 32%,
        rgba(0, 0, 0, 0.88) 48%,
        rgba(0, 0, 0, 0.45) 64%,
        rgba(0, 0, 0, 0.1) 78%,
        transparent 92%
      );
      z-index: 2;
    }
"""

t2, n = re.subn(
    r"    /\*\n      主花层.*?    \*/\n    \.veil-flowers \{.*?\n    \}\n    \[data-theme=\"light\"\] \.veil-flowers \{.*?\n    \}\n    \[data-theme=\"dark\"\] \.veil-flowers \{.*?\n    \}\n\n    /\* 暗版不再需要.*?\n    \.veil-flowers-tint \{\n      display: none;\n    \}\n",
    flowers,
    t,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"flowers replace failed n={n}")
t = t2

bloom = """    .veil-bloom-soft {
      position: absolute;
      left: 50%;
      top: 50%;
      width: min(110vmin, 900px);
      height: min(110vmin, 900px);
      transform:
        translate(
          calc(-50% + (var(--mx) - 0.5) * -10px),
          calc(-50% + (var(--my) - 0.5) * -8px)
        );
      background:
        radial-gradient(circle at 40% 38%, rgba(255, 170, 110, 0.45) 0%, transparent 58%),
        radial-gradient(circle at 58% 45%, rgba(160, 180, 230, 0.4) 0%, transparent 55%),
        radial-gradient(circle at 48% 65%, rgba(130, 175, 230, 0.35) 0%, transparent 58%);
      filter: blur(52px);
      opacity: 0.65;
      z-index: 1;
      transition: transform 0.75s var(--ease);
      animation: bloom-float 14s ease-in-out infinite alternate;
    }
"""
t2, n = re.subn(
    r"    \.veil-bloom-soft \{.*?\n    \}\n    \[data-theme=\"light\"\] \.veil-bloom-soft \{.*?\n    \}\n    \[data-theme=\"dark\"\] \.veil-bloom-soft \{.*?\n    \}\n",
    bloom,
    t,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"bloom replace failed n={n}")
t = t2

t = re.sub(
    r"\n    \[data-theme=\"dark\"\] \.veil-soften \{.*?\n    \}\n",
    "\n",
    t,
    count=1,
    flags=re.S,
)

title = """    .type-title {
      margin: 0;
      font-weight: 900;
      letter-spacing: -0.035em;
      line-height: 0.98;
      font-size: clamp(2.5rem, 7.5vw, 3.35rem);
      background: linear-gradient(115deg, #1c1410 0%, #1c1410 40%, #9a3412 70%, #ea580c 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.55));
    }
"""
t2, n = re.subn(
    r"    \.type-title \{.*?\n    \}\n    \[data-theme=\"light\"\] \.type-title \{.*?\n    \}\n    \[data-theme=\"dark\"\] \.type-title \{.*?\n    \}\n",
    title,
    t,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"title replace failed n={n}")
t = t2

t = t.replace(
    """      [data-theme=\"light\"] .type-title {
        background: none;
        -webkit-text-fill-color: #1c1410;
        color: #1c1410;
        filter: none;
      }
""",
    """      .type-title {
        background: none;
        -webkit-text-fill-color: #1c1410;
        color: #1c1410;
        filter: none;
      }
""",
)

t = t.replace(
    """  <div class=\"toolbar\" role=\"toolbar\" aria-label=\"设计验收\">
    <strong>登录页</strong>
    <span class=\"sep\" aria-hidden=\"true\"></span>
    <button type=\"button\" class=\"active\" data-theme-set=\"dark\">暗 · 黑绿</button>
    <button type=\"button\" data-theme-set=\"light\">亮 · 白橙</button>
    <span class=\"sep\" aria-hidden=\"true\"></span>
    <a class=\"link\" href=\"homepage-v2.html\">← 首页稿</a>
  </div>""",
    """  <div class=\"toolbar\" role=\"toolbar\" aria-label=\"设计验收\">
    <strong>登录页 · 亮版</strong>
    <span class=\"sep\" aria-hidden=\"true\"></span>
    <a class=\"link\" href=\"homepage-v2.html\">← 首页稿</a>
  </div>""",
)

t = t.replace('      <div class="veil-flowers-tint"></div>\n', "")

t2, n = re.subn(
    r"      const themeButtons = document\.querySelectorAll\(\"\[data-theme-set\]\"\);\n      const reduceMotion = window\.matchMedia\(\"\(prefers-reduced-motion: reduce\)\"\)\.matches;\n\n      function setTheme\(theme\) \{.*?\n      \} catch \(_\) \{\}\n\n      /\* 鼠标扰动",
    '      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;\n\n      /* 鼠标扰动',
    t,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"js replace failed n={n}")
t = t2

t = t.replace("登录页设计稿（核验用）", "登录页设计稿 · 亮版（核验用）", 1)

p.write_text(t, encoding="utf-8")
print("OK", p)
for s in ['data-theme="dark"', "data-theme-set", "ref-soft-flowers-dark", "黑绿", "[data-theme"]:
    print(s, t.count(s))
