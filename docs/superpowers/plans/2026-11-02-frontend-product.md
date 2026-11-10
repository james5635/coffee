# Complete Product Frontend Implementation Plan (Phase 2 of the Complete Frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 complete product frontend for the coffee shop app — menu browsing, ordering/checkout, prep queue, payments/refunds, staff screens — on top of the merged Phase 1 auth flow, using Apollo Client + GraphQL Code Generator, frontend-only against the existing backend schema.

**Architecture:** Phase 2 keeps Phase 1's auth architecture (signals-based auth state, `AuthService` refresh orchestration, functional guard, boot restore) and swaps the transport layer for Apollo Client (`HttpLink` via `apollo-angular`, `withCredentials: true`, auth via Apollo `setContext` link reading `AuthStateService`), fed by GraphQL Code Generator typed documents (`typescript-operations` + `typescript-apollo-angular` from the backend schema). Product screens consume auth-aware operations through `AuthService.query`.

**Tech Stack:** Angular 22 (`@angular/core ^22.2.0`, `@angular/common ^22.2.0`, `@angular/compiler ^22.2.0`, `@angular/platform-browser ^22.2.0`, `@angular/router ^22.2.0`, `@angular/forms ^22.2.0`, `@angular/ssr ^22.2.4`), TypeScript `~6.0.2`, Tailwind CSS `^4.1.12` (+ `@tailwindcss/postcss ^4.1.12`), Vitest `^5.0.0`, RxJS `~7.8.0`; Apollo Client (`@apollo/client`, `apollo-angular`); GraphQL Code Generator (`@graphql-codegen/cli`, plugins `typescript-operations`, `typescript-apollo-angular`); Go/gqlgen backend untouched (Phase 2 is frontend-only).

**Spec:** /home/jame/Desktop/coding/coffee/docs/superpowers/specs/2026-11-01-frontend-product-design.md

## Global Constraints

- Phase 2 is frontend-only: no backend GraphQL schema, service, repository, or database changes.
- Angular versions: `@angular/core ^22.2.0`, `@angular/common ^22.2.0`, `@angular/compiler ^22.2.0`, `@angular/platform-browser ^22.2.0`, `@angular/router ^22.2.0`, `@angular/forms ^22.2.0`, `@angular/ssr ^22.2.4`; TypeScript `~6.0.2`; Tailwind `css ^4.1.12` + `@tailwindcss/postcss ^4.1.12`; Vitest `^5.0.0`; RxJS `~7.8.0`.
- Phase 2 frontend dependencies (user decision, supersede Phase 1 no-new-deps constraint): `@apollo/client`, `apollo-angular`, `@graphql-codegen/cli`.
- GraphQL: `POST /query`; Apollo `HttpLink` `uri: '/query'`, `withCredentials: true`; dev proxy `/query` → backend already forwards cookies.
- Money: GraphQL `Decimal` is a Go string formatted `"12.99"` (dollars.cents, 2 dp); frontend parses to integer cents; no float math; backend is source of truth.
- Error codes: `BAD_USER_INPUT`, `INVALID_STATE`, `NOT_FOUND`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `FORBIDDEN`, `INSUFFICIENT_BALANCE`, `INTERNAL`.
- Auth: access token in memory; refresh via HttpOnly cookie; boot restore; guard; `AuthService.query` orchestrates refresh-on-expiry → retry-once → clear-on-failure; product operations flow through it.
- Human decisions/final builder direction (Phase 2): one coherent product pass; customer checkout places order then staff handles payment (no online payment step); order tracking = immediate confirmation, not persistent live tracking; pending-order acceptance = manager/owner via existing transition; staff screens map to actual backend permissions (cashier: order+payment ops; barista: prep queue + permitted transitions; manager: manager ops; owner: owner ops); READY→COMPLETED not implemented until backend can retrieve READY orders.

## Review Focus

1. Money: GraphQL `Decimal` strings → integer cents handling in any UI aggregation/display.
2. Error surfacing: `FORBIDDEN` and other product-op errors passing through `AuthService`/`AuthError` to UI.
3. Guest/anonymous flows: public menu reads and guest order placement (no bearer); protected staff ops guarded.
4. Order status transitions: `INVALID_STATE` mapping when advancing status.
5. Refresh orchestration over Apollo transport: `TOKEN_EXPIRED`/`UNAUTHENTICATED` → refresh → retry, using generated documents.

---

## Tasks

### Task 1: Adopt Apollo Client + GraphQL Code Generator transport

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/app/app.config.ts`
- Modify: `frontend/src/app/services/graphql.service.ts`
- Create: `frontend/codegen.ts`
- Create: `frontend/src/graphql/operations/` (generated-document inputs, e.g. product operations + auth operations as codegen documents)

**Interfaces:**
- Consumes: Phase 1 `AuthStateService` (`accessToken`, `isAuthenticated`, `setAccessToken`, `clearSession`, `whenInitialized`), Phase 1 `AuthService` (orchestration), backend GraphQL schema/SDL.
- Produces: Apollo client configured (`provideApollo`, `HttpLink` `uri: '/query'`, `withCredentials: true`, `InMemoryCache`); `GraphQLService` (or `AuthService`) executing typed documents via Apollo; auth-aware refresh orchestration over the new transport.

- [ ] **Step 1: Write failing tests for the Apollo-backed transport**

```ts
// frontend/src/app/services/graphql.service.spec.ts (updated)
// expect the Apollo-backed service to attach bearer from AuthStateService,
// send with withCredentials, and execute through Apollo.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL (transport not Apollo-backed yet).

- [ ] **Step 3: Implement the Apollo provider configuration**

