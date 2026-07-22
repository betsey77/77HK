import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getBootstrap,
  getReviewResultSummary,
  upsertFavorite,
  updateFavoriteContent,
  deleteFavorite,
  upsertConfig,
  deleteConfig,
  upsertBrandProfile,
  importData,
} from '../services/cloudSyncService.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

// ============================================================
// Constants
// ============================================================

const VALID_VARIANT_KEYS = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];
const MAX_CLIENT_ID_LENGTH = 256;
const MAX_CONTENT_LENGTH = 5000;
const MAX_NOTES_LENGTH = 2000;
const MAX_FAVORITE_REASON_LENGTH = 1000;
const MAX_NAME_LENGTH = 200;
const MAX_BRAND_NAME_LENGTH = 200;
const MAX_BRAND_RED_LINES_LENGTH = 2000;
const MAX_SAVED_CONFIGS = 20;
const MAX_IMPORT_BATCH = 200;
const MAX_JSON_SIZE = 1_000_000; // 1 MiB per JSON field
const MAX_REASON_TAGS = 20;
const MAX_REASON_TAG_LENGTH = 100;
const MAX_ARRAY_LENGTH = 100;
const VALID_COPY_TYPES = new Set(['social', 'spoken', 'poster', 'advertorial', 'poetry', 'custom']);
const VALID_PUBLISH_PLATFORMS = new Set([...VALID_VARIANT_KEYS, 'all']);

// ============================================================
// Validation helpers
// ============================================================

function assertNonEmptyString(value: unknown, field: string, maxLength?: number): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw { status: 400, message: `${field} must be a non-empty string` };
  }
  if (maxLength && value.length > maxLength) {
    throw { status: 400, message: `${field} must not exceed ${maxLength} characters` };
  }
}

function assertOptionalString(value: unknown, field: string, maxLength?: number): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    throw { status: 400, message: `${field} must be a string if provided` };
  }
  if (maxLength && value.length > maxLength) {
    throw { status: 400, message: `${field} must not exceed ${maxLength} characters` };
  }
}

function assertObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw { status: 400, message: `${field} must be a valid object` };
  }
}

function assertOptionalInteger(value: unknown, field: string, min: number, max: number): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw { status: 400, message: `${field} must be an integer between ${min} and ${max}` };
  }
}

function assertOptionalBoolean(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw { status: 400, message: `${field} must be a boolean if provided` };
  }
}

function assertOptionalArrayOfStrings(value: unknown, field: string): void {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw { status: 400, message: `${field} must be an array of strings` };
  }
}

function assertVariantKey(value: string): void {
  if (!VALID_VARIANT_KEYS.includes(value)) {
    throw { status: 400, message: `variantKey must be one of: ${VALID_VARIANT_KEYS.join(', ')}` };
  }
}

function rejectOverpost(body: Record<string, unknown>): void {
  if ('owner_id' in body || 'ownerId' in body || 'id' in body || 'reviewRequestedAt' in body) {
    throw { status: 400, message: 'Body must not contain owner_id, ownerId, id, or reviewRequestedAt fields' };
  }
}

function assertUserAuthoredFavorite(body: Record<string, unknown>): void {
  assertOptionalBoolean(body.isUserAuthored, 'isUserAuthored');
  assertOptionalBoolean(body.reviewRequested, 'reviewRequested');
  if (body.isUserAuthored !== true) return;

  if (typeof body.reviewRequested !== 'boolean') {
    throw { status: 400, message: 'reviewRequested must be explicitly selected for user-authored favorites' };
  }
  const settings = body.settings as Record<string, unknown>;
  const brandName = typeof settings.brandName === 'string' ? settings.brandName.trim() : '';
  if (!brandName || brandName.length > MAX_BRAND_NAME_LENGTH) {
    throw { status: 400, message: `settings.brandName must be 1-${MAX_BRAND_NAME_LENGTH} characters` };
  }
  if (typeof settings.copyType !== 'string' || !VALID_COPY_TYPES.has(settings.copyType)) {
    throw { status: 400, message: 'settings.copyType is invalid' };
  }
  if (settings.copyType === 'custom') {
    const custom = typeof settings.customCopyType === 'string' ? settings.customCopyType.trim() : '';
    if (custom.length < 2 || custom.length > 20) {
      throw { status: 400, message: 'settings.customCopyType must be 2-20 characters' };
    }
  }
  if (typeof settings.publishPlatform !== 'string'
    || !VALID_PUBLISH_PLATFORMS.has(settings.publishPlatform)) {
    throw { status: 400, message: 'settings.publishPlatform is invalid' };
  }
}

function assertJsonSize(value: unknown, field: string): void {
  if (value === undefined || value === null) return;
  const byteLength = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (byteLength > MAX_JSON_SIZE) {
    throw { status: 400, message: `${field} exceeds maximum size` };
  }
}

function assertOptionalObject(value: unknown, field: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw { status: 400, message: `${field} must be an object if provided` };
  }
}

