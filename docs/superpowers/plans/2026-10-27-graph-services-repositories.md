# Coffee Shop GraphQL Services and Repositories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Todo GraphQL API with menu, order, preparation, and payment flows backed by service and repository modules.

**Architecture:** GraphQL resolvers map requests and results, services enforce workflow and authorization rules, and PostgreSQL repositories wrap generated sqlc queries. Order and payment workflows use transaction-scoped repositories to persist related changes atomically.

**Tech Stack:** Go, gqlgen, PostgreSQL, database/sql, sqlc, Goose.

**Spec:** `docs/superpowers/specs/2026-10-27-graph-services-repositories-design.md`

## Global Constraints

- Preserve the Resolver → service → repository → sqlc flow.
- Never accept client-supplied authoritative prices or totals.
- Keep money arithmetic decimal-safe; do not use `float64`.
- Do not expose protected order data or mutations without a principal and the required permission.
- Do not implement login, token issuance, external payment processing, inventory management, or staff administration in this work.
- Add no tests unless the user asks for tests or verification; use code generation and compilation checks for this implementation.

## Review Focus

- Forged or missing principal: protected reads and mutations fail closed; owned-order reads and customer cancellation are scoped to the principal (Tasks 2, 5, 6).
- Invalid product/modifier combinations or unavailable products: order creation rejects them and writes no partial order (Task 5).
- Decimal edge cases: modifiers, quantities, and half-up tax rounding produce the documented totals without binary floating point (Task 5).
- Invalid payment/refund amount or order state: payment balances remain within the order total and refund totals remain within settled payments (Task 6).
- Concurrent order/payment changes: conditional state/balance updates and transactions prevent duplicate or over-applied writes (Tasks 1, 5, 6).

---

## File Structure

- `backend/db/queries/*.sql`: add only the persistence operations not present in the current sqlc query set.
- `backend/repository/`: define focused persistence interfaces and PostgreSQL adapters, including transaction-scoped implementations.
- `backend/service/domain/`: define category, product, modifier, order, item, payment, and enum values shared by services and repositories.
- `backend/service/`: implement menu reads, order workflows, payment workflows, domain errors, and permission checks.
- `backend/utils/auth/`: hold the request principal and context helpers; no credential or token handling.
- `backend/graph/schema.graphqls`, `backend/graph/resolver.go`, `backend/graph/schema.resolvers.go`, `backend/graph/generated.go`, `backend/graph/model/models_gen.go`: replace Todo with the accepted coffee shop API and gqlgen output.
- `backend/graph/scalar/decimal.go`: serialize decimal money values as a GraphQL Decimal string.
- `backend/main.go`: connect PostgreSQL, construct adapters/services, and pass them into gqlgen without adding an authentication scheme.
- `backend/go.mod`, `backend/go.sum`: add the PostgreSQL `database/sql` driver required by the server.

## Task 1: Add transaction-safe data access operations

**Files:**
- Modify: `backend/db/queries/menu.sql`
- Modify: `backend/db/queries/orders.sql`
- Modify: `backend/db/queries/inventory.sql` only if a shared inventory helper is needed; inventory feature operations stay out of the API.
- Generate: `backend/db/*.sql.go`, `backend/db/models.go`

**Interfaces:**
- Produces sqlc operations to fetch a sellable product with current price, fetch modifier groups and modifiers associated with that product, find/create a customer by `user_id`, obtain an order and scoped order lists, summarize succeeded payments/refunds, and perform conditional status/payment changes.
- Order/payment lock queries use `SELECT ... FOR UPDATE` inside the relevant transaction. A failed conditional write returns zero affected rows so the service can report invalid state or balance.

- [x] Add queries needed to validate product availability and selected modifier ownership/availability and to retrieve group selection limits.
- [x] Add order/payment queries for read scopes, successful payment/refund totals, and conditional writes that protect status and balance invariants.
- [x] Preserve the existing generated query contracts and run `sqlc generate` from `backend/`.
- [x] Review generated params and nullability to ensure IDs, optional customer fields, and decimal values retain the expected Go types.

## Task 2: Define repository and principal interfaces

**Files:**
- Create: `backend/repository/interfaces.go`
- Create: `backend/repository/postgres.go`
- Create: `backend/repository/postgres_menu.go`
- Create: `backend/repository/postgres_orders.go`
- Create: `backend/repository/postgres_payments.go`
- Create: `backend/service/domain/models.go`
- Create: `backend/utils/auth/principal.go`
- Create: `backend/service/errors.go`

