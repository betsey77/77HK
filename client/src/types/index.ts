// ============================================================
// Slice B: Auth types
// ============================================================

export type AppRole = 'user' | 'support' | 'admin' | 'super_admin';

export interface SupabaseUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  roles: AppRole[];
  createdAt: string;
}

// ============================================================
// Request
// ============================================================

export type Platform = 'ig' | 'facebook' | 'shorts' | 'all';
/** Primary brand tone. Expanded in W1; legacy 5 values remain first. */
export type BrandTone =
  | '穩妥'
  | '活潑'
  | '高級'
  | '街坊'
  | '年輕'
  | '專業'
  | '真誠'
  | '溫暖'
  | '幽默'
  | '克制'
  | '俏皮'
  | '激昂';
/** W1: up to 2 modifier tones layered on primaryTone */
export type ToneModifier =
  | '簡潔'
  | '敘事'
  | '促銷感'
  | '治癒'
  | '緊迫'
  | '節日感'
  | '知識感'
  | '對話感';
/** W1: generation copy type — still always produces 5 platform variants */
export type CopyType = 'social' | 'spoken' | 'poster' | 'advertorial' | 'poetry' | 'custom';
export type InputLanguage = 'mandarin' | 'cantonese';

export interface ConsumerPersona {
  id: string;
  name: string;
  ageRange: string;
  occupation: string;
  habits: string;
  apps: string;
  notes: string;
}

export interface GenerateRequest {
  source: string;
  platform: Platform;
  tone: BrandTone;
  cantoneseLevel: number;      // 0-5
  englishMixingLevel: number;  // 0-5
  useEnhancement: boolean;     // deprecated
  brandName?: string;
  productName?: string;
  brandRedLines?: string;
  structuredBriefEnabled?: boolean; // 🆕 Ph1 结构化写作简报 toggle
  creativityLevel: number;      // 0-4, default 2 (平衡)
  inputLanguage: InputLanguage; // default 'mandarin'
  refresh?: boolean;           // 🆕 P2.5 内容刷新
  consumerPersonas?: ConsumerPersona[];
  /** 🆕 Phase B: Reference cases for few-shot prompt injection */
  referenceCases?: ReferenceCase[];
  /** 🆕 话题日历：用户选择的节日/事件 ID */
  calendarEventIds?: string[];
  /** W1: 文案类型（默认 social）；custom 时需 customCopyType */
  copyType?: CopyType;
  /** W1: custom 类型补充说明，2–20 字 */
  customCopyType?: string;
  /** W1: 是否注入软长度目标 */
  lengthControlEnabled?: boolean;
  /** W1: 1–5 长度档（仅开关开启时生效） */
  copyLengthLevel?: number;
  /** W1: 主语气；缺省时回退 tone */
  primaryTone?: BrandTone;
  /** W1: 修饰语气，最多 2 个 */
  toneModifiers?: ToneModifier[];
  /**
   * W3: 个人案例库所选 ID（最多 3 个 UUID）。
   * 仅发送 ID；正文/原因由服务端 JWT+RLS 解析，客户端不得伪造 body。
   */
  selectedCaseLibraryIds?: string[];
  /** 生成历史恢复：保存当次完整工作台配置，不参与模型 Prompt。 */
  workbenchSettings?: AppSettings;
  /** 🆕 Slice C1: Stable idempotency key — one per user action, reused on retry */
  idempotencyKey?: string;
}

// ============================================================
// Response
// ============================================================

export interface Diagnosis {
  hasSimplifiedChars: boolean;
  mainlandPhrases: Array<{ phrase: string; suggestion: string }>;
  issues: string[];
  /** Compliance violations found in source text */
  complianceViolations?: Array<{
    rule: string;
    match: string;
    severity: 'high' | 'medium';
  }>;
}

export interface Variants {
  standardHK: string;
  lightCantonese: string;
  ig: string;
  facebook: string;
  shorts: string;
}

export type VariantKey = keyof Variants;

