// Mirror of client types for server-side validation

// ============================================================
// Slice B: Auth types
// ============================================================

export type AppRole = 'user' | 'support' | 'admin' | 'super_admin';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
}

export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'suspended' | 'deletion_pending' | 'deleted';
  deletionRequestedAt: string | null;
  purgeAfter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoles {
  userId: string;
  roles: AppRole[];
}

export type Platform = 'ig' | 'facebook' | 'shorts' | 'all';
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
export type ToneModifier =
  | '簡潔'
  | '敘事'
  | '促銷感'
  | '治癒'
  | '緊迫'
  | '節日感'
  | '知識感'
  | '對話感';
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

export interface ConsumerSuggestion {
  personaId: string;
  personaName: string;
  aspect: string;           // e.g. 港味地道度, 社媒吸引力, 產品說服力
  suggestion: string;       // the modification suggestion (Cantonese)
  reason: string;           // why this change would improve the copy
  relevanceScore: number;   // 1-5, how relevant is this suggestion to the user's original intent?
  relevanceReason: string;  // why this score — is the suggestion on-target or off-topic?
  targetPlatforms?: string[]; // variant keys this suggestion targets (ig|facebook|shorts|standardHK|lightCantonese)
}

export interface ConsumerFeedback {
  personaId: string;
  personaName: string;
  feedback: string;
  rating: number; // 1-5 stars
  suggestions?: ConsumerSuggestion[]; // modification suggestions from this persona
}

export interface AuditScores {
  cantoneseNaturalness: number; // 港味纯正度 0-100
  brandSafety: number;          // 品牌安全度 0-100
  platformFit: number;          // 平台适配度 0-100
  readability: number;          // 可读性 0-100
  creativity: number;           // 创意/吸引力 0-100
  hookStrength: number;         // 🆕 P2.1 Hook强度 0-100
  emojiHashtagFit: number;      // 🆕 P2.1 Emoji/Hashtag策略 0-100
  engagementPotential: number;  // 🆕 P2.1 互动引导潜力 0-100
  total: number;                // 加权总分 0-100
}

export interface GenerateRequest {
  source: string;
  platform: Platform;
  tone: BrandTone;
  cantoneseLevel: number;
  englishMixingLevel: number;
  useEnhancement: boolean;       // deprecated, kept for backward compat
  brandName?: string;
  productName?: string;
  brandRedLines?: string;        // brand expression constraints
  structuredBriefEnabled?: boolean; // 🆕 Ph1: 结构化写作简报 toggle
  creativityLevel: number;       // 0-4, default 2 (平衡)
  inputLanguage: InputLanguage;  // default 'mandarin'
  refresh?: boolean;            // 🆕 P2.5 内容刷新模式 — 同参数换写法
  consumerPersonas?: ConsumerPersona[];
  /** P2: Target publish date for calendar matching */
  targetDate?: string;
  /** P2: Competitor page name for ad library search */
  competitorQuery?: string;
  /** 🆕 Phase B: Reference cases for few-shot injection from bookmarked copies */
  referenceCases?: ReferenceCase[];
  /** 🆕 话题日历：用户选择的节日/事件 ID，服务端按 ID 查找完整事件并注入 prompt */
  calendarEventIds?: string[];
  /** 🆕 话题日历：resolve 后的完整事件对象（由路由层注入） */
  calendarEvents?: CalendarEvent[];
  /** W1 */
  copyType?: CopyType;
  customCopyType?: string;
  lengthControlEnabled?: boolean;
  copyLengthLevel?: number;
  primaryTone?: BrandTone;
  toneModifiers?: ToneModifier[];
  /**
   * W3: client sends selected case library IDs only (max 3 UUIDs).
   * Bodies are never trusted from the client.
   */
  selectedCaseLibraryIds?: string[];
  /**
   * W3: server-resolved case library context (owner JWT + RLS).
   * Only this field may enter prompts / rules fallback — never client bodies.
   */
  caseLibraryContext?: CaseLibraryContextEntry[];
}

