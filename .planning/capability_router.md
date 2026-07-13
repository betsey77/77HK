# Capability Router

This project uses `77vibe-dev-flow` as the controller.

Use this file to record which companion skills are relevant for this specific project. Do not call every skill by default.

## Selected Companion Skills

| Area | Skill or tool | Why it is relevant | Status |
|---|---|---|---|
| Product discovery | MVP_PROTOTYPE_AND_REUSE_FLOW | 固定最小可运行商业闭环和复用边界 | selected |
| PRD / stories / tests | 77vibe-dev-flow | PRD/SDD/严格证据与切片控制 | selected |
| Frontend / visual design | local `docs/design-system.md` | 登录复用与工作台视觉一致 | selected |
| Architecture / code quality | COMMERCIAL_SAAS_FLOW + SECURITY_ENGINEERING_GATE | Auth、数据、支付、后台架构与门禁 | selected |
| Context / memory | context_pack + prompt | Claude Code 交接和 compact 恢复 | selected |
| Analytics / business proof | TBD | TBD | candidate |
| Marketing / launch | TBD | TBD | candidate |
| Mobile QA / iOS simulator | TBD | Use ios-simulator-mcp only on macOS with Xcode and IDB | candidate |
| Learning path / examples | TBD | Use Easy-Vibe style guidance for beginner onboarding or cross-platform examples | candidate |
| Deployment | Netlify/Vercel later | 仅本地验收通过且用户明确批准后选择 | deferred |

## Routing Decisions

- Discovery route: existing PRD decisions + real-need/MVP reuse audit.
- Design route: local design system; total overview login is visual reference only.
- Build route: sequential Claude Code vertical slices in `77`.
- Verification route: strict evidence for UI/Auth/data/payment/admin.
- Mobile QA route:
- Memory route:
- Deployment route: no deployment until complete acceptance; preview first.

## Rules

- Read the selected companion skill's `SKILL.md` before using it.
- Use the minimum companion skills needed for the current phase.
- Multi-subagent execution requires explicit user approval before dispatch.
- Deployment requires local acceptance first and explicit user approval.
- Write durable outputs back to PRD, SDD, TEST_PLAN, evidence, acceptance, changelog, or memory.
- External projects are references or optional tools; do not install or vendor them without explicit user approval.
