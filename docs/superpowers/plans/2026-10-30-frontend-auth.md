# Frontend Auth Flow Implementation Plan (Phase 1 of Complete Frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 auth-flow frontend for the coffee shop app — real login screen, token state, GraphQL client with refresh-on-expiry, auth guard, logout, routing, dev proxy, and tests — consuming the just-merged backend access/refresh token flow.

**Architecture:** Angular 22 + SSR frontend consumes the Go/gqlgen backend via `POST /query`; Angular-signals-based auth state; HttpClient-based GraphQL service that attaches the bearer and orchestrates refresh/retry; functional auth guard; dev proxy forwarding `/query` with cookies to the backend.

**Tech Stack:** Angular 22.2 (`@angular/core ^22.2.0`, `@angular/common ^22.2.0`, `@angular/compiler ^22.2.0`, `@angular/platform-browser ^22.2.0`, `@angular/router ^22.2.0`, `@angular/forms ^22.2.0`, `@angular/ssr ^22.2.4`), TypeScript `~6.0.2`, Tailwind CSS `^4.1.12` (`tailwindcss` + `@tailwindcss/postcss`), Vitest `^5.0.0`, RxJS `~7.8.0`, Karma absent (Vitest). No new frontend dependencies in Phase 1.

**Spec:** `/home/jame/Desktop/coding/coffee/docs/superpowers/specs/2026-10-30-frontend-auth-design.md`

## Global Constraints

- Frontend Angular versions (exact): `@angular/core ^22.2.0`, `@angular/common ^22.2.0`, `@angular/compiler ^22.2.0`, `@angular/platform-browser ^22.2.0`, `@angular/router ^22.2.0`, `@angular/forms ^22.2.0`, `@angular/ssr ^22.2.4`.
- TypeScript `~6.0.2`; Tailwind `tailwindcss ^4.1.12` + `@tailwindcss/postcss ^4.1.12`; Vitest `^5.0.0`; RxJS `~7.8.0`.
- Phase 1 adds no new frontend dependencies (proxy via Angular dev-server proxy config; no new packages).
- GraphQL endpoint: `POST /query` (GET also enabled) on backend `:8080`; JSON body; dev proxy `/query` → `http://localhost:8080` with cookie forwarding.
- Backend error codes: login failures → `UNAUTHENTICATED`; expired access → `TOKEN_EXPIRED`; refresh failure → `INVALID_REFRESH_TOKEN`; forbidden → `FORBIDDEN`; insufficient balance → `INSUFFICIENT_BALANCE`; not found → `NOT_FOUND`; invalid input → `BAD_USER_INPUT`; invalid state → `INVALID_STATE`; internal → `INTERNAL`.
- Token storage: client memory only; refresh token via backend-set HttpOnly cookie; no client-side persistence of refresh tokens.
- Design decisions pending human adjudication that Phase 1 must not contradict: backend I1 (refresh token exposure in `AuthPayload` body vs cookie-only design anti-goal) and M1 (expired-bearer+refresh-cookie pass-through contract change).

## Review Focus

1. Refresh trigger correctness against post-fix backend behavior (expired bearer + cookie → pass-through → protected ops surface `UNAUTHENTICATED`) — owning task 3.
2. Refresh rotation retry correctness (single retry; clear session on `INVALID_REFRESH_TOKEN`) — task 3.
3. Login error handling mapping (`UNAUTHENTICATED` → invalid-credentials UI) — task 4.
4. SSR render modes (`/login` prerender, `/` client) — task 4.
5. Dev proxy cookie forwarding — task 1.

## Tasks

### Task 1: Dev proxy for the GraphQL endpoint with cookie forwarding

**Files:**
- Create: `frontend/proxy.conf.json`
- Modify: `frontend/angular.json` (serve options → proxyConfig)

**Interfaces:**
- Consumes: none.
- Produces: dev proxy `/query` → `http://localhost:8080` with cookie forwarding (changeOrigin, secure false) for `ng serve`.

- [ ] **Step 1: Write the dev proxy config**

Create `frontend/proxy.conf.json`:
```json
{
  "/query": {
    "target": "http://localhost:8080",
    "changeOrigin": true,
    "secure": false
  }
}
```

- [ ] **Step 2: Wire the proxy into `ng serve`**

Add `proxyConfig: "proxy.conf.json"` (path relative to project root) to the `serve` options in `frontend/angular.json`.

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds with the proxy config present.

### Task 2: Auth state service (signals) + state ops

**Files:**
- Create: `frontend/src/app/services/auth-state.service.ts`
- Test: `frontend/src/app/services/auth-state.service.spec.ts`

**Interfaces:**
- Consumes: none.
- Produces: `AuthStateService` with `accessToken(): Signal<string | null>`, `isAuthenticated(): Signal<boolean>`, `setAccessToken(token: string)`, `clearSession(): void`. No persistence.

- [ ] **Step 1: Write failing tests for auth state**

