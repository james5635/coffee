# Access & Refresh Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend access JWT + opaque refresh token lifecycle: login issues token pairs, the API returns `401` when the access token is expired, and the auth server validates the refresh token against the database and issues a rotated token pair.

**Architecture:** GraphQL-first auth flow on the existing gqlgen/Gin server. A new `AuthService` (service layer) orchestrates login/refresh/logout/authenticate; token crypto lives in `utils/auth`; persistence goes through a new `AuthRepository` (repository layer) backed by new sqlc queries over a new `refresh_tokens` migration. Gin middleware resolves the bearer token into the principal context and short-circuits with `401` on expiry; refresh-token issuance rides the login/refresh responses via an HttpOnly, SameSite cookie.

**Tech Stack:** Go 1.27, gqlgen v0.17.98, Gin, PostgreSQL/pgx, sqlc, goose, golang.org/x/crypto (bcrypt), Go stdlib (HMAC-SHA256 JWT signing, crypto/rand, crypto/sha256).

**Spec:** `docs/superpowers/specs/2026-10-30-access-refresh-tokens-design.md`

## Global Constraints

- Money is integer cents (`repository.Money`); keep calculations decimal-safe and source prices/totals from server-side logic.
- Backend dependencies flow GraphQL resolvers → service → repository → generated db queries; services own business rules; repository defines shared types and translates persistence rows into them.
- Goose migrations in `backend/db/migrations/` are the schema source of truth; sqlc queries in `backend/db/queries/`; generated `backend/db/*.sql.go` files are outputs.
- `backend/graph/schema.graphqls` is the GraphQL schema source of truth; generated `backend/graph/generated.go` and `backend/graph/model/models_gen.go` are outputs; resolver behavior lives in `backend/graph/schema.resolvers.go`.
- Protected service operations read the principal from context and check permissions there; public menu reads and guest order creation are intentional exceptions; protected operations fail closed.
- `backend/utils/auth/` holds request identity helpers.

## Review Focus

1. Expired access token → API returns `401` (middleware short-circuit; error code `TOKEN_EXPIRED`): verified in Task 5.
2. Refresh token rotation and rejection of unknown/revoked/expired tokens: pinned by tests in Task 3.
3. Refresh cookie attributes (HttpOnly, SameSite, Secure, Max-Age) and logout clearing: implemented in Task 5.
4. Login failure paths (bad credentials, inactive user) never issue tokens: pinned by tests in Task 3.
5. Roles/permissions rehydration when resolving a principal from an access token: covered in Tasks 4–5.

---

## Tasks

### Task 1: Refresh token persistence (migration, sqlc queries, regen)

**Files:**
- Create: `backend/db/migrations/20261030090000_refresh_tokens.sql`
- Modify: `backend/db/queries/auth.sql`
- Regenerate: `backend/db/auth.sql.go`, `backend/db/db.go`, `backend/db/models.go`

**Interfaces:**
- Produces: `db.Queries` methods for `GetRefreshTokenByHash`, `InsertRefreshToken`, `RevokeRefreshToken`.

- [ ] **Step 1: Write the goose migration**
  - Create `refresh_tokens` table: `id BIGSERIAL PRIMARY KEY`, `user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash TEXT NOT NULL UNIQUE`, `expires_at TIMESTAMPTZ NOT NULL`, `revoked_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now();` plus index on `user_id`. Provide matching `-- +goose Down` section.

- [ ] **Step 2: Add sqlc queries**
  - Append to `backend/db/queries/auth.sql`:
    - `GetRefreshTokenByHash :one` — select by `token_hash`.
    - `InsertRefreshToken :one` — insert `user_id`, `token_hash`, `expires_at`, returning row.
    - `RevokeRefreshToken :exec` — `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`.

- [ ] **Step 3: Regenerate db code**
  - Run `task generate` (sqlc) from repo root.

- [ ] **Step 4: Verify build**
  - Run `go build ./...` in `backend/`.

### Task 2: Repository auth surface

