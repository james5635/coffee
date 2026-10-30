# Agent Instructions

## Project shape

- `backend/` is a Go GraphQL API backed by PostgreSQL. `frontend/` is an Angular app.
- Keep backend dependencies flowing from GraphQL resolvers to `service/` to `repository/` to generated `db/` queries. Services own business rules; `repository/` defines the shared types and translates persistence rows into them.
- Put shared business types in `backend/repository/` and request identity helpers in `backend/utils/auth/`.
- Protected service operations read the principal from context and check permissions there. Public menu reads and guest order creation are intentional exceptions. No authentication middleware currently populates the principal, so protected operations fail closed by default.

## Backend data and API changes

- Treat `backend/db/migrations/` as the schema source of truth and use Goose migrations for schema changes. Update sqlc queries in `backend/db/queries/`; generated `backend/db/*.sql.go` files are outputs.
- Treat `backend/graph/schema.graphqls` as the GraphQL schema source of truth. `backend/graph/generated.go` and `backend/graph/model/models_gen.go` are generated outputs; keep resolver behavior in `backend/graph/schema.resolvers.go`.
- Money is represented as integer cents by `repository.Money`. Keep calculations decimal-safe and source prices/totals from server-side logic.
- Read `Taskfile.yml` for the canonical local development, generation, migration, seed, and build tasks. Backend-specific generator configuration lives in `backend/sqlc.yaml` and `backend/gqlgen.yml`.

## Frontend changes

- Follow the existing Angular structure under `frontend/src/` and use the scripts in `frontend/package.json` for frontend workflows.
- Keep API-facing UI behavior consistent with the GraphQL schema in `backend/graph/schema.graphqls`.

## Documentation

- `README.md` describes the product roles and permission model; `docs/plans.md` records broader product planning. Consult them when changing role behavior or product scope.
