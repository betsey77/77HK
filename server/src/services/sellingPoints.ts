import type { ProductSellingPoint } from '../types/index.js';

export const MAX_PRODUCT_SELLING_POINTS = 10;
export const MAX_PRODUCT_SELLING_POINT_LENGTH = 200;

export function normalizeProductSellingPoints(value: unknown): ProductSellingPoint[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const sourceText = typeof raw.sourceText === 'string'
      ? raw.sourceText.trim().slice(0, MAX_PRODUCT_SELLING_POINT_LENGTH)
      : '';
    if (!sourceText) return [];
    const cantoneseText = typeof raw.cantoneseText === 'string'
      ? raw.cantoneseText.trim().slice(0, MAX_PRODUCT_SELLING_POINT_LENGTH)
      : '';

    return [{
      id: typeof raw.id === 'string' && raw.id.trim()
        ? raw.id
        : `selling-point-${index + 1}`,
      sourceText,
      cantoneseText,
      status: cantoneseText ? 'ready' : raw.status === 'error' ? 'error' : 'idle',
    } as ProductSellingPoint];
  }).slice(0, MAX_PRODUCT_SELLING_POINTS);
}
