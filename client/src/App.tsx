import { lazy, Suspense, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, AppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlanAccessProvider } from './context/PlanAccessContext';
import { useCloudSync } from './hooks/useCloudSync';
import { resolveNextPath } from './services/nextPath';
import { OPEN_REVIEWED_FAVORITE_EVENT } from './services/reviewResultNotifications';
import BrandLoader from './components/shared/BrandLoader';

const Header = lazy(() => import('./components/layout/Header'));
const Footer = lazy(() => import('./components/layout/Footer'));
const ThreePanel = lazy(() => import('./components/layout/ThreePanel'));
const InputPanel = lazy(() => import('./components/input/InputPanel'));
const ResultsPanel = lazy(() => import('./components/results/ResultsPanel'));
const AuditPanel = lazy(() => import('./components/audit/AuditPanel'));
const InspirationPanel = lazy(() => import('./components/inspiration/InspirationPanel'));
const FavoritesPanel = lazy(() => import('./components/favorites/FavoritesPanel'));
const ReviewResultNotifier = lazy(() => import('./components/favorites/ReviewResultNotifier'));
const CheckInDialog = lazy(() => import('./components/checkin/CheckInDialog'));
const FeedbackCenter = lazy(() => import('./components/feedback/FeedbackCenter'));
const MarketingPage = lazy(() => import('./components/marketing/MarketingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const HistoryDetailPage = lazy(() => import('./pages/HistoryDetailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const BillingResultPage = lazy(() => import('./pages/BillingResultPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// ============================================================
// Center content (unchanged from original App.tsx)
// ============================================================

function CenterContent() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ResultsPanel />
      </div>
      <InspirationPanel />
    </div>
  );
}

// ============================================================
// Loading fallback for auth restore
// ============================================================

function AuthLoading() {
  return <BrandLoader label="正在准备 77 工作台…" fullPage />;
}

// ============================================================
// Protected route wrapper
// ============================================================

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { state } = useAuth();

  if (state.isLoading) {
    return <AuthLoading />;
  }

  if (!state.isAuthenticated) {
    // Preserve the intended destination so login can redirect back
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/login?next=${next}`);
    return null;
  }

  return <>{children}</>;
}

// ============================================================
// Workbench shell with auth-aware header
// ============================================================

function AppShellWithAuth() {
  const { logout, state: authState } = useAuth();
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoriteFocusId, setFavoriteFocusId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleToggleFavorites = useCallback(() => {
    setFavoriteFocusId(null);
    setShowFavorites(prev => !prev);
  }, []);

  const handleOpenReviewedFavorite = useCallback((event: Event) => {
    const favoriteId = (event as CustomEvent<{ favoriteId?: string }>).detail?.favoriteId;
    if (!favoriteId) return;
    setFavoriteFocusId(favoriteId);
    setShowFavorites(true);
  }, []);

  useEffect(() => {
    window.addEventListener('toggle-favorites', handleToggleFavorites);
    window.addEventListener(OPEN_REVIEWED_FAVORITE_EVENT, handleOpenReviewedFavorite);
    return () => {
      window.removeEventListener('toggle-favorites', handleToggleFavorites);
      window.removeEventListener(OPEN_REVIEWED_FAVORITE_EVENT, handleOpenReviewedFavorite);
    };
  }, [handleOpenReviewedFavorite, handleToggleFavorites]);

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  return (
    <div
      data-testid="workbench-shell"
      className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-gray-950 light:bg-white"
    >
      <Header
        onLogout={handleLogout}
        userEmail={authState.user?.email ?? null}
        onOpenFeedback={() => setShowFeedback(true)}
      />
      <ThreePanel
        left={<InputPanel />}
        center={<CenterContent />}
        right={<AuditPanel />}
      />
      <Footer />
      <FavoritesPanel
        isOpen={showFavorites}
        focusBookmarkId={favoriteFocusId}
        onClose={() => {
          setShowFavorites(false);
          setFavoriteFocusId(null);
        }}
      />
      <FeedbackCenter
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        jwt={authState.session?.access_token ?? null}
      />
    </div>
  );
}

function AccountScopedWorkbench() {
  const { state } = useAuth();
  if (!state.user) return null;

  return (
    <PlanAccessProvider>
      <AppProvider key={state.user.id} ownerId={state.user.id}>
        <CloudSyncGate>
          <AppShellWithAuth />
        </CloudSyncGate>
      </AppProvider>
    </PlanAccessProvider>
  );
}

function AccountScopedBilling() {
  const { state } = useAuth();
  if (!state.user) return null;

  return (
    <AppProvider key={state.user.id} ownerId={state.user.id}>
      <BillingPage />
    </AppProvider>
  );
}

function AccountScopedAdmin() {
  const { state } = useAuth();
  if (state.isLoading) return <AuthLoading />;
  return <AdminPage userEmail={state.user?.email ?? null} />;
}

/**
 * CloudSyncGate — hydrates local state from the cloud on mount,
 * then renders children. Shows a minimal loading state during
 * hydration and a non-blocking legacy import prompt.
 */
const CLOUD_SYNC_FOCUS_INTERVAL_MS = 30_000;

export function shouldBlockCloudSync(
  syncStatus: string,
  initialHydrationComplete: boolean,
) {
  return !initialHydrationComplete && (syncStatus === 'hydrating' || syncStatus === 'error');
}

export function shouldRefreshCloudSyncOnFocus(
  syncStatus: string,
  lastRefreshAt: number,
  now: number,
) {
  return syncStatus === 'ready' && now - lastRefreshAt >= CLOUD_SYNC_FOCUS_INTERVAL_MS;
}

export function CloudSyncGate({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();
  const [initialHydrationComplete, setInitialHydrationComplete] = useState(false);
  const lastFocusRefreshAtRef = useRef(0);

  const cloudSync = useCloudSync(
    authState.user?.id ?? 'anonymous',
    authState.isAuthenticated,
  );

  useEffect(() => {
    if (cloudSync.syncStatus !== 'ready') return;
    setInitialHydrationComplete(true);
    if (lastFocusRefreshAtRef.current === 0) {
      lastFocusRefreshAtRef.current = Date.now();
    }
  }, [cloudSync.syncStatus]);

  useEffect(() => {
    const refreshOnFocus = () => {
      const now = Date.now();
      if (shouldRefreshCloudSyncOnFocus(cloudSync.syncStatus, lastFocusRefreshAtRef.current, now)) {
        lastFocusRefreshAtRef.current = now;
        cloudSync.retryHydration();
      }
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [cloudSync.retryHydration, cloudSync.syncStatus]);

  // Only the first account hydration blocks the workbench.
  if (cloudSync.syncStatus === 'hydrating' && shouldBlockCloudSync(cloudSync.syncStatus, initialHydrationComplete)) {
    return <BrandLoader label="同步云端数据…" fullPage />;
  }

  // Hydration error with retry
  if (cloudSync.syncStatus === 'error' && shouldBlockCloudSync(cloudSync.syncStatus, initialHydrationComplete)) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 light:bg-white">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <p className="text-sm text-red-400">
            {cloudSync.syncError || '云端同步失败'}
          </p>
          <button
            onClick={cloudSync.retryHydration}
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Legacy import banner — once per account */}
      {cloudSync.legacyImportAvailable && (
        <LegacyImportBanner
          bookmarkCount={cloudSync.legacyBookmarkCount}
          configCount={cloudSync.legacyConfigCount}
          onImport={cloudSync.importLegacyData}
          onSkip={cloudSync.skipLegacyImport}
        />
      )}

      {/* Non-blocking sync error with retry */}
      {cloudSync.syncError && (cloudSync.syncStatus === 'ready' || initialHydrationComplete) && (
        <div className="mx-auto flex max-w-3xl items-center justify-between rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
          <span>{cloudSync.syncError}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={cloudSync.retryHydration}
              className="text-amber-300 underline hover:text-amber-100"
            >
              重试
            </button>
            <button
              onClick={cloudSync.dismissSyncError}
              className="text-amber-300 hover:text-amber-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {cloudSync.syncStatus === 'ready' && authState.user?.id && (
        <>
          <ReviewResultNotifier
            ownerId={authState.user.id}
            onReviewVersionChanged={cloudSync.retryHydration}
          />
          <CheckInDialog ownerId={authState.user.id} />
        </>
      )}

      {children}
    </>
  );
}

/** Legacy import banner — shown once per account when old global localStorage keys are detected */
function LegacyImportBanner({
  bookmarkCount,
  configCount,
  onImport,
  onSkip,
}: {
  bookmarkCount: number;
  configCount: number;
  onImport: () => Promise<unknown>;
  onSkip: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const result = await onImport();
      if (result) {
        setDone(true);
      } else {
        setError('导入失败，请重试');
      }
    } catch {
      setError('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  }

  if (done || skipped) return null;

  const items: string[] = [];
  if (bookmarkCount > 0) items.push(`${bookmarkCount} 条收藏`);
  if (configCount > 0) items.push(`${configCount} 个配置`);

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm">
      <span className="text-emerald-300">
        检测到本浏览器旧版本数据（{items.join('、')}），可能来自旧版本或其他账号。是否导入到当前账号？
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {importing ? '导入中…' : '导入'}
        </button>
        <button
          onClick={() => { onSkip(); setSkipped(true); }}
          disabled={importing}
          className="rounded border border-gray-500 px-3 py-1 text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          跳过
        </button>
      </div>
      {error && <span className="w-full text-red-400">{error}</span>}
    </div>
  );
}

// ============================================================
// Public route — redirect to /app if already authed
// ============================================================

export function PublicAuthRoute({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const initialAuthResolvedRef = useRef(!state.isLoading);

  if (!state.isLoading) {
    initialAuthResolvedRef.current = true;
  }

  if (state.isLoading && !initialAuthResolvedRef.current) {
    return <AuthLoading />;
  }

  if (state.isAuthenticated) {
    // Honour safe next path if already authenticated
    const next = new URLSearchParams(window.location.search).get('next');
    const safe = resolveNextPath(next ? decodeURIComponent(next) : null);
    window.location.replace(safe ?? '/app');
    return null;
  }

  return <>{children}</>;
}

// ============================================================
// Main App — path-based router
// ============================================================

function AppRoutes() {
  const path = window.location.pathname;

  // ---- Public landing ----
  if (path === '/' || path === '') {
    return <MarketingPage />;
  }

  // ---- Public pricing page ----
  if (path === '/pricing') {
    return <ThemeProvider><PricingPage /></ThemeProvider>;
  }

  // ---- Billing result pages (public, show order outcome) ----
  if (path === '/billing/success') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <BillingResultPage outcome="success" />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  if (path === '/billing/cancel') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <BillingResultPage outcome="cancel" />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- Admin dashboard (auth-required, role-verified by server) ----
  if (path === '/admin') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <AccountScopedAdmin />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- Auth pages (public, redirect to /app if already authed) ----
  if (path === '/login') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <PublicAuthRoute>
            <LoginPage />
          </PublicAuthRoute>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  if (path === '/signup') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <PublicAuthRoute>
            <SignupPage />
          </PublicAuthRoute>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  if (path === '/forgot-password') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <ForgotPasswordPage />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  if (path === '/reset-password') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <ResetPasswordPage />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- Auth callback (email confirmation) ----
  if (path === '/auth/callback') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <AuthCallback />
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- History detail page (protected) ----
  if (/^\/app\/history\/([^/]+)$/.test(path)) {
    return (
      <ThemeProvider>
        <AuthProvider>
          <ProtectedRoute>
            <HistoryDetailPage />
          </ProtectedRoute>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- History page (protected) ----
  if (path === '/app/history') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- Billing page (protected) ----
  if (path === '/app/billing') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <ProtectedRoute>
            <AccountScopedBilling />
          </ProtectedRoute>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- Protected workbench ----
  if (/^\/app(?:\/|$)/.test(path)) {
    return (
      <ThemeProvider>
        <AuthProvider>
          <ProtectedRoute>
            <AccountScopedWorkbench />
          </ProtectedRoute>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // ---- Unknown routes → redirect to / ----
  window.location.replace('/');
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <AppRoutes />
    </Suspense>
  );
}
