import type { CalendarEvent } from '../types/index.js';

/**
 * Hong Kong local topic calendar — static data, quarterly refresh recommended.
 * Covers July–December 2026 with ~40 events spanning major holidays,
 * local festivals, shopping seasons, and cultural moments.
 */
export const HK_CALENDAR: CalendarEvent[] = [
  // ==================== JUNE 2026 ====================
  {
    id: '618-shopping-2026',
    date: '2026-06-15..2026-06-18',
    title: '618 Shopping Festival',
    titleZh: '618 购物节',
    applicableIndustries: ['零售', '电商', '科技', '美容', '全行业'],
    angles: ['618优惠', '年中大促', '网购攻略', '限时折扣'],
    narrativeHooks: ['618最抵买嘅唔系淘宝，系...', '年中最大优惠，错过等半年...'],
  },
  {
    id: 'dragon-boat-2026',
    date: '2026-06-19',
    title: 'Dragon Boat Festival 2026',
    titleZh: '端午节 2026',
    applicableIndustries: ['食品', '餐饮', '零售', '旅游'],
    angles: ['粽子送礼', '龙舟赛事', '端午传统', '家庭聚餐'],
    narrativeHooks: ['今年端午想食咩粽？', '端午唔止食粽，仲可以...', '阿妈包嘅粽最好食...'],
  },
  {
    id: 'fathers-day-2026',
    date: '2026-06-21',
    title: 'Father\'s Day 2026',
    titleZh: '父亲节 2026',
    applicableIndustries: ['零售', '餐饮', '美容', '全行业'],
    angles: ['父亲节礼物', '孝亲优惠', '家庭聚餐', '爸爸专属'],
    narrativeHooks: ['父亲节送咩好？', '平时唔讲出口嘅多谢...', '爸爸嘅喜好你最清楚...'],
  },

  // ==================== JULY 2026 ====================
  {
    id: 'hksar-establishment-day',
    date: '2026-07-01',
    title: 'HKSAR Establishment Day',
    titleZh: '香港回归纪念日',
    applicableIndustries: ['全行业'],
    angles: ['本地情怀', '家在香港', '回归优惠', '城市自豪感'],
    narrativeHooks: ['27年来嘅变化...', '作为香港人，最自豪嘅系...', '呢个城市嘅故事...'],
    sensitivityNote: '避免过度政治化表达，以温情/社区角度切入',
  },
  {
    id: 'summer-holiday-start',
    date: '2026-07-01..2026-07-15',
    title: 'Summer Holiday Start',
    titleZh: '暑假开始',
    applicableIndustries: ['零售', '餐饮', '旅游', '教育', '娱乐'],
    angles: ['暑假活动', '亲子时光', '学生优惠', '暑假打卡'],
    narrativeHooks: ['放暑假啦！', '暑假唔知去边？', '小朋友放假，家长嘅烦恼...'],
  },
  {
    id: 'hk-book-fair-2026',
    date: '2026-07-15..2026-07-21',
    title: 'Hong Kong Book Fair 2026',
    titleZh: '香港书展 2026',
    applicableIndustries: ['零售', '餐饮', '文化', '教育'],
    angles: ['文青打卡', '书展限定', '摊位优惠', '书展场内外消费'],
    narrativeHooks: ['行书展行到脚软？', '书展必买 list...', '年年书展都买呢几样...'],
  },
  {
    id: 'dse-results-release',
    date: '2026-07-15',
    title: 'DSE Results Release',
    titleZh: 'DSE 放榜',
    applicableIndustries: ['教育', '餐饮', '零售', '全行业'],
    angles: ['放榜加油', '升学规划', '放榜优惠', '正向鼓励'],
    narrativeHooks: ['放榜日嘅心情...', '无论结果点样，你都已经好努力...'],
    sensitivityNote: '避免制造焦虑，以鼓励支持角度为主',
  },
  {
    id: 'anime-comic-game-hk',
    date: '2026-07-24..2026-07-28',
    title: 'ACG HK 2026',
    titleZh: '香港动漫电玩节',
    applicableIndustries: ['零售', '娱乐', '科技', '餐饮'],
    angles: ['动漫热话', 'Cosplay打卡', '限定周边', '年轻潮流'],
    narrativeHooks: ['今年动漫节有咩必睇？', 'Cosplay 达人大召集...', '动漫迷嘅年度盛事...'],
  },

  // ==================== AUGUST 2026 ====================
  {
    id: 'summer-peak-aug',
    date: '2026-08-01..2026-08-15',
    title: 'Summer Peak Season',
    titleZh: '暑假消费旺季',
    applicableIndustries: ['零售', '餐饮', '旅游', '娱乐'],
    angles: ['暑假尾声', '开学前准备', '亲子活动', '夏日限定'],
    narrativeHooks: ['暑假就快完，仲未去够...', '开学前必做嘅几件事...'],
  },
  {
    id: 'hk-food-expo',
    date: '2026-08-13..2026-08-17',
    title: 'Food Expo 2026',
    titleZh: '美食博览 2026',
    applicableIndustries: ['食品', '餐饮', '零售'],
    angles: ['美食展优惠', '试食体验', '限量美食', '吃货打卡'],
    narrativeHooks: ['一年一度美食展又嚟啦！', '入场$30食到饱...', '必试摊位清单...'],
  },
  {
    id: 'computer-festival',
    date: '2026-08-21..2026-08-25',
    title: 'Computer & Communications Festival',
    titleZh: '电脑通讯节',
    applicableIndustries: ['科技', '零售', '电子'],
    angles: ['开学优惠', '3C产品折扣', '电竞装备', '开学必备'],
    narrativeHooks: ['开学前最后冲刺！', '电脑节最抵买嘅...', '学生哥必备装备...'],
  },
  {
    id: 'back-to-school',
    date: '2026-08-25..2026-09-05',
    title: 'Back to School Season',
    titleZh: '开学季',
    applicableIndustries: ['零售', '教育', '食品', '文具'],
    angles: ['开学装备', '学生优惠', '家长准备', '新学期新开始'],
    narrativeHooks: ['开学啦！准备齐未？', '开学必备 checklist...', '新学期嘅小目标...'],
  },

  // ==================== SEPTEMBER 2026 ====================
  {
    id: 'mid-autumn-2026',
    date: '2026-09-20..2026-09-25',
    title: 'Mid-Autumn Festival 2026',
    titleZh: '中秋节 2026',
    applicableIndustries: ['食品', '餐饮', '零售', '全行业'],
    angles: ['月饼送礼', '团圆聚餐', '赏月打卡', '中秋促销'],
    narrativeHooks: ['今年中秋想点过？', '月饼口味大对决...', '中秋送礼嘅学问...'],
  },
  {
    id: 'national-day-prelude',
    date: '2026-09-25..2026-10-01',
    title: 'National Day Prelude',
    titleZh: '国庆前夕',
    applicableIndustries: ['零售', '餐饮', '旅游', '全行业'],
    angles: ['国庆优惠预告', '黄金周准备', '节日氛围'],
    narrativeHooks: ['黄金周就快到...', '国庆长假有咩plan？'],
    sensitivityNote: '以消费/旅游角度切入，避免政治化',
  },

  // ==================== OCTOBER 2026 ====================
  {
    id: 'national-day-golden-week',
    date: '2026-10-01..2026-10-07',
    title: 'National Day Golden Week',
    titleZh: '国庆黄金周',
    applicableIndustries: ['零售', '餐饮', '旅游', '全行业'],
    angles: ['国庆优惠', '黄金周消费', '本地游', 'Staycation'],
    narrativeHooks: ['黄金周 staycation 推介...', '国庆唔使返工，去边度玩？', '限时优惠，只限黄金周...'],
  },
  {
    id: 'chung-yeung-2026',
    date: '2026-10-18',
    title: 'Chung Yeung Festival',
    titleZh: '重阳节',
    applicableIndustries: ['食品', '零售', '旅游'],
    angles: ['孝亲敬老', '秋日登高', '家庭聚餐', '敬老优惠'],
    narrativeHooks: ['重阳节陪长辈去边？', '秋高气爽，行山好时节...'],
  },
  {
    id: 'halloween-2026',
    date: '2026-10-25..2026-10-31',
    title: 'Halloween 2026',
    titleZh: '万圣节 2026',
    applicableIndustries: ['零售', '餐饮', '娱乐', '食品'],
    angles: ['万圣装扮', '派对优惠', '限定产品', '打卡热点'],
    narrativeHooks: ['今年万圣节想扮咩？', 'Halloween 最恐怖嘅唔系鬼，系...', '万圣节限定，卖完就冇！'],
  },

  // ==================== NOVEMBER 2026 ====================
  {
    id: 'singles-day-2026',
    date: '2026-11-01..2026-11-11',
    title: 'Singles\' Day (11.11)',
    titleZh: '双十一购物节',
    applicableIndustries: ['零售', '科技', '美容', '全行业'],
    angles: ['双11优惠', '网购攻略', '折扣力度', '限时抢购'],
    narrativeHooks: ['双11最抵买嘅唔系淘宝，系...', '11.11 本地商户都有优惠？', '唔好冲动消费！双11聪明买法...'],
  },
  {
    id: 'thanksgiving-2026',
    date: '2026-11-20..2026-11-26',
    title: 'Thanksgiving 2026',
    titleZh: '感恩节 2026',
    applicableIndustries: ['餐饮', '零售', '食品', '全行业'],
    angles: ['感恩回馈', '火鸡大餐', '客户感谢', '年终致谢'],
    narrativeHooks: ['今年想多谢嘅人...', '感恩节唔一定食火鸡...', '回馈客户嘅小小心意...'],
  },
  {
    id: 'black-friday-2026',
    date: '2026-11-25..2026-11-30',
    title: 'Black Friday 2026',
    titleZh: '黑色星期五',
    applicableIndustries: ['零售', '科技', '美容', '全行业'],
    angles: ['黑五优惠', '限量折扣', '早鸟优惠', '年度最抵'],
    narrativeHooks: ['Black Friday 最值得入手嘅...', '一年得一次嘅超抵优惠...', '手快有手慢冇！'],
  },

  // ==================== DECEMBER 2026 ====================
  {
    id: 'christmas-preparation',
    date: '2026-12-01..2026-12-15',
    title: 'Christmas Preparation',
    titleZh: '圣诞准备期',
    applicableIndustries: ['零售', '餐饮', '美容', '全行业'],
    angles: ['圣诞礼物', '节日布置', '早鸟优惠', '派对准备'],
    narrativeHooks: ['圣诞礼物买咗未？', '今年圣诞 tree 要点布置？', '圣诞 party 准备清单...'],
  },
  {
    id: 'winter-solstice-2026',
    date: '2026-12-21',
    title: 'Winter Solstice',
    titleZh: '冬至',
    applicableIndustries: ['食品', '餐饮', '零售'],
    angles: ['做冬聚餐', '冬至食品', '家庭团聚', '传统习俗'],
    narrativeHooks: ['冬大过年！', '今年做冬食咩好？', '冬至嘅传统，你知几多？'],
  },
  {
    id: 'christmas-2026',
    date: '2026-12-20..2026-12-26',
    title: 'Christmas 2026',
    titleZh: '圣诞节 2026',
    applicableIndustries: ['零售', '餐饮', '旅游', '娱乐', '全行业'],
    angles: ['圣诞大餐', '交换礼物', '圣诞打卡', '限定优惠'],
    narrativeHooks: ['圣诞快乐！', '今年圣诞有咩节目？', '圣诞打卡热点推介...', '最后机会买圣诞礼物！'],
  },
  {
    id: 'new-year-eve-2026',
    date: '2026-12-28..2026-12-31',
    title: 'New Year\'s Eve 2026',
    titleZh: '除夕 2026',
    applicableIndustries: ['餐饮', '娱乐', '旅游', '零售', '全行业'],
    angles: ['跨年倒数', '新年愿望', '年终回顾', '新年优惠'],
    narrativeHooks: ['2026 say goodbye...', '新年愿望系咩？', '今年最难忘嘅一件事...', '新年新开始！'],
  },
  {
    id: 'double-12-2026',
    date: '2026-12-10..2026-12-12',
    title: 'Double 12 Shopping Festival',
    titleZh: '双十二购物节',
    applicableIndustries: ['零售', '电商', '科技', '美容', '全行业'],
    angles: ['双12优惠', '年末清仓', '圣诞前最后优惠', '年终购物'],
    narrativeHooks: ['圣诞前最后冲刺！', '双12 平过 Black Friday？', '年末最后一波优惠...'],
  },

  // ==================== JANUARY 2027 ====================
  {
    id: 'new-year-day-2027',
    date: '2027-01-01',
    title: 'New Year\'s Day 2027',
    titleZh: '元旦 2027',
    applicableIndustries: ['零售', '餐饮', '旅游', '全行业'],
    angles: ['新年新开始', '元旦优惠', '新年愿望', '节日消费'],
    narrativeHooks: ['2027 第一日！', '新年新目标...', '元旦有咩搞作？'],
  },
  {
    id: 'cny-shopping-2027',
    date: '2027-01-20..2027-02-05',
    title: 'CNY Shopping Season',
    titleZh: '年货节 / 春节购物季',
    applicableIndustries: ['食品', '零售', '餐饮', '美容', '全行业'],
    angles: ['办年货', '送礼攻略', '大扫除', '新衫新气象'],
    narrativeHooks: ['开始办年货未？', '今年送礼有咩新选择...', '大扫除必备清单...'],
  },
  {
    id: 'lunar-new-year-2027',
    date: '2027-02-06..2027-02-12',
    title: 'Lunar New Year 2027',
    titleZh: '农历新年（年初一至初七）',
    applicableIndustries: ['食品', '零售', '餐饮', '旅游', '全行业'],
    angles: ['拜年送礼', '新年优惠', '团圆聚餐', '新年限定'],
    narrativeHooks: ['恭喜发财！', '新年最紧要开心...', '拜年必备礼品...'],
  },

  // ==================== FEBRUARY 2027 ====================
  {
    id: 'valentines-2027',
    date: '2027-02-10..2027-02-14',
    title: 'Valentine\'s Day 2027',
    titleZh: '情人节 2027',
    applicableIndustries: ['零售', '餐饮', '美容', '珠宝', '旅游'],
    angles: ['情人节礼物', '浪漫晚餐', '情侣优惠', '限定产品'],
    narrativeHooks: ['情人节送咩唔会错？', '单身都要对自己好啲...', '最浪漫嘅唔系礼物，系...'],
  },
  {
    id: 'lantern-festival-2027',
    date: '2027-02-20',
    title: 'Lantern Festival 2027',
    titleZh: '元宵节 2027',
    applicableIndustries: ['食品', '餐饮', '零售'],
    angles: ['汤圆/元宵', '赏灯打卡', '团圆饭', '新年尾声'],
    narrativeHooks: ['元宵快乐！', '食完汤圆就正式开工啦...', '今年元宵去边度赏灯？'],
  },

  // ==================== MARCH-APRIL 2027 ====================
  {
    id: 'easter-2027',
    date: '2027-03-28..2027-04-01',
    title: 'Easter Holiday 2027',
    titleZh: '复活节假期 2027',
    applicableIndustries: ['零售', '餐饮', '旅游', '娱乐'],
    angles: ['复活节旅行', 'Staycation', '节日优惠', '亲子活动'],
    narrativeHooks: ['复活节长假去边？', '唔使飞都有 holiday vibe...', '长假必备攻略...'],
  },
  {
    id: 'ching-ming-2027',
    date: '2027-04-05',
    title: 'Ching Ming Festival 2027',
    titleZh: '清明节 2027',
    applicableIndustries: ['食品', '零售'],
    angles: ['祭祖传统', '孝亲思故', '春日出游'],
    narrativeHooks: ['清明时节...', '缅怀之余，珍惜当下...'],
    sensitivityNote: '以温情/家庭角度切入，避免消费主义过度',
  },

  // ==================== MAY 2027 ====================
  {
    id: 'labor-day-2027',
    date: '2027-05-01',
    title: 'Labour Day 2027',
    titleZh: '劳动节 / 五一黄金周',
    applicableIndustries: ['零售', '餐饮', '旅游', '全行业'],
    angles: ['五一优惠', '短途旅行', '假期消费', 'Staycation'],
    narrativeHooks: ['五一有咩plan？', '唔使飞嘅假期一样精彩...', '劳动节最应该奖励自己...'],
  },
  {
    id: 'mothers-day-2027',
    date: '2027-05-09',
    title: 'Mother\'s Day 2027',
    titleZh: '母亲节 2027',
    applicableIndustries: ['零售', '餐饮', '美容', '珠宝', '全行业'],
    angles: ['母亲节礼物', '孝顺优惠', '家庭聚餐', '妈妈专属'],
    narrativeHooks: ['母亲节送咩俾阿妈？', '平时讲唔出口嘅说话...', '阿妈嘅笑容最珍贵...'],
  },

  // ==================== JUNE 2027 ====================
  {
    id: 'tuen-ng-2027',
    date: '2027-06-09',
    title: 'Tuen Ng Festival 2027',
    titleZh: '端午节 2027',
    applicableIndustries: ['食品', '餐饮', '零售', '旅游'],
    angles: ['粽子送礼', '龙舟赛事', '端午传统', '家庭聚餐'],
    narrativeHooks: ['又到食粽嘅季节！', '今年有咩新口味粽？', '端午看龙舟好去处...'],
  },

  // ==================== RECURRING / YEAR-ROUND ====================
  {
    id: 'hk-monthly-payday',
    date: '2026-07-28..2026-07-31',
    title: 'Month-End Payday',
    titleZh: '月尾出粮日',
    applicableIndustries: ['零售', '餐饮', '美容', '娱乐'],
    angles: ['出粮消费', '月尾优惠', '犒赏自己'],
    narrativeHooks: ['出粮啦！点样奖励自己？', '月尾终于可以...'],
  },
  {
    id: 'hk-monthly-payday-aug',
    date: '2026-08-28..2026-08-31',
    title: 'Month-End Payday (Aug)',
    titleZh: '月尾出粮日（8月）',
    applicableIndustries: ['零售', '餐饮', '美容', '娱乐'],
    angles: ['出粮消费', '月尾优惠', '犒赏自己'],
    narrativeHooks: ['捱咗成个月，系时候...', '出粮必去嘅地方...'],
  },
  {
    id: 'hk-monthly-payday-sep',
    date: '2026-09-28..2026-09-30',
    title: 'Month-End Payday (Sep)',
    titleZh: '月尾出粮日（9月）',
    applicableIndustries: ['零售', '餐饮', '美容', '娱乐'],
    angles: ['出粮消费', '月尾优惠', '犒赏自己'],
    narrativeHooks: ['出粮啦！中秋+国庆前最后一击...'],
  },
  {
    id: 'hk-monthly-payday-oct',
    date: '2026-10-28..2026-10-31',
    title: 'Month-End Payday (Oct)',
    titleZh: '月尾出粮日（10月）',
    applicableIndustries: ['零售', '餐饮', '美容', '娱乐'],
    angles: ['出粮消费', '月尾优惠', '犒赏自己', '万圣节消费'],
    narrativeHooks: ['Halloween + 出粮 = 完美组合！'],
  },
  {
    id: 'hk-monthly-payday-nov',
    date: '2026-11-27..2026-11-30',
    title: 'Month-End Payday (Nov)',
    titleZh: '月尾出粮日（11月）',
    applicableIndustries: ['零售', '餐饮', '美容', '娱乐'],
    angles: ['出粮消费', 'Black Friday', '圣诞前消费'],
    narrativeHooks: ['Black Friday + 出粮 = 买爆佢！'],
  },
  {
    id: 'hk-monthly-payday-dec',
    date: '2026-12-28..2026-12-31',
    title: 'Month-End Payday (Dec)',
    titleZh: '月尾出粮日（12月）',
    applicableIndustries: ['零售', '餐饮', '美容', '娱乐'],
    angles: ['出粮消费', '新年消费', '年终奖消费'],
    narrativeHooks: ['年尾出双粮，梗系要...', '新一年，对自己好啲...'],
  },
];

