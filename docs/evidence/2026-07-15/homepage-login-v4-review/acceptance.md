# Homepage and login v4 acceptance

- Reference: `前端设计稿/grok/homepage-v4.html`, `前端设计稿/grok/login-page.html`
- Client tests: 398 passed
- Client production build: passed
- Desktop viewport: 1440 x 1000, no horizontal overflow
- Mobile viewport: 390 x 844, no horizontal overflow
- Browser console errors: 0
- Failed browser resources: 0
- Homepage case lightbox: opened and closed successfully
- Homepage lab: generated a visible Cantonese preview
- Login routes: real sign-in, sign-up, password recovery, and homepage links retained
- Loading state: centered `77`, animated dual orbit, reduced-motion fallback
- Login carousel: semantic line breaks use `pre-line` and `keep-all`
- Homepage terminal title: 53.6 px desktop, 25.6 px mobile, no horizontal overflow
- Theme handoff: homepage and workbench share `hk-cantonese-theme`; visual, DOM, and stored values stay aligned
- Workbench accordions: all four groups default closed; chevrons are green in dark mode and orange in light mode
- Loading label: green in dark mode and orange in light mode
- Review URL: `http://localhost:5173/`
- Login URL: `http://localhost:5173/login`
