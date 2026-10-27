# Coffee Shop GraphQL Services and Repositories

## Intent

Replace the placeholder Todo GraphQL API with the first working coffee shop API. Keep resolvers focused on GraphQL mapping, put workflow rules in services, and put persistence behind repositories implemented with the generated sqlc queries.

## Goals

- Browse active categories, available products, and product modifier choices.
- Place a guest or account-linked order using product and modifier IDs. Calculate prices from the database and persist the order, items, and selected modifier snapshots atomically.
- Read an order and its items for permitted callers; list the preparation queue.
- Advance orders through valid preparation states.
- Record cash/card/other payments and refunds through the current payment model, with payment writes kept atomic and totals checked against the order balance.
- Use domain-focused repository and service interfaces so GraphQL resolvers do not contain SQL or business rules.
- Return useful validation and not-found errors without leaking database details.

## Non-goals

- Login, password reset, token issuance, or payment-gateway integration.
- Staff, category, product, supplier, or inventory management mutations.
- Automatic recipe-based stock decrement or loyalty points.
- Branch support, discounts, delivery dispatch, and reporting.
- Preserving the example Todo schema/API.

## Constraints and calls

- Keep Go, gqlgen, PostgreSQL, Goose, and sqlc; do not add a GraphQL or database framework.
- Use the approved flow: Resolver → service → repository → sqlc.
- Use `database/sql` transactions for multi-row order and payment workflows. Repositories receive a transaction-scoped sqlc query set so callers cannot accidentally persist only part of an order.
- Money is represented as decimal strings by generated sqlc types. Service calculations must use fixed-point/decimal-safe arithmetic; do not convert prices to `float64`.
- Guest order creation is allowed. If a caller is authenticated, its user identity may be attached to the customer/order where appropriate.
- The current server has no authentication middleware. Protected reads and mutations must fail closed unless an authenticated principal is supplied through request context. The implementation adds the context contract and authorization checks but does not invent a login/token scheme. Wiring a real authentication provider is a separate integration.
- Staff actions use the existing role/permission data, checked by services (including `order.update_status` and `payment.accept` / `payment.refund`). Public menu reads and guest order creation do not require staff permissions.
- Access mapping follows the seeded permissions: `order.read.all` can read any order; `order.read.assigned` reads orders created by that user; `order.read.own` reads orders linked to the caller's customer record; `order.read.preparation_queue` grants the preparation queue only. No public order lookup by numeric ID is exposed.
- Preparation-queue-only callers receive order items and preparation instructions, but customer email and payment records are omitted from their order results.
- Payment methods in scope are the existing `cash`, `card`, `online`, and `other` values. No external processor is present; this API records payment lifecycle state and does not claim to charge a card.
- GraphQL keeps IDs as the existing numeric database IDs encoded as GraphQL IDs.

## Approaches

1. **Resolver → service → repository → sqlc (chosen).** Keeps GraphQL transport concerns, business rules, and database operations local to their own modules. Supports transactions and service-level authorization while allowing repository adapters to be replaced in focused tests.
2. **Resolver → repository → sqlc.** Smaller initial code footprint, but order validation, state transitions, and payment constraints would leak into resolvers or repositories and be difficult to reuse outside GraphQL.

The first approach was selected in the conversation because the requested implementation includes both services and repositories.

## GraphQL surface

Queries:

- `categories` and `products(categoryId)` for active menu data.
- `order(id)` for a caller permitted to read the order.
- `preparationQueue` for staff with queue-read permission.

Mutations:

- `placeOrder(input)` with optional customer details, order type, notes, product IDs, quantities, modifier IDs, and special instructions. The client does not submit authoritative prices or totals.
- `advanceOrderStatus(orderId, status)` with a validated transition; only staff with status-update permission may call it.
- `recordPayment(input)` for staff-authorized payment records; `issueRefund(input)` for staff-authorized refunds. Service logic checks order state and remaining refundable/collectable amount.

GraphQL order and payment results include stable database IDs, order number, status, currency, calculated totals, timestamps, item snapshots, and payment records where appropriate. Do not expose password hashes or internal authorization data in GraphQL types.

