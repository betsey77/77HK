/**
 * 快速规则检查 — 纯本地规则引擎，不调 AI
 * PRD P2.3: 在生成/修改后即时提供本地化质量检查，
 * 帮助用户快速发现明显问题，无需等待 AI 审核。
 */

import type { Variants } from '../types/index.js';

// ── Types ──────────────────────────────────────────────

export interface QuickCheckItem {
  rule: string;           // 规则名称，如 "Emoji 数量"
  passed: boolean;
  variantKey: string;     // 哪个版本: 'standardHK' | 'lightCantonese' | 'ig' | 'facebook' | 'shorts'
  variantLabel: string;   // 版本显示名
  message: string;        // 人类可读信息
  severity: 'error' | 'warning' | 'info';
  actual?: string;        // 实际值
  expected?: string;      // 期望值/范围
}

export interface QuickCheckResult {
  passed: boolean;        // 全部通过?
  items: QuickCheckItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export interface QuickCheckParams {
  /** 品牌名 — 如果提供，检查是否出现在各版本中 */
  brandName?: string;
  /** 品牌红线 — 用于检查违禁表达 */
  brandRedLines?: string;
  /** 目标平台 — 用于平台特定规则 */
  platform?: string;
}

// ── Helpers ────────────────────────────────────────────

const VARIANT_LABELS: Record<string, string> = {
  standardHK: '港式标准繁中',
  lightCantonese: '轻粤语社媒',
  ig: 'IG 版本',
  facebook: 'Facebook 版本',
  shorts: 'Shorts/TK',
};

const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{200D}\u{FE0F}\u{20E3}\u{2934}\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}\u{0023}\u{002A}\u{0030}-\u{0039}\u{00A9}\u{00AE}\u{2122}\u{2139}\u{2320}-\u{23F3}\u{24C2}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2611}\u{2614}\u{2615}\u{261D}\u{2620}\u{2622}\u{2623}\u{2626}\u{262A}\u{262E}\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{265F}\u{2660}\u{2663}\u{2665}\u{2666}\u{2668}\u{267B}\u{267E}\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}\u{269C}\u{26A0}\u{26A1}\u{26A7}\u{26AA}\u{26AB}\u{26B0}\u{26B1}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26C8}\u{26CE}\u{26CF}\u{26D1}\u{26D3}\u{26D4}\u{26E9}\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}]/gu;

/**
 * Glyphs that are simplified forms and differ from common HK Traditional forms.
 * Excludes 简繁同形字 (的/了/是/成/…) to reduce false positives on pure 繁體 copy.
 * Expanded for social/marketing coverage (incl. 粮/点/样/奖/励).
 */
export const SIMPLIFIED_ONLY_CHARS = '这们来个为国户闭种亲头显长机网价实动气电风体门问说认让记车转买卖对树东乐开时后会么粮点样奖励还过发应觉从无与万广义爱办帮宝报备笔边标表别并补参仓层产场称诚处传创达带单当党导读队吨夺额范饭飞费丰凤妇复该干刚钢给关观规贵汉号红护画话欢环货获击积绩鸡几际济继坚间简见将较阶节结解仅进经惊旧据决绝军看克块宽扩蓝劳类累离里礼历丽联脸练两辆辽邻灵龙楼录陆虑论轮妈吗满猫贸没迷面庙灭鸣铭摸亩纳难脑闹宁农欧盘跑喷鹏碰骗票评凭扑铺齐骑启千钱强墙抢桥轻清庆穷区权却确扰热赛伞扫杀晒伤烧绍设谁审声胜师诗湿识驶势视试适释书术数双顺苏诉肃虽随岁孙损态谈汤讨腾题条铁听厅统图团推脱完望围维伟卫温闻卧乌污误雾吸习袭戏系吓鲜闲险现线乡响向销协写谢兴醒锈须许续选学寻训压亚严颜验杨阳养药业叶页医仪艺亿议异译阴银营硬拥优邮游鱼娱语预员园远愿约云运杂灾赞脏则择责贼增战张涨帐账赵针阵镇争证郑织职执质滞钟众猪属嘱专赚庄装壮状准资综总纵组钻碍袄坝绊贝辈币变宾饼拨惨舱厕侧测偿厂尘陈衬惩迟齿冲虫础触疮闯锤纯词辞丛凑窜错胆弹灯邓敌递淀垫调叠顶订栋独镀断堕鹅讹恶饿儿尔饵罚阀贩纺废坟奋愤粪枫疯冯缝讽肤辐抚辅赋负缚钙盖赶纲岗鸽沟购够顾挂馆罐惯贯瑰轨柜锅骇韩华缓换唤秽汇绘枪窍窃寝氢倾请琼趋驱龋颧券劝缺瘸鹊';

