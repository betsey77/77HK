import { createContext, useReducer, useEffect, type ReactNode } from 'react';
import type {
  AppState,
  AppAction,
  AppSettings,
  BrandTone,
  GenerateResponse,
  Platform,
  InputLanguage,
  ConsumerPersona,
  SavedConfig,
  BookmarkedCopy,
  Theme,
  VariantKey,
} from '../types';
import { DEFAULT_SETTINGS, PLATFORMS, TONES, INPUT_LANGUAGES } from '../constants';
import { saveWorkbenchSnapshot, loadWorkbenchSnapshot, clearWorkbenchSnapshot, type WorkbenchSnapshot } from '../services/workbenchSnapshot';

const VALID_PLATFORM_VALUES = new Set(PLATFORMS.map((platform) => platform.value));
const VALID_TONE_VALUES = new Set(TONES.map((tone) => tone.value));
const VALID_INPUT_LANGUAGE_VALUES = new Set(INPUT_LANGUAGES.map((l) => l.value));

function normalizeNumber(value: unknown, fallback: number, max = 5) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= max ? numeric : fallback;
}

function normalizePersonas(raw: unknown): ConsumerPersona[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (p: unknown) => p && typeof p === 'object' && typeof (p as Record<string, unknown>).name === 'string',
    );
  }
  return [];
}

function normalizeSettings(settings: unknown): AppSettings {
  if (!settings || typeof settings !== 'object') return { ...DEFAULT_SETTINGS };

  const raw = settings as Record<string, unknown>;
  return {
    platform:
      typeof raw.platform === 'string' && VALID_PLATFORM_VALUES.has(raw.platform as never)
        ? (raw.platform as Platform)
        : DEFAULT_SETTINGS.platform,
    tone:
      typeof raw.tone === 'string' && VALID_TONE_VALUES.has(raw.tone as never)
        ? (raw.tone as BrandTone)
        : DEFAULT_SETTINGS.tone,
    cantoneseLevel: normalizeNumber(raw.cantoneseLevel, DEFAULT_SETTINGS.cantoneseLevel),
    englishMixingLevel: normalizeNumber(raw.englishMixingLevel, DEFAULT_SETTINGS.englishMixingLevel),
    creativityLevel: normalizeNumber(raw.creativityLevel, DEFAULT_SETTINGS.creativityLevel, 4),
    inputLanguage:
      typeof raw.inputLanguage === 'string' && VALID_INPUT_LANGUAGE_VALUES.has(raw.inputLanguage as never)
        ? (raw.inputLanguage as InputLanguage)
        : DEFAULT_SETTINGS.inputLanguage,
    brandName:
      typeof raw.brandName === 'string' ? raw.brandName : DEFAULT_SETTINGS.brandName,
    productName:
      typeof raw.productName === 'string' ? raw.productName : DEFAULT_SETTINGS.productName,
    brandRedLines:
      typeof raw.brandRedLines === 'string' ? raw.brandRedLines : DEFAULT_SETTINGS.brandRedLines,
    structuredBriefEnabled:
      typeof raw.structuredBriefEnabled === 'boolean' ? raw.structuredBriefEnabled : DEFAULT_SETTINGS.structuredBriefEnabled,
    consumerPersonas: raw.consumerPersonas ? normalizePersonas(raw.consumerPersonas) : [],
    targetDate:
      typeof raw.targetDate === 'string' ? raw.targetDate : DEFAULT_SETTINGS.targetDate,
    competitorQueries:
      Array.isArray(raw.competitorQueries)
        ? raw.competitorQueries.filter((q: unknown) => typeof q === 'string' && q.trim())
        : DEFAULT_SETTINGS.competitorQueries,
    selectedReferenceCaseIds:
      Array.isArray(raw.selectedReferenceCaseIds)
        ? raw.selectedReferenceCaseIds.filter((id: unknown) => typeof id === 'string')
        : DEFAULT_SETTINGS.selectedReferenceCaseIds,
    selectedCalendarEventIds:
      Array.isArray(raw.selectedCalendarEventIds)
        ? raw.selectedCalendarEventIds.filter((id: unknown) => typeof id === 'string')
        : DEFAULT_SETTINGS.selectedCalendarEventIds,
  };
}

function storageKey(ownerId: string, kind: 'settings' | 'configs' | 'bookmarks') {
  return `hk-cantonese-${kind}:${ownerId}`;
}

