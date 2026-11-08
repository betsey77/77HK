import { describe, expect, it } from 'vitest';
import { hasSimplifiedChars, quickCheck } from '../services/quickCheckService.js';
import type { Variants } from '../types/index.js';

describe('quickCheck simplified glyph table', () => {
  it('flags the reported Shorts miss: 出粮 / 点样 / 奖励', () => {
    const text = '出粮啦！点样奖励自己？🔥';
    expect(hasSimplifiedChars(text)).toBe(true);

    const variants: Variants = {
      standardHK: '月尾出糧，你諗住點獎勵自己？🔥',
      lightCantonese: '月尾出糧，你諗住點獎勵自己？🔥',
      ig: '月尾出糧，你諗住點獎勵自己？🔥',
      facebook: '月尾出糧，你諗住點獎勵自己？🔥',
      shorts: text,
    };
    const result = quickCheck(variants);
    const trad = result.items.filter(
      (i) => i.variantKey === 'shorts' && i.rule === '繁体检查',
    );
    expect(trad).toHaveLength(1);
    expect(trad[0].passed).toBe(false);
    expect(trad[0].actual).toBe('检测到简体字符');
  });

  it('does not flag clean HK traditional social copy', () => {
    const hk = '月尾出糧，你諗住點獎勵自己？🔥\n思急煎餃王一上枱，成枱人即刻變搶食 mode 🥟';
    expect(hasSimplifiedChars(hk)).toBe(false);
  });

  it('still catches baseline simplified forms', () => {
    expect(hasSimplifiedChars('这个东西怎么样')).toBe(true);
    expect(hasSimplifiedChars('网络价格实惠')).toBe(true);
  });
}
);
