# Slice A — Implementation Notes

## Files Created

| File | Purpose |
|------|---------|
| `client/src/context/AuthContext.tsx` | Mock auth context: useReducer + localStorage persistence |
| `client/src/context/ThemeContext.tsx` | Single reactive theme source for dark/light mode |
| `client/src/components/auth/AuthLayout.tsx` | Shared left-right split layout with CSS animated background |
| `client/src/pages/LoginPage.tsx` | Login form — ported from 总览/login.tsx visual |
| `client/src/pages/SignupPage.tsx` | Signup form with validation |
| `client/src/pages/ForgotPasswordPage.tsx` | Forgot password with mock behavior |
| `client/src/pages/ResetPasswordPage.tsx` | Reset password with mock behavior |
| `client/src/test/slice-a.test.tsx` | 12 behavior tests (Vitest + RTL + user-event + jsdom) |
| `client/src/test/setup.ts` | Test setup: localStorage polyfill, jest-dom matchers |

## Files Modified

| File | Change |
|------|--------|
| `client/src/App.tsx` | Full path-based routing with ProtectedRoute, ThemeProvider wrapping |
| `client/src/components/layout/Header.tsx` | Added optional `onLogout` / `userEmail` props |
| `client/src/index.css` | Added `.auth-bg-animate` keyframe animation |
| `client/src/components/shared/Badge.tsx` | Green variant → light:orange |
| `client/src/components/shared/Spinner.tsx` | Added light:border-t-orange-500 |
| `client/src/components/shared/Slider.tsx` | Dynamic brandFill from ThemeContext |
| `client/src/components/shared/Tabs.tsx` | Active tab light:orange |
| `client/src/components/shared/SegmentedControl.tsx` | Selected state light:orange |
| `client/src/components/input/InputPanel.tsx` | CTA button light:orange |
| `client/vite.config.ts` | Vitest config (jsdom environment) |
| `client/package.json` | DevDeps: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom |

## Files NOT Modified

- All workbench components (InputPanel, ResultsPanel, AuditPanel, etc.)
- AppContext.tsx
- Footer.tsx, ThreePanel.tsx
- MarketingPage.tsx

## Slice A 验收修复 (2026-07-11)

| # | Issue | Fix | Test |
|---|-------|-----|------|
| 1 | ResetPassword false success | `mockResetPassword` returns `Promise<boolean>` | Test "resetPassword succeeds" |
| 2 | Theme state fragmentation | ThemeContext as single source of truth | Theme button tests |
| 3 | Light mode emerald → orange | 6 shared components + InputPanel updated | Theme button tests |
| 4 | Form a11y (id/htmlFor/aria) | IDs + htmlFor + aria-describedby on all 4 auth pages | 3 a11y tests |
| 5 | Title orphan "器" at 1440px | Font clamp reduced, container widened, text-wrap:balance | Visual |
| 6 | Behavior tests | 12 tests covering core auth flows | All 12 pass |

## Verification Results (2026-07-11)

- `npx vitest run`: 12/12 passed (7.52s)
- `npx tsc --noEmit`: clean (0 errors)
- `npm run build`: 1640 modules, 2.18s (382 KB JS, 74 KB CSS)

## Mock Data Storage

- Key: `hk-cantonese-mock-auth` in localStorage
- Structure: `{ users: Record<email, {password, createdAt}>, currentSession: email | null }`
- All functions prefixed with `mock` for self-documentation
- MOCK badges on all auth pages

## Visual Port Decisions

From 总览/login.tsx → 77 Slice A:
- ✅ Left-right split layout (grid-cols-[1.15fr_1fr])
- ✅ Brand title "77港话通社媒文案器" + English subtitle
- ✅ Bottom-border input style
- ✅ Glass-morphism form card (dark mode)
- ✅ Gradient overlay fades
- ✅ "Forgot password?" right-aligned link
- ❌ framer-motion → CSS transitions (no dependency)
- ❌ DarkVeil canvas → CSS animated gradient (no dependency)
- ❌ Supabase auth → localStorage mock
- ❌ Google OAuth → removed
- ❌ Admin assignment text → replaced with public signup
- ❌ Email domain whitelist → removed
