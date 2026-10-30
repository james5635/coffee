# Access & Refresh Token Flow — Design

Date: 2026-10-30
Topic: Backend access token (JWT) + refresh token (opaque) implementation

## Intent

Give the backend a complete token lifecycle for authenticated operations:

1. Client sends an expired access token to the API resource server.
2. Resource server responds `401 Unauthorized` (access token TTL: 15 minutes).
3. Client sends the opaque refresh token to the auth server.
4. Auth server validates the refresh token against the database.
5. Auth server issues a new access JWT + a new (rotated) refresh token.

## Why

The backend currently has no authentication integration at all — no token
issuance, no token validation, no auth middleware. Protected service operations
fail closed via the principal context helpers, but nothing ever populates a
principal, so there is no working authenticated flow yet.

## Goals / Non-goals / Anti-goals

Goals:

- Issue an access JWT and an opaque refresh token at login.
- Access JWT: HS256, claims `sub`, `iat`, `exp`, `iss`, `aud`, roles/permissions;
  15-minute TTL.
- Refresh token: opaque random value; only a SHA-256 hash is stored in the
  database along with `user_id` and expiration; 30-day TTL; single-use rotation
  (old token revoked on successful refresh).
- API returns `401 Unauthorized` when the presented access token is expired or
  otherwise invalid.
- Auth service validates refresh tokens via database lookup and issues new
  token pairs.
- Valid access tokens resolve a principal (user + roles + permissions) for
  protected operations.

Non-goals:

- User account creation / staff user management mutations (no login-capable
  user path exists yet; `user.manage` permission is future work).
- Password reset, MFA, multi-factor flows.
- Refresh token reuse detection across rotation families.
- Frontend (Angular) wiring; backend focus for this work.

Anti-goals:

- Never return password hashes or refresh-token internals in GraphQL payloads.
- Do not accept the refresh token through client-side storage; use an
  HttpOnly, SameSite cookie as the client store.

## Constraints

- Stack: Go 1.27, gqlgen + Gin + PostgreSQL (pgx) + sqlc + goose.
- Layering: GraphQL resolvers → service → repository → generated sqlc queries.
- `backend/utils/auth` holds principal context helpers; identity/token helpers
  should stay consistent with that.
- Generated code (`backend/db/*.sql.go`, `backend/graph/generated.go`,
  `backend/graph/model/models_gen.go`) must be regenerated after schema/query
  changes.

## Approaches considered

Chosen (from the human partner):

- Access token = JWT; refresh token = opaque. Refresh token persisted in DB.
- Access TTL short-lived (5–15 min) → **15 min** chosen. Refresh TTL long-lived
  (7–30+ days) → **30 days** chosen.
- Access token client store: memory/variable (not persisted, not cookie).
- Refresh token client store: Secure, HttpOnly, SameSite cookie.

## Concrete design decisions

- Access JWT: HS256 signed with `JWT_SECRET` env secret; claims `sub` (user ID),
  `iat`, `exp`, `iss` (env-configured issuer), `aud` (env-configured audience),
  plus roles/permissions for the principal.
- Refresh token: 32 bytes from `crypto/rand`, base64url encoded; SHA-256 hash
  stored (`token_hash`) with `user_id`, `expires_at`, `revoked_at`.
- Database: new `refresh_tokens` table (`id`, `user_id`, `token_hash` unique,
  `expires_at`, `revoked_at`, `created_at`) + index on `user_id`; goose migration
  + sqlc queries (`GetRefreshTokenByHash`, `InsertRefreshToken`,
  `RevokeRefreshToken`) + regenerated `db` code.
- API surface: GraphQL mutations `login(email, password) → AuthPayload!`,
  `refreshToken → AuthPayload!`, `logout → Boolean!`; `AuthPayload` exposes
  `accessToken`, `tokenType`, `expiresIn` (refresh token travels via cookie).
- Refresh flow: auth service takes raw refresh token from cookie, hashes it,
  looks up in DB, rejects if missing/revoked/expired, revokes presented token,
  inserts rotated token, returns new token pair.
- Login flow: verify bcrypt password against user, check `is_active`, load
  roles/permissions, issue token pair, set refresh token cookie.
- HTTP behavior: Gin middleware on the GraphQL endpoint; bearer token present
  and invalid/expired → `401` (expired maps to `TOKEN_EXPIRED` error code);
  no bearer token → anonymous context (public menu/guest orders keep working;
  protected operations keep failing closed).
- Errors: add `TOKEN_EXPIRED` (access) and `INVALID_REFRESH_TOKEN` (refresh)
  codes surfaced through the existing GraphQL error presenter.

## Builder check outcomes (2026-10-30)

Builder review surfaced six questions; dispositions:

1. **401 mechanism (design intent, builder discretion):** expired/invalid bearer
   → Gin middleware short-circuits with raw HTTP 401; refresh validation failures
   → GraphQL error with `INVALID_REFRESH_TOKEN` code via error presenter.
2. **Login-capable users (OPEN — human partner decision):** token lifecycle cannot
   be exercised end-to-end without a provisioning path. Candidate answers: seeded
   demo users, staff user-management mutations, or both.
3. **JWT roles source (settled as builder call):** re-hydrate roles/permissions
   from database at validation time; JWT carries a snapshot at issue time.
4. **Logout semantics (settled as builder call):** revoke refresh token from
   cookie; idempotent; access tokens are stateless (no server-side revocation).
5. **Refresh is_active re-check (settled as builder call):** yes, fail closed.
6. **Issuer/audience (settled as builder call):** env vars `JWT_SECRET`,
   `JWT_ISSUER`, `JWT_AUDIENCE` with development defaults.

## What's left to the builder

- Migration + sqlc queries + regeneration.
- Repository-level auth surface (refresh token persistence, user lookup by
  email/ID, roles/permissions).
- Service layer: login/refresh/logout/authenticate + token helpers.
- GraphQL schema additions + gqlgen regeneration + resolvers.
- Gin middleware wiring (bearer → principal; expired → 401) and cookie handling
  for refresh token.
- Build + verify (`go build ./...`).

## Open questions for the human partner

- ~~How should login-capable user accounts come into existence (seeded demo users,
  user-management mutations, or both)?~~ **Resolved 2026-10-30: seeded demo users.**
  Staff user-management mutations remain future work.