## Module interfaces

- `graph.Resolver` receives constructed menu, order, and payment service interfaces; it has no database handle.
- Menu service exposes menu reads and maps repository rows to GraphQL-facing domain values.
- Order service exposes menu-backed order creation, permitted order reads, queue reads, and state transitions. It validates product availability, modifier ownership/availability and selection constraints; obtains current prices itself; computes subtotal/tax/total; then persists an order and snapshots in one transaction.
- Payment service records successful offline payments/refunds as explicit payment events only after validating the order and current settled balance in a transaction. Pending/failed lifecycle mutations remain internal to a future gateway integration.
- Repositories expose focused operations over domain rows and transactions. The PostgreSQL adapter uses sqlc-generated queries and may add SQL queries needed to fetch sellable products, validate modifiers, and summarize successful payments.
- Request context carries a principal with user ID and resolved permissions. Services reject protected calls if it is absent or lacks the required permission. Resolver code does not infer identity from caller-supplied GraphQL fields.

## Order behavior

- New orders begin in `pending`.
- Allowed status transitions are `pending → accepted → preparing → ready → completed`, plus cancellation from `pending` or `accepted`. Invalid transitions return a domain validation error. Every transition requires the applicable permission and ownership check.
- Cancellation is separately authorized by `order.cancel`; customers can cancel only their own pending order, while staff may cancel pending or accepted orders. Baristas may only advance accepted → preparing → ready → completed; managers and owners may use any valid transition.
- Order item names, prices, and selected modifier names/price deltas are snapshots, preserving receipts if menu data later changes.
- Place-order persistence is atomic: any invalid line or failed insert leaves no order behind.
- An authenticated order uses the existing customer row for that user, creating one when absent. New customer records use the user's name/email; guest-supplied name/email are stored as order snapshots and do not create an account. Supplied details do not overwrite an existing customer profile.
- Line subtotal includes selected modifier deltas multiplied by item quantity. Tax uses the subtotal after discount (discounts are not part of this API yet), rounded to the nearest cent using half-up rounding. The service copies the current shop currency onto the order.
- Payments may be recorded only while an order is pending or accepted, and cannot exceed the remaining balance. Refunds can be issued against any order with a successful net payment and cannot exceed that net amount. Payment/refund events are immutable rows, and successful payments/refunds are reflected in balance checks within a transaction.

## Error behavior

Services return typed errors for invalid input/state, missing records, missing identity, and insufficient permission. GraphQL maps these to stable client-safe messages/codes. Unexpected repository errors are logged by the server and returned as a generic internal error.

## Files likely to change

- `backend/graph/schema.graphqls`, generated gqlgen models/server, and handwritten resolvers.
- New `backend/utils/auth` principal context helper.
- New feature-focused `backend/service` and `backend/service/domain` packages, plus `backend/repository` adapters using `backend/db`.
- Additional sqlc query files for sellable product/modifier validation and order/payment summaries.
- `backend/main.go` to construct the graph and repositories from the configured database connection. Database connection configuration itself should use the existing `DATABASE_URL` convention.

## Left to the builder

- Keep interfaces small; use an in-memory adapter for service behavior tests only if it does not duplicate repository semantics.
- Use a decimal-safe arithmetic approach compatible with Go's standard library and the existing module dependencies; do not add a dependency solely for formatting decimal strings if integer minor units are sufficient for the supported currencies.
- Configure gqlgen error codes and server logging without exposing SQL errors.
- Ensure the unauthenticated server refuses protected operations until real auth middleware is connected.

## Builder-review calls

- Payment is accepted only before preparation begins; refunds remain possible after completion or cancellation, subject to the successful net payment balance.
- Tax is applied after discounts and rounded half-up to cents; because the current API has no discount input, the taxable base is currently the calculated subtotal.
- Read permissions map to all orders, cashier-created orders, a customer's own linked orders, and the preparation queue as described above.
- Authenticated customer records are found or created by user ID and are not silently overwritten from order input.
