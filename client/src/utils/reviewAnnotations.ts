import type { ReviewAnnotation } from '../types';

export interface AnnotatedSegment {
  text: string;
  annotation?: ReviewAnnotation;
}

export function utf16OffsetToCodePoint(text: string, offset: number): number {
  return Array.from(text.slice(0, Math.max(0, offset))).length;
}

export function buildAnnotatedSegments(
  content: string,
  annotations: ReviewAnnotation[] | null | undefined,
): { segments: AnnotatedSegment[]; invalid: ReviewAnnotation[] } {
  const points = Array.from(content);
  const sorted = [...(annotations ?? [])].sort((a, b) => a.startOffset - b.startOffset);
  const valid: ReviewAnnotation[] = [];
  const invalid: ReviewAnnotation[] = [];
  let lastEnd = 0;

  for (const item of sorted) {
    const structurallyValid = Number.isInteger(item.startOffset)
      && Number.isInteger(item.endOffset)
      && item.startOffset >= lastEnd
      && item.endOffset > item.startOffset
      && item.endOffset <= points.length
      && points.slice(item.startOffset, item.endOffset).join('') === item.quotedText;
    if (!structurallyValid) {
      invalid.push(item);
      continue;
    }
    valid.push(item);
    lastEnd = item.endOffset;
  }

  if (valid.length === 0) return { segments: [{ text: content }], invalid };

  const segments: AnnotatedSegment[] = [];
  let cursor = 0;
  for (const annotation of valid) {
    if (annotation.startOffset > cursor) {
      segments.push({ text: points.slice(cursor, annotation.startOffset).join('') });
    }
    segments.push({
      text: points.slice(annotation.startOffset, annotation.endOffset).join(''),
      annotation,
    });
    cursor = annotation.endOffset;
  }
  if (cursor < points.length) segments.push({ text: points.slice(cursor).join('') });
  return { segments, invalid };
}

