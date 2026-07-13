// Validate parsed JSON against expected schema shapes.
// Throws on critical missing fields, warns on non-critical.

import type {
  Diagnosis,
  Variants,
  Audit,
  AuditScores,
  VariantMeta,
} from '../types/index.js';

export function validateDiagnoseGenerateResult(data: unknown): { diagnosis: Diagnosis; variants: Variants; variantMeta?: Record<string, VariantMeta> } {
  const obj = data as Record<string, unknown>;
  if (!obj.diagnosis || !obj.variants) {
    throw new Error('Missing diagnosis or variants in generate response');
  }

  const diagnosis = obj.diagnosis as Record<string, unknown>;
  const variants = obj.variants as Record<string, unknown>;

  // Ensure variants have all required keys
  const requiredVariantKeys = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];
  for (const key of requiredVariantKeys) {
    if (typeof variants[key] !== 'string' || !variants[key]) {
      throw new Error(`Missing variant: ${key}`);
    }
  }

  // 🆕 Ph1: Pass through variantMeta if the LLM returned it
  let variantMeta: Record<string, VariantMeta> | undefined;
  if (obj.variantMeta && typeof obj.variantMeta === 'object') {
    const raw = obj.variantMeta as Record<string, unknown>;
    variantMeta = {};
    for (const key of requiredVariantKeys) {
      if (raw[key] && typeof raw[key] === 'object') {
        const vm = raw[key] as Record<string, unknown>;
        variantMeta[key] = {
          headline: typeof vm.headline === 'string' ? vm.headline : '',
          altHeadlines: Array.isArray(vm.altHeadlines) ? vm.altHeadlines.filter(h => typeof h === 'string') : [],
          ctaLine: typeof vm.ctaLine === 'string' ? vm.ctaLine : '',
          valuePropStatement: typeof vm.valuePropStatement === 'string' ? vm.valuePropStatement : undefined,
          targetPersona: typeof vm.targetPersona === 'string' ? vm.targetPersona : undefined,
          creativeForm: typeof vm.creativeForm === 'string' ? vm.creativeForm : undefined,
          strategyGoal: typeof vm.strategyGoal === 'string' ? vm.strategyGoal : undefined,
        };
      }
    }
    if (Object.keys(variantMeta).length === 0) variantMeta = undefined;
  }

  return {
    diagnosis: {
      hasSimplifiedChars: Boolean(diagnosis.hasSimplifiedChars),
      mainlandPhrases: Array.isArray(diagnosis.mainlandPhrases)
        ? diagnosis.mainlandPhrases as Diagnosis['mainlandPhrases']
        : [],
      issues: Array.isArray(diagnosis.issues)
        ? diagnosis.issues as string[]
        : [],
      complianceViolations: Array.isArray(diagnosis.complianceViolations)
        ? diagnosis.complianceViolations as Diagnosis['complianceViolations']
        : undefined,
    },
    variants: variants as unknown as Variants,
    variantMeta,
  };
}

export function validateAuditResult(data: unknown): Audit {
  const obj = data as Record<string, unknown>;

  if (!obj.thermometer) {
    throw new Error('Missing thermometer in audit response');
  }

  const thermometer = obj.thermometer as Record<string, unknown>;
  const dimensions = (thermometer.dimensions ?? {}) as Record<string, unknown>;

  return {
    thermometer: {
      overall: typeof thermometer.overall === 'number' ? thermometer.overall : 70,
      dimensions: {
        cantoneseFeel: validateDimension(dimensions.cantoneseFeel),
        culturalFit: validateDimension(dimensions.culturalFit),
        platformFit: validateDimension(dimensions.platformFit),
        brandSafety: validateDimension(dimensions.brandSafety),
        tradConsistency: validateDimension(dimensions.tradConsistency),
        hookStrength: validateDimension(dimensions.hookStrength),
        visualStrategy: validateDimension(dimensions.visualStrategy),
        engagementFit: validateDimension(dimensions.engagementFit),
      },
    },
    issues: Array.isArray(obj.issues) ? obj.issues as Audit['issues'] : [],
    replacements: Array.isArray(obj.replacements) ? obj.replacements as Audit['replacements'] : [],
    risks: Array.isArray(obj.risks) ? obj.risks as Audit['risks'] : [],
    comments: Array.isArray(obj.comments) ? obj.comments as Audit['comments'] : [],
    scores: validateScores(obj.scores),
  };
}

function validateScores(value: unknown): AuditScores | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const s = value as Record<string, unknown>;
  const dims: (keyof AuditScores)[] = [
    'cantoneseNaturalness', 'brandSafety', 'platformFit', 'readability', 'creativity',
    'hookStrength', 'emojiHashtagFit', 'engagementPotential',
  ];
  for (const d of dims) {
    if (typeof s[d] !== 'number' || isNaN(s[d] as number)) return undefined;
  }
  if (typeof s.total !== 'number' || isNaN(s.total as number)) return undefined;
  return {
    cantoneseNaturalness: Math.max(0, Math.min(100, s.cantoneseNaturalness as number)),
    brandSafety: Math.max(0, Math.min(100, s.brandSafety as number)),
    platformFit: Math.max(0, Math.min(100, s.platformFit as number)),
    readability: Math.max(0, Math.min(100, s.readability as number)),
    creativity: Math.max(0, Math.min(100, s.creativity as number)),
    hookStrength: Math.max(0, Math.min(100, s.hookStrength as number)),
    emojiHashtagFit: Math.max(0, Math.min(100, s.emojiHashtagFit as number)),
    engagementPotential: Math.max(0, Math.min(100, s.engagementPotential as number)),
    total: Math.max(0, Math.min(100, s.total as number)),
  };
}

function validateDimension(value: unknown): number {
  if (typeof value === 'number' && value >= 1 && value <= 5) return value;
  if (typeof value === 'number') return Math.max(1, Math.min(5, Math.round(value)));
  return 3; // Default
}