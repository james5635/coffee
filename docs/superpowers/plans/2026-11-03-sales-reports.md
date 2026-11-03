# Sales Reports & Dashboard Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a staff-only Sales reports & dashboard (`/reports`) computed live from the existing orders/payments data, seeded with 45 days of demo rows, executed as backend (Go/gqlgen/sqlc) + frontend (Angular/Apollo/Chart.js) work.

**Architecture:** One aggregate GraphQL field `salesSummary` on the backend — a `ReportsService` enforcing `report.sales.read` and a `ReportsRepository` (new `reports.sql` sqlc queries, SQL-side aggregates) — consumed by one lazy staff route in the Angular app using the Phase 2 patterns (permission-gated nav, Decimal-string money, lazy `/reports`, Chart.js + ng2-charts for the three charts). Seed data is a deterministic, idempotent goose seed file; no migrations.

**Tech Stack:** Go 1.2x + gqlgen + Gin + sqlc + Goose (backend); Angular 22 + Apollo Client + GraphQL Code Generator + Chart.js + ng2-charts (frontend); PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-03-sales-reports-design.md` (read it with this plan; the answers to the builder-check questions are recorded there).

## Global Constraints

- Money is integer cents in the domain layer (`repository.Money`); parsed/formatted with `ParseMoney`/`FormatMoney`; **no float math anywhere**; GraphQL `Decimal` scalar is a Go `string` ("12.99").
- **No backend schema migrations in Phase 3** — reporting is read-only over existing tables. (One intentional exception class: none.)
- **No new frontend dependencies** beyond exactly `chart.js` + `ng2-charts`.
- Backend service-layer permission checks only (`requirePermission` pattern, e.g. `report.sales.read`); frontend hiding is advisory; backend is the boundary.
- Angular versions stay `^22.2.0` / TS `~6.0.2`; Tailwind `^4.1.12`; Apollo Client + Code Generator as already adopted in Phase 2.
- GraphQL only — no REST endpoints.
- Demo seed rows carry `notes = 'report-demo'` (orders) and `external_reference = 'report-demo'` (payments); seed is idempotent by explicit deletes, never by guessing.
- Day/hour bucketing uses `shop_settings.timezone` (fallback UTC); all buckets key on `created_at`; refunds attribute to **the day the refund was recorded**; windows = calendar days ending today; zero-sales days/hours render as 0.
- AOV = net sales ÷ orders, round **half-up** to the cent; zero orders ⇒ 0.00.

## Review Focus

Failure modes the spec implies, most likely first, each pinned by a task's tests:

1. **Zero-data dashboard** — reasonable person expects honest empty states, not `0.00` fake success or a crash. → Task 5 component specs assert per-section empty states; Task 1 seed is opt-in, not silent reliance.
2. **Refund netting wrong** — today's number must be gross − refunds; a sign error corrupts every card. → Task 3 service tests assert net math with refunds recorded in the window.
3. **Timezone mis-bucketing at day boundaries** — worst with UTC vs local shop tz mismatch. → Task 3 tests with injected clock and explicit tz; Task 2 SQL uses parameterized `AT TIME ZONE`.
4. **Unauthorized access** — cashier/barista/customer must see nothing useful; reasonable expectation: graceful explanation, never raw error. → Task 3 (permission deny test), Task 4 (FORBIDDEN resolver mapping test), Task 5 (FORBIDDEN screen state test).
5. **Zero orders today** — AOV must render `0.00`, never NaN/Infinity. → Task 3 zero-order test; Task 5 money-format assert.
6. **AOV fraction-of-a-cent rounding** — half-up to cent everywhere. → Task 3 rounding test (e.g. net 350¢ ÷ 3 ⇒ 117¢).

---

### Task 1: Seed demo report data (idempotent)

**Files:**
- Create: `backend/db/seeds/20261103090000_seed_report_orders.sql`

**Interfaces:**
- Consumes: existing `orders` / `order_items` / `payments` / `customers` / `products` tables; `notes='report-demo'` marker.
- Produces: deterministic 45-day demo dataset used by manual QA of every later task.

- [ ] **Step 1: Write the seed file**

Required content (write exactly this logic as SQL — deterministic, no `random()`):

1. `SELECT setseed(0.42);` first.
2. Idempotency block (exact order, required by `ON DELETE RESTRICT` on `payments.order_id`):
   ```sql
   DELETE FROM payments WHERE external_reference = 'report-demo';
   DELETE FROM payments WHERE external_reference = 'report-demo-refund';
   DELETE FROM payments
   WHERE order_id IN (SELECT id FROM orders WHERE notes = 'report-demo');
   DELETE FROM orders WHERE notes = 'report-demo';
   ```
   (`order_items` / `order_item_modifiers` cascade from `orders`.)
3. Generate days `d` from 44 days ago through today (`generate_series` on `date_trunc('day', now() AT TIME ZONE 'UTC')`).
4. For each day, insert **3 orders** at hours `07:15`, `12:30`, `18:10` UTC; customers: `NULL`; `customer_name = 'Report Demo'`; `currency = 'USD'`; `order_type` rotates `['takeaway','dine_in','delivery']` by `(day_index + n) % 3`; status: `completed` for 29 of 30 generated per day+slot, `cancelled` for 1-in-10 deterministic slot permutation (e.g. slot 3 on days whose index ≡ 4 (mod 10)), else `completed`.
5. Items per order: rotate deterministic product selection — order `(day_index, n)` picks products `(day_index*3 + n) % products_count`, `(day_index*3 + n + 7) % products_count`, `(day_index*3 + n + 13) % products_count` from `SELECT id, name, price FROM products ORDER BY id` (join to resolve, never hard-code ids); quantities `1, 2, 1` respectively when the order draws 3 lines (vary count: 1 line for slot 1, 2 lines for slot 2, 3 lines for slot 3).
6. `subtotal = Σ(line_total)`, `discount_amount = 0`, `tax_amount = 0`, `total = subtotal`; `created_at = <day 07:15|12:30|18:10> UTC`, `updated_at = created_at`, `completed_at = created_at + interval '15 minutes'` for completed rows.
7. **Payments** for every completed demo order, method rotating `['card','cash','card','online','cash','card']` by `(day_index + n)`: one `SUCCEEDED` `payment`-kind row, `amount = order.total`, `external_reference = 'report-demo'`. Plus: on days index ≡ 2 (mod 15) one demo order gets a `FAILED` payment instead (amount 0.01 not allowed — use order total), and on days index ≡ 7 (mod 30) one gets a `PENDING` payment — demo realism for status counts.
8. **3 refunds in the trailing 30 days**: pick the latest three completed demo payments (deterministic ids via `ORDER BY created_at DESC LIMIT 3`); for each insert one `SUCCEEDED` `refund`-kind row with `amount = ROUND(payment.amount * 0.2, 2)`, `external_reference = 'report-demo-refund'` (also matched by the Step 2 delete's second predicate pattern — note: Step 2 deletes only `report-demo`; **also** delete `external_reference = 'report-demo-refund'` there). Update Step 2 accordingly.
- [ ] **Step 2: Idempotency + data verification** (no Go code; verification only)

Run:
```bash
DATABASE_URL='postgres://coffee:coffee@localhost:5432/coffee?sslmode=disable' task migrate
DATABASE_URL='postgres://coffee:coffee@localhost:5432/coffee?sslmode=disable' task seed
DATABASE_URL='postgres://coffee:coffee@localhost:5432/coffee?sslmode=disable' task seed
```
Verify with psql:
```sql
SELECT count(*), sum(total) FROM orders WHERE notes='report-demo';   -- identical after 2nd seed (135 per spec: 45 days × 3)
SELECT count(*) FROM payments WHERE external_reference LIKE 'report-demo%';  -- stable across re-seeds
SELECT count(*) FILTER (WHERE kind='refund') FROM payments WHERE external_reference='report-demo-refund';  -- 3
```
Expected: stable counts across the two `seed` runs; 135 demo orders; exactly 3 demo refunds.

- [ ] **Step 3: Commit**

```bash
git add backend/db/seeds/20261103090000_seed_report_orders.sql
git commit -m "seed: add idempotent 45-day demo report dataset"
```

---

### Task 2: Reports repository read path (sqlc + Postgres impl)

**Files:**
- Create: `backend/db/queries/reports.sql`
- Modify: `backend/repository/interfaces.go` (add `ReportsRepository`)
- Modify: `backend/repository/models.go` (add report models; extend `ShopSettings` with `Timezone string`)
- Modify: `backend/repository/postgres_orders.go:164-175` (map `row.Timezone` into `ShopSettings`)
- Create: `backend/repository/postgres_reports.go`
- Create: `backend/repository/postgres_reports_test.go` (unit mapper tests only)

**Interfaces:**
- Consumes: `repository.Money`, `repository.PaymentMethod`, `repository.Order`, `repository.ShopSettings`.
- Produces:
  ```go
  type ReportsRepository interface {
      GetShopSettings(context.Context) (ShopSettings, error)
      PeriodTotals(context.Context, time.Time, time.Time) (PeriodTotals, error)
      SalesTrend(context.Context, string, int) ([]DayPoint, error)
      TopItems(context.Context, time.Time, time.Time, int) ([]TopItem, error)
      HourlyOrderCounts(context.Context, time.Time, time.Time, string) ([]HourPoint, error)
      PaymentMethodTotals(context.Context, time.Time, time.Time) ([]PaymentMethodPoint, error)
      RefundTotals(context.Context, time.Time, time.Time) (RefundTotals, error)
      RecentRefunds(context.Context, int) ([]RefundLine, error)
  }
  type PeriodTotals struct { GrossSales Money; Refunds Money; RefundCount int; OrderCount int }
  type RefundTotals struct { Count int; Total Money }
  type DayPoint struct{ Day string; NetSales Money; OrderCount int }
  type TopItem struct{ ProductName string; Quantity int; Revenue Money }
  type HourPoint struct{ Hour int; OrderCount int }
  type PaymentMethodPoint struct{ Method PaymentMethod; Count int; Amount Money }
  type RefundLine struct{ OrderNumber int64; Amount Money; CreatedAt time.Time }
  // Full Report payload models (added to models.go in this task; Tasks 3–4 consume them):
  type SalesSnapshot struct {
      NetSales Money; GrossSales Money; OrderCount int; AverageOrderValue Money
      RefundCount int; RefundTotal Money
  }
  type SalesSummary struct {
      Currency, Timezone string
      Today, Yesterday SalesSnapshot
      Trend []DayPoint
      TopItems []TopItem
      Hours []HourPoint
      Split []PaymentMethodPoint
      Refunds RefundTotals
      RecentRefunds []RefundLine
  }
  ```

- [ ] **Step 1: Write the failing mapper test**

```go
func TestMapPaymentMethodPoints(t *testing.T) {
    rows := []db.PaymentMethodTotalsRow{
        {Method: "card", Count: 4, Amount: "123.45"},
        {Method: "cash", Count: 2, Amount: "10.00"},
    }
    got, err := mapPaymentMethodPoints(rows)
    // expect: Money(12345), Money(1000), methods preserved, order preserved
}
```
Also: `TestMapDayPoints`, `TestMapTopItems` (assert `Money` parse), `TestMapHourlyOrderCounts` (zero-hour passthrough).
- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && go test ./repository -run 'TestMap' -v`  → FAIL (undefined mappers)

