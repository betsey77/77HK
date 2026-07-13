// Consumer persona presets and helpers.
// Default personas are used when the user doesn't provide custom ones.

import type { ConsumerPersona } from '../types/index.js';

function makeId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_PERSONAS: ConsumerPersona[] = [
  {
    id: 'default-saolei',
    name: '本地師奶阿May',
    ageRange: '35-50',
    occupation: '家庭主婦',
    habits: '精打細算、睇WhatsApp group、重口碑、鐘意試新嘢但要抵',
    apps: 'Facebook、WhatsApp Group',
    notes: '對價錢敏感，見到「優惠」「限時」會特別留意。唔鐘意太複雜嘅文字。',
  },
  {
    id: 'default-ol',
    name: '職場白領Jason',
    ageRange: '25-35',
    occupation: '中環返工，marketing manager',
    habits: '追求效率、睇IG多過FB、會因為文案有趣而follow品牌',
    apps: 'IG、LinkedIn、Threads',
    notes: '中英夾雜自然，對設計感同文案質素要求高。太hard sell會反感。',
  },
  {
    id: 'default-genz',
    name: '斜槓青年Chris',
    ageRange: '18-25',
    occupation: '大學生 / freelance designer',
    habits: '追求質感、鐘意小眾品牌、願意為體驗付費、會留意品牌tone of voice',
    apps: 'IG、Threads、小紅書',
    notes: '睇design多過睇字，caption太長會skip。用開"slay" "vibes"呢類英文。',
  },
  {
    id: 'default-parent',
    name: '育兒爸媽Karen',
    ageRange: '30-45',
    occupation: '在職媽媽，有兩個小朋友',
    habits: '關注教育同健康、會做功課先消費、睇親子group介紹',
    apps: 'Facebook、WhatsApp Group、YouTube',
    notes: '重視資訊準確性，對誇張廣告免疫。實用資訊多過花巧文案。',
  },
];

/**
 * Resolve personas: use user-provided if any, otherwise return defaults.
 * Always returns at least 2 personas for meaningful feedback.
 */
export function resolvePersonas(userPersonas?: ConsumerPersona[]): ConsumerPersona[] {
  if (userPersonas && userPersonas.length > 0) {
    return userPersonas.map(p => ({
      ...p,
      id: p.id || makeId(),
    }));
  }
  return [];
}

/**
 * Create a new empty persona template.
 */
export function createEmptyPersona(): ConsumerPersona {
  return {
    id: makeId(),
    name: '',
    ageRange: '',
    occupation: '',
    habits: '',
    apps: '',
    notes: '',
  };
}