/**
 * Match calendar events against a target date and optional industry.
 * If no targetDate, returns all events. Otherwise, returns events within
 * ±14 days of the target date.
 */
export function matchCalendarEvents(
  targetDate?: string,
  industry?: string,
): CalendarEvent[] {
  let events = [...HK_CALENDAR];

  if (targetDate) {
    const target = new Date(targetDate);
    if (Number.isNaN(target.getTime())) return events;

    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    events = events.filter((ev) => {
      // Use start of range (first date if range like "2026-07-15..2026-07-21")
      const evDateStr = ev.date.split('..')[0]!;
      const evDate = new Date(evDateStr);
      if (Number.isNaN(evDate.getTime())) return true;
      return Math.abs(evDate.getTime() - target.getTime()) <= twoWeeksMs;
    });
  }

  if (industry && industry !== '全行业') {
    events = events.filter(
      (ev) =>
        ev.applicableIndustries.includes('全行业') ||
        ev.applicableIndustries.some((ind) => industry.includes(ind)),
    );
  }

  // Sort by proximity to now (or target date — nearest first)
  const now = targetDate ? new Date(targetDate) : new Date();
  events.sort((a, b) => {
    const aDate = new Date(a.date.split('..')[0]!);
    const bDate = new Date(b.date.split('..')[0]!);
    return Math.abs(aDate.getTime() - now.getTime()) - Math.abs(bDate.getTime() - now.getTime());
  });

  return events;
}
