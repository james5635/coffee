# Agent Instructions

## Project shape

- `backend/` is a Go GraphQL API backed by PostgreSQL. `frontend/` is an Angular app (Apollo Client + GraphQL Code Generator for the GraphQL transport).
- Object storage is SeaweedFS (`compose.yaml`, service `seaweedfs`, `weed mini`, S3 API on `:8333`): `my-bucket/products/` holds product images seeded from `assets/products/` via `task objects:seed` (also run as part of `task seed`). The Angular dev proxy rewrites `/products/*` to the bucket (see `frontend/proxy.conf.json`); production hosts need the same path-style rewrite. `seaweedfs/s3.json` carries anonymous Read plus dev-only admin credentials.
- Keep backend dependencies flowing from GraphQL resolvers to `service/` to `repository/` to generated `db/` queries. Services own business rules; `repository/` defines the shared types and translates persistence rows into them.
- Put shared business types in `backend/repository/` and request identity helpers in `backend/utils/auth/`.
- Protected service operations read the principal from context and check permissions there. Public menu reads and guest order creation are intentional exceptions. The bearer middleware (`backend/main.go` — `bearerMiddleware`) populates the principal from the Phase 1 JWT; protected operations work with a valid token and fail closed without one.

## Backend data and API changes

- Treat `backend/db/migrations/` as the schema source of truth and use Goose migrations for schema changes. Update sqlc queries in `backend/db/queries/`; generated `backend/db/*.sql.go` files are outputs.
- Treat `backend/graph/schema.graphqls` as the GraphQL schema source of truth. `backend/graph/generated.go` and `backend/graph/model/models_gen.go` are generated outputs; keep resolver behavior in `backend/graph/schema.resolvers.go`.
- Money is represented as integer cents by `repository.Money`. Keep calculations decimal-safe and source prices/totals from server-side logic.
- Read `Taskfile.yml` for the canonical local development, generation, migration, seed, and build tasks. `task backend`/`task dev` default `DATABASE_URL` to the local Compose DSN (override by exporting `DATABASE_URL`); `task verify` runs the full gate (backend `go test ./...` + build; frontend tests, build, and codegen freshness). Backend-specific generator configuration lives in `backend/sqlc.yaml` and `backend/gqlgen.yml`.

## Frontend changes

- Follow the existing Angular structure under `frontend/src/` and use the scripts in `frontend/package.json` for frontend workflows.
- Keep API-facing UI behavior consistent with the GraphQL schema in `backend/graph/schema.graphqls`.
- GraphQL documents live in `frontend/src/graphql/operations/*.graphql`; `frontend/src/graphql/generated/` is committed output of `npm run codegen` (from the backend SDL). `npm test` fails when generated output is stale. Never hand-edit generated files.
- Staff screens hide actions the current user cannot perform, from decoded access-token claims (`report.sales.read`, `payment.accept`, `payment.refund`, `order.read.preparation_queue`, `order.update_status`), with an authentication-only fallback when the claim is absent; the backend service layer remains the permission boundary.

## Documentation

- `README.md` — runbook, shipped scope, product roles and permission model; `docs/plans.md` records broader product planning. Consult them when changing role behavior or product scope.
- `PRODUCT.md` — durable product truth (users, positioning, constraints, principles). Read before changing scope, positioning, or anything user-facing in a way that outlives the task.
- `DESIGN.md` — the visual design system (North Star "The Counter at Dawn"; Brewed Honey accent on Roast Stone neutrals). Read before UI work; `.impeccable/design.json` is its sidecar.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design docs and implementation plans for past phases.
- The seed is idempotent (`notes='report-demo'` rows) — `task seed` may be run repeatedly; demo accounts use password `password123`. `task unseed` removes all seed data (DB rows and the SeaweedFS bucket) — destructive in intent.
