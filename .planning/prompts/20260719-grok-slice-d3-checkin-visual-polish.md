# Grok Build task: D3 check-in visual polish review (read-only)

Repository: `D:\work\77港话通社媒文案\77`

Read only:

- `client/src/components/checkin/CheckInDialog.tsx`
- `docs/design-system.md`
- `client/src/index.css` only when a referenced token must be confirmed

Context:

- The dialog is functionally complete and verified at desktop 1440x900 and mobile 390x844.
- User feedback: the check-in UI looks too plain/ugly.
- Current screenshot impression: a small boxy modal with nested bordered cards, seven equally weighted circles, weak reward celebration, too much empty black backdrop, and limited hierarchy. Mobile is readable but still feels like a compressed desktop card.
- Keep the existing dark emerald / light orange product identity, Lucide icons, Chinese copy, server-authoritative states, keyboard/a11y behavior and 44px targets.
- Do not change API/business logic, dismissal semantics, tests, dependencies, layout outside this dialog, or create a new design system.

Task:

1. Review the current component and relevant design-system rules.
2. Return a ranked, concrete visual-polish proposal suitable for one surgical implementation pass.
3. Include exact Tailwind-level recommendations for hierarchy, spacing, progress visualization, reward emphasis, desktop/mobile sizing, dark/light contrast and motion/reduced-motion.
4. Flag any recommendation that would risk accessibility, mobile overflow or product-state ambiguity.
5. Prefer simplification over adding decorative elements. No emoji, glassmorphism overload, gradients everywhere or new packages.

Output only the review and recommended changes. Do not edit files, run commands, use web search, memory or subagents.
