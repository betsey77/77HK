# 去黑箱参考方案

> **定位**：参考方案，非强制开发。记录"如何让 AI 文案生成过程从黑箱变透明"的完整思路，供后续有需要时直接取用。
>
> **创建日期**：2026-07-10
>
> **关联文档**：[[spec-v2.1-进度条与反馈系统]] [[comprehensive-spec-v2]]

---

## 问题定义

当前系统（截至 2026-07-10）的生成流程对用户而言是一个完全的黑箱：

1. 用户输入文案 → 看到 spinner "生成中，请稍候..." → 等 5-15 秒 → 拿到 5 个变体 + 评分
2. 中间发生了什么完全不可见
3. 三个层面的不透明叠加：
   - **模型层**：AI 内部做了什么推理？
   - **系统层**：当前在哪个流水线阶段？
   - **决策层**：为什么这个变体这样写？

---

## 当前状态基线

| 维度 | 当前实现 | 缺失 |
|---|---|---|
| 阶段可见性 | `uiState` 只有 `idle/loading/success/error` | 无 `diagnosing/generating/auditing` 等中间态 |
| 数据传输 | 单次 `fetch` + `res.json()` | 无 streaming/SSE |
| 模型推理 | `cantoneseService.ts` 的 `stripThinking()` 丢弃 `<think>` 内容 | 推理过程完全丢失 |
| 变体解释 | 每个 variant 有 `variantMeta`（headline, ctaLine, persona 等） | 无 "为什么选这个策略" 的解释 |
| 原生自然度 | `scoreCantoneseNaturalness()` 函数已写好 | 未接入生成路由 |
| Prompt 可见性 | 仅开发者可读源码 | 无 UI 暴露 raw prompt/response |
| 生成耗时 | 不追踪 | 无 `elapsedSeconds` |

---

## 分层方案

### 🥇 第一层：SSE 阶段进度曝光

**解决的问题**："AI 在干嘛？还要等多久？"

**原理**：服务端 `/api/generate` 当前 4 个阶段（诊断 → 生成 → 审核 → 消费者反馈）串行执行，在每个 `await` 完成时 push SSE 事件给前端。

**实现要点**：

```
GET/POST /api/generate  →  Content-Type: text/event-stream

事件流示意：

event: phase
data: {"phase":"diagnosis","status":"started"}

event: phase
data: {"phase":"diagnosis","status":"done","findings":3,"hasSimplifiedChars":true}

event: phase
data: {"phase":"generation","status":"started"}

event: phase
data: {"phase":"generation","status":"done","variantCount":5,"engine":"deepseek"}

event: phase
data: {"phase":"audit","status":"started"}

event: phase
data: {"phase":"audit","status":"done","totalScore":78}

event: phase
data: {"phase":"feedback","status":"started"}

event: phase
data: {"phase":"feedback","status":"done","personaCount":3}

event: done
data: {"elapsedMs":8200,"result":{...完整DiagnoseGenerateResult...}}
```

**前端组件**：`GenerationProgressBar`

```
┌─────────────────────────────────────────────────────┐
│  🔍 診斷源文本  ✓ 完成（3 個問題）                    │
│  ✍️  生成文案    ⏳ 進行中...                         │
│  📊 品質審核    ○ 等待中                              │
│  👥 消費者反饋  ○ 等待中                              │
│                                                       │
│  ████████░░░░░░░░░░  已用時 4.2s                       │
└─────────────────────────────────────────────────────┘
```

**关键决策**：
- 不需要 LLM 支持 streaming——阶段级别的进度不需要模型 token-by-token streaming，只需在路由层每个 `await` 之间 emit 事件
- 同时保留旧的非 SSE 端点作为 fallback（前端检测 `EventSource` 是否可用）
- SSE 通过单个 HTTP 连接传输，穿透防火墙和代理比 WebSocket 更好

**预估工作量**：2-3h
- 服务端：新增 SSE helper 函数 + 改造 `routes/generate.ts`
- 客户端：`GenerationProgressBar` 组件 + `useGenerationProgress` hook（spec-v2.1 已有设计稿）

---

### 🥈 第二层：变体级别 rationale

**解决的问题**："为什么 AI 这样写？它想了什么？"

**原理**：在 LLM prompt 的输出 JSON Schema 中增加 `rationale` 字段，要求模型为每个变体解释其写作决策。

**Prompt 改动**（在 `diagnoseGenerate.ts` 的 Output Format 层增加）：