**Interfaces:**
- `utils/auth.Principal` contains `UserID int64`, roles, and a set of permission codes; `utils/auth.WithPrincipal(ctx, principal)` and `utils/auth.PrincipalFromContext(ctx)` are the only identity transport helpers.
- `repository.MenuRepository` methods: `ListCategories(ctx) ([]domain.Category, error)`, `ListProducts(ctx, categoryID *int64) ([]domain.Product, error)`, and `GetSellableProduct(ctx, productID int64) (domain.Product, error)`; `domain` is `backend/service/domain`, and products include ordered available modifier groups/options.
- `repository.OrderRepository` methods: `GetOrder(ctx, id int64) (domain.Order, error)`, `GetCustomerByUserID(ctx, userID int64) (domain.Customer, error)`, `ListPreparationQueue(ctx) ([]domain.Order, error)`, and `WithinOrderTx(ctx, func(OrderTx) error) error`.
- `OrderTx` methods: `GetShopSettings(ctx)`, `GetOrCreateCustomer(ctx, userID)`, `GetSellableProduct(ctx, productID)`, `CreateOrder(ctx, domain.Order)`, `AddOrderItem(ctx, domain.OrderItem)`, `AddOrderItemModifier(ctx, domain.OrderItemModifier)`, `GetOrderForUpdate(ctx, orderID)`, and `SetOrderStatus(ctx, orderID, expectedStatus, targetStatus)`.
- `repository.PaymentRepository` exposes `WithinPaymentTx(ctx, func(PaymentTx) error) error`; `PaymentTx` exposes `GetOrderForUpdate(ctx, orderID)`, `GetPaymentBalanceForUpdate(ctx, orderID)`, `RecordSuccessfulPayment(ctx, domain.Payment)`, and `CreateRefund(ctx, domain.Payment)`.
- PostgreSQL adapters map generated sqlc rows into `backend/service/domain` values; services do not depend on generated `db` types.
- Domain errors distinguish invalid input/state, not found, unauthenticated, forbidden, and insufficient/over-refunded balance.

- [x] Define the focused repository interfaces and transaction callback behavior.
- [x] Implement the PostgreSQL adapter using `*sql.DB`, generated query methods, and context-aware transactions with rollback on callback failure.
- [x] Define the principal context contract and typed service errors; do not add HTTP headers or caller-controlled identity extraction.

## Task 3: Replace the Todo schema and generate gqlgen types

**Files:**
- Modify: `backend/graph/schema.graphqls`
- Modify: `backend/gqlgen.yml` only for Decimal scalar mapping if required
- Create: `backend/service/contracts.go` for interfaces and service input values consumed by GraphQL
- Generate: `backend/graph/generated.go`
- Generate: `backend/graph/model/models_gen.go`
- Modify: `backend/graph/resolver.go`

**Interfaces:**
- Queries: `categories`, `products(categoryId)`, `order(id)`, `preparationQueue`.
- Mutations: `placeOrder(input)`, `advanceOrderStatus(orderId, status)`, `recordPayment(input)`, `issueRefund(input)`.
- `Decimal` is serialized as a base-10 string. GraphQL IDs map to database `int64` values through explicit parsing helpers.
- Graph result types expose only public menu/order/payment fields; never expose password hashes or permission internals.

- [x] Define GraphQL enums, inputs, and result types matching the accepted design and existing database constraints.
- [x] Define menu/order/payment service interfaces and input types in `backend/service/contracts.go` so gqlgen's resolver root can depend on stable contracts before implementations exist.
- [x] Implement Decimal marshal/unmarshal as a string-only scalar with syntax validation.
- [x] Configure the resolver root to receive menu/order/payment service interfaces.
- [x] Run gqlgen generation and preserve only generated output plus handwritten resolver implementations.

## Task 4: Implement menu reads and GraphQL resolvers

**Files:**
- Create: `backend/service/menu.go`
- Modify: `backend/graph/schema.resolvers.go`
- Modify: `backend/graph/resolver.go`

**Interfaces:**
- `MenuService.Categories(ctx) ([]Category, error)`
- `MenuService.Products(ctx, categoryID *int64) ([]Product, error)`
- Product results include active modifier groups and available modifiers in configured order.
- Public menu reads require no principal.