/** W3: minimal case library snapshot for prompt + generation history */
export interface CaseLibraryContextEntry {
  id: string;
  caseType: 'good' | 'bad';
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
}

/** A reference case from user's bookmarked copies for few-shot prompt injection */
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

export interface ThermometerDimensions {
  cantoneseFeel: number;
  culturalFit: number;
  platformFit: number;
  brandSafety: number;
  tradConsistency: number;
  hookStrength: number;        // 🆕 P2.1 Hook强度 1-5
  visualStrategy: number;      // 🆕 P2.1 Emoji/Hashtag策略 1-5
  engagementFit: number;       // 🆕 P2.1 互动引导 1-5
}

export interface Thermometer {
  overall: number;
  dimensions: ThermometerDimensions;
}

// Issue tags are free-form strings. The audit prompt provides a rich taxonomy,
// but any tag the model generates is accepted — this prevents the "all AI腔" problem.
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

export interface CtaScores {
  standardHK: { presence: number; naturalness: number; platformFit: number; total: number };
  lightCantonese: { presence: number; naturalness: number; platformFit: number; total: number };
  ig: { presence: number; naturalness: number; platformFit: number; total: number };
  facebook: { presence: number; naturalness: number; platformFit: number; total: number };
  shorts: { presence: number; naturalness: number; platformFit: number; total: number };
}

export interface Audit {
  thermometer: Thermometer;
  issues: AuditIssue[];
  replacements: Replacement[];
  risks: RiskNote[];
  comments: SimulatedComment[];
  scores?: AuditScores;
  ctaScores?: CtaScores; // 🆕 P2.2 CTA 独立评分
}

export interface Enhancement {
  model: string;
  suggestions: Record<string, string>;
}

export interface VariantMeta {
  headline: string;
  altHeadlines: string[];
  ctaLine: string;
  valuePropStatement?: string;
  targetPersona?: string;
  creativeForm?: string;
  strategyGoal?: string;
}

export interface DiagnoseGenerateResult {
  diagnosis: Diagnosis;
  variants: Variants;
  variantMeta?: Record<string, VariantMeta>; // 🆕 Ph1
}

export type GenerationEngine = 'self-hosted-cantonese' | 'featherless-cantonese' | 'deepseek' | 'rules';

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
  variantMeta?: Record<string, VariantMeta>; // 🆕 Ph1
}

// Temperature mapping by brand tone
export const TONE_TEMPERATURE: Record<BrandTone, number> = {
  '高級': 0.4,
  '克制': 0.4,
  '專業': 0.45,
  '穩妥': 0.5,
  '真誠': 0.55,
  '溫暖': 0.6,
  '活潑': 0.7,
  '俏皮': 0.8,
  '街坊': 0.8,
  '幽默': 0.85,
  '激昂': 0.85,
  '年輕': 0.9,
};

// ============================================================
// Slice C1: Generation Jobs
// ============================================================

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  ownerId: string;
  idempotencyKey: string;
  status: GenerationStatus;
  // Input brief
  source: string;
  platform: string;
  tone: string;
  cantoneseLevel: number;
  englishMixingLevel: number;
  creativityLevel: number;
  inputLanguage: string;
  brandName?: string | null;
  productName?: string | null;
  brandRedLines?: string | null;
  brief?: Record<string, unknown> | null;
  // Results (null until completed)
  variants?: Variants | null;
  variantMeta?: Record<string, VariantMeta> | null;
  diagnosis?: Diagnosis | null;
  audit?: Audit | null;
  scores?: { generated: AuditScores; source: AuditScores | null } | null;
  consumerFeedback?: ConsumerFeedback[] | null;
  generationEngine?: string | null;
  // Error
  errorMessage?: string | null;
  errorCode?: string | null;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  deletedAt?: string | null;
}

/** Flattened list item for history — excludes heavy jsonb payloads */
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

