import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { diagnoseAndGenerate, audit, scoreSource, generateConsumerFeedback, scoreCantoneseNaturalness } from '../services/deepseekService.js';
import { generateWithCantoneseLLM } from '../services/cantoneseService.js';
import { fallbackAudit, fallbackGenerate } from '../services/fallbackService.js';
import {
  getModelRuntimePolicy,
  RealModelUnavailableError,
} from '../services/modelPolicy.js';
import { resolvePersonas } from '../services/personaService.js';
import { HK_CALENDAR } from '../services/calendarData.js';
import { requireAuth } from '../middleware/auth.js';
import { upsertJob, markProcessing, completeJob, failJob } from '../services/generationJobsService.js';
import { reserveQuota, consumeQuota, releaseQuota } from '../services/quotaService.js';
import {
  validateDiagnoseGenerateResult,
  validateAuditResult,
} from '../parsers/parseResponse.js';
import { validateCalendarCoverage, ensureCalendarCoverage } from '../services/calendarValidation.js';
import type { GenerateRequest, GenerationEngine, InputLanguage } from '../types/index.js';
import { resolveW1Fields, VALID_PRIMARY_TONES } from '../prompts/w1Constraints.js';
import { createUserClient } from '../services/supabase.js';
import {
  resolveCaseLibraryContext,
  budgetReferenceCases,
  buildCaseLibrarySnapshots,
  normalizeSelectedCaseLibraryIds,
  sanitizeCaseLibraryFieldsForPersistence,
  CASE_LIBRARY_PARTIAL_NOTICE,
} from '../services/caseLibraryContext.js';
import { normalizeProductSellingPoints } from '../services/sellingPoints.js';
import type { ModelCallContext } from '../services/telemetryService.js';
import {
  afterGenerationPersistReviewPack,
  buildCaptureInputFromGenerateContext,
  buildManifestForGeneration,
} from '../services/badCaseReviewPackService.js';

// ============================================================
// Error classification helpers
// ============================================================

/**
 * Errors that indicate an uncertain outcome — the model call may have
 * succeeded or failed, but we cannot determine which. In these cases
 * the job stays 'processing' and the reservation is kept alive for
 * reconciliation rather than being released.
 */
const UNCERTAIN_ERROR_PATTERNS = [
  /timeout/i,
  /timed.?out/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EPIPE/i,
  /AbortError/i,
  /abort/i,
  /network/i,
  /fetch failed/i,
  /connection/i,
  /socket hang up/i,
  /request was interrupted/i,
];

function isUncertainError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return UNCERTAIN_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

const router = Router();

const VALID_PLATFORMS = ['ig', 'facebook', 'shorts', 'all'];
const VALID_TONES = [...VALID_PRIMARY_TONES];
const VALID_INPUT_LANGUAGES: InputLanguage[] = ['mandarin', 'cantonese'];
const LEGACY_TONE_MAP: Record<string, string> = {
  '绌╁Ε': '穩妥',
  '娲绘綉': '活潑',
  '楂樼礆': '高級',
  '琛楀潑': '街坊',
  '骞磋紩': '年輕',
};

