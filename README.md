# Coffee Shop

A coffee shop operations app with a Go GraphQL API, PostgreSQL storage, and an Angular frontend. The backend provides public menu reads, guest and authenticated ordering, the preparation queue and status transitions, offline payment/refund recording, and the auth token operations (`login`, `refreshToken`, `logout`). The Angular frontend ships the Phase 1 auth flow (in-memory access token, HttpOnly refresh cookie, boot restore, guard) and the product screens on top of it: menu browsing, ordering/checkout, order tracking, preparation queue, payments/refunds, and the staff sales reports dashboard (`/reports`).

## Stack

- **Backend:** Go, gqlgen, Gin, `database/sql` with pgx
- **Database:** PostgreSQL, Goose migrations, sqlc-generated queries
- **Frontend:** Angular (Angular 22, Apollo Client + GraphQL Code Generator for the GraphQL transport)
- **Local orchestration:** Docker Compose and Task

## Current API

The GraphQL schema is in [`backend/graph/schema.graphqls`](backend/graph/schema.graphqls). The API supports:

- Public category and available-product browsing, including modifier choices.
- Guest order placement and authenticated customer/staff order placement. Prices, line totals, and tax are calculated by the server and saved as order snapshots.
- Preparation queue and validated order status transitions (including pending-order acceptance by manager/owner).
- Recording offline payments and refunds against order balances. These mutations record events; they do not charge a card or call a payment provider.
- Staff sales reports and dashboard (`salesSummary`): today/yesterday snapshots, a 45-day trend, top items, hourly and payment-method splits, and refunds. Gated by the `report.sales.read` permission; protected operations fail closed without a valid principal.

The database includes broader coffee shop tables, but database support does not imply that an API workflow exists for every area. Inventory operations and staff administration workflows are not implemented yet; the frontend does not build against those operations.

### Authorization status

Protected service operations require a principal and permission set in the request context; the bearer authentication middleware (`backend/main.go:98`) populates the principal from the `Authorization: Bearer <token>` header, and services enforce permissions there. Protected operations therefore fail closed when no valid principal is present. Public menu reads and guest order creation remain available exceptions (no principal required).

## Run locally

You need Docker Compose, [Task](https://taskfile.dev/), Go matching [`backend/go.mod`](backend/go.mod), and Node.js/npm for the Angular app.

Install dependencies, start PostgreSQL, and prepare the schema and sample menu data:

```sh
task install
task postgres:detached
task seaweedfs:detached   # object storage for images/files (S3 API on :8333)
task objects:seed         # create the bucket and upload the bundled product images
task migrate
task seed
```

Task `backend` defaults `DATABASE_URL` to `postgres://coffee:coffee@localhost:5432/coffee?sslmode=disable` (same default as `task migrate`/`task seed`). To point at a different database, export `DATABASE_URL` before running the tasks:

```sh
task dev
```

The frontend is served at [http://localhost:4200](http://localhost:4200). The GraphQL endpoint is [http://localhost:8080/query](http://localhost:8080/query), with the GraphQL playground at [http://localhost:8080](http://localhost:8080).

The local seed creates a shop settings row, sample categories/products, modifier choices, and demo inventory. Its tax rate is zero. Migrations and seeds are in `backend/db/migrations/` and `backend/db/seeds/`.

The frontend dev proxy serves the bundled assets from object storage: requests to `/products/*` are rewritten to the SeaweedFS bucket (`http://localhost:8333/my-bucket/products/*`), so product images work from any host that can reach the dev server (including LAN) without signing. Production deployments must add the same path-style rewrite (reverse proxy or SSR host).

The seed is deterministic and idempotent: running `task seed` repeatedly deletes and re-inserts the `report-demo` dataset, so order/payment/refund counts stay identical across runs (safe to run repeatedly). Seeded staff demo accounts for the reports dashboard: `owner@coffee.local` and `manager@coffee.local` (both hold `report.sales.read`); `cashier@coffee.local` does not. All passwords are `password123`.

## Development tasks

Run `task --list` to see available workflows. Common tasks include:

```sh
task generate       # regenerate sqlc database code
task build          # build backend and frontend
task verify         # run the full backend+frontend verification gate
task migrate        # apply Goose migrations
task seed           # apply sample data
task seaweedfs:detached  # start SeaweedFS (S3 object storage) in the background
task objects:seed   # upload bundled assets to the SeaweedFS bucket
```

Object storage: [SeaweedFS](https://github.com/seaweedfs/seaweedfs) runs all-in-one via `weed mini` in Docker Compose (`compose.yaml`, service `seaweedfs`), exposing the S3 API on `:8333`. The `my-bucket` bucket holds the product images under `products/` (source of truth: `assets/products/` in this repo). `seaweedfs/s3.json` configures two identities: anonymous Read (public product images load unsigned in `<img>` tags) and admin `admin/secret` with full access (signed writes used by `task objects:seed`; dev credentials only — replace for production). All credentials are local-development only, matching the seeded database users and demo passwords.

After changing the GraphQL schema, regenerate gqlgen output from `backend/`:

```sh
go run github.com/99designs/gqlgen generate
```

## Backend structure

```text
backend/
├── db/                 # migrations, seeds, SQL queries, generated sqlc code
├── graph/              # GraphQL schema, resolvers, scalar and error mapping
├── repository/         # PostgreSQL adapters and transaction-scoped interfaces
├── service/             # menu, order, payment workflows and domain types
└── utils/auth/          # request principal and context helpers
```

Resolvers translate GraphQL inputs and outputs. Services enforce business rules and permissions. Repositories handle persistence through generated sqlc queries. Monetary values use integer cents in the domain layer.

## Product roles

The planned role model is Owner/Admin, Manager, Cashier, Barista, and Customer. Permissions are granular (for example, `order.read.all`, `order.read.own`, `order.read.preparation_queue`, `order.update_status`, `payment.accept`, and `payment.refund`). See [`docs/plans.md`](docs/plans.md) for the broader product plan.

Phase 2 shipped the product frontend against the implemented backend operations: the public menu, ordering/checkout, preparation queue, payments/refunds, and the Phase 1 auth screens. Staff screens hide actions the current user cannot perform and handle `FORBIDDEN` from the backend; the backend remains the permission boundary.

Staff administration workflows (user/role administration, menu/product management, inventory operations) are not implemented yet, and the frontend does not build against those operations.

## License

No license has been selected yet.