- [ ] **Step 3: Write `reports.sql`** (params `timestamptz`, tz as `text`)

```sql
-- name: PeriodTotals :one
SELECT COALESCE(SUM(amount) FILTER (WHERE kind='payment' AND status='succeeded'),0)::numeric(14,2)::text AS gross,
       COALESCE(SUM(amount) FILTER (WHERE kind='refund'  AND status='succeeded'),0)::numeric(14,2)::text AS refunds,
       COUNT(*) FILTER (WHERE kind='refund' AND status='succeeded')::int AS refund_count
FROM payments
WHERE created_at >= $1 AND created_at < $2;

-- name: PeriodOrderCount :one
SELECT COUNT(*)::int AS order_count
FROM orders
WHERE created_at >= $1 AND created_at < $2 AND status <> 'cancelled';

-- name: SalesTrend :many
WITH days AS (
    SELECT generate_series(
        date_trunc('day', now() AT TIME ZONE $2) - ($1 - 1) * interval '1 day',
        date_trunc('day', now() AT TIME ZONE $2),
        interval '1 day')::date AS d)
SELECT to_char(d.d, 'YYYY-MM-DD') AS day,
       (SELECT (COALESCE(SUM(amount) FILTER (WHERE kind='payment' AND status='succeeded'),0)
              - COALESCE(SUM(amount) FILTER (WHERE kind='refund' AND status='succeeded'),0))
           ::numeric(14,2) FROM payments
        WHERE (created_at AT TIME ZONE $2)::date = d.d)::text AS net_sales,
       (SELECT COUNT(*) FROM orders
         WHERE (created_at AT TIME ZONE $2)::date = d.d AND status <> 'cancelled')::int AS order_count
FROM days d
ORDER BY d.d;

-- name: TopItems :many
SELECT oi.product_name,
       SUM(oi.quantity)::int AS quantity,
       COALESCE(SUM(oi.line_total),0)::numeric(14,2)::text AS revenue
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.created_at >= $1 AND o.created_at < $2 AND o.status <> 'cancelled'
GROUP BY oi.product_name
ORDER BY quantity DESC, revenue DESC
LIMIT $3;

-- name: HourlyOrderCounts :many
SELECT EXTRACT(hour FROM created_at AT TIME ZONE $3)::int AS hour, COUNT(*)::int AS order_count
FROM orders
WHERE created_at >= $1 AND created_at < $2 AND status <> 'cancelled'
GROUP BY 1 ORDER BY 1;

-- name: PaymentMethodTotals :many
SELECT method, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(14,2)::text AS amount
FROM payments
WHERE kind='payment' AND status='succeeded' AND created_at >= $1 AND created_at < $2
GROUP BY method ORDER BY method;

-- name: RefundTotals :one
SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(14,2)::text AS total
FROM payments
WHERE kind='refund' AND status='succeeded' AND created_at >= $1 AND created_at < $2;

-- name: RecentRefunds :many
SELECT o.order_number, p.amount::numeric(14,2)::text AS amount, p.created_at
FROM payments p JOIN orders o ON o.id = p.order_id
WHERE p.kind='refund' AND p.status='succeeded'
ORDER BY p.created_at DESC LIMIT $1;
```

