# Sales Reports & Dashboard — Phase 3 (Complete Product Frontend continuation)

Phase 3 of the complete coffee-shop frontend: a **staff sales reports & dashboard** screen,
backed by real aggregate queries against the existing orders/payments tables. Backend +
frontend, executed against the existing Go/GraphQL service layer.

Status: designed 2026-11-03. Approvals pending (spec review + builder check).

## Intent — why this exists

The owner and manager want a morning glance at how the shop performed without a spreadsheet:
money in, orders placed, what's selling, when the rushes are, how customers pay, and what had to
be refunded. Today nothing in the app answers these questions — the data is all there, stored in
order snapshots and payment events, but no API or screen surfaces it.

## Goals

1. A single staff screen at `/reports` showing the six sections defined below, fixed layout.
2. Visibility gated on the existing `report.sales.read` permission (already granted to
   `owner_admin` and `manager` in the base migration) — backend enforces in the service layer;
   frontend hides nav and handles `FORBIDDEN` gracefully.
3. Reports computed live via SQL aggregates at request time — always fresh, no rollup tables,
   no cron jobs, no new migrations.
4. A seeded demo dataset so the screen demos meaningfully out of the box (45 days of synthetic
   orders/payments, clearly marked, idempotent).
5. Money is integer-cents/Decimal-string end-to-end; the server is the source of truth.

## Non-goals (explicit)

- **Profit / margin / COGS reports.** No cost data is stored anywhere; cannot be computed
  honestly. Out of scope.
- Customer-level analytics, loyalty, segments (customers are not linked to analytics here).
- Export to CSV/PDF, scheduled email reports, subscriptions, or real-time push updates.
  Manual refresh only.
- Multi-branch, multi-shop, or per-user report views.
- Tax / accounting reconciliation reporting.
- Any change to the order/payment **write** paths or their semantics.

## Anti-goals