export interface ThermometerDimensions {
  cantoneseFeel: number;       // 香港语感 1-5
  culturalFit: number;         // 文化贴地度 1-5
  platformFit: number;         // 平台适配度 1-5
  brandSafety: number;         // 品牌安全 1-5
  tradConsistency: number;     // 繁体一致性 1-5
  hookStrength: number;        // 🆕 P2.1 Hook强度 1-5
  visualStrategy: number;      // 🆕 P2.1 Emoji/Hashtag策略 1-5
  engagementFit: number;       // 🆕 P2.1 互动引导 1-5
}

export interface Thermometer {
  overall: number;              // 0-100
  dimensions: ThermometerDimensions;
}

export type IssueTag = string;
export type Severity = 'high' | 'medium' | 'low';

export interface AuditIssue {
  tag: IssueTag;
  severity: Severity;
  description: string;
}

export interface Replacement {
  original: string;
  suggested: string;
  reason: string;
}

export interface RiskNote {
  level: 'red' | 'amber';
  description: string;
}

export type CommentType = 'interest' | 'question' | 'skepticism' | 'playful' | 'followup';

export interface SimulatedComment {
  type: CommentType;
  text: string;
}

export interface AuditScores {
  cantoneseNaturalness: number;
  brandSafety: number;
  platformFit: number;
  readability: number;
  creativity: number;
  hookStrength: number;        // 🆕 P2.1 Hook强度
  emojiHashtagFit: number;     // 🆕 P2.1 Emoji/Hashtag策略
  engagementPotential: number; // 🆕 P2.1 互动引导潜力
  total: number;
}

export interface ConsumerSuggestion {
  personaId: string;
  personaName: string;
  aspect: string;
  suggestion: string;
  reason: string;
  relevanceScore: number;   // 1-5
  relevanceReason: string;
  targetPlatforms?: string[]; // variant keys this targets
}

export interface ConsumerFeedback {
  personaId: string;
  personaName: string;
  feedback: string;
  rating: number;
  suggestions?: ConsumerSuggestion[];
}

export interface CtaScore {
  presence: number;       // 0-30 CTA 是否存在
  naturalness: number;    // 0-30 CTA 是否自然
  platformFit: number;    // 0-40 CTA 是否匹配平台
  total: number;          // 0-100
}

export interface CtaScores {
  standardHK: CtaScore;
  lightCantonese: CtaScore;
  ig: CtaScore;
  facebook: CtaScore;
  shorts: CtaScore;
}

export interface Audit {
  thermometer: Thermometer;
  issues: AuditIssue[];
  replacements: Replacement[];
  risks: RiskNote[];
  comments: SimulatedComment[];
  scores?: AuditScores;
  ctaScores?: CtaScores;  // 🆕 P2.2 CTA 独立评分
}

export interface Enhancement {
  model: string;
  engine: 'featherless-cantonese' | 'cantonese-llm-chat' | 'openrouter-qwen' | 'deepseek-cantonese';
  suggestions: Record<string, string>;
}

export type GenerationEngine = 'self-hosted-cantonese' | 'featherless-cantonese' | 'deepseek' | 'rules';

// 🆕 Ph1: Variant metadata (alt headlines, value prop, creative form)
export interface VariantMeta {
  headline: string;
  altHeadlines: string[];
  ctaLine: string;
  valuePropStatement?: string;   // 仅 toggle=ON 时生成
  targetPersona?: string;
  creativeForm?: string;         // L4: 直球广告/软广告/故事/诗歌/...
  strategyGoal?: string;         // L4: 引流/推广/增长激活/品牌塑造
}

export interface GenerateResponse {
  diagnosis: Diagnosis;
  variants: Variants;
  audit: Audit;
  generationEngine: GenerationEngine;
  enhancement?: Enhancement;
  scores?: {
    generated: AuditScores;
    source: AuditScores | null;
  };
  consumerFeedback?: ConsumerFeedback[];
  variantMeta?: Record<VariantKey, VariantMeta>; // 🆕 Ph1
}

// ============================================================
// Slice C1 v4: Discriminated generate API response types
// ============================================================

/** POST /api/generate — completed (200) */
export interface GenerateSuccessBody extends GenerateResponse {
  jobId: string;
  idempotent?: boolean;
}

