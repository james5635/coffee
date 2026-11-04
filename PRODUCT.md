# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Staff-first, guests welcome. The primary users are the owner, manager, cashier, and barista of a single independent coffee shop — taking orders at the counter, working the preparation queue, taking and refunding payments, and reading sales reports during or after a shift. Guests browse the menu and place orders without an account; the public screens serve them, but design decisions prioritize the person mid-shift over the casual browser.

## Product Purpose

A single-shop, self-hosted coffee-shop operations app, end to end: public menu browsing, guest and authenticated ordering, a preparation queue with validated status transitions, payments and refunds recorded offline at the counter, and sales reporting — one app from the first order of the day to close-of-day numbers. Success means staff run a full shift without paper tickets or spreadsheets, and guests order from their phone while standing at the counter.

## Positioning

Single-shop, self-hosted ops: a no-subscription, no-vendor-lock-in alternative to POS/SaaS stacks. One independent café gets ordering, prep, offline payments/refunds, and reports from a Docker Compose setup it fully owns. It is deliberately not a multi-shop SaaS, and not a payments processor — it records payment events; it never charges a card.

## Operating Context

One independent coffee shop, counter service.

- Cashier takes the order (guest or authenticated), confirms the total, and hands off to the counter for payment recording.
- Barista works a queue of accepted orders and moves them through preparation to ready.
- Manager/owner checks the day at a glance: today vs yesterday, weekly trend, top items, hourly load, payment split, refunds.
- Offline-friendly by design: no payment-provider calls; amounts, totals, and tax are computed by the server.
- Runs locally via Docker Compose (PostgreSQL) + Taskfile (`task dev`, `task migrate`, `task seed`, `task verify`); seeded demo accounts and a 45-day demo report dataset ship in the repo.

## Capabilities and Constraints

Confirmed capabilities (all shipped and tested):

- Public menu browsing — categories, products, modifier groups; guest order placement.
- Staff: ordering/checkout with confirmation, prep queue (advance ACCEPTED→PREPARING→READY, cancel), payments & refunds (record counter payments, issue refunds; `INSUFFICIENT_BALANCE` handling), sales reports dashboard (`report.sales.read`).
- Auth: login/refresh/logout with short-lived access JWT (memory only) + HttpOnly refresh cookie, boot restore, auth guard; 401 refresh orchestration.
- Staff screens hide actions the current user cannot perform (decoded JWT claims + auth-only fallback); the backend service layer enforces permissions (`order.read.preparation_queue`, `order.update_status`, `payment.accept`, `payment.refund`, `report.sales.read`) and remains the permission boundary.

Technical constraints:

- Money is integer cents everywhere (domain `repository.Money`; GraphQL `Decimal` as string). No float math anywhere; the server is the source of truth for prices, totals, tax.
- No online/card charging. Payments are recorded, never initiated.
- No migrations for reporting (read-only over existing orders/payments); Goose migrations are the schema source of truth elsewhere.
- Single shop. No branches, no multi-tenancy.
- Protected operations require a principal; the bearer middleware exists and populates it (`backend/main.go` `bearerMiddleware`); anonymous calls fail closed.

Explicitly undecided / not built (future work must not fabricate):

- Customer accounts beyond the `customer` role; loyalty, order history for customers.
- Profit/margin reporting — cost prices do not exist; sales reports deliberately show revenue/volume, not margin.
- Inventory operations, staff administration (users/roles), menu CRUD, shop settings UI.
- Ready→completed order retrieval; persistent order tracking for guests (immediate confirmation only).
- The product name is a placeholder ("Coffee Shop"); no external brand commitment exists yet.

## Brand Commitments

None beyond the current state: keep the placeholder name "Coffee Shop", the warm minimal tone, and the existing stone/amber identity. Nothing else is binding, and no assets are contractually fixed.

## Evidence on Hand

- Working app: Angular frontend + Go/GraphQL backend + PostgreSQL, docker-composed; `task dev` runs it.
- Demo accounts, password `password123`: `owner@coffee.local`, `manager@coffee.local` (both hold `report.sales.read`), `cashier@coffee.local`, `barista@coffee.local`, `customer@coffee.local`.
- Idempotent 45-day demo sales dataset for the reports dashboard (`notes='report-demo'` seed).
- Product scope/role plan: `docs/plans.md`; shipped scope and runbook: `README.md`.
- No external customer testimonials, sales benchmarks, or press exist — do not invent any.

## Product Principles

1. Counter first — every screen must work in the busiest minute of the day, at a till, with one hand.
2. One honest tool — never fake a missing capability (charging cards, inventory) to look complete.
3. The backend is the boundary — hiding a button is courtesy; permissions are enforced server-side.
4. Self-hosted and boring — Docker, Go, Postgres, Node; no SaaS bills, no vendor lock-in, deployable by one person.
5. Respect the shift — staff are mid-service between customers; flows are few, obvious, and forgiving of mistakes (refunds, cancellations).