```json
{
  "standardHK": {
    "text": "...",
    "variantMeta": { ... },
    "rationale": {
      "hookStrategy": "用'唔使再'句式製造同感，針對返工族痛點",
      "cantoneseChoices": [
        {"word": "慳錢", "reason": "港澳慣用，唔會用'省錢'"},
        {"word": "真係", "reason": "加強語氣，符合港式口語節奏"}
      ],
      "toneDecision": "品牌 tone 係'親切'所以用'你'唔用'您'，結尾加'～'軟化語氣",
      "creativeDecision": "用返工場景切入因為 target persona 係 25-35 歲辦公室人群"
    }
  }
}
```

**前端展示**：在 AuditPanel 旁边加 "AI 寫作思路" 标签页或折叠面板

```
┌─ AI 寫作思路 ─────────────────────────────────────┐
│                                                     │
│  🎯 標題策略                                        │
│  「唔使再捱貴機票」—— 用「唔使再」句式製造同感，     │
│  針對返工族 travel 痛點                              │
│                                                     │
│  🗣️ 粵語選詞                                        │
│  • 「慳錢」而唔用「省錢」—— 港澳慣用講法             │
│  • 「真係」—— 加強語氣，符合港式口語節奏             │
│  • 「慳返好多」而唔用「節省不少」—— 地道廣東話       │
│                                                     │
│  🎨 語氣決策                                        │
│  品牌 tone 係「親切」，所以全文用「你」而唔用「您」，  │
│  結尾加「～」軟化語氣，避免太 hard-sell              │
│                                                     │
│  💡 創意方向                                        │
│  用返工族日常場景切入，因為 target persona 係        │
│  25-35 歲辦公室人群，容易產生代入感                   │
└─────────────────────────────────────────────────────┘
```

**成本考量**：rationale 字段预计增加 200-400 tokens/变体，5 个变体约增加 1000-2000 output tokens。对于 DeepSeek 的定价来说成本增幅可忽略。

**预估工作量**：3-4h
- Prompt 改 JSON schema + 指令
- 类型定义更新（`VariantRationale` interface）
- 前端组件 `RationalePanel.tsx`

---

### 🥉 第三层：回收模型推理过程

**解决的问题**："模型内部到底怎么想的？"

**现状**：`cantoneseService.ts` 第 54 行的 `stripThinking()` 函数把自部署 CantoneseLLM 返回的 `<think>...</think>` 推理内容直接丢弃。DeepSeek 端也不消费 `reasoning_content`。

**改动**：

```typescript
// 当前：丢弃
function stripThinking(content: string): string {
  const idx = content.lastIndexOf('</think>');
  if (idx !== -1) return content.slice(idx + 8).trim();
  return content.trim();
}

// 改为：提取并保留
function extractThinking(content: string): { thinking: string | null; response: string } {
  const idx = content.lastIndexOf('</think>');
  if (idx !== -1) {
    return {
      thinking: content.slice(0, idx + 8),   // 保留完整 <think>...</think>
      response: content.slice(idx + 8).trim()
    };
  }
  return { thinking: null, response: content.trim() };
}
```

**类型扩展**：在 `DiagnoseGenerateResult` 中增加可选字段：

```typescript
interface DiagnoseGenerateResult {
  // ... 现有字段 ...
  /** 模型原始推理过程（CantoneseLLM 的 <think> 块，或 DeepSeek 的 reasoning_content） */
  thinkingTrace?: string;
}
```

**前端展示**：在结果底部加折叠面板 "🔍 AI 思考過程"（默认折叠，避免干扰普通用户）

```
┌─ 🔍 AI 思考過程（點擊展開）───────────────────────┐
│                                                     │
│  <think>                                             │
│  用户输入係普通話文案"省钱攻略来啦！机票酒店打折"，  │
│  需要轉換做港式 IG post...                           │
│                                                      │
│  首先分析源文本問題：                                 │
│  1. 「攻略」係內地講法，香港會用「懶人包」或「貼士」  │
│  2. 「打折」可以保留但要加港式語氣詞                  │
│  3. 「來啦！」太普通話腔，改做「出咗啦！」或「有啦！」│
│  ...                                                 │
│  </think>                                            │
│                                                      │
│  [原始 JSON 回應]                                    │
│  {"diagnosis":{...},"variants":{...}}                │
└─────────────────────────────────────────────────────┘
```

**价值**：对 prompt engineering 调试、排查生成质量问题、理解模型行为模式非常有价值。

**预估工作量**：1-2h

---

### 🔧 第四层：Debug 模式（开发者工具）

**解决的问题**："Prompt 到底长什么样？LLM 返回的原始数据是什么？"