/** POST /api/generate — pending/processing (202) */
export interface GeneratePendingBody {
  jobId: string;
  status: 'pending' | 'processing';
  message: string;
  idempotent: true;
}

/** POST /api/generate — failed (200, body.status='failed') */
export interface GenerateFailedBody {
  jobId: string;
  status: 'failed';
  error: string;
  errorCode?: string;
  idempotent: true;
  retryHint: string;
}

/**
 * Discriminated union for POST /api/generate responses.
 * Discriminate on `status` (present only on pending/processing/failed)
 * or HTTP status code (202 = pending, 200 with no `status` = completed).
 */
export type GenerateApiResponse = GenerateSuccessBody | GeneratePendingBody | GenerateFailedBody;

// ============================================================
// Saved Config (localStorage)
// ============================================================

export interface SavedConfig {
  id: string;
  name: string;
  brandName: string;
  productName: string;
  brandRedLines: string;
  structuredBriefEnabled: boolean; // 🆕 Ph1
  creativityLevel: number;
  cantoneseLevel: number;
  englishMixingLevel: number;
  tone: BrandTone;
  platform: Platform;
  inputLanguage: InputLanguage;
  consumerPersonas: ConsumerPersona[];
  targetDate?: string;           // 🆕 P2
  competitorQueries?: string[];   // 🆕 P2 — multi-select competitor brands
  selectedReferenceCaseIds?: string[]; // 收藏案例 Few-Shot 参考
  selectedCalendarEventIds?: string[]; // 🆕 话题日历
  /** W2: 个人案例库选择（仅 ID，最多 3） */
  selectedCaseLibraryIds?: string[];
  /** W1 */
  copyType?: CopyType;
  customCopyType?: string;
  lengthControlEnabled?: boolean;
  copyLengthLevel?: number;
  primaryTone?: BrandTone;
  toneModifiers?: ToneModifier[];
  createdAt: string;
}

// ============================================================
// W2 Personal case library
// ============================================================

export type CaseLibraryType = 'good' | 'bad';

export interface CaseLibraryEntry {
  id: string;
  caseType: CaseLibraryType;
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseLibraryInput {
  caseType: CaseLibraryType;
  title?: string | null;
  body: string;
  reason: string;
  tags?: string[];
}

// ============================================================
// App State
// ============================================================

export type Theme = 'dark' | 'light';

export type UIState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================
// UX-F1: Generation Progress (estimated, no SSE yet)
// ============================================================

export type GenerationStage = 'diagnosis' | 'generation' | 'audit' | 'feedback';

export interface StageProgress {
  stage: GenerationStage;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export interface GenerationProgress {
  stages: StageProgress[];
  startedAt: number;
  /** Always true until real SSE streaming is implemented */
  isEstimated: true;
}

export interface AppSettings {
  platform: Platform;
  tone: BrandTone;
  cantoneseLevel: number;
  englishMixingLevel: number;
  creativityLevel: number;
  inputLanguage: InputLanguage;
  brandName: string;
  productName: string;
  brandRedLines: string;
  structuredBriefEnabled: boolean; // 🆕 Ph1 默认 false
  consumerPersonas: ConsumerPersona[];
  /** P2: Target publish date for calendar matching */
  targetDate?: string;           // ISO date string YYYY-MM-DD
  /** P2: Competitor brand names for ad library search (multi-select) */
  competitorQueries?: string[];
  /** 🆕 Phase B: Selected bookmark IDs for few-shot injection in generation */
  selectedReferenceCaseIds?: string[];
  /** 🆕 话题日历：用户选择注入的节日/事件 ID */
  selectedCalendarEventIds?: string[];
  /** W2/W3: 个人案例库选择 ID（最多 3；生成时只发 ID，正文由服务端 JWT 解析注入） */
  selectedCaseLibraryIds?: string[];
  /** W1: 文案类型，默认 social */
  copyType: CopyType;
  /** W1: custom 补充说明 */
  customCopyType: string;
  /** W1: 长度控制开关，默认 false */
  lengthControlEnabled: boolean;
  /** W1: 长度档 1–5，默认 3 */
  copyLengthLevel: number;
  /** W1: 主语气（与 tone 同步写入） */
  primaryTone: BrandTone;
  /** W1: 修饰语气，最多 2 个 */
  toneModifiers: ToneModifier[];
  /**
   * Favorite-only snapshot: intended publish platform for this saved copy.
   * Must not replace historical generation `platform` or global workbench platform.
   */
  publishPlatform?: string;
}

export interface AppState {
  // Input
  source: string;
  settings: AppSettings;

