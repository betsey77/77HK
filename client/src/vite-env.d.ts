/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (from Supabase Dashboard > Project Settings > API) */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase modern Publishable Key — safe for browser (from Supabase Dashboard > Project Settings > API) */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
