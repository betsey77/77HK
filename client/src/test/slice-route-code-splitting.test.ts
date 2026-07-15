import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('route code splitting', () => {
  it('loads route and workbench surfaces through React.lazy with one Suspense boundary', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(source).toMatch(/import\s*\{[^}]*\blazy\b[^}]*\bSuspense\b[^}]*\}\s*from\s*['"]react['"]/s);
    expect(source).toContain("const MarketingPage = lazy(() => import('./components/marketing/MarketingPage'))");
    expect(source).toContain("const AdminPage = lazy(() => import('./pages/AdminPage'))");
    expect(source).toContain("const InputPanel = lazy(() => import('./components/input/InputPanel'))");
    expect(source).toContain('<Suspense fallback={<AuthLoading />}>');
    expect(source).not.toMatch(/^import\s+MarketingPage\s+from/m);
    expect(source).not.toMatch(/^import\s+AdminPage\s+from/m);
    expect(source).not.toMatch(/^import\s+InputPanel\s+from/m);
  });
});