  // Results
  diagnosis: Diagnosis | null;
  variants: Variants | null;
  audit: Audit | null;
  enhancement: Enhancement | null;
  generationEngine: GenerationEngine | null;

  // V2 additions
  scores: GenerateResponse['scores'] | null;
  consumerFeedback: ConsumerFeedback[] | null;
  variantMeta: Record<VariantKey, VariantMeta> | null; // 🆕 Ph1
  savedConfigs: SavedConfig[];

  // Modification tracking (original text for diff highlighting)
  modifiedVariants: Partial<Record<VariantKey, string>>;

  // Bookmarks (favorites)
  bookmarkedCopies: BookmarkedCopy[];

  // Cloud sync
  syncStatus: 'idle' | 'hydrating' | 'ready' | 'error';
  syncError: string | null;
  legacyImportAvailable: boolean;
  legacyBookmarkCount: number;
  legacyConfigCount: number;

  // Generation progress (UX-F1: estimated, no SSE yet)
  generationProgress: GenerationProgress | null;

  // UI
  theme: Theme;
  uiState: UIState;
  activeTab: VariantKey;
  error: string | null;
}

// ============================================================
// Actions
// ============================================================

export type AppAction =
  | { type: 'SET_SOURCE'; payload: string }
  | { type: 'SET_PLATFORM'; payload: Platform }
  | { type: 'SET_TONE'; payload: BrandTone }
  | { type: 'SET_PRIMARY_TONE'; payload: BrandTone }
  | { type: 'SET_TONE_MODIFIERS'; payload: ToneModifier[] }
  | { type: 'SET_COPY_TYPE'; payload: CopyType }
  | { type: 'SET_CUSTOM_COPY_TYPE'; payload: string }
  | { type: 'SET_LENGTH_CONTROL_ENABLED'; payload: boolean }
  | { type: 'SET_COPY_LENGTH_LEVEL'; payload: number }
  | { type: 'SET_CANTO_LEVEL'; payload: number }
  | { type: 'SET_ENGLISH_LEVEL'; payload: number }
  | { type: 'SET_CREATIVITY_LEVEL'; payload: number }
  | { type: 'SET_INPUT_LANGUAGE'; payload: InputLanguage }
  | { type: 'SET_BRAND_NAME'; payload: string }
  | { type: 'SET_PRODUCT_NAME'; payload: string }
  | { type: 'SET_BRAND_RED_LINES'; payload: string }
  | { type: 'SET_STRUCTURED_BRIEF_ENABLED'; payload: boolean } // 🆕 Ph1
  | { type: 'SET_CONSUMER_PERSONAS'; payload: ConsumerPersona[] }
  | { type: 'SET_SAVED_CONFIGS'; payload: SavedConfig[] }
  | { type: 'SET_ACTIVE_TAB'; payload: VariantKey }
  | { type: 'START_GENERATING' }
  | { type: 'SET_RESULTS'; payload: GenerateResponse }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'LOAD_CONFIG'; payload: SavedConfig }
  | { type: 'UPDATE_VARIANT'; payload: { key: VariantKey; text: string } }
  | { type: 'SET_RE_EVALUATION'; payload: { audit: Audit; scores: GenerateResponse['scores']; consumerFeedback: ConsumerFeedback[] | null } }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'MARK_VARIANT_MODIFIED'; payload: { key: VariantKey; originalText: string } }
  | { type: 'CLEAR_MODIFICATIONS' }
  | { type: 'SET_TARGET_DATE'; payload: string }              // 🆕 P2
  | { type: 'SET_COMPETITOR_QUERIES'; payload: string[] }      // 🆕 P2 — multi-select
  | { type: 'ADD_BOOKMARK'; payload: BookmarkedCopy }           // 🆕 收藏
  | { type: 'REMOVE_BOOKMARK'; payload: string }                // 🆕 取消收藏 (id)
  | { type: 'REMOVE_BOOKMARKS'; payload: string[] }
  | { type: 'UPDATE_BOOKMARK_NOTES'; payload: { id: string; notes: string } }  // 🆕 收藏备注
  | { type: 'UPDATE_BOOKMARK_RATING'; payload: { id: string; rating?: number; favoriteReason?: string; reasonTags?: string[] } }  // 🆕 Phase B 收藏评价
  | { type: 'UPDATE_BOOKMARK_PUBLISH_PLATFORM'; payload: { id: string; publishPlatform: string } }  // 收藏专属发布平台
  | { type: 'UPDATE_BOOKMARK_COPY_TYPE'; payload: { id: string; copyType: CopyType; customCopyType: string } }
  | { type: 'UPDATE_BOOKMARK_REVIEW_REQUEST'; payload: { id: string; reviewRequested: boolean } }
  | { type: 'UPDATE_BOOKMARK_CONTENT'; payload: { id: string; content: string; contentRevision: number; contentEditedAt: string | null; reviewRequested: boolean; reviewRequestedAt: string | null; adminReview: BookmarkAdminReview | null } }
  | { type: 'SET_SELECTED_REFERENCE_CASES'; payload: string[] }  // 🆕 Phase B 正例注入
  | { type: 'SET_SELECTED_CALENDAR_EVENTS'; payload: string[] }   // 🆕 话题日历勾选
  | { type: 'SET_SELECTED_CASE_LIBRARY_IDS'; payload: string[] }  // W2 个人案例库
  | { type: 'RESTORE_DEFAULT_GENERATION_SETTINGS' }
  | { type: 'RESET' }
  // UX-F1: Generation progress
  | { type: 'SET_GENERATION_PROGRESS'; payload: GenerationProgress }
  | { type: 'ADVANCE_STAGE'; payload: { stage: GenerationStage; status: StageProgress['status'] } }
  | { type: 'CLEAR_PROGRESS' }
  // Slice D: Cloud sync
  | { type: 'SET_SYNC_STATUS'; payload: AppState['syncStatus'] }
  | { type: 'SET_SYNC_ERROR'; payload: string | null }
  | { type: 'SET_LEGACY_INFO'; payload: { available: boolean; bookmarkCount: number; configCount: number } }
  | { type: 'MARK_LEGACY_IMPORTED' }
  | { type: 'HYDRATE_BOOKMARKS'; payload: BookmarkedCopy[] }
  | { type: 'HYDRATE_CONFIGS'; payload: SavedConfig[] }
  | { type: 'HYDRATE_BRAND_PROFILE'; payload: { brandName?: string | null; productName?: string | null; brandRedLines?: string | null } }
  // Slice H1-R: Restore workbench from history
  | { type: 'RESTORE_SNAPSHOT'; payload: Record<string, unknown> };

