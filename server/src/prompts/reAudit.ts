import type { Variants, AuditScores } from '../types/index.js';
import { buildComplianceSection } from './complianceRules.js';

/**
 * Prompt for RE-auditing modified variants.
 * Takes previous scores so the model can make incremental adjustments
 * instead of re-scoring from scratch (which causes large score swings).
 */
export function buildReAuditPrompt(
  variants: Variants,
  previousScores?: AuditScores | null,
  brandRedLines?: string,
): string {
  const complianceBlock = buildComplianceSection(brandRedLines);
  const prevBlock = previousScores
    ? `
### 上次評分（修改前）
- 總分：${previousScores.total}
- 港味純正度：${previousScores.cantoneseNaturalness}
- 品牌安全度：${previousScores.brandSafety}
- 平台適配度：${previousScores.platformFit}
- 可讀性：${previousScores.readability}
- 創意/吸引力：${previousScores.creativity}
- Hook強度：${previousScores.hookStrength}
- Emoji/Hashtag策略：${previousScores.emojiHashtagFit}
- 互動引導潛力：${previousScores.engagementPotential}

⚠️ **增量評分規則**：
- 呢次係**修改後嘅版本**，大部分內容同上次一樣，只改咗少部分文字。
- **只調整實際被修改影響嘅維度**。未被改動嘅維度，分數應該同上一次**保持喺 ±3 分內**。
- 小改動（改幾個詞）→ 相關維度分數變化 ≤ ±5 分。
- 中等改動（改一兩句）→ 相關維度分數變化 ≤ ±10 分。
- 大改動（重寫整段）→ 先重新評分，但仍然參考上次分數作為基準。
- **唔好因為換咗一次評分就全部重新估過**——要保持評分嘅連續性。
`
    : '';

  return `## 任務：審核已修改嘅港式社媒文案

你係一個**專業嘅香港社媒文案評審**。以下係**經過修改**嘅文案版本，請根據修改內容**增量調整**評分。

${complianceBlock}

---
${prevBlock}
### 標準繁中版本
${variants.standardHK}

### 輕粵語版本
${variants.lightCantonese}

### IG 版本
${variants.ig}

### Facebook 版本
${variants.facebook}

### Shorts/TK 版本（YouTube Shorts / TikTok）
${variants.shorts}

---

### 八維度評分（每維 0-100 分）

**🚨 增量評分規則**：
- **先對比修改前後嘅差異**：邊個版本改咗？改咗啲乜？
- **只調整受影響嘅維度**：如果只改咗 IG 版嘅 hook，噉「Hook強度」可能要調整，但其他維度保持接近上次分數。
- **評分錨點同上**，但必須參考上次分數作為起點。
- 如果修改確實改善咗某個維度，大膽加分（+5~+15）；如果改差咗，大膽減分。但如果冇影響，唔好亂改分數。

**港味純正度 (0-100)** — 權重 25%
**品牌安全度 (0-100)** — 權重 15%
**平台適配度 (0-100)** — 權重 15%
**可讀性 (0-100)** — 權重 15%
**創意/吸引力 (0-100)** — 權重 10%
**Hook強度 (0-100)** — 權重 10%
**Emoji/Hashtag策略 (0-100)** — 權重 5%
**互動引導潛力 (0-100)** — 權重 5%

**總分計算公式**：
總分 = 港味純正度 × 0.25 + 品牌安全度 × 0.15 + 平台適配度 × 0.15 + 可讀性 × 0.15 + 創意/吸引力 × 0.10 + Hook強度 × 0.10 + Emoji/Hashtag策略 × 0.05 + 互動引導潛力 × 0.05

### 輸出格式

\`\`\`json
{
  "thermometer": {
    "overall": 74,
    "dimensions": {
      "cantoneseFeel": 3,
      "culturalFit": 3,
      "platformFit": 4,
      "brandSafety": 4,
      "tradConsistency": 5,
      "hookStrength": 3,
      "visualStrategy": 3,
      "engagementFit": 3
    }
  },
  "scores": {
    "cantoneseNaturalness": 68,
    "brandSafety": 82,
    "platformFit": 72,
    "readability": 78,
    "creativity": 60,
    "hookStrength": 65,
    "emojiHashtagFit": 70,
    "engagementPotential": 58,
    "total": 72
  },
  "issues": [],
  "replacements": [],
  "risks": [],
  "comments": []
}
\`\`\`

🚨 最後檢查：
- [ ] 係咪先對比咗修改前後差異？
- [ ] 未受影響嘅維度係咪保持喺上次分數 ±3 分內？
- [ ] 總分係咪跟加權公式計算？
- [ ] JSON 合法，只輸出 JSON`;
}