- [x] Implement menu service reads over `MenuRepository`.
- [x] Map category and product GraphQL fields to service outputs without database access in resolvers.
- [x] Regenerate gqlgen if resolver signatures change and keep resolvers as input/output adapters.

## Task 5: Implement order creation, reads, and status transitions

**Files:**
- Create: `backend/service/orders.go`
- Create: `backend/service/money.go`
- Create: `backend/service/authorization.go`
- Create: `backend/service/authorization.go`
- Create: `backend/service/authorization.go`
- Modify: `backend/graph/schema.resolvers.go`
- Modify: `backend/repository/postgres_orders.go`

**Interfaces:**
- `OrderService.PlaceOrder(ctx, PlaceOrderInput) (Order, error)`
- `OrderService.GetOrder(ctx, id int64) (Order, error)`
- `OrderService.PreparationQueue(ctx) ([]Order, error)`
- `OrderService.AdvanceStatus(ctx, id int64, target OrderStatus) (Order, error)`
- `PlaceOrderInput` carries product IDs, positive quantities, selected modifier IDs, order type, notes, and optional guest/customer display details; it never carries prices.

- [x] Implement exact fixed-point arithmetic at the database's two-decimal scale using integer cents and integer tax-rate units; reject unsupported precision rather than rounding input silently.
- [x] Validate each product, modifier group membership, modifier availability, required selections, and min/max selection counts before persistence.
- [x] Calculate item snapshots, subtotal including modifier deltas, and half-up tax after discounts (zero discount in this API); create order, customer link if authenticated, items, and modifier snapshots in one transaction.
- [x] Enforce order read scopes: all orders for `order.read.all`, caller-created orders for `order.read.assigned`, customer-linked orders for `order.read.own`, queue-only access for `order.read.preparation_queue`.
- [x] Redact customer email and payment records for preparation-queue-only order results.
- [x] Enforce the status transition graph and role-specific behavior. Require `order.update_status` for staff transitions; require `order.cancel` for cancellation, with customer cancellation limited to their own pending order.
- [x] Implement GraphQL resolvers for place, read, queue, and status operations.

## Task 6: Implement payments, refunds, and safe GraphQL errors

**Files:**
- Create: `backend/service/payments.go`
- Modify: `backend/graph/schema.resolvers.go`
- Create: `backend/graph/errors.go`
- Modify: `backend/repository/postgres_payments.go`

**Interfaces:**
- `PaymentService.RecordPayment(ctx, input) (Payment, error)` requires `payment.accept` and permits only pending/accepted orders.
- `PaymentService.IssueRefund(ctx, input) (Payment, error)` requires `payment.refund` and caps successful refunds at successful payments net of prior refunds.

- [x] Implement transactional balance checks and immutable successful offline payment/refund events; use conditional writes/row locking to avoid overpayment under concurrent requests.
- [x] Map typed domain errors to stable GraphQL extension codes and generic messages for unexpected database errors.
- [x] Implement GraphQL payment and refund resolvers without exposing a card-charging claim or gateway lifecycle.

## Task 7: Wire the server to PostgreSQL and the services

**Files:**
- Modify: `backend/main.go`
- Modify: `backend/go.mod`
- Modify: `backend/go.sum`
- Modify: `compose.yaml` so the backend service receives the Compose PostgreSQL URL and waits for database health.

**Interfaces:**
- Server startup reads `DATABASE_URL`, opens and pings PostgreSQL, constructs the repository adapter and services, and supplies them to `graph.Resolver`.
- Context has no principal by default; protected GraphQL operations therefore deny access until a real authentication integration injects one.

- [x] Add `github.com/jackc/pgx/v5/stdlib`, open the connection with driver name `pgx`, and initialize it with startup error handling.
- [x] Construct repositories, services, gqlgen schema, and Gin handlers through dependency injection.
- [x] Ensure server startup fails clearly when the database is unavailable and does not start with nil service dependencies.

## Task 8: Generate and compile the implementation

**Files:** all generated and implementation files above.

- [x] Run `sqlc generate` from `backend/` after final SQL query edits.
- [x] Run `go run github.com/99designs/gqlgen generate` from `backend/` after final schema edits.
- [x] Run `go build ./...` from `backend/` to check package and generated-code integration.
- [x] Review the final diff for stale Todo schema/resolver artifacts, accidental credentials, floating-point money conversions, and protected operations that do not check principal/permission.