// ============================================================
// Quick Check (P2.3)
// ============================================================

export interface QuickCheckItem {
  rule: string;           // e.g. "Emoji 数量"
  passed: boolean;
  variantKey: string;
  variantLabel: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  actual?: string;
  expected?: string;
}

export interface QuickCheckResult {
  passed: boolean;
  items: QuickCheckItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// ============================================================
// Inspiration Panel (P2)
// ============================================================

/** A single HK social media post for the inspiration panel */
export interface HKPost {
  id: string;
  platform: 'ig' | 'facebook' | 'youtube';
  type: 'organic' | 'ad';
  industry?: string;
  headline?: string;
  body: string;
  hashtags: string[];
  engagement: {
    likes: number;
    comments: number;
    shares?: number;
    views?: number;
  };
  url: string;
  authorName?: string;
  fetchedAt: string;
  publishedAt?: string;
  /** 句式骨架 — topics stripped, structure preserved */
  expressionFingerprint?: string;
}

/** An event on the HK local topic calendar */
export interface CalendarEvent {
  id: string;
  date: string;            // ISO date or range "2026-07-15..2026-07-21"
  title: string;
  titleZh: string;
  applicableIndustries: string[];
  angles: string[];
  narrativeHooks: string[];
  sensitivityNote?: string;
}

/** A competitor ad from Meta Ad Library */
export interface CompetitorAd {
  adArchiveId: string;
  pageName: string;
  pageId?: string;
  platform: ('facebook' | 'instagram' | 'messenger' | 'audience_network')[];
  body: string;
  title?: string;
  ctaText?: string;
  linkUrl?: string;
  isActive: boolean;
  startDate: number;
  endDate?: number;
  /** Set to true when this is demo data (live fetch failed) */
  isDemo?: boolean;
}

// ============================================================
// Bookmarked Copy (Favorites)
// ============================================================

/** Read-only admin review on a bookmark (user cannot edit). */
export interface ReviewAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  note: string;
}

