# Design: Complete Product Frontend (Phase 2 of the Complete Frontend)

Date: 2026-11-01
Part of: frontend work for the coffee shop app (Phase 2 of the complete frontend); builds on Phase 1 (auth-flow frontend, merged to `main` via merge commit `0dc7f81`).

## Intent and why

Phase 1 delivered the auth-flow frontend — real login screen, in-memory access token, HttpOnly refresh cookie, boot-time silent refresh, refresh-on-expiry + single retry orchestration, auth guard, logout, dev proxy, SSR render modes — and closed via fix wave, scoped re-review, and merge to `main`.

The backend now ships the complete product API surface alongside the token machinery:

- Public menu reads: `categories`, `products(categoryId)`.
- Ordering: `placeOrder`, `order(id)`.
- Preparation: `preparationQueue`, `advanceOrderStatus`.
- Payments/refunds: `recordPayment`, `issueRefund`.
- Auth: `login`, `refreshToken`, `logout` (done in Phase 1).

Phase 2 delivers the **full product frontend**: the screens that let a coffee shop actually run — browse menu, take/guest-order, pay, track, staff prep, staff payments/refunds — built on top of the now-working auth loop.

## Goals

1. Customer-facing menu browsing: categories, products, modifier groups; public.
2. Ordering/checkout: cart → `placeOrder` (guest or authenticated customer) → `recordPayment`; order totals computed and snapshotted server-side.
3. Order status visibility: order detail/tracking wired to `order(id)` and preparation queue (`preparationQueue` / `advanceOrderStatus`).
4. Payments/refunds: `recordPayment` (PAYMENT) and `issueRefund` (REFUND) against order balances; server-enforced balance checks (`INSUFFICIENT_BALANCE`).
5. Staff screens: barista prep queue; cashier/manager order + payment/refund operations.
6. Auth integration: every product operation flows through the Phase 1 `AuthService.query` orchestration (bearer attach, refresh-on-expiry, single retry, clear-on-failure); protected ops are guarded, public ops are not.

## Non-goals

- Backend staff-admin mutations (menu CRUD, staff accounts/roles, shop settings, sales reports) — not implemented in the backend; frontend must not build against absent mutations.
- Inventory operations UI (backend has inventory foundation only).
- Customer accounts / loyalty programs (backend absent).
- Reports/sales dashboards (backend absent).
- Any backend changes in Phase 2 (frontend-only phase by prior decision).

## Constraints

- Frontend stack: Angular 22 (`@angular/core ^22.2.0`, `@angular/common ^22.2.0`, `@angular/compiler ^22.2.0`, `@angular/platform-browser ^22.2.0`, `@angular/router ^22.2.0`, `@angular/forms ^22.2.0`, `@angular/ssr ^22.2.4`), TypeScript `~6.0.2`, Tailwind CSS `^4.1.12`, Vitest `^5.0.0`, RxJS `~7.8.0`.
- **Phase 2 adopts Apollo Client** (`@apollo/client` + `apollo-angular` provider integration) as the GraphQL transport; Phase 1's hand-rolled fetch-based `GraphQLService` is replaced by an Apollo-backed service. Phase 2 therefore introduces new frontend dependencies (user decision; supersedes Phase 1's no-new-deps constraint for Phase 2).
- Apollo Angular setup: `provideApollo` with `HttpLink` (`from 'apollo-angular/http'`) and `InMemoryCache`; `httpLink.create({ uri: '/query', withCredentials: true })` (cookie forwarding for the HttpOnly refresh cookie); requires Angular `provideHttpClient`.
- GraphQL endpoint: `POST /query` via the Phase 1 `GraphQLService`/`AuthService` transport; dev proxy already forwards cookies.
- **Phase 2 adopts GraphQL Code Generator** (`@graphql-codegen/cli`) with the `typescript-operations` and `typescript-apollo-angular` plugins; schema sourced from the backend GraphQL schema/SDL and documents supplied via globs; generated typed documents feed the Apollo Client transport. Phase 1 hand-written mutation documents (e.g., `LOGIN_MUTATION`) are candidates for migration into the generated document set; product operations are authored as codegen documents.
- Money: GraphQL `Decimal` scalar is implemented in Go as a string (`backend/graph/scalar/decimal.go`) formatted as `"12.99"` (dollars.cents, 2 dp) via `repository.FormatMoney`; the scalar only unmarshals strings. Frontend must treat Decimal fields as strings and parse to integer cents for display/math; the backend remains the source of truth; no float math on money.
- Tax rate: string, scaled decimal (up to 5 dp) via `repository.FormatTaxRate`; display/pass through server-computed values.
- Error codes (`backend/graph/errors.go`): `BAD_USER_INPUT`, `INVALID_STATE`, `NOT_FOUND`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `FORBIDDEN`, `INSUFFICIENT_BALANCE`, `INTERNAL`.
- Auth: access token in memory; refresh via HttpOnly cookie; boot restore; guard; all product mutations/reasons should go through `AuthService.query`.

## Approaches considered

- **Phase 2 as one coherent product pass (chosen by human partner).** Build menu, ordering/checkout, prep queue, payments/refunds, and staff screens together as one phase on top of the merged Phase 1 auth flow.
- Split into sub-phases (e.g., Phase 2a customer-facing ordering, Phase 2b staff operations) — considered during brainstorming; the human partner answered the final open question by choosing the coherent pass, so splitting is deferred as a possible future reorganization, not a Phase 2 deliverable.
- Backend-first (implement missing backend staff-admin mutations before frontend) — rejected as Phase 2 scope (frontend-only phase by prior decision; would balloon scope).