const SIMPLIFIED_ONLY_RE = new RegExp(
  '[' + [...new Set([...SIMPLIFIED_ONLY_CHARS])].join('') + ']',
);

function countEmojis(text: string): number {
  const matches = text.match(EMOJI_RE);
  return matches ? matches.length : 0;
}

function countHashtags(text: string): number {
  const matches = text.match(/#[\w一-鿿　-〿＀-￯]+/g);
  return matches ? matches.length : 0;
}

function countChars(text: string): number {
  // Count visible characters (exclude whitespace-only)
  return text.replace(/\s/g, '').length;
}

/** True when text contains at least one simplified-only glyph from the expanded table. */
export function hasSimplifiedChars(text: string): boolean {
  return SIMPLIFIED_ONLY_RE.test(text);
}


const MAINLAND_PHRASES = [
  '寶子們', '宝子们', '姐妹們', '姐妹们', '家人們', '家人们',
  '小伙伴', '小夥伴', '爆款來襲', '爆款来袭', '狠狠拿捏',
  '閉眼入', '闭眼入', '種草', '种草', '絕絕子', '绝绝子',
  '安利', '必入', '神仙單品', '神仙单品', '寶藏', '宝藏',
  '沖', '冲', '炸裂', '王炸', '天花板', '神器', '平替',
  'yyds', 'YYDS', '親愛的顧客', '亲爱的顾客',
];

function countMainlandPhrases(text: string): string[] {
  return MAINLAND_PHRASES.filter((p) => text.includes(p));
}

function checkHookStrength(firstLine: string): { strong: boolean; reason: string } {
  if (!firstLine || firstLine.trim().length === 0) {
    return { strong: false, reason: '第一行为空' };
  }
  const hook = firstLine.trim();
  if (hook.length > 80) {
    return { strong: false, reason: 'Hook 过长（>80字），Short 用户注意力短，建议压缩到 30-60 字' };
  }
  if (hook.length < 6) {
    return { strong: false, reason: 'Hook 过短（<6字），缺乏吸引力' };
  }
  // Check for strong hook patterns: question, number, surprise, emotional
  const strongPatterns = [
    /[？?]/,           // Question
    /[！!]/,           // Exclamation
    /\d/,              // Number
    /等[一下陣]/,     // "Wait..."
    /知唔知/,         // "Did you know..."
    /估唔到/,         // "Can't believe..."
    /原來/,           // "Turns out..."
    /有冇/,           // "Have you..."
    /想唔想/,         // "Do you want..."
    /係咪/,           // "Is it..."
  ];
  const hasStrongPattern = strongPatterns.some((p) => p.test(hook));
  if (!hasStrongPattern) {
    return { strong: false, reason: 'Hook 缺乏吸引元素（问句/数字/惊叹/悬念），建议加入抢眼 hook' };
  }
  return { strong: true, reason: '' };
}

// ── Main Check Engine ──────────────────────────────────

export function quickCheck(variants: Variants, params: QuickCheckParams = {}): QuickCheckResult {
  const items: QuickCheckItem[] = [];
  const variantKeys = Object.keys(variants) as Array<keyof Variants>;

  for (const key of variantKeys) {
    const text = variants[key] ?? '';
    const label = VARIANT_LABELS[key] || key;

    // ── 1. Emoji 数量 ──
    const emojiCount = countEmojis(text);
    if (key === 'ig' || key === 'shorts') {
      if (emojiCount === 0) {
        items.push({
          rule: 'Emoji 数量', passed: false, variantKey: key, variantLabel: label,
          message: `${label} 没有使用 emoji——社媒平台建议适量 emoji 增加互动感`,
          severity: 'warning', actual: '0 个', expected: '2-8 个',
        });
      } else if (emojiCount > 15) {
        items.push({
          rule: 'Emoji 数量', passed: false, variantKey: key, variantLabel: label,
          message: `${label} emoji 过多（${emojiCount} 个），可能显得不够专业`,
          severity: 'warning', actual: `${emojiCount} 个`, expected: '≤15 个',
        });
      } else {
        items.push({
          rule: 'Emoji 数量', passed: true, variantKey: key, variantLabel: label,
          message: `${label} emoji 数量合理`, severity: 'info',
          actual: `${emojiCount} 个`,
        });
      }
    } else {
      if (emojiCount > 10) {
        items.push({
          rule: 'Emoji 数量', passed: false, variantKey: key, variantLabel: label,
          message: `${label} emoji 偏多（${emojiCount} 个），正式版本建议克制`,
          severity: 'warning', actual: `${emojiCount} 个`, expected: '≤10 个',
        });
      } else {
        items.push({
          rule: 'Emoji 数量', passed: true, variantKey: key, variantLabel: label,
          message: `${label} emoji 数量合理`, severity: 'info',
          actual: `${emojiCount} 个`,
        });
      }
    }

    // ── 2. Hashtag 数量 ──
    const hashtagCount = countHashtags(text);
    if (key === 'ig') {
      if (hashtagCount === 0) {
        items.push({
          rule: 'Hashtag 数量', passed: false, variantKey: key, variantLabel: label,
          message: 'IG 版本没有 hashtag，建议加 3-5 个相关 hashtag 增加曝光',
          severity: 'warning', actual: '0 个', expected: '3-10 个',
        });
      } else if (hashtagCount > 15) {
        items.push({
          rule: 'Hashtag 数量', passed: false, variantKey: key, variantLabel: label,
          message: `IG 版本 hashtag 过多（${hashtagCount} 个），建议 ≤15 个`,
          severity: 'warning', actual: `${hashtagCount} 个`, expected: '≤15 个',
        });
      } else {
        items.push({
          rule: 'Hashtag 数量', passed: true, variantKey: key, variantLabel: label,
          message: `Hashtag 数量合理（${hashtagCount} 个）`, severity: 'info',
          actual: `${hashtagCount} 个`,
        });
      }
    } else if (key === 'shorts') {
      if (hashtagCount > 8) {
        items.push({
          rule: 'Hashtag 数量', passed: false, variantKey: key, variantLabel: label,
          message: `Shorts/TK 版本 hashtag 过多（${hashtagCount} 个），建议 3-5 个`,
          severity: 'warning', actual: `${hashtagCount} 个`, expected: '3-5 个',
        });
      } else {
        items.push({
          rule: 'Hashtag 数量', passed: true, variantKey: key, variantLabel: label,
          message: `Hashtag 数量合理（${hashtagCount} 个）`, severity: 'info',
          actual: `${hashtagCount} 个`,
        });
      }
    } else {
      if (hashtagCount > 5) {
        items.push({
          rule: 'Hashtag 数量', passed: false, variantKey: key, variantLabel: label,
          message: `${label} 通常不需要太多 hashtag（${hashtagCount} 个）`,
          severity: 'info', actual: `${hashtagCount} 个`, expected: '0-3 个',
        });
      }
    }

    // ── 3. 字数 ──
    const charCount = countChars(text);
    const platformRanges: Record<string, [number, number]> = {
      standardHK: [30, 0],        // 0 = no upper limit
      lightCantonese: [20, 0],
      ig: [30, 2200],            // IG caption limit
      facebook: [50, 0],          // FB has higher limit
      shorts: [30, 500],          // Shorts script
    };
    const [minChars, maxChars] = platformRanges[key] || [20, 0];

    if (charCount < minChars) {
      items.push({
        rule: '字数检查', passed: false, variantKey: key, variantLabel: label,
        message: `${label} 字数过少（${charCount} 字），可能缺乏足够内容`,
        severity: 'warning', actual: `${charCount} 字`, expected: `≥${minChars} 字`,
      });
    } else if (maxChars > 0 && charCount > maxChars) {
      items.push({
        rule: '字数检查', passed: false, variantKey: key, variantLabel: label,
        message: `${label} 字数超过平台上限（${charCount} 字 > ${maxChars} 字上限）`,
        severity: 'error', actual: `${charCount} 字`, expected: `≤${maxChars} 字`,
      });
    } else {
      items.push({
        rule: '字数检查', passed: true, variantKey: key, variantLabel: label,
        message: `${label} 字数合理（${charCount} 字）`, severity: 'info',
        actual: `${charCount} 字`,
      });
    }

    // ── 4. 简体字检查 ──
    if (hasSimplifiedChars(text)) {
      items.push({
        rule: '繁体检查', passed: false, variantKey: key, variantLabel: label,
        message: `${label} 可能包含简体中文字符，请确认已转换为香港繁体`,
        severity: 'error', actual: '检测到简体字符',
      });
    } else {
      items.push({
        rule: '繁体检查', passed: true, variantKey: key, variantLabel: label,
        message: `${label} 未检测到简体字符`, severity: 'info',
      });
    }

    // ── 5. 内地词汇检查 ──
    const mainlandHits = countMainlandPhrases(text);
    if (mainlandHits.length > 0) {
      items.push({
        rule: '内地词汇检查', passed: false, variantKey: key, variantLabel: label,
        message: `${label} 含有内地营销词汇：${mainlandHits.join('、')}`,
        severity: 'warning', actual: `${mainlandHits.length} 个内地词汇`,
      });
    }

    // ── 6. 品牌名检查 ──
    if (params.brandName) {
      if (!text.includes(params.brandName)) {
        items.push({
          rule: '品牌名检查', passed: false, variantKey: key, variantLabel: label,
          message: `${label} 未提及品牌名「${params.brandName}」，建议至少出现一次`,
          severity: 'warning',
        });
      }
    }

    // ── 7. Shorts/TK Hook 检查 ──
    if (key === 'shorts') {
      const firstLine = text.split('\n')[0] || '';
      const hookResult = checkHookStrength(firstLine);
      if (!hookResult.strong) {
        items.push({
          rule: 'Shorts/TK Hook', passed: false, variantKey: key, variantLabel: label,
          message: `Shorts/TK 版本 Hook 不够强：${hookResult.reason}`,
          severity: 'warning', actual: firstLine.slice(0, 60) + (firstLine.length > 60 ? '...' : ''),
          expected: '吸引眼球的 hook（问句/数字/悬念/惊叹）',
        });
      } else {
        items.push({
          rule: 'Shorts/TK Hook', passed: true, variantKey: key, variantLabel: label,
          message: 'Shorts/TK Hook 有吸引力', severity: 'info',
        });
      }
    }

    // ── 8. 品牌红线检查 ──
    if (params.brandRedLines) {
      const redLines = params.brandRedLines
        .split(/[，,、\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const violations = redLines.filter((rl) => text.includes(rl));
      if (violations.length > 0) {
        items.push({
          rule: '品牌红线检查', passed: false, variantKey: key, variantLabel: label,
          message: `${label} 触犯品牌红线：包含「${violations.join('」「')}」`,
          severity: 'error', actual: `${violations.length} 处违规`,
        });
      }
    }
  }

  // ── Summary ──
  const failedItems = items.filter((i) => !i.passed);
  const warningItems = items.filter((i) => !i.passed && i.severity === 'warning');
  const errorItems = items.filter((i) => !i.passed && i.severity === 'error');
  const passedItems = items.filter((i) => i.passed);

  return {
    passed: failedItems.length === 0,
    items,
    summary: {
      total: items.length,
      passed: passedItems.length,
      failed: errorItems.length + warningItems.length,
      warnings: warningItems.length,
    },
  };
}