- [ ] **Step 4: Add `ReportsRepository` to `interfaces.go` and models to `models.go`** exactly as the Produces block; implement `postgres_reports.go`:
  - `PeriodTotals` also calls the generated `PeriodOrderCount` and merges into `PeriodTotals{GrossSales, Refunds, RefundCount, OrderCount}`.
  - Every mapper: cast `::text` → `ParseMoney` → skip/fail are treated as internal errors (wrap `fmt.Errorf("reports: ...: %w")`).
  - `GetShopSettings` maps currency + timezone (row already selects them).
- [ ] **Step 5: Regenerate sqlc**

Run: `task generate` (or `cd backend && sqlc generate`)
Expected: new `backend/db/reports.sql.go` committed; `git status` shows generated diff only in expected files.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && go test ./repository -run 'TestMap' -v` → PASS; also `go build ./...`.

- [ ] **Step 7: Commit**

```bash
git add backend/db/queries/reports.sql backend/db/reports.sql.go backend/db/models.go backend/repository/
git commit -m "feat: add reports repository with SQL-side aggregates"
```

---

### Task 3: Reports service + permission enforcement

**Files:**
- Create: `backend/service/reports.go`
- Create: `backend/service/reports_test.go`

**Interfaces:**
- Consumes: `repository.ReportsRepository` (Task 2), `principalFor`, `requirePermission` (existing), `utils/auth.Principal`.
- Produces:
  ```go
  type ReportsService interface{ GetSalesSummary(ctx context.Context) (repository.SalesSummary, error) }
  func NewReportService(repo repository.ReportsRepository) ReportsService
  ```
  `repository.SalesSummary` (defined once, in Task 2's `models.go`) is consumed unchanged —
  do not redefine it in this task.

- [ ] **Step 1: Write failing service test with injection**

Use a `fakeReportsRepository` (in-memory; copy the `fakeAuthRepository` pattern from `service/auth_service_test.go`). Tests must cover:

1. `TestGetSalesSummaryAnonymous` — no principal in ctx → `ErrUnauthenticated`.
2. `TestGetSalesSummaryRequiresPermission` — principal with `order.read.all` only → `ErrForbidden`; with `report.sales.read` → success.
3. `TestNetSalesSubtractsRefunds` — fixture: gross 100.00, refunds recorded **in window** 25.00 ⇒ today.NetSales = 75.00; yesterday window unaffected by today's refunds.
4. `TestAverageOrderValueHalfUp` — net 350¢, orders 3 ⇒ 117¢; orders 0 ⇒ 0¢.
5. `TestTimezoneBucketingRespected` — fixture payments at `2026-11-02T00:30+02:00` bucket into the correct shop-tz day vs UTC misread day; service reads tz from settings (set tz to `Europe/Berlin` in fake settings, compare Trend days list).
6. `TestHoursAllZeroFill` — no orders in fixture ⇒ Hours has 24 entries, all zero.
7. `TestZeroOrdersTodayAOV` — covered by 4.

Also: `var nowFunc = time.Now` package var, swapped in tests via `defer func(){ nowFunc = time.Now }()` (or clock param on constructor — choose the var; simpler and idiomatic here).

- [ ] **Step 2: Run tests → verify they fail**

Run: `cd backend && go test ./service -run 'TestGetSalesSummary|TestNetSales|TestAverageOrder|TestTimezone|TestHours' -v` → FAIL (undefined)

- [ ] **Step 3: Implement `service/reports.go`**

- `GetSalesSummary(ctx)`:
  `principalFor` → `requirePermission(principal, "report.sales.read")` → `repo.GetShopSettings` →
  `tz, err := time.LoadLocation(settings.Timezone)` (invalid → UTC + continue) →
  compute `[todayStart, tomorrowStart)` in tz, plus 30-day and 7-day windows →
  fake-friendly now via `nowFunc()` → assemble `SalesSummary` with:
  - today/yesterday via `PeriodTotals` ×2; `NetSales = Gross − Refunds`; `AOV` half-up.
  - `Trend = repo.SalesTrend(ctx, tzName, 7)` — service zero-fills? No — repo returns 7 rows always (generate_series), service passes through.
  - `Hours = repo.HourlyOrderCounts(...)` then expand missing hours to 0 (fixed 0–23 slice).
  - `Refunds = repo.RefundTotals(ctx, start30, now)`; `RecentRefunds = repo.RecentRefunds(ctx, 5)`.
  - `Split = repo.PaymentMethodTotals(...)`; pass through (absent methods simply absent).
- Money math in integer cents; `AverageOrderValue = ((int64(net) * 100 + int64(orders)/2) / int64(orders))` style half-up integer math (orders > 0).
- Currency/timezone echoed from settings.

- [ ] **Step 4: Run tests → PASS; `go vet ./...`**
- [ ] **Step 5: Commit**

```bash
git add backend/service/reports.go backend/service/reports_test.go
git commit -m "feat: add reports service with report.sales.read enforcement"
```

---

### Task 4: GraphQL schema, resolver, and wiring

**Files:**
- Modify: `backend/graph/schema.graphqls` (add new types + `Query.salesSummary`)
- Modify (regenerated): `backend/graph/generated.go`, `backend/graph/model/models_gen.go` (via gqlgen — **do not hand-edit**)
- Modify: `backend/graph/mapping.go` (add `salesSnapshotToModel`, `salesSummaryToModel`, etc.)
- Modify: `backend/graph/schema.resolvers.go` (add `SalesSummary` to `queryResolver`)
- Modify: `backend/graph/resolver.go` (add `Reports service.ReportsService`)
- Modify: `backend/graph/schema.resolvers_test.go` (SalesSummary mapping + FORBIDDEN propagation tests)
- Modify: `backend/main.go` (wire `Reports: service.NewReportService(store)`)

**Interfaces:**
- Consumes: `service.ReportsService` (Task 3), `repository.SalesSummary` models (Task 2).
- Produces: GraphQL `Query.salesSummary: SalesSummary!` consumed by Task 5 (codegen).

- [ ] **Step 1: Write failing resolver test**

```go
// Mirror errors_test.go / schema.resolvers_test.go patterns with a fake ReportsService.
// TestSalesSummaryResolverMapsPayload: fixture repository.SalesSummary with USD/UTC,
//   assert mapping of money Decimal strings ("12.99"), day strings, hour ints.
// TestSalesSummaryResolverPropagatesForbidden: fake service returns wrapped ErrForbidden
//   ⇒ mapToGraphQLError maps to FORBIDDEN code (assert extensions.code == "FORBIDDEN").
```

- [ ] **Step 2: Run → fail** (`cd backend && go test ./graph -run SalesSummary -v`)

- [ ] **Step 3: Extend `schema.graphqls`** (exact types from the spec §GraphQL additions:
  `SalesSnapshot`, `DayPoint`, `TopItem`, `HourPoint`, `PaymentMethodPoint`, `RefundSummary`, `RefundLine`, `SalesSummary`, and `salesSummary: SalesSummary!` in `type Query`). Decimal scalar mapping must be unchanged (`graph/scalar` Decimal already string).

- [ ] **Step 4: Regenerate gqlgen**

```bash
cd backend && go run github.com/99designs/gqlgen generate
```
`git status` shows only `generated.go` + `model/models_gen.go` changed.

- [ ] **Step 5: Implement mapping + resolver + wiring**

- `mapping.go`: add snapshot/trend/top-items/hour/method-split/refund-line/summary mappers — match existing mapper naming style; Decimal, Time passthrough; OrderNumber as string per existing ID! convention (verify how existing code converts `int64` order numbers used by gqlgen IDs — copy the existing pattern, e.g. `orderToModel`).
- `schema.resolvers.go`: `SalesSummary` resolver calls `r.Reports.GetSalesSummary(ctx)` and maps.
- `resolver.go`: add `Reports service.ReportsService`.
- `main.go`: `Reports: service.NewReportService(store),` in the `Resolver{}` literal.

- [ ] **Step 6: Tests pass & build green**

Run: `cd backend && go test ./... && go build ./...` → all PASS/exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/graph backend/main.go
git commit -m "feat: expose salesSummary via GraphQL with FORBIDDEN mapping"
```