- `frontend/src/app/app.config.ts`: add `provideApollo` with `HttpLink` + `InMemoryCache`; `httpLink.create({ uri: '/query', withCredentials: true })`.

- [ ] **Step 4: Implement the Apollo-backed GraphQL service**

- Rewrite `frontend/src/app/services/graphql.service.ts` to execute typed documents through Apollo (bearer attach via `setContext` from `AuthStateService`; cookie forwarding via `withCredentials`).

- [ ] **Step 5: Add GraphQL Code Generator config and dependencies**

- `frontend/codegen.ts`: schema from backend, documents glob, plugins `typescript-operations` + `typescript-apollo-angular`.
- Add deps: `@apollo/client`, `apollo-angular`, `@graphql-codegen/cli`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test && npm run build`
Expected: PASS / build green.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/src/app/app.config.ts frontend/src/app/services/graphql.service.ts frontend/codegen.ts
git commit -m "feat: adopt Apollo Client and GraphQL Code Generator for GraphQL transport"
```

### Task 2: Menu browsing screens (public) via generated operations

**Files:**
- Create: `frontend/src/app/pages/menu/*` (menu component, templates, styles, spec).
- Modify: `frontend/src/app/app.routes.ts` (add `/menu` public route; adjust shell landing).
- Modify: `frontend/src/app/app.routes.server.ts` (SSR render modes for new public route).

**Interfaces:**
- Consumes: Task 1 transport + generated operations; Phase 1 auth state.
- Produces: public menu screen rendering categories/products/modifiers via `categories` / `products`.

- [ ] **Step 1: Write failing tests** for menu component rendering from mocked auth-aware query results.
- [ ] **Step 2: Run tests → verify fail.**
- [ ] **Step 3: Implement menu screen.**
- [ ] **Step 4: Run tests → pass.**
- [ ] **Step 5: Commit.**

### Task 3: Ordering/checkout — place order, confirmation, staff payment

**Files:**
- Create: `frontend/src/app/pages/order/*` (checkout/cart → `placeOrder`, confirmation; staff payment `recordPayment`).
- Modify: relevant services for order/payment operations via generated docs; `AuthService` orchestration reuse.

**Interfaces:**
- Consumes: Task 1 (transport), Task 2 (menu data), Phase 1 `AuthService.query`.
- Produces: customer order placement (`placeOrder`) with confirmation; staff payment recording (`recordPayment`) with `INSUFFICIENT_BALANCE` handling.

- [ ] **Step 1: Write failing tests** for order placement flow (guest + authenticated) and payment flow (staff).
- [ ] **Step 2: Run tests → verify fail.**
- [ ] **Step 3: Implement checkout/payment UI + service ops.
- [ ] **Step 4: Run tests → pass.**
- [ ] **Step 5: Commit.**

### Task 4: Staff prep queue + order status advancement

**Files:**
- Modify: shell/staff screens (or new `frontend/src/app/pages/prep/*`).
- Modify: order/advance status ops via generated docs.

**Interfaces:**
- Consumes: Task 1, Task 3 (order data).
- Produces: prep queue UI (`preparationQueue`) + `advanceOrderStatus` actions; `INVALID_STATE` surfacing.

- [ ] **Step 1: Write failing tests** for prep queue rendering + transition handling.
- [ ] **Step 2: Run tests → verify fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests → pass.**
- [ ] **Step 5: Commit.**

### Task 5: Payments/refunds + staff screens + error surfacing

**Files:**
- Modify: payments/refunds screens (`frontend/src/app/pages/payments/*`).
- Modify: error handling in `AuthService`/services for `FORBIDDEN`, `INSUFFICIENT_BALANCE`, etc.

**Interfaces:**
- Consumes: Tasks 3, 4, 1.
- Produces: staff payment/refund actions (`recordPayment`, `issueRefund`) with graceful error handling; documented incomplete workflows.

- [ ] **Step 1: Write failing tests** for refund/payment error paths.
- [ ] **Step 2: Run tests → verify fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests → pass.**
- [ ] **Step 5: Commit.**

### Task 6: Routing/SSR integration, shell/nav, full verification

**Files:**
- Modify: `frontend/src/app/app.routes.ts`, `frontend/src/app/app.routes.server.ts`, shell component.

**Interfaces:**
- Consumes: Tasks 2–5 screens + Task 1 transport.

- [ ] **Step 1: Write failing tests** for route wiring (public `/menu`, protected staff, SSR modes).
- [ ] **Step 2: Run tests → verify fail.**
- [ ] **Step 3: Implement routing/SSR/nav wiring.
- [ ] **Step 4: Run full frontend suite + build.
- [ ] **Step 5: Commit.

---

## Self-review

1. **Spec coverage:** every Phase 2 design goal (menu, ordering/checkout, prep queue, payments/refunds, staff screens, auth integration, money, constraints, decisions, builder direction) maps to tasks above? Gaps: guest tracking limitation intentionally not built (documented); READY→COMPLETED intentionally not built (documented).
2. **Step scan:** each step unambiguous, one action, checkable; tests named with assertions; verification commands stated.
3. **Type consistency:** Task 1 produces typed transport consumed by Tasks 2–5; AuthService orchestration interfaces preserved.
4. **Review Focus:** five focus areas each have owning task tests.
5. **Proportion:** plan covers spec without transcribing code.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-02-frontend-product.md`. Please review the plan. Does it capture what you want?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end.

For this plan I recommend **subagent-driven**, because the tasks share interfaces (Apollo transport → AuthService → screens) and each has its own test surface.

Does the plan capture what you want, and which approach should we use?
