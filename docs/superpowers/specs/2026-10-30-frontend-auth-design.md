# Design: Auth-Flow Frontend (Phase 1 of the Complete Frontend)

Date: 2026-10-30
Part of: frontend work for the coffee shop app (Phase 1 of complete frontend)

## Intent and why

The backend access/refresh token flow has shipped and was merged to local
`main` (`7021f7f`, after final fix wave and scoped re-review; final
whole-branch verdict was *No — with fixes*, resolved to: refresh-after-expiry
reachable via middleware pass-through on refresh-cookie presence, and refresh
revoke+rotate atomic). The Angular frontend is still the untouched CLI
starter.

The human partner directed: implement the complete frontend; phase order —
auth-flow frontend first, then the complete frontend.

Phase 1 exists so the just-built backend token machinery is actually consumed
by a real client before product UI begins.

## Goals

- A real login screen (not placeholder) that calls the `login` mutation, stores
  the access token, and transitions the app to authenticated state.
- Access token kept in client memory only (per token design; refresh token
  travels via backend-set HttpOnly/SameSite cookie).
- GraphQL client: attach `Authorization: Bearer`, refresh on `TOKEN_EXPIRED`,
  retry once, clear session on refresh failure.
- Auth guard protecting the app shell; login/logout flows.
- Phase-1 auth loop demonstrably working end to end against the live backend
  (`POST /query` on `:8080`).

## Non-goals

- Full product UI (Phase 2): menu browsing, ordering/checkout, preparation
  queue, payments/refunds, staff screens, reports.
- Backend staff-admin mutations (not yet implemented) — frontend must not build
  against absent mutations.

## Constraints

- Angular 22 (`@angular/core` etc. v22, SSR via `@angular/ssr`, Tailwind v4,
  Vitest, `ng` scripts; see `frontend/package.json`).
- GraphQL endpoint: `POST /query` (and `GET /query`) on backend `:8080`;
  JSON request body.
- Dev proxy: `/query` → `http://localhost:8080`, forwarding cookies so the
  backend-set refresh cookie reaches the backend.
- Backend error codes (from `backend/graph/errors.go`): login failures map to
  `UNAUTHENTICATED`; expired access → `TOKEN_EXPIRED`; failed refresh →
  `INVALID_REFRESH_TOKEN`; forbidden → `FORBIDDEN`; etc.
- SSR: `app.routes.server.ts` currently maps all routes to `RenderMode.Prerender`.
  Phase 1 must set login → prerender-safe and protected shell → client render
  (or equivalent) so auth state governs shell rendering.
- Token design decision still open with human partner (backend I1): whether
  `AuthPayload.refreshToken` stays in the response body. Frontend design
  assumes cookie-only refresh transport regardless; frontend never persists
  refresh tokens client-side.

## Approaches considered

- **Option 1 (chosen): full phase-1 slice in one pass.** Real login screen +
  complete auth wiring built together; end-to-end loop proven before Phase 2.
  - Trades: larger single build. Benefits: phase-1 acceptance is real, not
    scaffolded; aligns with human direction ("auth-flow frontend first").
- **Option 2: plumbing-first with placeholder screen.** Rejected by human
  decision ("a real screen now").

Build approach within Option 1 (chosen): Angular-idiomatic slice —
  - `AuthState`: Angular signals-based state holder (token + authenticated
    flag); memory-only token storage.
  - Auth-aware GraphQL client wrapper (HttpClient): attach bearer when token
    present; on `TOKEN_EXPIRED` error → run `refreshToken` mutation → on
    success update token → retry original operation once; on refresh failure
    (`INVALID_REFRESH_TOKEN`) → clear session → route to login.
  - Functional auth guard on protected routes.
  - Real login screen: email/password form, loading + error states, success →
    authenticated state → navigate.
  - Logout: call `logout` mutation, clear state, navigate to login.
  - Routing: `/login` (public), `/` (protected shell) — SSR render modes set
    accordingly.

## Phase 1 scope (to be built)

1. Dev proxy for `/query` with cookie forwarding.
2. Auth state + auth service methods (login/refresh/logout/clear) with signals.
3. GraphQL client wrapper with refresh-on-expiry + retry.
4. Functional auth guard.
5. Real login screen (`/login`) with error display (`UNAUTHENTICATED` →
   invalid credentials message).
6. Protected shell at `/` with guard; minimal placeholder content + logout
   control.
7. Routing + SSR render-mode adjustments.
8. Tests (Vitest) for guard, refresh flow, login success/failure at unit level.

## Decisions made during brainstorming

- Real screen now (human decision) → Phase 1 includes a real, styled login
  screen (Tailwind), not a placeholder.
- Auth state via signals in a single auth state holder (no NgRx; no new deps).
- Refresh trigger strictly on GraphQL error code `TOKEN_EXPIRED`; not on
  generic 401/HTTP-level errors surfaced by the client wrapper.
- Refresh call made without bearer header; refresh cookie sent automatically
  (HttpOnly) — backend middleware pass-through (fixed) makes expired-bearer +
  cookie path work for refresh.
- Refresh failure → clear session, route to login.

## What's left after Phase 1

- Phase 2: complete product frontend (menu, ordering/checkout, prep queue,
  payments/refunds, staff screens) on top of the auth flow.
- Backend follow-ups pending human adjudication: I1 (refresh token exposure in
  `AuthPayload` vs cookie-only design anti-goal) and M1 (pass-through contract
  change for protected ops with expired bearer + refresh cookie).

## Open questions for the builder check — RESOLVED with findings

Builder check (2026-10-30, software engineer subagent) surfaced the following
open design questions, ranked by importance:

1. **Refresh trigger (high importance).** On the merged backend, an expired
   bearer plus a present refresh cookie passes through the middleware
   anonymously, so protected resolvers surface `UNAUTHENTICATED` — the
   `TOKEN_EXPIRED` GraphQL error can no longer be the client-facing trigger for
   a protected operation. Options on the table: client refreshes on
   `UNAUTHENTICATED` (scoped to protected operations so failed logins do not
   trigger it), on HTTP 401, or backend changes to surface `TOKEN_EXPIRED`.
   Also pending: whether the middleware pass-through (M1) is frozen for Phase 1.

2. **Boot-time silent refresh (high importance).** Access tokens are memory-only,
   so after a full page reload the session is lost unless Phase 1 adds a
   boot-time `refreshToken` call to restore it. The design only defined refresh
   after an error; boot restore needs an async initializer / loading state
   before redirect, or stays on "/login on reload".

3. **Protected operation for the Phase-1 bearer demo (medium).** No existing
   operation exercises the bearer in Phase 1 (`categories`/`products` public,
   `placeOrder` public, `order`/`preparationQueue` gated; no `me` query). Options:
   use a permission-gated op (e.g. `preparationQueue` as owner demo account) or
   add a backend `me` query. Determines whether Phase 1 stays frontend-only and
   what the placeholder shell calls.

4. **Automated E2E vs manual walkthrough (low).** Unit-level Vitest cannot
   exercise real HttpOnly cookie, dev proxy, rotation, or SSR. Manual acceptance
   vs automated browser test (Playwright) affects scope.

## Open questions for the human partner (to be answered)

- Refresh trigger and M1 freeze status (see builder finding 1).
- Boot-time session restore: yes or no (finding 2).
- Bearer-demo operation / `me` query decision (finding 3).
- E2E verification method (finding 4).
