import { describe, expect, it } from 'vitest';
import {
  traditionalizeText,
  traditionalizeVariants,
} from '../services/traditionalizeHk.js';

describe('traditionalizeHk OpenCC cn→hk pass', () => {
  it('converts the reported simplified hook to traditional', () => {
    expect(traditionalizeText('出粮啦！点样奖励自己？🔥')).toBe('出糧啦！點樣獎勵自己？🔥');
  });

  it('converts common social simplified phrases via full dictionary', () => {
    expect(traditionalizeText('点击了解优惠活动')).toMatch(/點擊/);
    expect(traditionalizeText('点击了解优惠活动')).toMatch(/優惠/);
    expect(traditionalizeText('点击了解优惠活动')).toMatch(/活動/);
    expect(traditionalizeText('这个东西怎么样')).toContain('這');
    expect(traditionalizeText('这个东西怎么样')).toMatch(/麼|麽/);
    // OpenCC full map covers rarer glyphs beyond our old hand table
    expect(traditionalizeText('软体更新已发布')).toMatch(/軟體|軟件/);
    expect(traditionalizeText('软体更新已发布')).toMatch(/發佈|發布/);
  });

  it('leaves clean HK traditional text largely unchanged', () => {
    const hk = '月尾出糧，你諗住點獎勵自己？🔥';
    expect(traditionalizeText(hk)).toBe(hk);
  });

  it('normalizes all five variants', () => {
    const out = traditionalizeVariants({
      standardHK: '点样奖励',
      lightCantonese: '出粮',
      ig: '网络优惠',
      facebook: '免费领取',
      shorts: '点样奖励自己',
    });
    expect(out.standardHK).toBe('點樣獎勵');
    expect(out.lightCantonese).toBe('出糧');
    expect(out.ig).toBe('網絡優惠');
    expect(out.facebook).toBe('免費領取');
    expect(out.shorts).toBe('點樣獎勵自己');
  });

  it('preserves emoji, latin, and hashtags', () => {
    const src = '限时优惠 #香港美食 must-try 🔥';
    const out = traditionalizeText(src);
    expect(out).toContain('#香港美食');
    expect(out).toContain('must-try');
    expect(out).toContain('🔥');
    expect(out).toMatch(/限時/);
    expect(out).toMatch(/優惠/);
  });
});
