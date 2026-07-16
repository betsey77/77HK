/**
 * Isolated Vite config for local workbench shell E2E only.
 * Normal `vite.config.ts` / production build must not load this file or e2e fixtures.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eSupabase = path.resolve(__dirname, 'src/e2e/supabase.fixture.ts');
const e2eAuth = path.resolve(__dirname, 'src/e2e/authContext.fixture.tsx');
const realSupabase = path.resolve(__dirname, 'src/services/supabase.ts');
const realAuth = path.resolve(__dirname, 'src/context/AuthContext.tsx');

function e2eLocalMockPlugin(): Plugin {
  const rewrite = (id: string): string | null => {
    const n = id.replace(/\\/g, '/');
    if (n.includes('/e2e/')) return null;
    if (n.includes('services/supabase')) return e2eSupabase;
    if (n.includes('context/AuthContext')) return e2eAuth;
    return null;
  };

  return {
    name: 'e2e-local-mock-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      // Relative import strings
      const hit = rewrite(source);
      if (hit) return hit;
      // Absolute / partially resolved ids
      if (importer && (source.startsWith('.') || source.startsWith('/'))) {
        try {
          const abs = path.normalize(path.resolve(path.dirname(importer), source)).replace(/\\/g, '/');
          const hit2 = rewrite(abs);
          if (hit2) return hit2;
        } catch {
          /* ignore */
        }
      }
      return null;
    },
    load(id) {
      // Last line of defence: if real modules are requested, serve fixtures instead
      const n = id.replace(/\\/g, '/').split('?')[0];
      if (n === realSupabase.replace(/\\/g, '/') || n.endsWith('/src/services/supabase.ts')) {
        return null; // let resolveId handle; if load is hit for real file, re-export fixture
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [e2eLocalMockPlugin(), react(), tailwindcss()],
  envDir: path.resolve(__dirname, 'src/e2e'),
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(''),
  },
  resolve: {
    alias: [
      { find: realSupabase, replacement: e2eSupabase },
      { find: realAuth, replacement: e2eAuth },
      // Extension-less absolute forms
      { find: realSupabase.replace(/\.ts$/, ''), replacement: e2eSupabase },
      { find: realAuth.replace(/\.tsx$/, ''), replacement: e2eAuth },
    ],
  },
  optimizeDeps: {
    // Keep local fixtures out of a prebundle that could pin the real client
    exclude: [],
    holdUntilCrawlEnd: false,
  },
  server: {
    host: '127.0.0.1',
    port: 5184,
    strictPort: true,
  },
});
