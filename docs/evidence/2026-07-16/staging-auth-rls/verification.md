# Staging Auth / RLS verification

Date: 2026-07-16

Target: Supabase staging `wzpaghnxlpfjojvuxplx` (`77HK-staging`).

## Environment boundary

- Client and server local runtime configuration point to staging.
- The repository-root production `.env` was not modified.
- The server secret is loaded through an ignored file outside the repository.
- The browser bundle contains the staging project ref, contains no production
  project ref, and contains no secret-key marker.
- Server startup confirmed that `server/.env` takes precedence locally.

## Automated acceptance

The reusable harness is `scripts/staging-auth-rls-acceptance.mjs`. It creates four
temporary, admin-confirmed Auth users with random in-memory passwords, assigns the
two admin roles and two review groups through the trusted client, runs the matrix,
and removes all users and data in `finally`.

Passed:

- S2: temporary-user password login, wrong-password rejection, logout and login
  again.
- S2 real mailbox: signup confirmation link confirmed the account, the initial
  password could sign in, and the password-reset link reached the local
  `/reset-password` page.
- S2 password update: a browser submitted the reset form with a one-time recovery
  session; the success state was visible, the old password was rejected, and the
  new password could sign in.
- S3: new users start as `user` on Free and cannot self-assign admin, review group,
  or Pro.
- S4: profiles, generation jobs, favorites, saved configs, brand profiles, case
  library entries, and roles are isolated across owners.
- S5: cloud bootstrap returns only the current owner's favorites, configurations,
  and brand profile.
- S6: admin routes require authentication and admin role; ordinary admins only see
  their non-null review group; cross-group detail/review returns 404; the browser
  cannot directly invoke the service-role review RPC.
- S7/S8 backend state: same-group review results reach the owner, pending counts
  decrease after review, content edits invalidate stale reviews and create a new
  pending cycle, and a second review result reaches the owner.
- S9: missing JWT, invalid JWT, ordinary-user admin access, and cross-group admin
  access fail closed.

## Cleanup

An independent service-side query confirmed zero temporary Auth users and zero rows
in every table touched by the harness, including `audit_log`.

The one real-mailbox test account is intentionally retained for the next browser
notification slice. It has the default `user` role and Free plan and will be
removed with that slice's acceptance data.

The staging notification UI run independently confirmed:

- zero `codex-staging-ui-*` temporary administrators;
- zero favorites with the notification-acceptance source marker; and
- the real-mailbox user's original null review group was restored.

## Staging notification UI acceptance

Passed with real staging Auth, RLS, API, and browser sessions:

- The admin desktop reminder displayed `1 条文案待审核`, supported `稍后审核`,
  and did not repeat after reload in the same session.
- The admin mobile reminder opened `只看待审核（1）`, displayed the pending row,
  and had no document-level horizontal overflow.
- The admin mobile review dialog saved an `已采纳` result through the real API.
- The user desktop reminder displayed the expected brand and `已通过审核` result.
- Screenshots were visually inspected and email text was masked before capture.

The continuation slice corrected the harness to use the cloud `client_id` and
passed the remaining checks:

- Desktop `立即查看` opened the favorites panel and focused the adopted card.
- A content edit created revision 2, and a real admin API call saved a
  `changes_requested` result with a review note.
- The mobile user reminder displayed `未通过审核`, included the review note, stayed
  within the 390px viewport, and had no document-level horizontal overflow.
- Mobile `立即查看` opened and focused the revised favorite card.

## Remaining manual acceptance

None for the staging admin/user review-notification flow covered by this report.