function loadSettings(ownerId: string): AppSettings {
  try {
    const stored = localStorage.getItem(storageKey(ownerId, 'settings'));
    if (stored) return normalizeSettings(JSON.parse(stored)?.settings);
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function loadSavedConfigs(ownerId: string): SavedConfig[] {
  try {
    const stored = localStorage.getItem(storageKey(ownerId, 'configs'));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function loadBookmarks(ownerId: string): BookmarkedCopy[] {
  try {
    const stored = localStorage.getItem(storageKey(ownerId, 'bookmarks'));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function createInitialState(ownerId: string): AppState {
  const saved = loadSettings(ownerId);

  // Load theme preference
  let theme: Theme = 'dark';
  try {
    const stored = localStorage.getItem('hk-cantonese-theme');
    if (stored === 'light' || stored === 'dark') theme = stored;
  } catch { /* ignore */ }
  // Sync html class on init
  document.documentElement.classList.toggle('light', theme === 'light');

  // Try restoring workbench snapshot from sessionStorage (Slice H1-R)
  const snapshot = loadWorkbenchSnapshot(ownerId);

  if (snapshot && snapshot.uiState === 'success') {
    return {
      source: snapshot.source,
      settings: { ...saved, ...snapshot.settings },
      diagnosis: snapshot.diagnosis,
      variants: snapshot.variants,
      audit: snapshot.audit,
      enhancement: snapshot.enhancement,
      generationEngine: snapshot.generationEngine,
      scores: snapshot.scores,
      consumerFeedback: snapshot.consumerFeedback,
      variantMeta: snapshot.variantMeta,
      savedConfigs: loadSavedConfigs(ownerId),
      modifiedVariants: snapshot.modifiedVariants ?? {},
      bookmarkedCopies: loadBookmarks(ownerId),
      syncStatus: 'idle',
      syncError: null,
      legacyImportAvailable: false,
      legacyBookmarkCount: 0,
      legacyConfigCount: 0,
      generationProgress: null,
      theme,
      uiState: 'success',
      activeTab: snapshot.activeTab ?? 'lightCantonese',
      error: null,
    };
  }

  return {
    source: '',
    settings: saved,
    diagnosis: null,
    variants: null,
    audit: null,
    enhancement: null,
    generationEngine: null,
    scores: null,
    consumerFeedback: null,
    variantMeta: null,
    savedConfigs: loadSavedConfigs(ownerId),
    modifiedVariants: {},
    bookmarkedCopies: loadBookmarks(ownerId),
    syncStatus: 'idle',
    syncError: null,
    legacyImportAvailable: false,
    legacyBookmarkCount: 0,
    legacyConfigCount: 0,
    generationProgress: null,
    theme,
    uiState: 'idle',
    activeTab: 'lightCantonese',
    error: null,
  };
}

function reducer(state: AppState, action: AppAction, ownerId: string): AppState {
  switch (action.type) {
    case 'SET_SOURCE':
      return { ...state, source: action.payload, error: null };

    case 'SET_PLATFORM': {
      const next = { ...state, settings: { ...state.settings, platform: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_TONE': {
      const next = { ...state, settings: { ...state.settings, tone: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_CANTO_LEVEL': {
      const next = { ...state, settings: { ...state.settings, cantoneseLevel: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_ENGLISH_LEVEL': {
      const next = { ...state, settings: { ...state.settings, englishMixingLevel: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_CREATIVITY_LEVEL': {
      const next = { ...state, settings: { ...state.settings, creativityLevel: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_INPUT_LANGUAGE': {
      const next = { ...state, settings: { ...state.settings, inputLanguage: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_BRAND_NAME': {
      const next = { ...state, settings: { ...state.settings, brandName: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_PRODUCT_NAME': {
      const next = { ...state, settings: { ...state.settings, productName: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_BRAND_RED_LINES': {
      const next = { ...state, settings: { ...state.settings, brandRedLines: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_STRUCTURED_BRIEF_ENABLED': {
      const next = { ...state, settings: { ...state.settings, structuredBriefEnabled: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_CONSUMER_PERSONAS': {
      const next = { ...state, settings: { ...state.settings, consumerPersonas: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_TARGET_DATE': {
      const next = { ...state, settings: { ...state.settings, targetDate: action.payload || undefined } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_COMPETITOR_QUERIES': {
      const next = { ...state, settings: { ...state.settings, competitorQueries: action.payload } };
      persistSettings(ownerId, next);
      return next;
    }
    case 'SET_SAVED_CONFIGS': {
      const next = { ...state, savedConfigs: action.payload };
      persistSavedConfigs(ownerId, next.savedConfigs);
      return next;
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'START_GENERATING':
      return { ...state, uiState: 'loading', error: null };

    case 'SET_RESULTS': {
      const payload: GenerateResponse = action.payload;
      return {
        ...state,
        uiState: 'success',
        diagnosis: payload.diagnosis,
        variants: payload.variants,
        audit: payload.audit,
        enhancement: payload.enhancement ?? null,
        generationEngine: payload.generationEngine ?? null,
        scores: payload.scores ?? null,
        consumerFeedback: payload.consumerFeedback ?? null,
        variantMeta: payload.variantMeta ?? null,
        error: null,
      };
    }

    case 'UPDATE_VARIANT': {
      if (!state.variants) return state;
      return {
        ...state,
        variants: {
          ...state.variants,
          [action.payload.key]: action.payload.text,
        },
      };
    }

    case 'MARK_VARIANT_MODIFIED': {
      return {
        ...state,
        modifiedVariants: {
          ...state.modifiedVariants,
          [action.payload.key]: action.payload.originalText,
        },
      };
    }

    case 'CLEAR_MODIFICATIONS':
      return { ...state, modifiedVariants: {} };

    case 'SET_RE_EVALUATION': {
      return {
        ...state,
        audit: action.payload.audit,
        scores: action.payload.scores,
        consumerFeedback: action.payload.consumerFeedback,
        // Clear diff baseline so future modifications diff against the
        // current (post-re-evaluate) text rather than round-1 original.
        modifiedVariants: {},
      };
    }

    case 'SET_ERROR':
      return { ...state, uiState: 'error', error: action.payload };

    case 'LOAD_CONFIG': {
      const config = action.payload;
      const next = {
        ...state,
        settings: {
          ...state.settings,
          platform: config.platform,
          tone: config.tone,
          cantoneseLevel: config.cantoneseLevel,
          englishMixingLevel: config.englishMixingLevel,
          creativityLevel: config.creativityLevel,
          inputLanguage: config.inputLanguage,
          brandName: config.brandName,
          productName: config.productName,
          brandRedLines: config.brandRedLines,
          structuredBriefEnabled: config.structuredBriefEnabled,
          consumerPersonas: config.consumerPersonas,
          targetDate: config.targetDate,
          competitorQueries: config.competitorQueries ?? [],
          selectedCalendarEventIds: config.selectedCalendarEventIds ?? [],
        },
      };
      persistSettings(ownerId, next);
      return next;
    }

    case 'SET_THEME': {
      const theme = action.payload;
      localStorage.setItem('hk-cantonese-theme', theme);
      document.documentElement.classList.toggle('light', theme === 'light');
      return { ...state, theme };
    }

    case 'ADD_BOOKMARK': {
      const next = {
        ...state,
        bookmarkedCopies: [action.payload, ...state.bookmarkedCopies],
      };
      persistBookmarks(ownerId, next.bookmarkedCopies);
      return next;
    }

    case 'REMOVE_BOOKMARK': {
      const next = {
        ...state,
        bookmarkedCopies: state.bookmarkedCopies.filter(b => b.id !== action.payload),
      };
      persistBookmarks(ownerId, next.bookmarkedCopies);
      return next;
    }

    case 'UPDATE_BOOKMARK_NOTES': {
      const next = {
        ...state,
        bookmarkedCopies: state.bookmarkedCopies.map(b =>
          b.id === action.payload.id ? { ...b, notes: action.payload.notes } : b,
        ),
      };
      persistBookmarks(ownerId, next.bookmarkedCopies);
      return next;
    }

    case 'UPDATE_BOOKMARK_RATING': {
      const next = {
        ...state,
        bookmarkedCopies: state.bookmarkedCopies.map(b =>
          b.id === action.payload.id
            ? {
                ...b,
                rating: action.payload.rating,
                favoriteReason: action.payload.favoriteReason,
                reasonTags: action.payload.reasonTags,
              }
            : b,
        ),
      };
      persistBookmarks(ownerId, next.bookmarkedCopies);
      return next;
    }

    case 'SET_SELECTED_REFERENCE_CASES': {
      const next = {
        ...state,
        settings: { ...state.settings, selectedReferenceCaseIds: action.payload },
      };
      persistSettings(ownerId, next);
      return next;
    }

    case 'SET_SELECTED_CALENDAR_EVENTS': {
      const next = {
        ...state,
        settings: { ...state.settings, selectedCalendarEventIds: action.payload },
      };
      persistSettings(ownerId, next);
      return next;
    }

    case 'RESTORE_DEFAULT_GENERATION_SETTINGS': {
      const next = {
        ...state,
        settings: {
          ...state.settings,
          structuredBriefEnabled: false,
          creativityLevel: 1,
          cantoneseLevel: 4,
          englishMixingLevel: 1,
          consumerPersonas: [],
        },
      };
      persistSettings(ownerId, next);
      return next;
    }

    // ---- UX-F1: Generation progress ----

    case 'SET_GENERATION_PROGRESS':
      return { ...state, generationProgress: action.payload };

    case 'ADVANCE_STAGE': {
      if (!state.generationProgress) return state;
      return {
        ...state,
        generationProgress: {
          ...state.generationProgress,
          stages: state.generationProgress.stages.map((s) =>
            s.stage === action.payload.stage
              ? { ...s, status: action.payload.status }
              : s,
          ),
        },
      };
    }

    case 'CLEAR_PROGRESS':
      return { ...state, generationProgress: null };

    // ---- Slice D: Cloud sync ----
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };

    case 'SET_SYNC_ERROR':
      return { ...state, syncError: action.payload };

    case 'SET_LEGACY_INFO':
      return {
        ...state,
        legacyImportAvailable: action.payload.available,
        legacyBookmarkCount: action.payload.bookmarkCount,
        legacyConfigCount: action.payload.configCount,
      };

    case 'MARK_LEGACY_IMPORTED':
      return { ...state, legacyImportAvailable: false };

    case 'HYDRATE_BOOKMARKS': {
      // Cloud is the sole source of truth. Local-only items are auto-imported
      // by the hook once (before dispatch). After hydration, the local mirror
      // exactly matches cloud — this prevents deleted items from resurrecting.
      persistBookmarks(ownerId, action.payload);
      return { ...state, bookmarkedCopies: action.payload };
    }

    case 'HYDRATE_CONFIGS': {
      // Same semantics as HYDRATE_BOOKMARKS: cloud is authoritative.
      persistSavedConfigs(ownerId, action.payload);
      return { ...state, savedConfigs: action.payload };
    }

    case 'HYDRATE_BRAND_PROFILE': {
      // Cloud is authoritative: null means explicitly empty (don't fall back to old local value)
      const next = {
        ...state,
        settings: {
          ...state.settings,
          brandName: action.payload.brandName ?? '',
          productName: action.payload.productName ?? '',
          brandRedLines: action.payload.brandRedLines ?? '',
        },
      };
      persistSettings(ownerId, next);
      return next;
    }

    case 'RESET':
      clearWorkbenchSnapshot(ownerId);
      return { ...createInitialState(ownerId), settings: state.settings, modifiedVariants: {} };

    // ── Slice H1-R: Restore workbench from sessionStorage snapshot (history → workbench) ──
    case 'RESTORE_SNAPSHOT': {
      const snap = action.payload as unknown as WorkbenchSnapshot;
      return {
        ...state,
        source: snap.source,
        settings: { ...state.settings, ...snap.settings },
        diagnosis: snap.diagnosis,
        variants: snap.variants,
        audit: snap.audit,
        enhancement: snap.enhancement,
        generationEngine: snap.generationEngine,
        scores: snap.scores,
        consumerFeedback: snap.consumerFeedback,
        variantMeta: snap.variantMeta,
        modifiedVariants: snap.modifiedVariants ?? {},
        activeTab: snap.activeTab ?? 'lightCantonese',
        uiState: 'success',
        error: null,
        generationProgress: null,
      };
    }

    default:
      return state;
  }
}

function persistSettings(ownerId: string, state: AppState) {
  try {
    localStorage.setItem(storageKey(ownerId, 'settings'), JSON.stringify({ settings: state.settings }));
  } catch { /* ignore */ }
}

function persistSavedConfigs(ownerId: string, configs: SavedConfig[]) {
  try {
    localStorage.setItem(storageKey(ownerId, 'configs'), JSON.stringify(configs));
  } catch { /* ignore */ }
}

function persistBookmarks(ownerId: string, bookmarks: BookmarkedCopy[]) {
  try {
    localStorage.setItem(storageKey(ownerId, 'bookmarks'), JSON.stringify(bookmarks));
  } catch { /* ignore */ }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>(null!);

export function AppProvider({ children, ownerId = 'anonymous' }: { children: ReactNode; ownerId?: string }) {
  const [state, dispatch] = useReducer(
    (current: AppState, action: AppAction) => reducer(current, action, ownerId),
    undefined,
    () => createInitialState(ownerId),
  );

  // Persist workbench state to sessionStorage on every change (Slice H1-R)
  useEffect(() => {
    saveWorkbenchSnapshot(ownerId, state);
  }, [state, ownerId]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