**Files:**
- Modify: `backend/repository/interfaces.go` (add `AuthRepository` interface)
- Modify: `backend/repository/models.go` (add `User`, `Role`, `Permission`, `RefreshToken` types)
- Create: `backend/repository/postgres_auth.go` (`*Postgres` implements `AuthRepository`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `repository.AuthRepository` consumed by `service.AuthService` with methods:
  - `GetUserByEmail(ctx context.Context, email string) (User, error)`
  - `GetUserByID(ctx context.Context, userID int64) (User, error)`
  - `ListUserRoles(ctx context.Context, userID int64) ([]Role, error)`
  - `ListRolePermissions(ctx context.Context, roleID int64) ([]Permission, error)`
  - `InsertRefreshToken(ctx context.Context, tokenHash string, userID int64, expiresAt time.Time) (RefreshToken, error)`
  - `GetRefreshTokenByHash(ctx context.Context, tokenHash string) (RefreshToken, error)`
  - `RevokeRefreshToken(ctx context.Context, tokenID int64) error`

- [ ] **Step 1: Add repository types and interface**
- [ ] **Step 2: Implement repository methods** against generated `db.Queries` (map sqlc rows, wrap `repository.ErrNotFound` semantics where appropriate).

### Task 3: Token helpers, auth service, domain errors, tests

**Files:**
- Create: `backend/utils/auth/token.go`
- Modify: `backend/service/errors.go` (add `ErrTokenExpired`, `ErrInvalidRefreshToken`)
- Create: `backend/service/auth_service.go`
- Create: `backend/service/auth_service_test.go`
- Create: `backend/utils/auth/token_test.go`

**Interfaces:**
- Consumes: `repository.AuthRepository`, token helpers.
- Produces: `service.AuthService` with `Login`, `Refresh`, `Logout`, `Authenticate`; `service.TokenPair` type.

- [ ] **Step 1: Write failing tests for token helpers**
```go
// backend/utils/auth/token_test.go
func TestSignAndVerifyAccessTokenRoundTrip(t *testing.T) { /* sign with known secret -> verify -> expect userID */ }
func TestVerifyAccessTokenRejectsExpiredToken(t *testing.T) { /* sign with negative/short TTL -> expect expiry error */ }
```

- [ ] **Step 2: Run tests to verify they fail**
  - Run: `go test ./backend/utils/auth/... -run TestSignAndVerifyAccessTokenRoundTrip -v`
  - Expected: FAIL (helpers not defined).

- [ ] **Step 3: Implement token helpers in `backend/utils/auth/token.go`**
  - `SignAccessToken(secret, issuer, audience string, userID int64, roles, permissions []string) (string, error)` — HS256, claims `sub`, `iat`, `exp`, `iss`, `aud`, roles/permissions; TTL 15 minutes.
  - `VerifyAccessToken(secret, issuer, audience, tokenString string) (int64, error)` — validate signature/issuer/audience/expiry; expired → expiry error.
  - `GenerateRefreshToken() (string, error)` — crypto/rand 32 bytes → base64url.
  - `HashRefreshToken(token string) string` — SHA-256 hex.

- [ ] **Step 4: Implement auth service and errors**
  - Add `ErrTokenExpired` and `ErrInvalidRefreshToken` sentinels to `backend/service/errors.go`.
  - Implement `authService` with `Login` (bcrypt compare via `golang.org/x/crypto/bcrypt`, inactive check, load roles/permissions, issue pair, persist hashed refresh token), `Refresh` (lookup by hash, reject missing/revoked/expired, revoke + rotate, return new pair), `Logout` (revoke by hash), `Authenticate` (verify access token, load user + roles/permissions → principal).

- [ ] **Step 5: Add auth service tests**
```go
// backend/service/auth_service_test.go
// - Login issues pair and persists hashed refresh token (fake AuthRepository)
// - Refresh rejects unknown token with ErrInvalidRefreshToken
// - Refresh rotates: presented token revoked, new token inserted, new pair returned
```

- [ ] **Step 6: Verify tests pass and build passes**

### Task 4: GraphQL schema, generation, resolvers, DI

**Files:**
- Modify: `backend/graph/schema.graphqls` (add `AuthPayload`, `login`, `refreshToken`, `logout` mutations)
- Modify: `backend/graph/resolver.go` (add `Auth AuthService` to `Resolver`)
- Modify: `backend/graph/schema.resolvers.go` (implement resolvers)
- Regenerate: `backend/graph/generated.go`, `backend/graph/model/models_gen.go`

**Interfaces:**
- Consumes: `service.AuthService`.
- Produces: gqlgen-generated `model.AuthPayload` and resolver methods.

- [ ] **Step 1: Extend GraphQL schema**
```graphql
type AuthPayload {
  accessToken: String!
  refreshToken: String!
  tokenType: String!
  expiresIn: Int!
}

type Mutation {
  # ... existing ...
  login(email: String!, password: String!): AuthPayload!
  refreshToken: AuthPayload!
  logout: Boolean!
}
```

- [ ] **Step 2: Regenerate GraphQL code**
  - Run: `go run github.com/99designs/gqlgen generate` from `backend/` (gqlgen config in `backend/gqlgen.yml`).
  - Note: `refreshToken` is part of `AuthPayload` so the HTTP layer can apply it as the refresh-token cookie; the design's cookie-based client store is honored via cookie attributes.

- [ ] **Step 3: Implement resolvers and wire DI**
  - `login`: call `Auth.Login`, map result to `model.AuthPayload`.
  - `refreshToken`: call `Auth.Refresh` with token from refresh context; return new payload.
  - `logout`: call `Auth.Logout`; return true.

- [ ] **Step 4: Verify build**

### Task 5: Gin wiring (middleware, 401, cookie, error codes)

**Files:**
- Modify: `backend/graph/errors.go` (map `ErrTokenExpired` → `TOKEN_EXPIRED`; `ErrInvalidRefreshToken` → `INVALID_REFRESH_TOKEN`)
- Modify: `backend/main.go` (construct `AuthService`; add bearer middleware on `/query`; refresh-token cookie handling)

**Interfaces:**
- Consumes: `service.AuthService`, token helpers.
- Produces: HTTP behavior: expired/invalid bearer → `401`; valid bearer → principal in context; no bearer → anonymous (public ops allowed, protected fail closed.

- [ ] **Step 1: Extend error codes**
  - Add cases in `errorCodeAndMessage` for `service.ErrTokenExpired` → `TOKEN_EXPIRED` and `service.ErrInvalidRefreshToken` → `INVALID_REFRESH_TOKEN`.

- [ ] **Step 2: Wire Gin middleware**
  - Add bearer-token middleware on the `/query` route: extract `Authorization: Bearer <token>`; call `Auth.Authenticate`; on success put principal into context via `auth.WithPrincipal`; on expiry/invalid abort with `401`.

- [ ] **Step 3: Set refresh-token cookie**
  - Wrap the GraphQL handler response via a buffering response writer; on successful login/refresh issue, set refresh-token cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = refresh TTL, `Secure` per environment); on logout clear it.

- [ ] **Step 4: Verify build**

### Task 6: Seed demo users and verify end-to-end compile

**Files:**
- Modify: `backend/db/seeds/20261027091000_seed_coffee_shop.sql` or new seed migration (add demo users with bcrypt password hashes + role assignments).

- [ ] **Step 1: Add seeded demo users** (e.g. owner/manager/cashier/barista/customer) with bcrypt hashes and role assignments.

- [ ] **Step 2: Run full verification**
  - Run `task generate`, `go build ./...`, `go vet ./...` in `backend/`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-30-access-refresh-tokens.md`. Please review the plan. Does it capture what you want?

- **Subagent-driven** — recommended: a fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Best for this multi-task plan with inter-task interfaces.
- **Native** — I implement every task myself in this session, then one fresh reviewer checks the whole branch.

Which approach should we use?