// Request types
export interface CreateGenerationRequest {
  idempotencyKey?: string;
  source: string;
  platform?: string;
  tone?: string;
  cantoneseLevel?: number;
  englishMixingLevel?: number;
  creativityLevel?: number;
  inputLanguage?: string;
  brandName?: string;
  productName?: string;
  brandRedLines?: string;
  brief?: Record<string, unknown>;
}

export interface ListGenerationQuery {
  limit?: number;
  offset?: number;
  query?: string;
  /** Restrict list/search to the newest accessible records for the current plan. */
  accessLimit?: number;
}

// ============================================================
// Slice C2a: Quota & trusted write
// ============================================================

export interface QuotaReservation {
  reservationId: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  idempotencyKey: string;
}

export interface UserEntitlement {
  planName: string;
  quotaUsed: number;
  quotaTotal: number;
  remaining: number;
}

// ============================================================
// Inspiration Panel (P2)
// ============================================================

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
  expressionFingerprint?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  titleZh: string;
  applicableIndustries: string[];
  angles: string[];
  narrativeHooks: string[];
  sensitivityNote?: string;
}

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

export type InspirationTab = 'languageVibe' | 'topicCalendar' | 'hotTrends' | 'competitorActivity';

// Request/Response types for inspiration endpoints

export interface CalendarRequest {
  targetDate?: string;
  industry?: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  matchedCount: number;
}

export interface CompetitorSearchRequest {
  query: string;
  country?: string;
  platform?: string;
  limit?: number;
}

export interface CompetitorSearchResponse {
  ads: CompetitorAd[];
  query: string;
  totalFound: number;
}

export interface IgHashtagRequest {
  tag: string;
  limit?: number;
}

export interface IgHashtagResponse {
  posts: HKPost[];
  tag: string;
}

export interface YoutubeTrendingRequest {
  categoryId?: string;
  limit?: number;
}

export interface YoutubeSearchRequest {
  query: string;
  limit?: number;
}

export interface YoutubeResponse {
  videos: HKPost[];
}

// ============================================================
// Slice D: Cloud Sync — favorites, saved_configs, brand_profiles
// ============================================================

/** Read-only admin review attached to a favorite (owner may read, never write). */
export interface ReviewAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  note: string;
}

export interface FavoriteAdminReview {
  status: 'adopted' | 'changes_requested';
  note: string | null;
  updatedAt: string;
  annotations?: ReviewAnnotation[];
}

/** A single favorite/bookmark record stored in the cloud */
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
  isUserAuthored: boolean;
  reviewRequested: boolean;
  /** Database-owned queue timestamp; never accepted on upsert. */
  reviewRequestedAt: string | null;
  /** Populated from favorite_admin_reviews via RLS; never accepted on upsert. */
  adminReview?: FavoriteAdminReview | null;
}

/** A saved generation config stored in the cloud */
export interface SavedConfigRecord {
  id: string;
  ownerId: string;
  clientId: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A brand profile stored in the cloud (MVP: one per user) */
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

// ============================================================
// Slice E: Plans, Entitlements, Billing (MOCK)
// ============================================================

export type PlanId = 'free' | 'pro';

export interface PlanInfo {
  id: PlanId;
  name: string;
  nameZh: string;
  priceCny: number;
  quotaPerCycle: number;
  cycleDescription: string;
  cycleDays: number | null;
  features: string[];
}

export interface PlanEntitlements {
  planId: PlanId;
  planName: string;
  quotaUsed: number;
  quotaTotal: number;
  cycleStart: string;
  cycleEnd: string;
  isMock: true;
}

export interface CheckoutRequest {
  planId: PlanId;
}

export interface CheckoutResponse {
  orderId: string;
  planId: PlanId;
  planName: string;
  amountCny: number;
  redirectUrl: string;
  isMock: true;
}

export interface PaymentOrder {
  id: string;
  planId: PlanId;
  planName: string;
  amountCny: number;
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed';
  createdAt: string;
  paidAt: string | null;
  isMock: true;
}