## The coherent product pass — scope and screen map

Phase 2 delivers the following surfaces, all consuming the existing backend operations:

1. **Menu browsing (public).** Categories → products (with `modifierGroups` → `modifiers`) via `categories` / `products` queries. Display names, descriptions, prices (Decimal strings), sort orders, modifier group rules (min/max/required), modifier price deltas.

2. **Ordering/checkout.** Cart construction → `placeOrder(input: PlaceOrderInput!)` with `orderType` (TAKEAWAY/DINE_IN/DELIVERY), optional `customerName`/`customerEmail` (guest ok), `notes`, items (`productId`, `quantity`, `modifierIds`, `specialInstructions`). Server computes subtotal/discount/tax/total and snapshots. Payment at/after order: `recordPayment(input: RecordPaymentInput!)` (method CASH/CARD/ONLINE/OTHER, amount, externalReference) — balance-checked (`INSUFFICIENT_BALANCE`).

3. **Order status / tracking.** Order detail via `order(id: ID!)`; staff prep queue via `preparationQueue` + `advanceOrderStatus(orderId, status)` (transitions e.g. ACCEPTED→PREPARING→READY→COMPLETED; CANCELLED path guarded by permission/state rules; `INVALID_STATE` mapped).

4. **Payments/refunds.** `recordPayment` (PAYMENT) and `issueRefund` (REFUND, method, amount, externalReference) against order balances; refunds constrained server-side.

5. **Staff screens.** Barista (prep queue + status advancement), cashier/manager (order/payment/refund operations over the same flows).

## Decisions made during brainstorming

- Phase 2 is a **single coherent product pass** (human decision), superseding the earlier split question; sub-phase splitting is parked as a future organizational option, not a Phase 2 deliverable.
- Phase 2 is **frontend-only**: no backend changes; must not reference backend mutations that do not exist (menu CRUD, staff accounts, reports).
- **Money representation**: frontend parses GraphQL `Decimal` strings (e.g., `"12.99"`) into integer cents for display and any client-side aggregation; all authoritative calculations remain server-side.
- **Auth integration**: Phase 2 product mutations/reasons flow through `AuthService.query` so Phase 1 refresh/retry behavior applies unchanged; guard protects staff screens; guest ordering uses public path (no bearer). With Apollo Client adopted in Phase 2, the auth-aware layer sits on top of the Apollo transport: an Apollo `setContext` link reads the in-memory access token from `AuthStateService` and attaches `Authorization: Bearer <token>`; the refresh orchestration (`AuthService.query`: refresh-on-expiry → retry-once) drives Apollo `mutate`/`query` calls.
- **Apollo Client + GraphQL Code Generator adoption** (human decisions, Phase 2): Apollo Client (`@apollo/client` + `apollo-angular`) with `HttpLink` (`uri: '/query'`, `withCredentials: true`) and `InMemoryCache`; GraphQL Code Generator (`@graphql-codegen/cli`, plugins `typescript-operations` + `typescript-apollo-angular`) generating typed operation documents from the backend schema; hand-written mutation documents are candidates for migration into generated documents.
- **Boot/refresh**: see Phase 1 design (`2026-10-30-frontend-auth-design.md`).

## Builder check — answers from human partner (2026-11-01) and final builder direction

The builder check surfaced seven open questions; the human partner answered each, and issued final direction for the builder:

1. **JWT claims for roles/permissions** — Decision: decode JWT claims client-side if the access token contains roles/permissions; use decoded claims to control navigation and hide unauthorized UI actions; backend remains source of truth; fall back to authentication-only gating plus `FORBIDDEN` handling when claims are absent. Client-side decoding is **not** a security boundary.
2. **Customer checkout payment** — Decision: place order first; payment handled by staff. Flow: submit order → show confirmation + payment status → staff handles payment via supported backend operation. No online payment step (backend does not support it).
3. **Staff order discovery** — Decision: use existing queries only; no complete payment/refund management screen promised; limit to legitimately accessible orders; refund management incomplete without backend support.
4. **Order tracking** — Decision: immediate order confirmation, not persistent live tracking; keep returned order in frontend state; no promise of reopen/retrieve.
5. **Pending-order acceptance** — Decision: manager/owner accepts pending orders via existing transition operation; not exclusively in barista queue.
6. **Staff screen mapping** — Decision: follow actual backend permissions (cashier: order + payment ops; barista: prep queue + permitted transitions; manager: manager-authorized ops; owner: owner ops); no cashier refunds/unrestricted access; guest orders manager/owner-only where backend enforces.
7. **Barista READY→COMPLETED** — Decision: do not implement until backend can retrieve READY orders; document as known limitation.

Final builder direction: (1) Phase 2 remains frontend-only; (2) never simulate unsupported backend capabilities; (3) hide/disable actions the current user cannot perform; (4) handle `FORBIDDEN` and other API errors gracefully; (5) clearly document incomplete workflows (persistent tracking, refunds, completed-order discovery, READY→COMPLETED); (6) keep implementation aligned with the existing backend schema and Phase 1 services.

## What's left to the builder

- Task decomposition for the coherent product pass (menu, ordering/checkout, prep queue, payments/refunds, staff screens, routing/SSR adjustments, tests).
- Component/service breakdown (signals-based state, forms, cart state).
- Route design (`/menu`, `/order`, `/orders/:id`, `/kitchen`, payments/staff routes; SSR render-mode adjustments for new public/protected routes).
- Detailed screen flows per role (customer vs staff) and error-surface mapping in UI.
- Apply the human partner's decisions above and the final builder direction while planning/building.