---

### Task 5: Frontend — `/reports` route, screen, charts

**Files:**
- Create: `frontend/src/graphql/operations/reports.graphql` (the `salesSummary` query document)
- Modify (regenerated): `frontend/src/graphql/generated/graphql.ts` (`npm run codegen`)
- Modify: `frontend/package.json` (+ `chart.js`, + `ng2-charts` — install with npm)
- Modify: `frontend/src/app/app.routes.ts` (add lazy `reports` route, `canActivate: [authGuard]`, before the `''` shell)
- Modify: `frontend/src/app/pages/shell/shell.component.ts` / `.html` (nav link shown when claims absent or `report.sales.read` present)
- Create: `frontend/src/app/pages/reports/reports.component.ts` / `.html` / `.css`
- Create: `frontend/src/app/pages/reports/reports.component.spec.ts`
- Modify: `frontend/src/app/pages/menu/.menu...` — **none**; no changes to other screens.

**Interfaces:**
- Consumes: `salesSummary` field (Task 4) via generated `SalesSummaryDocument`; `AuthStateService`; `AuthService.query` (refresh orchestration); `utils/money` (Decimal helpers); Phase 2 patterns (shell nav gating, FORBIDDEN handling, empty states).
- Produces: the `/reports` staff screen.

- [ ] **Step 1: Install Chart.js and write the failing component spec**