- Do not introduce a second charting library. Exactly one: **Chart.js (+ ng2-charts)** (user's pick).
- Do not fabricate report rows when the database is empty — honest empty states per section.
- Do not gate access to the report screen by role name on the frontend; rely on the
  `report.sales.read` permission claim and backend enforcement.
- Do not add REST endpoints; GraphQL only.

## Constraints

- **Backend:** Go, gqlgen, Gin, `database/sql` + sqlc, Goose migrations as schema source of
  truth. Services own business rules; resolvers translate inputs/outputs; `repository/` owns
  persistence. Money domain type: `repository.Money` (int64 cents). Reports are read-only — no
  migrations required.
- **Frontend:** Angular 22, TS ~6.0, Tailwind 4, Apollo Client + GraphQL Code Generator
  (Phase 1/2 transport), Vitest. Phase 2 screens/patterns are the template (route guard,
  permission-gated nav, shared error surfacing, Decimal-string money formatting, lazy routes
  where added since a022bd7).
- **Permission:** `report.sales.read` exists and is granted to `owner_admin` and `manager`
  exactly as seeded in `20261027090000_coffee_shop.sql`. Cashier/barista/customer do not hold it.
- **Time source:** order/payment `created_at`, `completed_at`. Day/hour bucketing uses
  `shop_settings.timezone` when set and valid, else UTC. Shop is seeded with USD and UTC.
- **Seed marker:** demo rows carry `notes = 'report-demo'`.

## Approaches

- **Approach A — one aggregate GraphQL query, SQL-side (picked).** A `ReportsService` exposes a
  single `salesSummary` query backed by sqlc aggregate queries. Fresh data, small API surface,
  thin resolvers, matches the repo's service/repository pattern. Cost: a few aggregate queries
  per screen load — fine at coffee-shop scale.
- **Approach B — one granular query per chart.** Independent loads/errors per block, but extra
  round trips and resolver plumbing for zero real gain at this size. Rejected.
- **Approach C — pull rows into Go and aggregate in memory.** Rejected outright: drags all
  orders/payments through the service layer, wasteful and incompatible with scale.

## The design

### Fixed layout (Section order is fixed; server decides the windows)

**Section 1 — Today vs yesterday** — four stat cards, with +/- delta vs yesterday:

- **Net sales today** — gross = sum(succeeded `payment`-kind amounts); net = gross − succeeded
  `refund`-kind amounts, both windows [start, end) of today and yesterday in shop tz.
- **Orders today** — count of orders created on `today`, excluding `cancelled`.
- **Avg order value** — net sales ÷ orders (zero orders ⇒ 0.00).
- **Refunds today** — count and amount of succeeded refunds created today.

**Section 2 — 7-day revenue trend** — bar chart, net sales per calendar day: the last 7
calendar days ending today (today + the previous 6), zero-sales days rendered as `0.00` bars
(Chart.js bar chart).

**Section 3 — Top 5 items (trailing 7 calendar days ending today)** — grouped by
`product_name` in non-cancelled orders; columns: quantity sold and revenue (sum of
`line_total`), sorted by quantity desc then revenue desc. Rendered as a compact list with
proportional bars (no extra dep needed beyond what Chart.js already covers).

**Section 4 — Sales by hour (trailing 7 calendar days ending today)** — orders per hour of day
(0–23), all non-cancelled orders, bar chart (Chart.js). Answers the "when do we staff up"
question.

**Section 5 — Payment method split (trailing 30 calendar days ending today)** — doughnut chart
(Chart.js): succeeded `payment`-kind amounts grouped by method (`cash|card|online|other`), with
count and amount per method.

**Section 6 — Refunds (trailing 30 calendar days ending today)** — count, total amount, and the
5 most recent refunds (order number, amount, created date) in a compact table.

Currency and timezone come from `shop_settings` (`currency`, `timezone`), returned with the
payload (no separate frontend round trip).

### GraphQL additions (`backend/graph/schema.graphqls`)

```graphql
type SalesSnapshot {
  netSales: Decimal!
  grossSales: Decimal!
  orderCount: Int!
  averageOrderValue: Decimal!
  refundCount: Int!
  refundTotal: Decimal!
}

type DayPoint {
  day: String!      # YYYY-MM-DD in shop tz
  netSales: Decimal!
  orderCount: Int!
}

type TopItem {
  productName: String!
  quantity: Int!
  revenue: Decimal!
}

type HourPoint {
  hour: Int!        # 0–23
  orderCount: Int!
}

type PaymentMethodPoint {
  method: PaymentMethod!
  count: Int!
  amount: Decimal!
}

type RefundSummary {
  count: Int!
  total: Decimal!
  recent: [RefundLine!]!
}

type RefundLine {
  orderNumber: ID!
  amount: Decimal!
  createdAt: Time!
}

type SalesSummary {
  currency: String!
  timezone: String!
  today: SalesSnapshot!
  yesterday: SalesSnapshot!
  revenueTrend: [DayPoint!]!
  topItems: [TopItem!]!
  salesByHour: [HourPoint!]!
  paymentSplit: [PaymentMethodPoint!]!
  refunds: RefundSummary!
}

# Added to existing:
type Query {
  ...
  salesSummary: SalesSummary!
}
```

One field, no arguments — windows are fixed by design (Section list above). Aggregation happens in
SQL on the server.

### Backend implementation

- New `ReportsRepository` (Go interface, implemented by `repository/`) with methods corresponding
  to the blocks; queries live in a new `backend/db/queries/reports.sql` consumed by sqlc
  (regenerate via `task generate` / `sqlc generate`).
- Aggregate queries compute sums/counts/groups directly in SQL; day buckets via
  `date_trunc('day', t AT TIME ZONE $tz)` style expressions (tz parameterized, non-user-controlled
  beyond the shop_settings value, validated at read time — set of validates vs IANA where
  practical; fallback UTC on invalid values, never SQL injection risk via parameterization).
- `ReportsService` implements the read path:
  `principalFor` → `requirePermission(principal, "report.sales.read")` (same pattern as
  `paymentService`), then repository calls, then assemble `SalesSummary`
  (avg order value with zero-order guard → 0; Decimal↔int64 cents math; no float math).
- Resolver: thin, maps via existing scalars; errors through `graph/errors.go` mapping
  (`ErrForbidden` → `FORBIDDEN`, `ErrUnauthenticated` → `UNAUTHENTICATED`).
- **No migrations** — reporting is read-only over existing tables (`orders`, `order_items`,
  `payments`, `shop_settings`).

### Seeded demo data — `backend/db/seeds/<date>-seed-report-orders.sql`

- Applied by the existing seed workflow (`task seed` runs
  `goose -dir db/seeds -no-versioning postgres "$DATABASE_URL" up` over the glob), so a new,
  correctly named file is picked up automatically — use the existing convention
  `<yyyymmddhhmmss>_seed_report_orders.sql`; no Taskfile edits required.
- Idempotent: `DELETE FROM orders WHERE notes = 'report-demo';` (cascades to `order_items`,
  `order_item_modifiers`, `payments`) then re-insert.
- 45 days of history. Within each day, generate orders with an hour profile weighted toward
  mornings (07:00–11:00), lunch (12:00–14:00), and evenings (16:00–19:00);
  `SELECT setseed(<fixed>)` + `generate_series` for determinism across re-seeds.
- Each order picks 1–4 lines from existing seeded products (documented prices in the seed are
  authoritative), status mostly `completed` with a few `accepted/preparing/cancelled` scattered,
  `completed_at` set for completed; `notes = 'report-demo'` on every generated row;
  `created_at` within the 45-day window; totals computed from the summed line totals
  (tax = 0 per seeded `tax_rate`).
- Payments: ~90% of completed orders get a `SUCCEEDED` `payment`-kind row; methods split roughly
  card 55% / cash 35% / online 10%; some `pending`/`failed` retained so status distribution looks
  real; **3 succeeded refunds** in the trailing 30 days (random small fraction of amounts).
- Seed prints a summary line (orders inserted, refunds, window).

### Frontend implementation

- New staff route: **`/reports`** — `authGuard` + lazy `loadComponent`; nav link in the shell
  shown when claims are absent **or** `report.sales.read` present (Phase 2 pattern), with
  `FORBIDDEN` handling on the screen itself. Backend remains the boundary.
- New operations file `frontend/src/graphql/operations/reports.graphql`; codegen regenerated via
  `npm run codegen` (staleness check in `npm test` already
  enforces freshness); consumes typed `SalesSummaryDocument`.
- One Apollo query (`salesSummary`) loaded on screen mount; a manual **Refresh** button
  re-runs it. No polling, no subscriptions.
- Layout: two-column-ish responsive grid — four stat cards (top row), 7-day trend chart
  (full width bar), top-5 list + sales-by-hour chart (two columns), payment split doughnut +
  refunds table (two columns). All sections render honest **empty states** when the DB is empty
  ("No sales yet — take your first order and this fills in").
- Money display: reuse the existing Decimal-string→label path; **no float math** anywhere.
  Currency symbol: `$` when `currency === 'USD'`, otherwise the ISO code prefix (e.g. `EUR 12.00`);
  documented as a builder call.
- Errors: `UNAUTHENTICATED` → redirect to login (Phase 1 flow); `FORBIDDEN` → "You need the
  report.sales.read permission to view sales reports."; transport/INTERNAL → shared error banner
  (Phase 2 pattern) with Try again.
- Charts via **Chart.js + ng2-charts** (`npm install chart.js ng2-charts` + adapter wiring per
  ng2-charts docs). Imported only in the reports chunk; verify bundle after build and keep the
  Angular budget clean (raise the initial-bundle warning only if the reports chunk itself exceeds
  it — expected: reports chunk ~ Chart.js size, initial stays at Phase 2 baseline).
- Spec: Vitest specs for rendering sections from mocked `salesSummary`, empty-state rendering,
  `FORBIDDEN` handling, refresh refetch, and money formatting; no float math asserted.

### Testing & verification

- **Backend:** service-layer tests — anonymous → unauthenticated; principal missing
  `report.sales.read` → forbidden; happy path aggregation against a test DB fixture (follow
  existing service test harness patterns), verifying sums/deltas/top-item ordering and the
  zero-order avg guard.
- **Backend:** `go test ./...` green; `sqlc generate` diff committed; gqlgen regenerated.
- **Seed smoke:** `task migrate && task seed` run twice on a fresh DB — counts unchanged,
  no duplicates (idempotent), and `salesSummary` returns non-empty numbers afterwards.
- **Frontend:** `npm test` green (including codegen staleness check), `npm run build` clean,
  `npm run codegen:check` pass; cascades from any auth/Apollo change covered by existing specs.
- **Phase 2 discipline:** no backend `.graphqls` schema edits beyond the additions above;
  money integrity preserved; no new dependencies beyond Chart.js + ng2-charts.

## Decisions made by the owner (human partner)

- Scope = sales reports & dashboard, six sections, fixed layout. (2026-11-03)
- Chart.js (+ ng2-charts) over ECharts and over hand-rolled SVG. (2026-11-03)
- Seeded demo report data (45 days), Approach A (single aggregate query, SQL-side). (2026-11-03)
- Builder-check answers (2026-11-03, "defaults are fine"):
  - **Refund attribution:** refunds net against **net sales of the day the refund was recorded**
    (refund `created_at`), not the original order day — cash-drawer view.
  - **Windows:** 7-day trend = today + previous 6 calendar days, zero-sales days rendered as
    `0.00`; "trailing 7 days" / "trailing 30 days" / refunds / payment split = the N calendar
    days ending today (inclusive); top items and hour data use the trailing 7-calendar-day
    window (incl. zero-order hours).
  - **Sales-by-hour:** order counts per hour, **all non-cancelled orders** (staffing sees
    demand as it happens), shop timezone.

## Decisions I made (builder call unless you disagree)

- Net sales = succeeded PAYMENT − succeeded REFUND; order count excludes CANCELLED;
  avg order value = net sales ÷ orders.
- **Revenue/refund/order buckets key on `created_at`** (the offline model records and settles
  in the same event — `settled_at` is `now()` at recording time for succeeded payments, NULL
  until then). `settled_at` is not used as a bucket key.
- **AOV rounding:** round half-up to the nearest cent; zero orders ⇒ 0.00. No float math.
- Day/hour bucketing uses `shop_settings.timezone` with UTC fallback (applies to all
  sections; replaces any earlier UTC-only note — hour histogram is also shop-tz).
- **Shop timezone seam:** extend the shared `repository.ShopSettings` struct with
  `Timezone string` mapped from the existing sqlc `GetShopSettings` query (the query already
  selects `timezone`); no reports-specific settings read; existing callers unchanged.
- Owner and manager see the same screen (both hold `report.sales.read`); no extra owner-only
  section — profit data doesn't exist.
- Hour histogram = orders (staffing question), not revenue.
- Currency display: `$` for USD else ISO code prefix.
- No polling; manual refresh button only.
- `/reports` nav item gated on claim presence with auth-only fallback (Phase 2 pattern);
  backend enforcement only.
- Seed marker `notes='report-demo'` with delete-then-insert idempotency **in correct FK
  order**: first `DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE
  notes = 'report-demo')` (payments.order_id is ON DELETE RESTRICT), then `DELETE FROM
  orders WHERE notes = 'report-demo'` (order_items/order_item_modifiers cascade); seed never
  sets `order_number` (GENERATED ALWAYS AS IDENTITY).
- Seed files are applied by `goose -dir db/seeds -no-versioning ... up` (glob), so a new
  `db/seeds/<timestamp>_seed_report_orders.sql` needs no Taskfile changes — filename must
  match the goose glob pattern.
- **No new index for Phase 3** — aggregate windows are trivial at demo/shop scale; if usage
  grows, a follow-up migration can add `orders(created_at)` / `payments(created_at)` indexes.
- Route lazy-loaded; keep initial bundle within Phase 2 baseline + verify reports chunk size.

## Open items for the builder

None beyond decisions above — anything discovered there is a minor call and should be marked
"builder call" in the implementation. If anything materially changes scope, stop and ask.

## Execution order (hint for the plan, not a commitment)

1. Backend: seed file (data to test against) → ReportsRepository + sqlc → ReportsService →
   resolvers + schema regenerate → backend tests.
2. Frontend: codegen docs → `/reports` route + screen + charts → specs → build/bundle check.
3. Task-level reviews + final whole-branch review per SDD flow, then finish.