export interface BookmarkAdminReview {
  status: 'adopted' | 'changes_requested';
  note: string | null;
  updatedAt: string;
  annotations?: ReviewAnnotation[];
}

export interface BookmarkedCopy {
  id: string;
  savedAt: string;
  /** Which variant tab this came from */
  variantKey: VariantKey;
  /** The generated copy text */
  content: string;
  /** Original source text input */
  source: string;
  /** Full generation settings snapshot */
  settings: AppSettings;
  /** Variant metadata (headline, altHeadlines, valuePropStatement, etc.) */
  variantMeta?: VariantMeta | null;
  /** Audit scores snapshot */
  scores?: GenerateResponse['scores'] | null;
  /** Consumer feedback snapshot */
  consumerFeedback?: ConsumerFeedback[] | null;
  /** User's optional notes for fine-tuning */
  notes?: string;
  /** 🆕 Phase B: 用户评分 1-5 */
  rating?: number;
  /** 🆕 Phase B: 自定义收藏原因 */
  favoriteReason?: string;
  /** 🆕 Phase B: 结构化原因标签 */
  reasonTags?: string[];
  /** Admin review from cloud bootstrap; display-only, never user-writable */
  adminReview?: BookmarkAdminReview | null;
  /** Database-owned revision metadata; never sent by SyncFavoriteRequest. */
  contentRevision?: number;
  contentEditedAt?: string | null;
  isUserAuthored?: boolean;
  reviewRequested?: boolean;
  /** Database-owned queue timestamp; display-only. */
  reviewRequestedAt?: string | null;
}

/** Predefined reason tags for bookmark rating (P2.10 Phase B) */
export const REASON_TAGS = [
  { key: 'hook', label: 'hook 吸睛', description: '开头能立刻吸引注意力' },
  { key: 'tone', label: '语气贴地', description: '语气自然，像真人聊天' },
  { key: 'cta', label: 'CTA 有力', description: '行动号召明确且有说服力' },
  { key: 'rhythm', label: '句式节奏好', description: '长短句搭配舒服，读起来流畅' },
  { key: 'emoji', label: 'emoji 自然', description: '表情使用恰到好处，不做作' },
  { key: 'brand', label: '品牌调性匹配', description: '符合品牌定位和风格' },
  { key: 'creative', label: '创意突出', description: '有令人印象深刻的创意点' },
  { key: 'audience', label: '适合目标受众', description: '目标受众会有共鸣' },
] as const;

export type InspirationTab = 'languageVibe' | 'topicCalendar' | 'hotTrends' | 'competitorActivity';

export const INSPIRATION_TABS: Array<{ key: InspirationTab; label: string }> = [
  { key: 'languageVibe', label: '当下语感' },
  { key: 'topicCalendar', label: '话题日历' },
  { key: 'hotTrends', label: '即时热话' },
  { key: 'competitorActivity', label: '竞品动态' },
];

/** A reference case for few-shot injection — selected from bookmarked copies */
export interface ReferenceCase {
  /** Bookmark ID */
  id: string;
  /** Copy text content */
  content: string;
  /** User rating 1-5 */
  rating?: number;
  /** Reason tags */
  reasonTags?: string[];
  /** Free-text reason */
  favoriteReason?: string;
  /** Which variant */
  variantKey: string;
}

