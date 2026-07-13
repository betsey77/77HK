import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, AppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCloudSync } from './hooks/useCloudSync';
import { resolveNextPath } from './services/nextPath';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ThreePanel from './components/layout/ThreePanel';
import InputPanel from './components/input/InputPanel';
import ResultsPanel from './components/results/ResultsPanel';
import AuditPanel from './components/audit/AuditPanel';
import InspirationPanel from './components/inspiration/InspirationPanel';
import FavoritesPanel from './components/favorites/FavoritesPanel';
import FeedbackCenter from './components/feedback/FeedbackCenter';
import MarketingPage from './components/marketing/MarketingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallback from './pages/AuthCallback';
import HistoryPage from './pages/HistoryPage';
import HistoryDetailPage from './pages/HistoryDetailPage';
import PricingPage from './pages/PricingPage';
import BillingPage from './pages/BillingPage';
import BillingResultPage from './pages/BillingResultPage';
import AdminPage from './pages/AdminPage';

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
  return (
    <div className="flex h-full items-center justify-center bg-gray-950 light:bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-emerald-400 light:border-gray-300 light:border-t-orange-500" />
        <p className="text-sm text-gray-500 light:text-gray-400">恢复会话中…</p>
      </div>
    </div>
  );
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
  const [showFeedback, setShowFeedback] = useState(false);

  const handleToggleFavorites = useCallback(() => {
    setShowFavorites(prev => !prev);
  }, []);

  useEffect(() => {
    window.addEventListener('toggle-favorites', handleToggleFavorites);
    return () => window.removeEventListener('toggle-favorites', handleToggleFavorites);
  }, [handleToggleFavorites]);

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 light:bg-white">
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
      <FavoritesPanel isOpen={showFavorites} onClose={() => setShowFavorites(false)} />
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
    <AppProvider key={state.user.id} ownerId={state.user.id}>
      <CloudSyncGate>
        <AppShellWithAuth />
      </CloudSyncGate>
    </AppProvider>
  );
}

/**
 * CloudSyncGate — hydrates local state from the cloud on mount,
 * then renders children. Shows a minimal loading state during
 * hydration and a non-blocking legacy import prompt.
 */
function CloudSyncGate({ children }: { children: ReactNode }) {
  const { state: authState } = useAuth();

  const cloudSync = useCloudSync(
    authState.user?.id ?? 'anonymous',
    authState.isAuthenticated,
  );

  // Hydration loading state
  if (cloudSync.syncStatus === 'hydrating') {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950 light:bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-emerald-400 light:border-gray-300 light:border-t-orange-500" />
          <p className="text-sm text-gray-500 light:text-gray-400">
            同步云端数据…
          </p>
        </div>
      </div>
    );
  }

  // Hydration error with retry
  if (cloudSync.syncStatus === 'error') {
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
      {cloudSync.syncError && cloudSync.syncStatus === 'ready' && (
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

function PublicAuthRoute({ children }: { children: ReactNode }) {
  const { state } = useAuth();

  if (state.isLoading) {
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

export default function App() {
  const path = window.location.pathname;

  // ---- Public landing ----
  if (path === '/' || path === '') {
    return <ThemeProvider><MarketingPage /></ThemeProvider>;
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
          <AdminPage />
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
            <BillingPage />
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
