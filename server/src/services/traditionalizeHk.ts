/**
 * Last-mile simplified → Hong Kong Traditional normalizer for generated copy.
 *
 * Uses OpenCC (opencc-js) full dictionary: cn → hk.
 * Applied after model/rules generation, before audit / persist.
 * No extra model call.
 */

import OpenCC from 'opencc-js';
import type { VariantMeta, Variants } from '../types/index.js';

/** Singleton converter: Mainland Simplified → Hong Kong Traditional. */
const cnToHk = OpenCC.Converter({ from: 'cn', to: 'hk' });

/**
 * Convert Chinese text to HK Traditional via OpenCC.
 * English, emoji, punctuation, and already-traditional text pass through safely.
 */
export function traditionalizeText(input: string): string {
  if (!input) return input;
  return cnToHk(input);
}

export function traditionalizeVariants(variants: Variants): Variants {
  return {
    standardHK: traditionalizeText(variants.standardHK),
    lightCantonese: traditionalizeText(variants.lightCantonese),
    ig: traditionalizeText(variants.ig),
    facebook: traditionalizeText(variants.facebook),
    shorts: traditionalizeText(variants.shorts),
  };
}

export function traditionalizeVariantMeta(
  meta: Record<string, VariantMeta> | undefined,
): Record<string, VariantMeta> | undefined {
  if (!meta) return undefined;
  const next: Record<string, VariantMeta> = {};
  for (const [key, vm] of Object.entries(meta)) {
    next[key] = {
      ...vm,
      headline: traditionalizeText(vm.headline ?? ''),
      altHeadlines: (vm.altHeadlines ?? []).map(traditionalizeText),
      ctaLine: traditionalizeText(vm.ctaLine ?? ''),
      valuePropStatement: vm.valuePropStatement
        ? traditionalizeText(vm.valuePropStatement)
        : undefined,
      targetPersona: vm.targetPersona ? traditionalizeText(vm.targetPersona) : undefined,
      creativeForm: vm.creativeForm ? traditionalizeText(vm.creativeForm) : undefined,
      strategyGoal: vm.strategyGoal ? traditionalizeText(vm.strategyGoal) : undefined,
    };
  }
  return next;
}
