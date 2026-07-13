# 🎨 思念文案引擎 — 前端设计规范

> 版本: v1.0 | 最后更新: 2026-07-11
> 技术栈: React 19 + TypeScript 5.7 + Tailwind CSS v4 + Lucide React

---

## 目录

1. [设计哲学](#一设计哲学)
2. [色彩系统](#二色彩系统)
3. [字体排印](#三字体排印)
4. [间距与尺寸](#四间距与尺寸)
5. [布局系统](#五布局系统)
6. [主题系统（深色/浅色）](#六主题系统深色浅色)
7. [共享基础组件](#七共享基础组件)
8. [交互模式库](#八交互模式库)
9. [图标系统](#九图标系统)
10. [组件结构规范](#十组件结构规范)
11. [状态展示规范](#十一状态展示规范)
12. [表单控件规范](#十二表单控件规范)
13. [动画与过渡](#十三动画与过渡)
14. [约定与反模式](#十四约定与反模式)

---

## 一、设计哲学

### 1.1 产品定位

> **思念** 是面向香港品牌运营人员的专业工具。界面风格需要体现：
> - **专业可信赖** — 不是玩具，是真能用到工作中的生产力工具
> - **信息密度适中** — 每屏展示足够信息，但不拥挤
> - **深色为主、浅色为辅** — 默认深色模式，适合长时间编辑
> - **数据可视化直觉化** — 温度计、柱状条、颜色温度指示

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **内容优先** | UI 不抢内容风头。文案生成结果是页面的主角 |
| **即时反馈** | 所有可交互元素必须有 hover/active/disabled 状态 |
| **一致性** | 同类控件统一使用共享组件，不各自写样式 |
| **无障碍** | focus-visible 环、适当的颜色对比度、title 属性 |
| **中国大陆字体内嵌** | 默认字体栈包含 PingFang HK、Microsoft YaHei |

### 1.3 禁止事项

- ❌ 不使用内联 `style={{}}`，始终用 Tailwind class
- ❌ 不硬编码 HEX 颜色到组件中（除 Tailwind 已提供的色值）
- ❌ 不使用第三方 CSS-in-JS 库
- ❌ 不引入额外 UI 框架（MUI、Chakra、shadcn 等）
- ❌ 不自定义 Tailwind 主题（使用默认色板）

---

## 二、色彩系统

### 2.1 语义色板

项目使用 Tailwind CSS v4 默认色板，以下为实际使用的语义色：

#### 主色（双模式）

深色模式使用 **Emerald（翡翠绿）**，浅色模式使用 **Orange（活力橙）**。CTA 按钮、评分、标尺亮点、引擎状态等所有品牌强调元素均遵循此规则。

##### 深色模式 — Emerald

| Token | 用途 |
|-------|------|
| `emerald-300` | 文本/图标 — 评分数字、选中 Tab |
| `emerald-400` | 主要强调 — 引擎指示点、高分柱条 |
| `emerald-500` | 按钮背景 — 主要 CTA（生成文案） |
| `emerald-500/15` | 微妙背景 — 评分容器背景、选中 chip 背景 |
| `emerald-500/20` | 醒目背景 — SegmentedControl 选中态、Badge |
| `emerald-500/30` | hover 加深 — 按钮 hover |

##### 浅色模式 — Orange

| Token | 对应深色 Token | 用途 |
|-------|---------------|------|
| `orange-600` | `emerald-400` | 主要强调 — 引擎指示点、高分柱条、评分数字 |
| `orange-700` | `emerald-300` | 文本/图标 — 评分数字、选中 Tab |
| `orange-50` | `emerald-500/15` | 微妙背景 — engine badge 背景 |
| `orange-200` | `emerald-500/20` | 边框 — engine badge border |
| `orange-600/70` | — | 引擎说明文字 |

**浅色模式下，所有 `light:text-emerald-*` / `light:bg-emerald-*` / `light:border-emerald-*` 均改为对应的 orange。深色模式 emerald 不变。**

##### 🔶 浅色模式强调色 — Orange（活力橙）

浅色模式下的品牌主色。深色模式的 emerald 在浅色时全部替换为 orange。

| Token | 用途 |
|-------|------|
| `orange-600` | light 模式强调文本、引擎指示、高分柱条 |
| `orange-700` | light 模式评分数字、选中 Tab |
| `orange-50` | light 模式引擎 badge 微妙背景 |
| `orange-200` | light 模式引擎 badge 边框 |
| `orange-500/15` | light 模式评分容器背景、选中 chip 背景 |
| `orange-500/20` | light 模式 SegmentedControl 选中态、Badge |

#### 警示色 — Amber（琥珀黄）

收藏、评分、中等严重度议题。**注意区分**：Amber 用于收藏/评分功能（语义独立），Orange 用于 light 模式下的品牌强调（与 dark 模式 emerald 等价）。

#### 危险色 — Red

| Token | 用途 |
|-------|------|
| `red-400` | 标红文本、高严重度议题 |
| `red-500` | 分数字柱 < 40 |
| `red-500/15` | diff 高亮背景、Badge (high) |

#### 信息色 — Blue

| Token | 用途 |
|-------|------|
| `blue-300` | 低严重度 Badge 文本 |
| `blue-500/15` | 低严重度 Badge 背景 |

#### 中性色 — Gray

深色模式下灰色是最主要的表面/分隔色：

| Token | 深色模式 | 浅色模式 |
|-------|---------|---------|
| `gray-950` | 主背景 | `white` 等价 |
| `gray-900` | 次背景、输入框内层 | `white` |
| `gray-800` | 按钮、card 背景、输入框外层 | `gray-100` |
| `gray-800/20` | Card 内容区背景 | `gray-100` |
| `gray-800/30` | 面板标题栏背景 | `gray-100` |
| `gray-700` | 分隔线、滑块轨道 | `gray-200` |
| `gray-700/30` | 卡片 border | `gray-300/50` |
| `gray-600` | 辅助文本 | `gray-500` |
| `gray-500` | 占位符、禁用文本、图标 | — |
| `gray-400` | 正文、label 文本 | `gray-600` |
| `gray-300` | 主要内容文本 | `gray-800` |
| `gray-200` | 强调文本 | `gray-800` |
| `gray-100` | 标题文本 | `gray-900` |

### 2.2 评分色阶

用于温度计和分数柱状条：

| 分值范围 | 颜色 | Tailwind class |
|---------|------|---------------|
| 0–1 (0–20%) | 红 | `text-red-400` / `bg-red-400` |
| 2 (21–40%) | 琥珀 | `text-amber-400` / `bg-amber-400` |
| 3 (41–60%) | 黄 | `text-yellow-400` / `bg-yellow-400` |
| 4 (61–80%) | 青柠 | `text-lime-400` / `bg-lime-400` |
| 5 (81–100%) | 翡翠 | `text-emerald-400` / `bg-emerald-400` |

### 2.3 温度计渐变

SVG 线性渐变: `#f87171`(红) → `#fbbf24`(黄) → `#a3e635`(绿) → `#34d399`(翠绿)

---

## 三、字体排印

### 3.1 字体栈

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang HK", "Microsoft YaHei", sans-serif;
```

优先使用系统原生字体，确保粤语繁体中文字符渲染正确。`PingFang HK` 是香港 macOS/iOS 默认中文字体。

### 3.2 字号阶梯

项目中不使用 Tailwind 的 `text-base`/`text-lg`，而是一个压缩的字号体系：

| 字号 | Tailwind | 使用场景 |
|------|----------|---------|
| 8px | `text-[8px]` | 收藏数 badge、极小标注 |
| 10px | `text-[10px]` | 辅助标注、时间戳、页脚、标签说明 |
| 11px | `text-[11px]` | Badge、按钮文字、分数字数字、参数表格 |
| 12px | `text-xs` | Section 标题、输入框 label、面包屑、Tab、副文本 |
| 13px | `text-sm` | **正文文案（核心内容区）**、按钮 |
| 14px | 未使用 | — |
| 24px | `text-2xl` | 总分大数字（`font-bold`） |

**规则**：正文永远用 `text-sm`（13px），不因平台缩放。辅助信息 ≤ `text-xs`。

### 3.3 字重

| 字重 | Tailwind | 用途 |
|------|----------|------|
| 400 (normal) | 默认 | 正文、输入框 |
| 500 (medium) | `font-medium` | label、Tab 按钮、Badge |
| 600 (semibold) | `font-semibold` | 标题、CTA 按钮、分数字 |
| 700 (bold) | `font-bold` | Header 标题、总分大数字 |

### 3.4 字距与行高

- 标题: `tracking-tight`（-0.025em）
- Section 标题: `tracking-wider`（0.05em）+ `uppercase`
- 正文: `leading-relaxed`（1.625）
- 输入框 placeholder: `placeholder-gray-500`
- 等宽数字: `font-mono`（评分、计数器）

---

## 四、间距与尺寸

### 4.1 内边距体系

| 尺寸 | Tailwind | 场景 |
|------|----------|------|
| 4px | `p-1` | 图标按钮、chip |
| 6px | `p-1.5` | tag、compact 按钮 |
| 8px | `p-2` | 按钮内 padding、单元格 |
| 10px | `p-2.5` | 输入框、Header、CTA 按钮 |
| 12px | `p-3` | Card 内容区、面板 body |
| 16px | `p-4` | 面板外层、页面 padding |

### 4.2 间距（gap）

| 尺寸 | Tailwind | 场景 |
|------|----------|------|
| 2px | `gap-0.5` | 紧凑按钮组、chip 间距 |
| 4px | `gap-1` | 图标与文字、label 与控件 |
| 6px | `gap-1.5` | Badge 间距、控件内间距 |
| 8px | `gap-2` | 按钮组、表单行 |
| 12px | `gap-3` | 控件组、Header 元素间隔 |
| 16px | `gap-4` | 面板内容区（`InputPanel`） |
| 20px | `gap-5` | 面板 section 间距（`AuditPanel`） |

### 4.3 圆角

| 尺寸 | Tailwind | 场景 |
|------|----------|------|
| 4px | `rounded` | 小按钮、Chip、Badge |
| 6px | `rounded-md` | SegmentedControl 选项 |
| 8px | `rounded-lg` | Card、输入框、按钮、面板区块 |
| 50% | `rounded-full` | Badge、滑动条 thumb、指示灯 |

### 4.4 边界线

| 样式 | 场景 |
|------|------|
| `border-b border-gray-800` | Header/Footer 底边 |
| `border border-gray-700/30` | Card 边框（30% 透明度） |
| `border border-gray-700/50` | 输入框边框（50% 透明度） |
| `divide-x divide-gray-800` | 三栏分隔线 |
| `border-t border-gray-700/20` | Card 内分隔（20% 透明度） |

---

## 五、布局系统

### 5.1 顶层结构

```
┌──────────────────────────────────────────────────────┐
│ Header  (h: auto, shrink-0, border-b)                │
├────────────┬─────────────────────────┬───────────────┤
│ InputPanel │ ResultsPanel           │ AuditPanel    │
│ (30%)      │ + InspirationPanel     │ (30%)         │
│            │ (center, flex-1)       │               │
├────────────┴─────────────────────────┴───────────────┤
│ Footer  (h: auto, shrink-0, border-t)                │
└──────────────────────────────────────────────────────┘
```

### 5.2 三栏布局 — ThreePanel

```tsx
// grid 列定义: 左右最小 260px，最大 30%，中间自适应
<div className="flex-1 grid grid-cols-[minmax(260px,30%)_1fr_minmax(260px,30%)] 
     divide-x divide-gray-800 light:divide-gray-200 overflow-hidden">
```

左栏和右栏：
- `overflow-hidden` 防止内容溢出
- 深色: `bg-gray-950/50`，浅色: `bg-gray-100/50`

中栏：
- `overflow-hidden`
- 深色: `bg-gray-950/30`，浅色: `bg-gray-50`
- `p-4` padding

### 5.3 面板内部布局

#### InputPanel（左栏）
```tsx
<div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
```

**控件内部统一结构**：
```tsx
<div className="space-y-1">
  <label className="text-xs text-gray-400 light:text-gray-600 font-medium">
    控件名
  </label>
  {/* 控件本体 */}
</div>
```

#### ResultsPanel（中栏上半）
- `flex-1 overflow-y-auto` — 占据剩余高度
- Variant tabs + ResultCard 网格/堆叠

#### AuditPanel（右栏）
```tsx
<div className="flex flex-col gap-5 h-full overflow-y-auto p-4">
```

每个 section 块：
```tsx
<div>
  <SectionTitle>标题</SectionTitle>
  <div className="mt-2 bg-gray-800/20 light:bg-gray-100 border border-gray-700/30 
       light:border-gray-300/50 rounded-lg p-3">
    {/* 内容 */}
  </div>
</div>
```

### 5.4 滑出面板

#### FavoritesPanel（右侧滑出）
```tsx
<div className="fixed inset-0 z-50 flex justify-end">
  <div className="absolute inset-0 bg-black/50" onClick={onClose} />  {/* 遮罩 */}
  <div className="relative w-full max-w-md h-full ...">              {/* 面板 */}
```

- 固定定位 + z-50
- 半透明黑色遮罩（`bg-black/50`）
- 面板最大宽度 `max-w-md`（448px）
- `shadow-2xl` 投影

### 5.5 灵感面板（内嵌折叠）

```tsx
<div className="mt-3 border border-gray-700/30 rounded-lg overflow-hidden flex-shrink-0">
  <button onClick={toggle}>  {/* 标题栏 — 点击折叠/展开 */}
  <div className={`transition-all duration-200 ${
    isExpanded ? 'max-h-[300px] overflow-y-auto' : 'max-h-0 overflow-hidden'
  }`}>
```

- 位于 ResultsPanel 下方，不遮挡结果
- `max-h-[300px]` 展开高度
- `transition-all duration-200` 折叠动画
- Tab 栏 + 内容区在可折叠体内部

---

## 六、主题系统（深色/浅色）

### 6.1 实现方式

使用 Tailwind v4 的 `@custom-variant`：

```css
@custom-variant light (&:where(.light, .light *));
```

在 `App.tsx` 根元素上切换 class：
```tsx
<div className="flex flex-col h-full bg-gray-950 light:bg-white">
```

Theme 通过 `<html>` 元素上的 `.light` class 控制：
```tsx
document.documentElement.classList.toggle('light', theme === 'light');
```

### 6.2 双模式模式对照表

组件中每个颜色 class 都必须有 `light:` 变体。标准模式：

| 属性 | 深色 (默认) | 浅色 (`light:`) |
|------|-----------|-----------------|
| 主背景 | `bg-gray-950` | `bg-white` |
| 次背景 | `bg-gray-950/50` | `bg-gray-100/50` |
| Card 表面 | `bg-gray-800/20` | `bg-gray-100` |
| 输入框 | `bg-gray-800/50` | `bg-gray-200` |
| 输入框边框 | `border-gray-700/50` | `border-gray-300` |
| 正文文本 | `text-gray-200` / `text-gray-300` | `text-gray-800` |
| 辅助文本 | `text-gray-400` | `text-gray-600` |
| 弱文本 | `text-gray-500` | `text-gray-500` |
| 分隔线 | `border-gray-800` | `border-gray-200` |
| Card 边框 | `border-gray-700/30` | `border-gray-300/50` |
| hover 表层 | `hover:bg-gray-800` | `hover:bg-gray-200` |
| 按钮背景 | `bg-gray-800` | `bg-gray-100` |
| 品牌强调色 | `text-emerald-300` / `text-emerald-400` | `text-orange-600` / `text-orange-700` |
| 品牌强调背景 | `bg-emerald-500/15` / `bg-emerald-500/20` | `bg-orange-50` / `bg-orange-500/20` |
| 品牌强调边框 | `border-emerald-500/20` | `border-orange-200` |
| 收藏/评分色 | `text-amber-400` | `text-amber-600` |

### 6.3 主题切换按钮

Header 右侧的日月图标按钮：
```tsx
<button onClick={toggle}>
  {isDark ? <Sun /> : <Moon />}
</button>
```

### 6.4 持久化

`localStorage` key: `hk-cantonese-theme`，值: `'dark'` | `'light'`

---

## 七、共享基础组件

所有共享组件位于 `client/src/components/shared/`，是构建 UI 的最小原子单元。

### 7.1 Tabs

```tsx
<Tabs tabs={[{key, label}]} activeTab={string} onTabChange={(key) => void} />
```

**样式**：
- 容器: `flex border-b border-gray-700/50 light:border-gray-300`
- Tab 按钮: `px-3 py-2 text-xs font-medium`
- 激活态: `border-b-2 border-emerald-400 text-emerald-300 light:text-orange-700 light:border-orange-400`
- 未激活: `text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600`
- 通过 `-mb-[1px]` 让底部 border 与容器重合

### 7.2 SegmentedControl

```tsx
<SegmentedControl<T> options={[{value, label}]} value={T} onChange={(v) => void} />
```

**样式**：
- 容器: `flex bg-gray-800 light:bg-gray-100 rounded-lg p-0.5 gap-0.5`
- 选项按钮: `flex-1 px-2 py-1.5 text-xs font-medium rounded-md`
- 激活态: `bg-emerald-500/20 text-emerald-300 light:text-orange-700 light:bg-orange-500/20 shadow-sm`
- 未激活: `text-gray-400 light:text-gray-600 hover:text-gray-200 hover:bg-gray-700/50`

### 7.3 Slider

```tsx
<Slider label value min max step leftLabel rightLabel onChange />
```

**样式**：
- Label + 数值显示行: `flex justify-between`
- 数值 badge: `text-xs font-mono text-emerald-400 light:text-orange-600 bg-emerald-400/10 light:bg-orange-400/10 px-1.5 py-0.5 rounded`
- 滑动条轨道: `w-full h-1.5 rounded-full bg-gray-700 light:bg-gray-200`
- 滑动条填充: `linear-gradient` 内联 style（比例计算）
- Thumb: `w-4 h-4 rounded-full bg-emerald-400 shadow-md`
- 使用 `[&::-webkit-slider-thumb]:` 伪元素样式

### 7.4 Badge

```tsx
<Badge label="xxx" variant="red" | "amber" | "green" | "blue" | "gray" dot? />
```

**样式**：
- 容器: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border`
- 5 种 variant 各有 `bg-{color}-500/15` + `text-{color}-300` + `border-{color}-500/20`（green variant 浅色模式: `light:text-orange-700 light:bg-orange-500/15 light:border-orange-500/20`）
- `dot` 模式: 文字前额外显示一个 `w-1.5 h-1.5 rounded-full` 小圆点

### 7.5 Spinner

```tsx
<Spinner label="生成中..." />
```

**样式**：
- 容器: `flex flex-col items-center justify-center gap-3 py-12`
- 动画环: 外层 `border-2 border-gray-700` + 内层 `border-2 border-t-emerald-400 animate-spin`
- 尺寸: `w-10 h-10`
- 标签: `text-sm text-gray-400`

### 7.6 Tooltip

```tsx
<Tooltip content="提示文字">
  <button>...</button>
</Tooltip>
```

**样式**：
- 定位: `absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50`
- 容器: `bg-gray-800 light:bg-gray-100 text-gray-200 light:text-gray-800 text-[11px] px-2 py-1 rounded shadow-lg border border-gray-700`
- 显示控制: `onMouseEnter`/`onMouseLeave` 控制 state

---

## 八、交互模式库

### 8.1 按钮

#### 主要 CTA（生成文案）
```
py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
正常: bg-emerald-500 text-gray-950 hover:bg-emerald-400 active:scale-[0.98] cursor-pointer
禁用: bg-gray-800 text-gray-600 cursor-not-allowed
```

#### 次要操作按钮（复制、编辑、删除）
```
inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all duration-150
正常: bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700
成功态: bg-emerald-500/20 text-emerald-300
```

#### 小图标按钮（收藏、取消、功能触发）
```
p-0.5 / p-1 rounded transition-all
正常: text-gray-500 hover:text-amber-400
激活: text-amber-400 hover:text-amber-300
```

#### 文字按钮 / Chip 切换
```
text-[10px] / text-[11px] px-1.5 py-0.5 rounded-full border transition-colors
选中: bg-emerald-500/15 border-emerald-500/30 text-emerald-400
未选中: bg-gray-800/30 border-gray-700/20 text-gray-500 hover:border-emerald-500/30
```

### 8.2 输入框

统一输入框样式（适用于 `input`、`textarea`、`select`）：

```
w-full bg-gray-800/50 light:bg-gray-200 
border border-gray-700/50 light:border-gray-300 
rounded-lg px-3 py-2 / py-2.5 
text-sm text-gray-200 light:text-gray-800
placeholder-gray-500 light:placeholder-gray-400 
resize-y / resize-none
focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
light:focus:border-orange-500/50 light:focus:ring-orange-500/20
transition-colors
```

**编辑态 textarea 变体**（文案卡片内）：
```
bg-gray-900/60 light:bg-white 
border-gray-600/50 light:border-gray-400
focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
```

### 8.3 Card 容器

**基础 Card**（用于 Audit 各 section）：
```
bg-gray-800/20 light:bg-gray-100 
border border-gray-700/30 light:border-gray-300/50 
rounded-lg p-3
```

**收藏 Card**：
```
bg-gray-800/40 light:bg-gray-100 
border border-gray-700/30 light:border-gray-300/50 
rounded-lg overflow-hidden
```

**文案 Card 内容区**：
```
flex-1 bg-gray-800/20 light:bg-gray-100 
border border-gray-700/30 light:border-gray-300/50 
rounded-lg p-3 overflow-y-auto space-y-3
```

### 8.4 Section 标题

```tsx
<h3 className="text-[11px] font-semibold text-gray-500 light:text-gray-500 
    uppercase tracking-wider">
  标题名
</h3>
```

### 8.5 分隔线

```tsx
// 区块分隔
<div className="border-t border-gray-700/40 light:border-gray-300/40 pt-2.5">
// Card 内分隔（更淡）
<div className="border-t border-gray-700/20 light:border-gray-300/30 pt-2">
// 翻译区
<div className="border-t border-gray-700/40 pt-2.5">
```

### 8.6 Diff 高亮（修改标红）

```tsx
// 变更内容: 红底红字
<span className="text-red-300 light:text-red-700 bg-red-500/15 light:bg-red-100 
      rounded px-0.5">
  修改的内容
</span>

// 标红图例
<div className="flex items-center gap-1.5 text-[10px]">
  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
  <span className="text-red-400 light:text-red-600">红色标记为修改内容</span>
</div>
```

### 8.7 空状态

```
flex flex-col items-center justify-center h-full text-center gap-2 / gap-3
  └─ 图标: text-2xl / text-4xl opacity-30
  └─ 说明: text-xs / text-sm text-gray-500
  └─ 引导 (可选): text-xs text-gray-600 max-w-xs
```

### 8.8 加载态

- Spinner: `Spinner` 组件，居中显示
- 生成中提示: `animate-pulse` 文字 + 绿色闪烁小圆点
- 按钮内: 文字变为 `'生成中...'`

### 8.9 引擎状态指示器（Header 右侧）

```tsx
<span className="flex items-center gap-1 text-[10px] text-{color}">
  <span className="w-1.5 h-1.5 rounded-full bg-{color} 
       {isLocal && 'animate-pulse'}" />
  {engineName}
</span>
```

状态色：
- 本地 4B 模型: `text-emerald-400` + 动画脉冲
- CantoneseLLMChat 32B: `text-emerald-400`（无脉冲）
- DeepSeek: `text-gray-500`
- 快速规则: `text-amber-400`
- 待命: `text-gray-600`

---

## 九、图标系统

### 9.1 图标库

使用 **Lucide React** (`lucide-react` ^0.468.0)，不引入其他图标库。

### 9.2 使用中的图标清单

| 图标 | 导入名 | 场景 |
|------|--------|------|
| ⭐ | `Star` | 收藏按钮、收藏库入口、评分星星 |
| ✏️ | `Pencil` | 编辑文案按钮 |
| 📋 | `Copy` | 复制文案 |
| ✓ | `Check` | 复制成功反馈 |
| 🗑️ | `Trash2` | 删除收藏 |
| 🔗 | `ExternalLink` | 载入参数 |
| 🔽 | `ChevronDown` | 展开参数详情 |
| 🔼 | `ChevronUp` | 收起参数详情 |
| ✕ | `X` | 关闭面板 |
| 🔄 | `RefreshCw` | 换一种写法 / 重新生成 |
| ☀️ | `Sun` | 浅色模式图标 |
| 🌙 | `Moon` | 深色模式图标 |

### 9.3 尺寸规范

| 尺寸 | class | 场景 |
|------|-------|------|
| 12px | `w-3 h-3` | 行内图标（复制、编辑、收藏卡片操作） |
| 14px | `w-3.5 h-3.5` | 收藏按钮、Header 图标 |
| 16px | `w-4 h-4` | Header 引擎指示圆点、面板关闭按钮 |
| 20px | `w-5 h-5` | 未使用 |

### 9.4 图标按钮模板

```tsx
<button className="p-1 rounded text-gray-500 hover:text-{color} transition-colors"
  title="操作描述">
  <IconName className="w-3.5 h-3.5" />
</button>
```

---

## 十、组件结构规范

### 10.1 目录组织

```
client/src/components/
├── layout/           # 页面级布局
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── ThreePanel.tsx
├── input/            # 左栏输入控件
│   ├── InputPanel.tsx          # 容器
│   ├── SourceEditor.tsx
│   ├── BrandInput.tsx
│   ├── BrandRedLinesInput.tsx
│   ├── PlatformSelector.tsx
│   ├── ToneSelector.tsx
│   ├── CantoneseSlider.tsx
│   ├── EnglishMixingSlider.tsx
│   ├── CreativitySlider.tsx
│   ├── LanguageToggle.tsx
│   ├── StructuredBriefToggle.tsx
│   ├── TargetDatePicker.tsx
│   ├── CompetitorSearchInput.tsx
│   ├── PersonaManager.tsx
│   ├── ConfigManager.tsx
│   └── ReferenceCaseSelector.tsx
├── results/          # 中栏结果展示
│   ├── ResultsPanel.tsx
│   ├── ResultCard.tsx
│   ├── ScoreDisplay.tsx
│   ├── DiagnosisSummary.tsx
│   ├── ConsumerFeedback.tsx
│   ├── BookmarkButton.tsx
│   └── CopyButton.tsx
├── audit/            # 右栏审核
│   ├── AuditPanel.tsx          # 容器
│   ├── ThermometerGauge.tsx
│   ├── IssueChips.tsx
│   ├── ReplacementCard.tsx
│   ├── RiskNotes.tsx
│   ├── SimulatedComments.tsx
│   └── QuickCheck.tsx
├── inspiration/      # 中栏底部灵感面板
│   ├── InspirationPanel.tsx
│   ├── LanguageVibeTab.tsx
│   ├── TopicCalendarTab.tsx
│   ├── HotTrendsTab.tsx
│   ├── CompetitorActivityTab.tsx
│   ├── PostCard.tsx
│   ├── CalendarEventCard.tsx
│   ├── CompetitorAdCard.tsx
│   └── SkeletonCard.tsx
├── favorites/        # 收藏库滑出面板
│   └── FavoritesPanel.tsx
└── shared/           # 通用原子组件
    ├── Tabs.tsx
    ├── Slider.tsx
    ├── SegmentedControl.tsx
    ├── Badge.tsx
    ├── Spinner.tsx
    └── Tooltip.tsx
```

### 10.2 组件命名规范

- **容器组件**: `{Domain}Panel`（如 `InputPanel`、`AuditPanel`）
- **功能卡片**: `{Name}Card`（如 `ResultCard`、`PostCard`）
- **按钮**: `{Action}Button`（如 `BookmarkButton`、`CopyButton`）
- **Tab 内容**: `{Name}Tab`（如 `LanguageVibeTab`、`HotTrendsTab`）
- **共享组件**: 单个词（如 `Tabs`、`Slider`、`Badge`）
- **文件命名**: PascalCase，与 default export 名一致

### 10.3 Context 使用模式

```tsx
import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function MyComponent() {
  const { state, dispatch } = useContext(AppContext);
  // ...
}
```

- 所有组件直接从 `AppContext` 读取 `state` 和 `dispatch`
- 不创建额外 Context（除非有明确的隔离需求）
- 不 prop-drill 超过 2 层

---

## 十一、状态展示规范

### 11.1 四个 UI 状态

`uiState: 'idle' | 'loading' | 'success' | 'error'`

| 状态 | AuditPanel 展示 | ResultsPanel 展示 | InputPanel CTA |
|------|----------------|-------------------|----------------|
| `idle` | 空白引导插图 | 空白（不可见） | "🚀 生成文案" enabled |
| `loading` | "加载中..." | Spinner | "生成中..." disabled |
| `success` | 完整审核面板 | 5 个 variant tabs | "🚀 生成文案" (重新生成) |
| `error` | 不显示 | 错误信息 | "🚀 生成文案" enabled |

### 11.2 错误态

- 使用 `state.error` 显示错误信息
- 颜色: `text-red-400`
- 不阻塞用户重试

### 11.3 禁用态

按钮禁用使用 `cursor-not-allowed` + 降低不透明度：
```tsx
disabled={!canGenerate}
className={canGenerate 
  ? 'bg-emerald-500 ... cursor-pointer' 
  : 'bg-gray-800 ... cursor-not-allowed'}
```

禁用态不透明度通过颜色本身变淡实现（`text-gray-600`），不使用 `opacity-50`。

---

## 十二、表单控件规范

### 12.1 控件结构

所有输入控件遵循统一结构：

```tsx
<div className="space-y-1">
  <label className="text-xs text-gray-400 light:text-gray-600 font-medium">
    {label}
  </label>
  {/* 控件本体 */}
</div>
```

### 12.2 控件类型对照

| 数据类型 | 控件 | 文件 |
|---------|------|------|
| 文本（短） | `<input type="text">` | `BrandInput.tsx` |
| 文本（长） | `<textarea>` | `SourceEditor.tsx` |
| 枚举（互斥） | `SegmentedControl` | `PlatformSelector.tsx` |
| 枚举（下拉） | `<select>` | `ToneSelector.tsx` |
| 范围（连续） | `Slider`（共享组件） | `CantoneseSlider.tsx` |
| 布尔 | Toggle 按钮 | `StructuredBriefToggle.tsx` |
| 日期 | `<input type="date">` + 日历图标 | `TargetDatePicker.tsx` |
| 多选文本 | Tag 输入 | `CompetitorSearchInput.tsx` |
| 复杂对象 | 专用管理器 | `PersonaManager.tsx` |

### 12.3 select 下拉样式

```tsx
<select className="w-full bg-gray-800/50 light:bg-gray-200 
  border border-gray-700/50 light:border-gray-300 
  rounded-lg px-3 py-2 text-sm text-gray-200 light:text-gray-800
  focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 
  light:focus:border-orange-500/50 light:focus:ring-orange-500/20
  transition-colors cursor-pointer">
```

---

## 十三、动画与过渡

### 13.1 使用的动画

| 动画 | Tailwind | 场景 |
|------|----------|------|
| 旋转 | `animate-spin` | Spinner、RefreshCw 按钮加载中 |
| 脉冲 | `animate-pulse` | 本地模型指示点、生成提示文字 |
| 过渡 150ms | `transition-all duration-150` | 按钮 hover、Tab 切换 |
| 过渡 200ms | `transition-all duration-200` | 可折叠面板展开/收起、CTA 按钮 |
| 过渡 500ms | `transition-all duration-500` | 分数字柱填充、温度计弧线（`transition-all duration-700`） |
| 颜色过渡 | `transition-colors` | 图标、chip、链接 |
| 缩放反馈 | `active:scale-[0.98]` | CTA 按钮点击 |
| 高度折叠 | `max-h-0 → max-h-[300px]` | 灵感面板展开 |

### 13.2 动画原则

- **只在必要时动** — 不滥用动效。动画服务于状态变化反馈
- **短促明确** — 按钮/图标用 150ms，面板用 200ms，数据可视化用 500-700ms
- **不自动轮播** — 无 carousel、无 marquee
- **不使用 animate-bounce / animate-ping** — 过于干扰

### 13.3 过渡曲线

使用 Tailwind 默认 `cubic-bezier(0.4, 0, 0.2, 1)`（`ease-in-out`），不自定义。

---

## 十四、约定与反模式

### 14.1 必须遵守

✅ **所有组件必须处理 `light:` 变体** — 深色和浅色都要能正常显示
✅ **使用共享组件** — 能用 `shared/` 里的组件就不要自己写
✅ **输入框统一 focus 样式** — 深色 `focus:border-emerald-500/50 focus:ring-emerald-500/20`，浅色 `light:focus:border-orange-500/50 light:focus:ring-orange-500/20`
✅ **所有按钮要有 `title` 属性** — 图标按钮提供无障碍描述
✅ **可交互元素要有 `cursor-pointer`**
✅ **从 `AppContext` 读取状态，不新建 state** — 除非是纯 UI state（折叠、编辑态等）

### 14.2 禁止

❌ **不使用 inline style** — 所有样式写 Tailwind class。唯一例外是 Slider 的 `linear-gradient` 填充（因为依赖计算比例）
❌ **不硬编码 HEX 颜色** — 不要写 `style={{ color: '#34d399' }}`、`className="text-[#34d399]"`
❌ **不引入非标准字号** — 不用 `text-[13px]`、`text-[15px]` 等非设计系统字号（除非有充分理由）
❌ **不创建超过 3 层的组件嵌套** — 如果嵌套深了，拆组件
❌ **不滥用 `!important`** — Tailwind 不应该需要 `!`
❌ **不要手动 CSS** — 所有样式写在 className 中。`index.css` 只包含全局重置和字体栈

### 14.3 文件大小上限

- 组件文件 ≤ 300 行（不含 import/type 定义）。超过则拆分
- `ConsumerFeedback.tsx`（~800 行）为已确认的技术债，未来须重构

---

## 附录 A：快速参考卡片

> **注意**：以下速查展示的是深色模式（默认）。浅色模式下，emerald → orange 全局生效。
> 详见 [二、色彩系统](#二色彩系统)。

### 按钮速查

```
CTA 主按钮:   py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
              深色: bg-emerald-500 text-gray-950 hover:bg-emerald-400 active:scale-[0.98]
              浅色: bg-orange-500 text-white hover:bg-orange-400

次要按钮:     inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium 
              transition-all duration-150
              bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700

图标按钮:     p-0.5 rounded transition-all text-gray-500 hover:text-{amber|emerald}-400
              深色: hover:text-emerald-400  ·  浅色: hover:text-orange-600

Chip 选择:    text-[10px] px-1.5 py-0.5 rounded-full border transition-colors
              选中（深色）: bg-emerald-500/15 border-emerald-500/30 text-emerald-400
              选中（浅色）: bg-orange-500/15 border-orange-500/30 text-orange-600
              未选中: bg-gray-800/30 border-gray-700/20 text-gray-500
```

### 输入框速查

```
w-full bg-gray-800/50 light:bg-gray-200 
border border-gray-700/50 light:border-gray-300 rounded-lg 
px-3 py-2 / py-2.5 text-sm text-gray-200 light:text-gray-800
placeholder-gray-500 light:placeholder-gray-400
focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
light:focus:border-orange-500/50 light:focus:ring-orange-500/20
transition-colors
```

### Card 速查

```
bg-gray-800/20 light:bg-gray-100 
border border-gray-700/30 light:border-gray-300/50 
rounded-lg p-3
```

### 文字速查

```
正文:   text-sm text-gray-300 light:text-gray-800 leading-relaxed
label:  text-xs text-gray-400 light:text-gray-600 font-medium
辅助:   text-[10px] text-gray-500
标题:   text-[11px] font-semibold text-gray-500 uppercase tracking-wider
```

---

## 附录 B：依赖说明

| 包 | 版本 | 用途 |
|----|------|------|
| `react` | ^19.0.0 | UI 框架 |
| `react-dom` | ^19.0.0 | DOM 渲染 |
| `lucide-react` | ^0.468.0 | 图标（唯一图标库） |
| `tailwindcss` | ^4.1.4 | 原子化 CSS 框架 |
| `@tailwindcss/vite` | ^4.1.4 | Tailwind v4 Vite 插件 |
| `vite` | ^6.2.0 | 构建工具 |
| `typescript` | ~5.7.2 | 类型系统 |

**不引入的库**: 无 UI 框架（MUI/shadcn/Chakra）、无 CSS-in-JS、无动画库、无状态管理库（使用原生 useReducer + Context）。

---

## 附录 C：补充说明

### 收藏库面板 (FavoritesPanel)

- 通过 CustomEvent `'toggle-favorites'` 触发开关 — 避免组件间耦合
- 右侧滑出，`max-w-md` (448px)，有半透明遮罩
- 分组: 今天 → 昨天 → 本周 → 更早
- 评分系统（Phase B 实现中）: 星级 + 原因标签 + 自定义原因

### 消费者反馈组件 (ConsumerFeedback)

- 最复杂的组件（~800 行），目前技术上未拆分
- 关键交互: 一键应用建议 → diff 高亮 → 重新评分
- View mode（默认）: 消费者留言展示
- Modify mode: 显示修改建议 + 一键套用 + 自定义修改
- `modifiedVariants` 追踪 diff 基线 — `SET_RE_EVALUATION` 时必须清空

### 三栏响应式

项目 **不做移动端响应式**。480px 以下视口不在设计范围内。