function assertOptionalArray(value: unknown, field: string, maxLength?: number): void {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    throw { status: 400, message: `${field} must be an array if provided` };
  }
  if (maxLength && value.length > maxLength) {
    throw { status: 400, message: `${field} must have at most ${maxLength} items` };
  }
}

function assertOptionalISO(value: unknown, field: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || isNaN(Date.parse(value))) {
    throw { status: 400, message: `${field} must be a valid ISO timestamp` };
  }
}

function assertReasonTags(value: unknown): void {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    throw { status: 400, message: 'reasonTags must be an array of strings' };
  }
  if (value.length > MAX_REASON_TAGS) {
    throw { status: 400, message: `reasonTags must have at most ${MAX_REASON_TAGS} items` };
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0 || item.length > MAX_REASON_TAG_LENGTH) {
      throw { status: 400, message: `Each reasonTag must be 1-${MAX_REASON_TAG_LENGTH} characters` };
    }
  }
}

// ============================================================
// GET /api/sync/bootstrap
// ============================================================
router.get('/sync/bootstrap', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const result = await getBootstrap(jwt, userId);
    res.json(result);
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/sync/review-result-summary — owner-only timestamp, no content
// ============================================================
router.get('/sync/review-result-summary', async (req: Request, res: Response) => {
  try {
    const result = await getReviewResultSummary(
      req.userJwt as string,
      req.userId as string,
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/sync/favorites — upsert a favorite
// ============================================================
router.post('/sync/favorites', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const body = req.body ?? {};

    rejectOverpost(body);

    assertNonEmptyString(body.clientId, 'clientId', MAX_CLIENT_ID_LENGTH);
    assertNonEmptyString(body.variantKey, 'variantKey');
    assertVariantKey(body.variantKey);
    assertNonEmptyString(body.content, 'content', MAX_CONTENT_LENGTH);
    assertNonEmptyString(body.source, 'source', MAX_CONTENT_LENGTH);
    assertObject(body.settings, 'settings');
    assertUserAuthoredFavorite(body);

    assertOptionalString(body.notes, 'notes', MAX_NOTES_LENGTH);
    assertOptionalInteger(body.rating, 'rating', 1, 5);
    assertOptionalString(body.favoriteReason, 'favoriteReason', MAX_FAVORITE_REASON_LENGTH);
    assertReasonTags(body.reasonTags);
    assertJsonSize(body.settings, 'settings');
    assertOptionalObject(body.variantMeta, 'variantMeta');
    assertJsonSize(body.variantMeta, 'variantMeta');
    assertOptionalObject(body.scores, 'scores');
    assertJsonSize(body.scores, 'scores');
    assertOptionalArray(body.consumerFeedback, 'consumerFeedback', MAX_ARRAY_LENGTH);
    assertJsonSize(body.consumerFeedback, 'consumerFeedback');
    assertOptionalISO(body.savedAt, 'savedAt');

    const result = await upsertFavorite(jwt, userId, body);
    res.status(201).json(result);
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 403) { res.status(403).json({ error: err.message, code: err.code ?? 'PLAN_LIMIT' }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// PUT /api/sync/favorites/:clientId/content — explicit owner edit
// ============================================================
router.put('/sync/favorites/:clientId/content', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const clientId = req.params.clientId as string;
    const body = req.body ?? {};

    assertNonEmptyString(clientId, 'clientId', MAX_CLIENT_ID_LENGTH);
    if (typeof body !== 'object' || body === null || Array.isArray(body)
        || Object.keys(body).some((key) => key !== 'content')) {
      throw { status: 400, message: 'Body may only contain content' };
    }
    assertNonEmptyString(body.content, 'content', MAX_CONTENT_LENGTH);
    if (!body.content.trim()) throw { status: 400, message: 'content must not be blank' };

    const result = await updateFavoriteContent(jwt, userId, clientId, body.content);
    res.json(result);
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 404) { res.status(404).json({ error: 'Favorite not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// DELETE /api/sync/favorites/:clientId — delete a favorite
// ============================================================
router.delete('/sync/favorites/:clientId', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const clientId = req.params.clientId as string;

    assertNonEmptyString(clientId, 'clientId', MAX_CLIENT_ID_LENGTH);

    const deleted = await deleteFavorite(jwt, userId, clientId);
    if (!deleted) {
      res.status(404).json({ error: 'Favorite not found' });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/sync/configs — upsert a saved config
// ============================================================
router.post('/sync/configs', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const body = req.body ?? {};

    rejectOverpost(body);

    assertNonEmptyString(body.clientId, 'clientId', MAX_CLIENT_ID_LENGTH);
    assertNonEmptyString(body.name, 'name', MAX_NAME_LENGTH);
    assertObject(body.config, 'config');

    const result = await upsertConfig(jwt, userId, body);
    res.status(201).json(result);
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// DELETE /api/sync/configs/:clientId — delete a saved config
// ============================================================
router.delete('/sync/configs/:clientId', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const clientId = req.params.clientId as string;

    assertNonEmptyString(clientId, 'clientId', MAX_CLIENT_ID_LENGTH);

    const deleted = await deleteConfig(jwt, userId, clientId);
    if (!deleted) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// PUT /api/sync/brand-profile — upsert brand profile
// ============================================================
router.put('/sync/brand-profile', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const body = req.body ?? {};

    rejectOverpost(body);

    assertOptionalString(body.brandName, 'brandName', MAX_BRAND_NAME_LENGTH);
    assertOptionalString(body.productName, 'productName', MAX_BRAND_NAME_LENGTH);
    assertOptionalString(body.brandRedLines, 'brandRedLines', MAX_BRAND_RED_LINES_LENGTH);

    const result = await upsertBrandProfile(jwt, userId, body);
    res.json(result);
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/sync/import — bulk import (idempotent)
// ============================================================
router.post('/sync/import', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const body = req.body ?? {};

    rejectOverpost(body);

    const totalItems = (Array.isArray(body.favorites) ? body.favorites.length : 0)
      + (Array.isArray(body.savedConfigs) ? body.savedConfigs.length : 0);
    if (totalItems > 200) {
      throw { status: 400, message: 'Total import batch limit is 200 items' };
    }

    // Validate favorites array if present
    if (body.favorites !== undefined) {
      if (!Array.isArray(body.favorites)) {
        throw { status: 400, message: 'favorites must be an array' };
      }
      if (body.favorites.length > MAX_IMPORT_BATCH) {
        throw { status: 400, message: `Import batch limit is ${MAX_IMPORT_BATCH} items` };
      }
      for (const fav of body.favorites) {
        if (typeof fav !== 'object' || fav === null) {
          throw { status: 400, message: 'Each favorite must be an object' };
        }
        rejectOverpost(fav);
        assertNonEmptyString(fav.clientId, 'favorite clientId', MAX_CLIENT_ID_LENGTH);
        assertNonEmptyString(fav.variantKey, 'favorite variantKey');
        assertVariantKey(fav.variantKey);
        assertNonEmptyString(fav.content, 'favorite content', MAX_CONTENT_LENGTH);
        assertNonEmptyString(fav.source, 'favorite source', MAX_CONTENT_LENGTH);
        assertObject(fav.settings, 'favorite settings');
        assertUserAuthoredFavorite(fav);
        assertJsonSize(fav.settings, 'favorite settings');
        assertOptionalObject(fav.variantMeta, 'favorite variantMeta');
        assertJsonSize(fav.variantMeta, 'favorite variantMeta');
        assertOptionalObject(fav.scores, 'favorite scores');
        assertJsonSize(fav.scores, 'favorite scores');
        assertOptionalArray(fav.consumerFeedback, 'favorite consumerFeedback', MAX_ARRAY_LENGTH);
        assertJsonSize(fav.consumerFeedback, 'favorite consumerFeedback');
        assertOptionalISO(fav.savedAt, 'favorite savedAt');
        assertOptionalString(fav.notes, 'favorite notes', MAX_NOTES_LENGTH);
        assertOptionalInteger(fav.rating, 'favorite rating', 1, 5);
        assertOptionalString(fav.favoriteReason, 'favorite favoriteReason', MAX_FAVORITE_REASON_LENGTH);
        assertReasonTags(fav.reasonTags);
      }
    }

    // Validate configs array if present
    if (body.savedConfigs !== undefined) {
      if (!Array.isArray(body.savedConfigs)) {
        throw { status: 400, message: 'savedConfigs must be an array' };
      }
      if (body.savedConfigs.length > MAX_IMPORT_BATCH) {
        throw { status: 400, message: `Import batch limit is ${MAX_IMPORT_BATCH} items` };
      }
      for (const cfg of body.savedConfigs) {
        if (typeof cfg !== 'object' || cfg === null) {
          throw { status: 400, message: 'Each savedConfig must be an object' };
        }
        rejectOverpost(cfg);
        assertNonEmptyString(cfg.clientId, 'config clientId', MAX_CLIENT_ID_LENGTH);
        assertNonEmptyString(cfg.name, 'config name', MAX_NAME_LENGTH);
        assertObject(cfg.config, 'config');
        assertJsonSize(cfg.config, 'config');
      }
    }

    const result = await importData(jwt, userId, body);
    res.json(result);
  } catch (err: any) {
    if (err?.status === 400) { res.status(400).json({ error: err.message }); return; }
    if (err?.status === 403) { res.status(403).json({ error: err.message, code: err.code ?? 'PLAN_LIMIT' }); return; }
    if (err?.status === 404) { res.status(404).json({ error: err.message }); return; }
    if (err?.status === 409) { res.status(409).json({ error: err.message }); return; }
    // Config limit error from service
    if (err?.message?.includes('maximum') && err?.message?.includes('configs')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