// Idempotency key: max 128 chars, alphanumeric + hyphens/underscores
const IDEMPOTENCY_KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,126}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function validateRequest(body: unknown): GenerateRequest {
  const obj = body as Record<string, unknown>;

  if (!obj.source || typeof obj.source !== 'string' || obj.source.trim().length === 0) {
    throw new Error('source is required and must be a non-empty string');
  }

  const platform = (obj.platform as string) ?? 'all';
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform: ${platform}. Must be one of: ${VALID_PLATFORMS.join(', ')}`);
  }

  const rawTone = (obj.tone as string) ?? (obj.primaryTone as string) ?? '穩妥';
  const mappedTone = LEGACY_TONE_MAP[rawTone] ?? rawTone;
  // Prefer primaryTone when provided; still accept legacy tone-only payloads.
  if (obj.primaryTone && typeof obj.primaryTone === 'string') {
    obj.primaryTone = LEGACY_TONE_MAP[obj.primaryTone] ?? obj.primaryTone;
  }
  obj.tone = mappedTone;

  const w1 = resolveW1Fields(obj);
  const tone = w1.tone;
  if (!VALID_TONES.includes(tone)) {
    throw new Error(`Invalid tone: ${tone}. Must be one of: ${VALID_TONES.join(', ')}`);
  }

  const cantoneseLevel = Number(obj.cantoneseLevel ?? 2);
  if (isNaN(cantoneseLevel) || cantoneseLevel < 0 || cantoneseLevel > 5) {
    throw new Error('cantoneseLevel must be a number between 0 and 5');
  }

  const englishMixingLevel = Number(obj.englishMixingLevel ?? 1);
  if (isNaN(englishMixingLevel) || englishMixingLevel < 0 || englishMixingLevel > 5) {
    throw new Error('englishMixingLevel must be a number between 0 and 5');
  }

  const creativityLevel = Number(obj.creativityLevel ?? 2);
  if (isNaN(creativityLevel) || creativityLevel < 0 || creativityLevel > 4) {
    throw new Error('creativityLevel must be a number between 0 and 4');
  }

  const inputLanguage = (obj.inputLanguage as string) ?? 'mandarin';
  if (!VALID_INPUT_LANGUAGES.includes(inputLanguage as InputLanguage)) {
    throw new Error(`Invalid inputLanguage: ${inputLanguage}. Must be 'mandarin' or 'cantonese'`);
  }

  const brandName = obj.brandName && typeof obj.brandName === 'string' ? obj.brandName.trim() : undefined;
  const productName = obj.productName && typeof obj.productName === 'string' ? obj.productName.trim() : undefined;
  const brandRedLines = obj.brandRedLines && typeof obj.brandRedLines === 'string' ? obj.brandRedLines.trim() : undefined;
  const structuredBriefEnabled = obj.structuredBriefEnabled === true ? true : undefined;
  const refresh = obj.refresh === true ? true : undefined;
  const workbench = (obj.workbenchSettings && typeof obj.workbenchSettings === 'object'
    ? obj.workbenchSettings
    : {}) as Record<string, unknown>;
  const productSellingPoints = normalizeProductSellingPoints(
    obj.productSellingPoints ?? workbench.productSellingPoints,
  );

  // Consumer personas: accept array or undefined
  let consumerPersonas = undefined;
  if (Array.isArray(obj.consumerPersonas) && obj.consumerPersonas.length > 0) {
    consumerPersonas = obj.consumerPersonas.filter(
      (p: unknown) => p && typeof p === 'object' && (p as Record<string, unknown>).name,
    );
    if (consumerPersonas.length === 0) consumerPersonas = undefined;
  }

  // Reference cases: accept array or undefined
  let referenceCases = undefined;
  if (Array.isArray(obj.referenceCases) && obj.referenceCases.length > 0) {
    referenceCases = obj.referenceCases.filter(
      (rc: unknown) => rc && typeof rc === 'object' && typeof (rc as Record<string, unknown>).content === 'string',
    );
    if (referenceCases.length === 0) referenceCases = undefined;
  }

  // Calendar events: look up by IDs from calendarData
  let calendarEvents = undefined;
  if (Array.isArray(obj.calendarEventIds) && obj.calendarEventIds.length > 0) {
    const ids = new Set(obj.calendarEventIds.filter((id: unknown) => typeof id === 'string' && id.trim()));
    if (ids.size > 0) {
      calendarEvents = HK_CALENDAR.filter((ev) => ids.has(ev.id));
      if (calendarEvents.length === 0) calendarEvents = undefined;
    }
    if (calendarEvents) {
      console.log(`[Generate] Calendar events injected: ${calendarEvents.map(e => e.titleZh).join(', ')}`);
    }
  }

  // W3: accept selectedCaseLibraryIds only (UUIDs, max 3). Never accept client case bodies.
  // Prefer top-level IDs; fall back to workbenchSettings.selectedCaseLibraryIds.
  const selectedCaseLibraryIds = normalizeSelectedCaseLibraryIds(
    obj.selectedCaseLibraryIds ?? workbench.selectedCaseLibraryIds,
  );

  // Validate idempotency key if provided
  const idempotencyKey = obj.idempotencyKey as string | undefined;
  if (idempotencyKey !== undefined) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0 || idempotencyKey.length > 128) {
      throw new Error('idempotencyKey must be a string between 1 and 128 characters');
    }
    if (!IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
      throw new Error('idempotencyKey must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  return {
    source: obj.source as string,
    platform: platform as GenerateRequest['platform'],
    tone: tone as GenerateRequest['tone'],
    cantoneseLevel,
    englishMixingLevel,
    useEnhancement: false, // deprecated
    brandName: brandName || undefined,
    productName: productName || undefined,
    brandRedLines: brandRedLines || undefined,
    productSellingPoints: productSellingPoints.length > 0 ? productSellingPoints : undefined,
    structuredBriefEnabled: structuredBriefEnabled || undefined,
    creativityLevel,
    inputLanguage: inputLanguage as InputLanguage,
    refresh,
    consumerPersonas,
    referenceCases,
    calendarEvents,
    copyType: w1.copyType,
    customCopyType: w1.customCopyType,
    lengthControlEnabled: w1.lengthControlEnabled,
    copyLengthLevel: w1.copyLengthLevel,
    primaryTone: w1.primaryTone,
    toneModifiers: w1.toneModifiers,
    selectedCaseLibraryIds: selectedCaseLibraryIds.length > 0 ? selectedCaseLibraryIds : undefined,
    // caseLibraryContext is filled by route after JWT-scoped resolve — never from client bodies
  };
}

// ============================================================
// POST /api/generate — authenticated generation with persistence
// ============================================================

router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId as string;
  const userJwt = req.userJwt as string;
  let jobId: string | undefined;
  let reservation: Awaited<ReturnType<typeof reserveQuota>> = null;

  try {
    const params = validateRequest(req.body);
    const modelPolicy = getModelRuntimePolicy();

    if (modelPolicy.requireRealModel && !modelPolicy.hasConfiguredRealModel) {
      res.status(503).json({
        error: 'A real AI model is required but not configured.',
        code: 'REAL_MODEL_NOT_CONFIGURED',
      });
      return;
    }

    // ---- W3: resolve personal case library via user JWT (RLS), never service role ----
    // Client may only send selectedCaseLibraryIds; bodies come from DB.
    const caseResolve = await resolveCaseLibraryContext(
      userId,
      userJwt,
      createUserClient,
      params.selectedCaseLibraryIds,
    );
    params.caseLibraryContext =
      caseResolve.entries.length > 0 ? caseResolve.entries : undefined;
    params.selectedCaseLibraryIds =
      caseResolve.requestedIds.length > 0 ? caseResolve.requestedIds : undefined;
    // Case library has priority; remaining budget (max 5 total) for bookmark references
    params.referenceCases = budgetReferenceCases(
      caseResolve.entries.length,
      params.referenceCases,
    );

    if (caseResolve.entries.length > 0) {
      console.log(
        `[Generate] Case library context: ${caseResolve.entries.length} resolved` +
          (caseResolve.partialUnavailable ? ' (partial unavailable)' : ''),
      );
    }

    // ---- Step 0: Atomic idempotent job creation ----
    // Client MUST provide an idempotency key. If not provided, we reject.
    const idempotencyKey = (req.body as Record<string, unknown>).idempotencyKey as string | undefined;
    if (!idempotencyKey) {
      res.status(400).json({ error: 'idempotencyKey is required. Generate a stable key per user action.' });
      return;
    }

    // Enrich brief for historical interpretability (snapshots of resolved cases only)
    const rawBody = sanitizeCaseLibraryFieldsForPersistence(
      req.body as Record<string, unknown>,
    );
    const incomingWorkbench =
      rawBody.workbenchSettings && typeof rawBody.workbenchSettings === 'object'
        ? { ...(rawBody.workbenchSettings as Record<string, unknown>) }
        : {};
    const resolvedSnapshots = buildCaseLibrarySnapshots(caseResolve.entries);
    const brief = {
      ...rawBody,
      productSellingPoints: params.productSellingPoints ?? [],
      selectedCaseLibraryIds: caseResolve.requestedIds,
      workbenchSettings: {
        ...incomingWorkbench,
        productSellingPoints: params.productSellingPoints ?? [],
        selectedCaseLibraryIds: caseResolve.requestedIds,
        resolvedCaseLibrarySnapshots: resolvedSnapshots,
      },
      resolvedCaseLibrarySnapshots: resolvedSnapshots,
    };

    const { job: existingJob, created } = await upsertJob(userId, {
      idempotencyKey,
      source: params.source,
      platform: params.platform,
      tone: params.tone,
      cantoneseLevel: params.cantoneseLevel,
      englishMixingLevel: params.englishMixingLevel,
      creativityLevel: params.creativityLevel,
      inputLanguage: params.inputLanguage,
      brandName: params.brandName,
      productName: params.productName,
      brandRedLines: params.brandRedLines,
      brief,
    });

    // Duplicate request handling:
    // - completed → return existing result (200)
    // - processing/pending → return existing status (200), no re-generation
    // - failed → return failed info (200); caller uses new key to retry
    if (!created) {
      console.log(`[Generate] Idempotent hit: job ${existingJob.id} (status=${existingJob.status})`);

      if (existingJob.status === 'completed') {
        res.json({
          diagnosis: existingJob.diagnosis,
          variants: existingJob.variants,
          variantMeta: existingJob.variantMeta ?? undefined,
          audit: existingJob.audit,
          generationEngine: existingJob.generationEngine,
          scores: existingJob.scores ?? undefined,
          consumerFeedback: existingJob.consumerFeedback ?? undefined,
          jobId: existingJob.id,
          idempotent: true,
        });
        return;
      }

      if (existingJob.status === 'processing' || existingJob.status === 'pending') {
        res.status(202).json({
          jobId: existingJob.id,
          status: existingJob.status,
          message: existingJob.status === 'processing'
            ? 'Generation is already in progress. Poll for results.'
            : 'Job is queued and will begin shortly.',
          idempotent: true,
        });
        return;
      }

      // failed — return error info, client must use new idempotency key to retry
      res.status(200).json({
        jobId: existingJob.id,
        status: 'failed',
        error: existingJob.errorMessage ?? 'Previous generation failed',
        errorCode: existingJob.errorCode,
        idempotent: true,
        retryHint: 'Use a new idempotencyKey to retry generation.',
      });
      return;
    }

    jobId = existingJob.id;

    // ---- Step 0.5: Quota reserve — fail fast before calling any model ----
    // @C2a-TRUSTED-WRITE: Quota is checked and reserved server-side using the
    // trusted Supabase client (service_role). The browser cannot forge quota.
    // Uses the same idempotencyKey as the job for coordinated idempotency.
    reservation = await reserveQuota(userId, idempotencyKey);
    if (!reservation) {
      // No active subscription or quota exhausted — do NOT call any model.
      // Mark the job as failed (no quota) and return 402.
      try {
        await failJob(jobId, userId, 'Insufficient quota. Please upgrade your plan.', 'QUOTA_EXHAUSTED');
      } catch (e) {
        console.error('[Generate] Failed to persist quota-exhausted state:', e);
      }
      try {
        await afterGenerationPersistReviewPack({
          jobId,
          ownerId: userId,
          status: 'failed',
          errorCode: 'QUOTA_EXHAUSTED',
          generationEngine: null,
          artifactManifest: buildManifestForGeneration({
            generationEngine: null,
            captureInput: null,
          }),
        });
      } catch {
        console.error(`[review_pack] category=review_pack.unexpected jobId=${jobId}`);
      }
      res.status(402).json({
        error: 'Insufficient quota',
        message: 'You have no remaining generation quota. Please upgrade your plan to continue.',
        jobId,
      });
      return;
    }

    // Mark as processing
    await markProcessing(jobId, userId);
    const modelCallContext: ModelCallContext = {
      jobId,
      requestId: randomUUID(),
    };

    // ---- Step 1: Generate ----
    let generateResult;
    let generationEngine: GenerationEngine;

    const hasSelfHosted = !!process.env.CANTONESE_API_URL;
    const cantoResult = hasSelfHosted
      ? await withTimeout(generateWithCantoneseLLM(params, modelCallContext), 15_000, null)
      : null;

    if (cantoResult) {
      generateResult = cantoResult;
      generationEngine = 'self-hosted-cantonese';
      console.log('[Generate] Using self-hosted Cantonese LLM engine');
    } else {
      console.warn('[Generate] Cantonese LLM unavailable, falling back to DeepSeek...');
      const deepseekResult = await withTimeout(
        diagnoseAndGenerate(params, modelCallContext, 1).catch((error) => {
          console.error('[Generate] DeepSeek request failed:', error);
          return null;
        }),
        modelPolicy.generationTimeoutMs,
        null,
      );
      if (deepseekResult) {
        generateResult = deepseekResult;
        generationEngine = 'deepseek';
        console.log('[Generate] Using DeepSeek engine');

        // §16.3: Score Cantonese naturalness — if < 3, auto-retry once
        const cantoScore = await withTimeout(
          scoreCantoneseNaturalness(deepseekResult.variants, modelCallContext, 1),
          modelPolicy.qualityScoreTimeoutMs,
          null,
        );
        if (cantoScore) {
          console.log(`[Generate] Cantonese naturalness: avg=${cantoScore.average}`);
          if (cantoScore.average < 3 && modelPolicy.allowQualityRetry) {
            console.warn(`[Generate] Cantonese score ${cantoScore.average} < 3 — auto-retrying generation...`);
            const retryResult = await withTimeout(
              diagnoseAndGenerate(params, modelCallContext, 2),
              modelPolicy.generationTimeoutMs,
              null,
            );
            if (retryResult) {
              const retryScore = await withTimeout(
                scoreCantoneseNaturalness(retryResult.variants, modelCallContext, 2),
                modelPolicy.qualityScoreTimeoutMs,
                null,
              );
              if (retryScore && retryScore.average > cantoScore.average) {
                console.log(`[Generate] Retry improved score: ${cantoScore.average} → ${retryScore.average}`);
                generateResult = retryResult;
              } else {
                console.log(`[Generate] Retry did not improve, keeping original`);
              }
            }
          }
        }
      } else {
        if (modelPolicy.requireRealModel) {
          throw new RealModelUnavailableError();
        }
        console.warn('[Generate] DeepSeek also unavailable, using rules engine');
        generateResult = fallbackGenerate(params);
        generationEngine = 'rules';
      }
    }

    // ---- Validate generate result ----
    const validatedGen = validateDiagnoseGenerateResult(generateResult);

    // ---- Calendar coverage enforcement (bounded, no retries, no model calls) ----
    // MUST run BEFORE audit and consumer feedback so they operate on the
    // final variants. If any platform variant lacks calendar event coverage,
    // append a deterministic bridge sentence. This ensures persisted job and
    // HTTP response body are always consistent.
    if (params.calendarEvents && params.calendarEvents.length > 0) {
      const variantsBefore: Record<string, string> = {
        standardHK: validatedGen.variants.standardHK,
        lightCantonese: validatedGen.variants.lightCantonese,
        ig: validatedGen.variants.ig,
        facebook: validatedGen.variants.facebook,
        shorts: validatedGen.variants.shorts,
      };
      const coverage = validateCalendarCoverage(variantsBefore, params.calendarEvents);

      if (!coverage.allCovered) {
        console.warn(
          `[Generate] Calendar coverage incomplete — missed: ${coverage.missedVariants.join(', ')}. ` +
          `Patching with deterministic bridge sentences.`,
        );
        const patched = ensureCalendarCoverage(variantsBefore, params.calendarEvents);
        validatedGen.variants.standardHK = patched.standardHK;
        validatedGen.variants.lightCantonese = patched.lightCantonese;
        validatedGen.variants.ig = patched.ig;
        validatedGen.variants.facebook = patched.facebook;
        validatedGen.variants.shorts = patched.shorts;
      } else {
        console.log('[Generate] Calendar coverage: all 5 platforms covered');
      }
    }

    // ---- Steps 2/3/4 run in parallel ----
    const personas = resolvePersonas(params.consumerPersonas);
    const hasPersonas = personas.length > 0;
    const fallbackAuditResult = fallbackAudit(validatedGen.variants, params.source, validatedGen.diagnosis);

    const [auditResult, sourceScores, consumerFeedbackRaw] = await Promise.all([
      withTimeout(
        audit(validatedGen.variants, params.brandRedLines, modelCallContext).catch(() => fallbackAuditResult),
        modelPolicy.postProcessingTimeoutMs,
        fallbackAuditResult,
      ),
      generationEngine !== 'rules'
        ? withTimeout(scoreSource(params.source, modelCallContext).catch(() => null), 8_000, null)
        : Promise.resolve(null),
      generationEngine !== 'rules' && hasPersonas
        ? withTimeout(
            generateConsumerFeedback(
              validatedGen.variants,
              personas,
              params.platform === 'all' ? '全部平台' : params.platform,
              params.source,
              params.brandName,
              params.productName,
              params.brandRedLines,
              modelCallContext,
            ).catch(() => null),
            modelPolicy.postProcessingTimeoutMs,
            null,
          )
        : Promise.resolve(null),
    ]);

    const consumerFeedback = consumerFeedbackRaw;

    // ---- Validate & respond ----
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

    // ---- Persist completed result ----
    await completeJob(jobId, userId, {
      variants: validatedGen.variants as unknown as Record<string, unknown>,
      variantMeta: validatedGen.variantMeta as unknown as Record<string, unknown> | undefined,
      diagnosis: validatedGen.diagnosis as unknown as Record<string, unknown>,
      audit: validatedAudit as unknown as Record<string, unknown>,
      scores: generatedScores
        ? { generated: generatedScores, source: sourceScores } as unknown as Record<string, unknown>
        : null,
      consumerFeedback: consumerFeedback as unknown as Record<string, unknown>[] | undefined,
      generationEngine,
    });

    // ---- E1/E2 best-effort: artifact snapshot + conditional review pack ----
    // Must not change the generation HTTP result on failure.
    try {
      const captureInput = buildCaptureInputFromGenerateContext({
        params: {
          platform: params.platform,
          tone: params.tone,
          toneModifiers: params.toneModifiers,
          cantoneseLevel: params.cantoneseLevel,
          englishMixingLevel: params.englishMixingLevel,
          creativityLevel: params.creativityLevel,
          inputLanguage: params.inputLanguage,
          copyType: params.copyType,
          customCopyType: params.customCopyType,
          lengthControlEnabled: params.lengthControlEnabled,
          copyLengthLevel: params.copyLengthLevel,
          refresh: params.refresh,
          brandName: params.brandName,
          productName: params.productName,
          brandRedLines: params.brandRedLines,
          productSellingPoints: params.productSellingPoints,
          referenceCases: params.referenceCases,
          calendarEvents: params.calendarEvents,
        },
        caseResolve: {
          requestedIds: caseResolve.requestedIds,
          entries: caseResolve.entries.map((e) => ({
            id: e.id,
            caseType: e.caseType,
            title: e.title,
            updatedAt: null,
          })),
          partialUnavailable: caseResolve.partialUnavailable,
        },
        generationEngine,
      });
      const artifactManifest = buildManifestForGeneration({
        generationEngine,
        captureInput,
      });
      await afterGenerationPersistReviewPack({
        jobId,
        ownerId: userId,
        status: 'completed',
        variants: validatedGen.variants as never,
        audit: validatedAudit as never,
        scores: generatedScores
          ? ({ generated: generatedScores, source: sourceScores } as never)
          : null,
        brandRedLines: params.brandRedLines ?? null,
        productSellingPoints: (params.productSellingPoints as never) ?? null,
        generationEngine,
        artifactManifest,
      });
    } catch {
      console.error(`[review_pack] category=review_pack.unexpected jobId=${jobId}`);
    }

    // ---- Quota: consume the reservation on success ----
    try {
      const consumed = await consumeQuota(userId, reservation.reservationId);
      if (!consumed) {
        throw new Error('Quota consume was not confirmed; reconciliation required');
      }
      console.log(`[Generate] Quota consumed: reservation=${reservation.reservationId}`);
    } catch (e) {
      console.error(
        `[Generate] Quota reconciliation required: job=${jobId}, reservation=${reservation.reservationId}`,
        e,
      );
      // Non-fatal: the job completed successfully even if quota tracking has an issue.
      // The reservation remains for reconciliation.
    }

    res.json({
      diagnosis: validatedGen.diagnosis,
      variants: validatedGen.variants,
      ...(validatedGen.variantMeta ? { variantMeta: validatedGen.variantMeta } : {}),
      audit: validatedAudit,
      generationEngine,
      scores: generatedScores
        ? { generated: generatedScores, source: sourceScores }
        : undefined,
      consumerFeedback,
      jobId,
      // W3: generic notice only — no existence leak for foreign/deleted IDs
      ...(caseResolve.partialUnavailable
        ? { warnings: [CASE_LIBRARY_PARTIAL_NOTICE] }
        : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const uncertain = isUncertainError(err);

    // @C2a-RECONCILIATION: Distinguish known business failures from uncertain
    // (timeout/network) errors.
    //
    // Known business failure (validation, generation error, model returned error):
    //   → mark job as failed + release quota (atomic via RPC).
    //
    // Uncertain error (timeout, ECONNRESET, abort, network interruption):
    //   → keep job as 'processing' + keep reservation alive for reconciliation.
    //   → return 202 with jobId so the client can poll.
    //
    // We must NOT fail the job or release quota for uncertain errors because
    // the model may have succeeded on the remote side; releasing would allow
    // double-spend if the client retries.

    if (uncertain && jobId && reservation) {
      console.warn(`[Generate] Uncertain error — keeping job ${jobId} as processing, reservation alive: ${message}`);
      res.status(202).json({
        jobId,
        status: 'processing',
        message: 'Generation may still be in progress. Poll for results.',
        retryable: true,
      });
      return;
    }

    // Uncertain error without reservation: no quota was held, fall through to
    // normal error handling. No release needed since nothing was reserved.
    // Uncertain error without jobId: nothing to keep alive, fall through.

    // Known business failure: fail the job and release quota
    const status = err instanceof RealModelUnavailableError
      ? 503
      : message.includes('required') || message.includes('Invalid') || message.includes('must be')
        ? 400
        : 500;

    if (jobId) {
      try {
        await failJob(jobId, userId, message, status === 400 ? 'VALIDATION_ERROR' : 'GENERATION_ERROR');
      } catch (e) {
        console.error('[Generate] Failed to persist error state:', e);
      }

      // E1/E2 best-effort failure pack (snapshot_missing when engine unknown).
      // Never alters the generation error HTTP response.
      try {
        const engine =
          typeof (err as { generationEngine?: string })?.generationEngine === 'string'
            ? (err as { generationEngine?: string }).generationEngine
            : undefined;
        const artifactManifest = buildManifestForGeneration({
          generationEngine: engine ?? null,
          captureInput: null,
        });
        await afterGenerationPersistReviewPack({
          jobId,
          ownerId: userId,
          status: 'failed',
          errorCode: status === 400 ? 'VALIDATION_ERROR' : 'GENERATION_ERROR',
          generationEngine: engine ?? null,
          artifactManifest,
        });
      } catch {
        console.error(`[review_pack] category=review_pack.unexpected jobId=${jobId}`);
      }
    }

    // Release on known business failure — atomic via release_quota RPC
    if (reservation) {
      try {
        const released = await releaseQuota(userId, reservation.reservationId);
        console.log(`[Generate] Quota released: reservation=${reservation.reservationId}, reason=${message}, released=${released}`);
      } catch (e) {
        console.error('[Generate] Failed to release quota (needs reconciliation):', e);
      }
    }

    res.status(status).json({
      error: message,
      jobId,
      ...(err instanceof RealModelUnavailableError ? { code: err.code } : {}),
    });
  }
});

export default router;