/** Aggregate data held locally in InspirationPanel */
export interface InspirationData {
  languageVibePosts: HKPost[];
  calendarEvents: CalendarEvent[];
  hotTrends: HKPost[];
  competitorAds: CompetitorAd[];
  tabLoading: Partial<Record<InspirationTab, boolean>>;
  tabError: Partial<Record<InspirationTab, string | null>>;
}

// ============================================================
// Slice C1: Generation Jobs
// ============================================================

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerationJobSummary {
  id: string;
  idempotencyKey: string;
  status: GenerationStatus;
  source: string;
  platform: string;
  tone: string;
  brandName?: string | null;
  productName?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface GenerationJob extends GenerationJobSummary {
  ownerId: string;
  cantoneseLevel: number;
  englishMixingLevel: number;
  creativityLevel: number;
  inputLanguage: string;
  brandName?: string | null;
  productName?: string | null;
  brandRedLines?: string | null;
  brief?: Record<string, unknown> | null;
  variants?: Variants | null;
  variantMeta?: Record<string, VariantMeta> | null;
  diagnosis?: Diagnosis | null;
  audit?: Audit | null;
  scores?: { generated: AuditScores; source: AuditScores | null } | null;
  consumerFeedback?: ConsumerFeedback[] | null;
  generationEngine?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  updatedAt: string;
  completedAt?: string | null;
  deletedAt?: string | null;
}

export interface GenerationListResponse {
  jobs: GenerationJobSummary[];
  total: number;
  lockedCount?: number;
}

export interface GenerationDetailResponse {
  job: GenerationJob;
}

export interface GenerationCreateResponse {
  job: GenerationJob;
  created: boolean;
}

// ============================================================
// Slice D: Cloud Sync
// ============================================================

/** Cloud-synced favorite record */
export interface FavoriteRecord {
  id: string;
  ownerId: string;
  clientId: string;
  variantKey: string;
  content: string;
  source: string;
  settings: Record<string, unknown>;
  variantMeta?: Record<string, unknown> | null;
  scores?: Record<string, unknown> | null;
  consumerFeedback?: Record<string, unknown>[] | null;
  notes?: string | null;
  rating?: number | null;
  favoriteReason?: string | null;
  reasonTags?: string[] | null;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
  contentRevision?: number;
  contentEditedAt?: string | null;
  isUserAuthored?: boolean;
  reviewRequested?: boolean;
  reviewRequestedAt?: string | null;
  /** Read-only admin review; never sent on SyncFavoriteRequest */
  adminReview?: BookmarkAdminReview | null;
}

/** Cloud-synced saved config record */
export interface SavedConfigRecord {
  id: string;
  ownerId: string;
  clientId: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Cloud-synced brand profile record (MVP: one per user) */
export interface BrandProfileRecord {
  id: string;
  ownerId: string;
  brandName?: string | null;
  productName?: string | null;
  brandRedLines?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/sync/bootstrap response */
export interface BootstrapResponse {
  favorites: FavoriteRecord[];
  savedConfigs: SavedConfigRecord[];
  brandProfile: BrandProfileRecord | null;
}

/** POST /api/sync/favorites body */
export interface SyncFavoriteRequest {
  clientId: string;
  variantKey: string;
  content: string;
  source: string;
  settings: Record<string, unknown>;
  variantMeta?: Record<string, unknown> | null;
  scores?: Record<string, unknown> | null;
  consumerFeedback?: Record<string, unknown>[] | null;
  notes?: string | null;
  rating?: number | null;
  favoriteReason?: string | null;
  reasonTags?: string[] | null;
  savedAt?: string;
  isUserAuthored?: boolean;
  reviewRequested?: boolean;
}

/** POST /api/sync/configs body */
export interface SyncConfigRequest {
  clientId: string;
  name: string;
  config: Record<string, unknown>;
}

/** PUT /api/sync/brand-profile body */
export interface SyncBrandProfileRequest {
  brandName?: string | null;
  productName?: string | null;
  brandRedLines?: string | null;
}

/** POST /api/sync/import body */
export interface SyncImportRequest {
  favorites?: SyncFavoriteRequest[];
  savedConfigs?: SyncConfigRequest[];
}

/** POST /api/sync/import response */
export interface SyncImportResponse {
  favorites: { imported: number; updated: number };
  savedConfigs: { imported: number; updated: number };
}

/** Sync status for individual items */
export type SyncStatus = 'synced' | 'local-only' | 'error';

/** Per-item sync tracker */
export interface SyncTracker {
  favorites: Record<string, SyncStatus>;
  savedConfigs: Record<string, SyncStatus>;
}

// ============================================================
// Slice E: Plans, Entitlements, Billing (MOCK)
// ============================================================

export type PlanId = 'free' | 'pro';

export interface PlanInfo {
  id: PlanId;
  name: string;
  nameZh: string;
  priceCny: number;            // 0 for Free, 19 for Pro
  quotaPerCycle: number;       // 20 for Free, 400 for Pro
  cycleDescription: string;    // e.g. "每滚动 7 天" / "每自然月"
  cycleDays: number | null;    // 7 for Free, null (calendar month) for Pro
  features: string[];          // human-readable feature list
  isCurrent: boolean;          // whether this is the user's active plan
  isMock: true;                // always true until real Alipay
}

export const FREE_PLAN: PlanInfo = {
  id: 'free',
  name: 'Free',
  nameZh: '免费版',
  priceCny: 0,
  quotaPerCycle: 20,
  cycleDescription: '每滚动 7 天',
  cycleDays: 7,
  features: [
    '每 7 天 20 次完整生成',
    '5 类港式平台文案',
    '质量审核与诊断',
    '消费者反馈模拟',
    '最多 10 条收藏',
    '最新 15 条生成历史',
  ],
  isCurrent: true,
  isMock: true,
};

export const PRO_PLAN: PlanInfo = {
  id: 'pro',
  name: 'Pro',
  nameZh: '专业版',
  priceCny: 19,
  quotaPerCycle: 250,
  cycleDescription: '每自然月',
  cycleDays: null,
  features: [
    '每自然月 250 次生成',
    'Free 全部功能',
    '收藏与生成历史全部解锁',
    '优先模型队列',
    '更多消费者画像',
    '高级品牌档案',
  ],
  isCurrent: false,
  isMock: true,
};

export const PLANS: PlanInfo[] = [FREE_PLAN, PRO_PLAN];

/** GET /api/me/entitlements response */
export interface PlanEntitlements {
  planId: PlanId;
  planName: string;
  quotaUsed: number;
  quotaTotal: number;
  cycleStart: string;          // ISO date
  cycleEnd: string;            // ISO date
  isMock: true;
}

/** POST /api/billing/checkout request */
export interface CheckoutRequest {
  planId: PlanId;
}

/** POST /api/billing/checkout response (mock) or /api/billing/alipay/checkout response (sandbox) */
export interface CheckoutResponse {
  orderId: string;
  planId: PlanId;
  planName: string;
  amountCny: number;
  amountFen?: number;          // sandbox: amount in fen (分)
  amountYuan?: string;         // sandbox: amount in yuan string
  outTradeNo?: string;         // sandbox: Alipay trade number
  redirectUrl: string;         // mock: local URL; sandbox: Alipay gateway URL
  paymentMode?: 'mock' | 'alipay_sandbox';
  isMock?: boolean;
  mockMode?: boolean;          // sandbox alias
}

/** GET /api/billing/orders item */
export interface PaymentOrder {
  id: string;
  planId: PlanId;
  planName: string;
  amountCny: number;
  amountFen?: number;          // sandbox: amount in fen
  outTradeNo?: string;         // sandbox: Alipay trade number
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed' | 'closed';
  createdAt: string;
  paidAt: string | null;
  paymentMode?: 'mock' | 'alipay_sandbox';
  isMock?: boolean;
}

/** GET /api/billing/orders response */
export interface PaymentOrderListResponse {
  orders: PaymentOrder[];
  total: number;
}
