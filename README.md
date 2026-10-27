# Coffee Shop

A coffee shop operations app with a Go GraphQL API, PostgreSQL storage, and an Angular frontend. The backend currently provides the menu, order, preparation queue, and offline payment/refund API foundation. The frontend is still the Angular starter screen; inventory, staff administration, and authentication integration are future work.

## Stack

- **Backend:** Go, gqlgen, Gin, `database/sql` with pgx
- **Database:** PostgreSQL, Goose migrations, sqlc-generated queries
- **Frontend:** Angular
- **Local orchestration:** Docker Compose and Task

## Current API

The GraphQL schema is in [`backend/graph/schema.graphqls`](backend/graph/schema.graphqls). The API supports:

- Public category and available-product browsing, including modifier choices.
- Guest order placement and authenticated customer/staff order placement. Prices, line totals, and tax are calculated by the server and saved as order snapshots.
- Permission-scoped order lookup, a preparation queue, and validated order status transitions.
- Recording offline payments and refunds against order balances. These mutations record events; they do not charge a card or call a payment provider.

The database includes broader coffee shop tables, but database support does not imply that an API workflow exists for every area. Inventory operations, staff administration, login/token issuance, and frontend GraphQL integration have not been implemented yet.

### Authorization status

Protected service operations require a principal and permission set in the request context. The context helpers and checks are implemented, but the server does not yet have authentication middleware that supplies a principal. Protected order/payment operations therefore fail closed for API requests until that integration is added. Public menu reads and guest order creation remain available.

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

The planned role model is Owner/Admin, Manager, Cashier, Barista, and Customer. Permissions are granular (for example, `order.read.all`, `order.read.own`, `order.read.preparation_queue`, `order.update_status`, `payment.accept`, and `payment.refund`). See [`docs/plans.md`](docs/plans.md) for the broader product plan. The API currently enforces permissions supplied by its future authentication integration; it does not yet provide login or role administration.

## License

No license has been selected yet.
