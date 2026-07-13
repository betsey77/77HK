import { Router } from 'express';
import type { Request, Response } from 'express';
import { translateToMandarin, applySuggestion, audit, reAudit, generateConsumerFeedback, scoreSource } from '../services/deepseekService.js';
import { resolvePersonas } from '../services/personaService.js';
import { fallbackAudit } from '../services/fallbackService.js';
import { validateAuditResult } from '../parsers/parseResponse.js';
import type { Variants, ConsumerPersona, AuditScores } from '../types/index.js';

const router = Router();

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * POST /api/translate
 * Translate Cantonese feedback text to Mandarin.
 */
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const translated = await translateToMandarin(text.trim());
    res.json({ translated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/apply-suggestion
 * Apply a consumer's modification suggestion to one or more variant texts.
 */
router.post('/apply-suggestion', async (req: Request, res: Response) => {
  try {
    const { variantText, suggestion, reason, brandRedLines, originalText, appliedSuggestions } = req.body as {
      variantText?: string;
      suggestion?: string;
      reason?: string;
      brandRedLines?: string;
      originalText?: string;
      appliedSuggestions?: string[];
    };

    if (!variantText || typeof variantText !== 'string') {
      res.status(400).json({ error: 'variantText is required' });
      return;
    }
    if (!suggestion || typeof suggestion !== 'string') {
      res.status(400).json({ error: 'suggestion is required' });
      return;
    }

    const modifiedText = await applySuggestion(
      variantText.trim(),
      suggestion.trim(),
      (reason || '').trim(),
      brandRedLines,
      originalText?.trim(),
      appliedSuggestions,
    );

    if (!modifiedText) {
      res.status(500).json({ error: 'Failed to apply suggestion' });
      return;
    }

    res.json({ modifiedText });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to apply suggestion';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/re-evaluate
 * Re-run audit scoring and consumer feedback on updated variants (after modification).
 * Steps run in parallel with timeouts to prevent hanging.
 */
router.post('/re-evaluate', async (req: Request, res: Response) => {
  try {
    const { variants, consumerPersonas, platform, source, brandName, productName, previousScores, brandRedLines } = req.body as {
      variants?: Variants;
      consumerPersonas?: ConsumerPersona[];
      platform?: string;
      source?: string;
      brandName?: string;
      productName?: string;
      previousScores?: AuditScores | null;
      brandRedLines?: string;
    };

    if (!variants) {
      res.status(400).json({ error: 'variants is required' });
      return;
    }

    // Validate variants has all required keys
    const requiredKeys = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];
    for (const key of requiredKeys) {
      if (typeof (variants as unknown as Record<string, unknown>)[key] !== 'string') {
        res.status(400).json({ error: `variants.${key} is required and must be a string` });
        return;
      }
    }

    const personas = resolvePersonas(consumerPersonas);
    const hasPersonas = personas.length > 0;
    const fallbackAuditResult = fallbackAudit(variants, source ?? '', null as never);

    // Run audit, source scoring, and consumer feedback in parallel WITH timeouts
    const [auditResult, sourceScores, consumerFeedbackRaw] = await Promise.all([
      // Step 1: Re-audit (with 15s timeout, fallback to rules-based audit)
      withTimeout(
        (async () => {
          try {
            if (previousScores) {
              return await reAudit(variants, previousScores, brandRedLines);
            }
            return await audit(variants, brandRedLines);
          } catch {
            return fallbackAuditResult;
          }
        })(),
        15_000,
        fallbackAuditResult,
      ),
      // Step 2: Re-score source (with 10s timeout, null if fails or no source)
      source && typeof source === 'string' && source.trim()
        ? withTimeout(scoreSource(source).catch(() => null), 10_000, null)
        : Promise.resolve(null),
      // Step 3: Consumer feedback — only when user has selected personas
      hasPersonas
        ? withTimeout(
            generateConsumerFeedback(
              variants,
              personas,
              platform || '全部平台',
              source,
              brandName,
              productName,
              brandRedLines,
            ).catch(() => null),
            35_000,
            null,
          )
        : Promise.resolve(null),
    ]);

    // Consumer feedback: only when user has selected personas
    // No fallback — if user didn't pick personas, no feedback is generated
    const consumerFeedback = consumerFeedbackRaw;

    const validatedAudit = validateAuditResult(auditResult);
    const generatedScores = validatedAudit.scores ?? (auditResult as unknown as Record<string, unknown>).scores as never ?? null;

    // Sync thermometer from five-dimension scores for visual consistency
    if (generatedScores && validatedAudit.thermometer) {
      validatedAudit.thermometer.overall = generatedScores.total;
      validatedAudit.thermometer.dimensions = {
        cantoneseFeel: Math.max(1, Math.min(5, Math.round(generatedScores.cantoneseNaturalness / 20))),
        culturalFit: Math.max(1, Math.min(5, Math.round(generatedScores.readability / 20))),
        platformFit: Math.max(1, Math.min(5, Math.round(generatedScores.platformFit / 20))),
        brandSafety: Math.max(1, Math.min(5, Math.round(generatedScores.brandSafety / 20))),
        tradConsistency: Math.max(1, Math.min(5, Math.round(generatedScores.creativity / 20))),
        hookStrength: Math.max(1, Math.min(5, Math.round(generatedScores.hookStrength / 20))),
        visualStrategy: Math.max(1, Math.min(5, Math.round(generatedScores.emojiHashtagFit / 20))),
        engagementFit: Math.max(1, Math.min(5, Math.round(generatedScores.engagementPotential / 20))),
      };
    }

    res.json({
      audit: validatedAudit,
      scores: generatedScores
        ? { generated: generatedScores, source: sourceScores }
        : undefined,
      consumerFeedback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Re-evaluation failed';
    res.status(500).json({ error: message });
  }
});

export default router;