```bash
cd frontend && npm install chart.js ng2-charts
```

Spec (`reports.component.spec.ts`) must cover, with mocked Apollo/AuthService as in existing Phase 2 specs:
1. Renders all six sections from a full fixture `SalesSummary` (assert stat labels & values, e.g. today's Net sales formatted from Decimal "1234.50").
2. Empty data (zero everything, empty arrays) → per-section empty messages ("No sales yet…"); **no NaN/Infinity** rendered anywhere.
3. `FORBIDDEN` error → permission message ("You need report.sales.read …"); `UNAUTHENTICATED` → redirect to login (existing pattern); transport error → Try again banner.
4. Refresh button re-fetches (spy on query call count).
5. Chart.js components render (mock canvas; assert labels/datasets lengths for trend, hours, split doughnut).
6. Money formatting uses existing util; assert no `parseFloat`/`* 1.1`-style ops in component sources via source scan test? No — assert rendered strings from fixture instead.

- [ ] **Step 2: Run spec → fail**

Run: `cd frontend && npx ng test --include src/app/pages/reports/reports.component.spec.ts` → FAIL (component missing)

- [ ] **Step 3: Create operations doc and regenerate**

`reports.graphql`: select every field used by the six sections (incl. `currency`, `timezone`). `npm run codegen`; commit regenerated output with the screen (staleness check enforces).

- [ ] **Step 4: Implement screen + route + nav**

- Route (identical lazy pattern as `prep`):
  ```ts
  { path: 'reports', title: 'Coffee Shop — Sales reports', loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent), canActivate: [authGuard] },
  ```
- Shell nav: new link visible when `authState.hasPermission('report.sales.read') || claimsAbsent` — follow the existing `canPrep`/`canPay` pattern exactly.
- Component: three charts via `ng2-charts` (`BarChart`, `DoughnutChart` types); Section layout per spec (cards row → trend → top-items/hour chart → split/refunds columns); manual **Refresh** button; loading skeleton; error banner reused from Phase 2 pages.
- Currency display: `$` for USD, else ISO code prefix (spec decision, builder call).
- Chart.js import isolated to this component (lazy chunk); after build, verify initial bundle is unchanged vs Phase 2 baseline (`npm run build` output; expected initial ≈ 526–540 kB; **do not raise the 500 kB→550 kB warning budget; it stays as fixed in a022bd7**).

- [ ] **Step 5: Tests pass, build clean**

Run: `cd frontend && npm test && npm run build && npm run codegen:check`
Expected: all green; build shows reports lazy chunk; no budget warning for initial bundle.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: add sales reports dashboard (chart.js, lazy /reports route)"
```

---

### Task 6: End-to-end verification & docs

**Files:**
- Modify: `README.md` (add sales reports to shipped surfaces + demo accounts note for `report.sales.read`; note demo seed marker)
- (No code — verification & docs only.)

- [ ] **Step 1: Full verification matrix — run and record**

```bash
cd backend && go test ./...                       # all pass
cd frontend && npm test && npm run build && npm run codegen:check   # all green
DATABASE_URL=... task migrate && task seed && task seed             # counts stable (report-demo)
```

- [ ] **Step 2: Manual smoke checklist (document results in the SDD ledger)**

- Sign in as `owner@coffee.local` / `manager@coffee.local` (password `password123`), open `/reports` — verify six sections render non-zero data after seed.
- Sign in as `cashier@coffee.local`, open `/reports` — expect the forbidden message (backend-enforced), no crash; nav link hidden or permission-disabled.
- Delete a demo order's payments and watch the evening-demo re-seed restore it (idempotent proof).

- [ ] **Step 3: README update** — list the reports feature + `owner@coffee.local` demo account + `task seed` runs twice idempotently.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document sales reports phase and demo verification"
```

---

## Self-review

1. **Spec coverage:** every spec requirement maps to a task — seed (T1), read path (T2), service+permission (T3), GraphQL+resolvers (T4), screen+charts+route+nav (T5), verify/docs (T6). Money integrity, zero-data states, FG/forbidden handling, refund attribution, tz bucketing — all have tests. No gaps found.
2. **Step scan:** each step unambiguous; SQL given where non-trivial (Task 2); seed logic fully specified deterministically (Task 1); verify steps have exact commands.
3. **Type consistency:** `SalesSummary`/`SalesSnapshot`/`PeriodTotals` defined once in Task 2's `models.go` and consumed unchanged by Tasks 3–5; `ReportsRepository` signature used identically in both tasks; GraphQL field name `salesSummary` used everywhere; navy/red flags checked.
4. **Review Focus:** all six failure modes are pinned by named tests in Tasks 3/5 (+ build check in Task 5).
5. **Proportion:** plan ≈ spec ×1.3; SQL and seed logic are the only long blocks and they are unavoidable decisions.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-03-sales-reports.md`. Please review the plan. Does it capture what you want, and which approach should we use?

- **Subagent-driven** — a fresh implementer per task with a fresh reviewer gate after each, then a whole-branch review at the end. Most thorough.
- **Native** — I implement every task in this session, one fresh reviewer at the end. Cheapest and fastest.