```ts
// frontend/src/app/services/auth-state.service.spec.ts
it('starts unauthenticated with no access token', ...)
it('becomes authenticated after setAccessToken', ...)
it('clears the session after clearSession', ...)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: fail (service not implemented).

- [ ] **Step 3: Implement `AuthStateService`**

Use Angular signals (`signal`, `computed` if needed) inside a service.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/auth-state.service.ts frontend/src/app/services/auth-state.service.spec.ts
git commit -m "feat: add auth state service with signals"
```

### Task 3: Auth service + GraphQL service (login/refresh/logout + refresh orchestration)

**Files:**
- Create: `frontend/src/app/services/graphql.service.ts`
- Create: `frontend/src/app/services/auth.service.ts`
- Test: `frontend/src/app/services/auth.service.spec.ts`, `frontend/src/app/services/graphql.service.spec.ts`

**Interfaces:**
- Consumes: Task 2 `AuthStateService` (`accessToken`, `isAuthenticated`).
- Produces:
  - `GraphQLService.query<T>(req: { query: string; variables?: Record<string, unknown> }): Promise<{ data?: T; errors?: Array<{ code?: string; message?: string }> }>` — HttpClient POST `/query`; attaches `Authorization: Bearer <token>` when a token exists (for refresh, no bearer — cookie only).
  - `AuthService.login(email: string, password: string): Promise<{ accessToken: string }>` — calls `login` mutation; on success `setAccessToken`; on error (e.g. `UNAUTHENTICATED`) throws.
  - `AuthService.refreshSession(): Promise<boolean>` — calls `refreshToken` mutation (cookie-based); on success set token + return true; on `INVALID_REFRESH_TOKEN`/failure → clear session, return false.
  - `AuthService.logout(): Promise<void>` — calls `logout` mutation; clears session.

- [ ] **Step 1: Write failing tests for refresh orchestration and login**

```ts
// frontend/src/app/services/auth.service.spec.ts
it('refreshes once and retries on TOKEN_EXPIRED, updating the token on success', ...)
it('clears the session and returns false on INVALID_REFRESH_TOKEN', ...)
it('stores the access token after successful login', ...)
it('throws on failed login', ...)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: fail (services not implemented).

- [ ] **Step 3: Implement `GraphQLService` and `AuthService`**

HttpClient-based query wrapper; bearer attach; refresh orchestration per design.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/services/graphql.service.ts frontend/src/app/services/auth.service.ts frontend/src/app/services/auth.service.spec.ts frontend/src/app/services/graphql.service.spec.ts
git commit -m "feat: add auth graphql service with refresh orchestration"
```

### Task 4: Login screen, routes, guard, protected shell, logout, SSR render modes

**Files:**
- Create: `frontend/src/app/pages/login/login.component.ts`, `login.component.html`, `login.component.css`
- Create: `frontend/src/app/pages/shell/shell.component.ts`, `shell.component.html`, `shell.component.css`
- Create: `frontend/src/app/auth/auth.guard.ts`
- Modify: `frontend/src/app/app.routes.ts` (login public; `/` protected w/ guard)
- Modify: `frontend/src/app/app.routes.server.ts` (`/login` prerender; `/` client render)

**Interfaces:**
- Consumes: Task 3 `AuthService`/`AuthStateService`.
- Produces: `/login` screen behavior (real screen; submit → login; `UNAUTHENTICATED` error → invalid-credentials message; success → set session + navigate); `authGuard`; protected shell with logout control.

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/app/auth/auth.guard.spec.ts
it('redirects unauthenticated to /login', ...)

// frontend/src/app/pages/login/login.component.spec.ts
it('renders the login form', ...)
it('shows error message on UNAUTHENTICATED', ...)
it('navigates to / on successful login', ...)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: fail (components/guard not implemented).

- [ ] **Step 3: Implement login component, guard, routes, shell, logout wiring, SSR render modes**

Real (non-placeholder) login screen markup/styles; functional guard; routes; shell w/ logout button wired to `AuthService.logout` + clear + navigate to `/login`; SSR server routes update.

- [ ] **Step 4: Run tests and build**

Run: `cd frontend && npm test && npm run build`
Expected: pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/pages frontend/src/app/auth frontend/src/app/app.routes.ts frontend/src/app/app.routes.server.ts
git commit -m "feat: add login screen, auth guard, protected shell for auth flow"
```

### Task 5: Phase 1 frontend verification

**Files:** none new.

- [ ] **Step 1: Run Phase 1 frontend verification**

Run: `cd frontend && npm run build && npm test`
Expected: green.

- [ ] **Step 2: Manual end-to-end verification checklist (against live stack)**

Checklist: `task postgres:detached && task migrate && task seed`; backend on `:8080` (JWT_SECRET etc.); frontend `ng serve`; login with seeded user (bcrypt-verified demo password); protected `/` loads; logout clears. Document results in report; no new code unless broken.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-30-frontend-auth.md`. Please review the plan. Does it capture what you want?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end.

For this plan I recommend **subagent-driven**, because the tasks share interfaces (AuthState → AuthService → screens/guard) and each has its own test surface.

Does the plan capture what you want, and which approach should we use?
