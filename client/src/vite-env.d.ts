/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (from Supabase Dashboard > Project Settings > API) */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase modern Publishable Key — safe for browser (from Supabase Dashboard > Project Settings > API) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /**
   * Optional API origin when frontend and backend are split (e.g. two Vercel projects).
   * Empty = same-origin relative `/api/...` (local Vite proxy). Never put secrets here.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
