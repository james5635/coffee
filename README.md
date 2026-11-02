# Coffee Shop

A coffee shop operations app with a Go GraphQL API, PostgreSQL storage, and an Angular frontend. The backend provides public menu reads, guest and authenticated ordering, the preparation queue and status transitions, offline payment/refund recording, and the auth token operations (`login`, `refreshToken`, `logout`). The Angular frontend ships the Phase 1 auth flow (in-memory access token, HttpOnly refresh cookie, boot restore, guard) and the Phase 2 product screens on top of it: menu browsing, ordering/checkout, order tracking, preparation queue, and payments/refunds.

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

The database includes broader coffee shop tables, but database support does not imply that an API workflow exists for every area. Inventory operations and staff administration workflows are not implemented yet; the frontend does not build against those operations.

### Authorization status

Protected service operations require a principal and permission set in the request context; the context helpers and checks are implemented and the auth token operations (`login`, `refreshToken`, `logout`) are wired. The server does not yet have authentication middleware that supplies a principal to every protected operation, so protected order/payment operations therefore fail closed for API requests until that integration is added. Public menu reads and guest order creation remain available.

## Run locally

You need Docker Compose, [Task](https://taskfile.dev/), Go matching [`backend/go.mod`](backend/go.mod), and Node.js/npm for the Angular app.

Install dependencies, start PostgreSQL, and prepare the schema and sample menu data:

```sh
task install
task postgres:detached
task migrate
task seed
```

Start the backend and frontend from the repository root:

```sh
export DATABASE_URL='postgres://coffee:coffee@localhost:5432/coffee?sslmode=disable'
task dev
```

The frontend is served at [http://localhost:4200](http://localhost:4200). The GraphQL endpoint is [http://localhost:8080/query](http://localhost:8080/query), with the GraphQL playground at [http://localhost:8080](http://localhost:8080).

The local seed creates a shop settings row, sample categories/products, modifier choices, and demo inventory. Its tax rate is zero. Migrations and seeds are in `backend/db/migrations/` and `backend/db/seeds/`.

## Development tasks

Run `task --list` to see available workflows. Common tasks include:

```sh
task generate       # regenerate sqlc database code
task build          # build backend and frontend
task migrate        # apply Goose migrations
task seed           # apply sample data
```

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

Staff administration workflows (user/role administration, menu/product management, inventory operations, sales reports) are not implemented yet, and the frontend does not build against those operations.

## License

No license has been selected yet.