**原理**：在设置面板加 `developerMode` 开关，开启后在结果下方显示两个只读 `<textarea>`。

**前端实现**：

```tsx
{settings.developerMode && (
  <details style={{ marginTop: 16, opacity: 0.7 }}>
    <summary>🛠️ Developer: Raw Prompt & Response</summary>
    <div>
      <h4>System Prompt</h4>
      <pre>{debugInfo.systemPrompt}</pre>
      <h4>User Prompt ({debugInfo.promptTokens} tokens)</h4>
      <pre>{debugInfo.userPrompt}</pre>
      <h4>Raw Response ({debugInfo.completionTokens} tokens)</h4>
      <pre>{debugInfo.rawResponse}</pre>
      <h4>Engine: {debugInfo.engine} | Temp: {debugInfo.temperature} | Latency: {debugInfo.latencyMs}ms</h4>
    </div>
  </details>
)}
```

**服务端改动**：生成结果中附带 `debug` 字段（仅在 `developerMode` 请求时返回，避免浪费带宽）：

```typescript
interface GenerateResponse {
  // ... 现有字段 ...
  debug?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    promptTokens: number;
    completionTokens: number;
    engine: string;
    temperature: number;
    latencyMs: number;
  };
}
```

**关键决策**：
- 默认关闭，普通用户看不到
- `debug` 对象不在每次请求中返回，而是通过 query string `?debug=true` 或 request body `debug: true` 控制
- Token 计数建议用 `tiktoken`（已在 comprehensive-spec-v2 §6.2 中提到）或直接从 LLM API response 的 `usage` 字段读取

**预估工作量**：1h

---

### 📊 第五层：港话自然度评分接入

**解决的问题**："每个变体的粤语地不地道？"

**现状**：`scoreCantoneseNaturalness()` 函数已写好（`deepseekService.ts` 第 292-370 行），是一个独立的 1-5 分粤语自然度评分器，但未在 `/api/generate` 路由中被调用。

**接入方式**：在生成完成后、audit 之前调用：

```typescript
// routes/generate.ts
const result = await diagnoseAndGenerate(params);

// 新增：港话自然度评分
const naturalness = await scoreCantoneseNaturalness(result.variants);
if (naturalness) {
  result.cantoneseNaturalness = naturalness;
  // 如果平均分低于阈值，可以触发 auto-retry
  if (naturalness.average < 2.5) {
    // 自动重试逻辑（可选）
  }
}
```

**前端展示**：在 "港味温度计" 旁边加一行：

```
┌─ 港話自然度 ──────────────────────────────────────┐
│  standardHK:     ★★★★☆  4.2  「好自然，似香港人寫」 │
│  lightCantonese: ★★★★☆  4.0                       │
│  IG:            ★★★☆☆  3.1  「有少少書面腔」       │
│  Facebook:      ★★★★☆  3.8                       │
│  Shorts:        ★★★☆☆  3.3  「hook 夠力但語氣偏硬」│
│                                                     │
│  綜合平均：3.7 / 5.0                                │
│  評語：IG 同 Shorts 版本有改善空間，部分用詞偏書面   │
└─────────────────────────────────────────────────────┘
```

**预估工作量**：0.5h（函数已写好，只需接入路由 + 前端展示）

---

## 总览

| 层 | 功能 | 解决的问题 | 预估 | 用户感知 |
|---|---|---|---|---|
| 🥇 | SSE 阶段进度 | "AI 在干嘛？还要等多久？" | 2-3h | ⭐⭐⭐⭐⭐ |
| 🥈 | 变体 rationale | "为什么这样写？AI 想了什么？" | 3-4h | ⭐⭐⭐⭐ |
| 🥉 | 回收 `<think>` 推理 | "模型内部推理过程？" | 1-2h | ⭐⭐⭐ |
| 🔧 | Debug 模式 | "Prompt/Response 原始内容？" | 1h | ⭐⭐ |
| 📊 | 港话自然度接入 | "每个变体粤语地道程度？" | 0.5h | ⭐⭐⭐ |

**总计**：约 8-11 小时完整解决黑箱问题。

---

## 实施建议

1. **先做第一层（SSE 进度）**：用户感知最强，且不依赖 LLM 能力，纯工程改动
2. **第二层（rationale）可与第三层（<think>回收）并行**：前者依赖 prompt engineering，后者是服务端代码改动
3. **第五层（自然度接入）零门槛**：可以随时插入
4. **第四层（Debug 模式）留给开发者自己**：属于"需要时才做"的功能

所有改动向后兼容——不破坏现有 API 契约，可以逐步增量上线。
