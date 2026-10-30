package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	db "github.com/james5635/coffee/backend/db"
)

func TestMapUser(t *testing.T) {
	now := time.Now()
	phone := "555-0100"
	row := db.User{
		ID:           42,
		Email:        "alice@example.com",
		PasswordHash: "$2a$10$dummy",
		DisplayName:  "Alice",
		Phone:        sql.NullString{String: phone, Valid: true},
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	user := mapUser(row)

	if user.ID != 42 || user.Email != row.Email || user.PasswordHash != row.PasswordHash ||
		user.DisplayName != row.DisplayName || !user.IsActive {
		t.Fatalf("mapUser did not copy scalar fields: %+v", user)
	}
	if user.Phone == nil || *user.Phone != phone {
		t.Fatalf("mapUser did not copy phone: %+v", user.Phone)
	}
	if !user.CreatedAt.Equal(now) || !user.UpdatedAt.Equal(now) {
		t.Fatalf("mapUser did not copy timestamps: %+v", user)
	}
}

func TestMapUserNullPhone(t *testing.T) {
	user := mapUser(db.User{ID: 1, Email: "a@b.com"})
	if user.Phone != nil {
		t.Fatalf("expected nil phone for null input, got %v", *user.Phone)
	}
}

func TestMapRefreshToken(t *testing.T) {
	now := time.Now()
	revoked := now.Add(-time.Hour)
	row := db.RefreshToken{
		ID:        7,
		UserID:    3,
		TokenHash: "hash",
		ExpiresAt: now.Add(24 * time.Hour),
		RevokedAt: sql.NullTime{Time: revoked, Valid: true},
		CreatedAt: now,
	}

	token := mapRefreshToken(row)

	if token.ID != 7 || token.UserID != 3 || token.TokenHash != "hash" {
		t.Fatalf("mapRefreshToken did not copy scalar fields: %+v", token)
	}
	if !token.ExpiresAt.Equal(row.ExpiresAt) || !token.CreatedAt.Equal(now) {
		t.Fatalf("mapRefreshToken did not copy timestamps: %+v", token)
	}
	if token.RevokedAt == nil || !token.RevokedAt.Equal(revoked) {
		t.Fatalf("mapRefreshToken did not copy revoked_at: %v", token.RevokedAt)
	}
}

func TestMapRefreshTokenNotRevoked(t *testing.T) {
	token := mapRefreshToken(db.RefreshToken{ID: 1})
	if token.RevokedAt != nil {
		t.Fatalf("expected nil revoked_at for null input, got %v", *token.RevokedAt)
	}
}

func authIntegrationDB(t *testing.T) *Postgres {
	t.Helper()
	ctx := context.Background()
	dsn := "postgres://coffee:coffee@localhost:5432/coffee?sslmode=disable"
	conn, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Skipf("skipping integration test: cannot open db: %v", err)
	}
	if err := conn.PingContext(ctx); err != nil {
		t.Skipf("skipping integration test: cannot ping db: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return &Postgres{conn: conn, queries: db.New(conn)}
}

// TestAuthRepositoryIntegration exercises the full auth repository surface
// against a live database. It is skipped when no database is available.
func TestAuthRepositoryIntegration(t *testing.T) {
	ctx := context.Background()
	p := authIntegrationDB(t)

	ownerAdminRoleID := int64(1)

	// Use a unique email so repeated runs don't collide with previously seeded rows.
	email := fmt.Sprintf("alice.integration.%d@example.com", time.Now().UnixNano())

	// Seed a user through the generated CreateUser query so role lookups have a subject.
	user, err := p.queries.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "$2a$10$integrationtestdummyhash",
		DisplayName:  "Alice Integration",
		Phone:        sql.NullString{String: "555-0100", Valid: true},
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	t.Cleanup(func() {
		_, _ = p.conn.ExecContext(ctx, "DELETE FROM refresh_tokens WHERE user_id = $1", user.ID)
		_, _ = p.conn.ExecContext(ctx, "DELETE FROM user_roles WHERE user_id = $1", user.ID)
		_, _ = p.conn.ExecContext(ctx, "DELETE FROM users WHERE id = $1", user.ID)
	})

	if err := p.queries.AssignRoleToUser(ctx, db.AssignRoleToUserParams{
		UserID: user.ID,
		RoleID: ownerAdminRoleID,
	}); err != nil {
		t.Fatalf("AssignRoleToUser: %v", err)
	}

	// GetUserByEmail
	got, err := p.GetUserByEmail(ctx, user.Email)
	if err != nil {
		t.Fatalf("GetUserByEmail: %v", err)
	}
	if got.ID != user.ID || got.Email != user.Email || !got.IsActive {
		t.Fatalf("GetUserByEmail returned unexpected user: %+v", got)
	}

	// GetUserByID
	got, err = p.GetUserByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if got.ID != user.ID || got.Email != user.Email {
		t.Fatalf("GetUserByID returned unexpected user: %+v", got)
	}

	// GetUserByEmail missing -> ErrNotFound
	if _, err := p.GetUserByEmail(ctx, "nope@example.com"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("GetUserByEmail missing user: expected ErrNotFound, got %v", err)
	}

	// ListUserRoles
	roles, err := p.ListUserRoles(ctx, user.ID)
	if err != nil {
		t.Fatalf("ListUserRoles: %v", err)
	}
	found := false
	for _, role := range roles {
		if role.ID == ownerAdminRoleID {
			found = true
		}
	}
	if !found {
		t.Fatalf("ListUserRoles did not include assigned role %d: %+v", ownerAdminRoleID, roles)
	}

	// ListRolePermissions for the owner_admin role (seeded with all permissions).
	permissions, err := p.ListRolePermissions(ctx, ownerAdminRoleID)
	if err != nil {
		t.Fatalf("ListRolePermissions: %v", err)
	}
	if len(permissions) == 0 {
		t.Fatalf("ListRolePermissions returned no permissions for role %d", ownerAdminRoleID)
	}

	// InsertRefreshToken -> GetRefreshTokenByHash
	expiresAt := time.Now().Add(24 * time.Hour)
	tokenHash := fmt.Sprintf("hash-token-%d", time.Now().UnixNano())
	token, err := p.InsertRefreshToken(ctx, tokenHash, user.ID, expiresAt)
	if err != nil {
		t.Fatalf("InsertRefreshToken: %v", err)
	}
	if token.UserID != user.ID || token.TokenHash != tokenHash ||
		token.ExpiresAt.Unix() != expiresAt.Unix() || token.RevokedAt != nil {
		t.Fatalf("InsertRefreshToken returned unexpected token: %+v", token)
	}

	gotToken, err := p.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash: %v", err)
	}
	if gotToken.ID != token.ID || gotToken.TokenHash != token.TokenHash || gotToken.RevokedAt != nil {
		t.Fatalf("GetRefreshTokenByHash returned unexpected token: %+v", gotToken)
	}

	// GetRefreshTokenByHash missing -> ErrNotFound
	if _, err := p.GetRefreshTokenByHash(ctx, "unknown-hash"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("GetRefreshTokenByHash missing: expected ErrNotFound, got %v", err)
	}

	// RevokeRefreshToken
	if err := p.RevokeRefreshToken(ctx, token.ID); err != nil {
		t.Fatalf("RevokeRefreshToken: %v", err)
	}
	revoked, err := p.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash after revoke: %v", err)
	}
	if revoked.RevokedAt == nil {
		t.Fatal("expected RevokedAt to be set after RevokeRefreshToken")
	}

	// Revoke is idempotent.
	if err := p.RevokeRefreshToken(ctx, token.ID); err != nil {
		t.Fatalf("second RevokeRefreshToken: %v", err)
	}
}

// TestRotateRefreshTokenIntegration verifies RotateRefreshToken revokes the
// presented token and inserts the rotated token atomically against a live
// database. It is skipped when no database is available.
func TestRotateRefreshTokenIntegration(t *testing.T) {
	ctx := context.Background()
	p := authIntegrationDB(t)

	email := fmt.Sprintf("alice.rotate.%d@example.com", time.Now().UnixNano())
	user, err := p.queries.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "$2a$10$integrationtestdummyhash",
		DisplayName:  "Alice Rotate",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	t.Cleanup(func() {
		_, _ = p.conn.ExecContext(ctx, "DELETE FROM refresh_tokens WHERE user_id = $1", user.ID)
		_, _ = p.conn.ExecContext(ctx, "DELETE FROM users WHERE id = $1", user.ID)
	})

	// Seed an existing refresh token.
	oldHash := fmt.Sprintf("old-hash-%d", time.Now().UnixNano())
	oldToken, err := p.InsertRefreshToken(ctx, oldHash, user.ID, time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("InsertRefreshToken: %v", err)
	}

	// Rotate: revoke old + insert new in a single transaction.
	newHash := fmt.Sprintf("new-hash-%d", time.Now().UnixNano())
	rotated, err := p.RotateRefreshToken(ctx, oldToken.ID, newHash, user.ID, time.Now().Add(30*24*time.Hour))
	if err != nil {
		t.Fatalf("RotateRefreshToken: %v", err)
	}

	// Old token is revoked.
	gotOld, err := p.GetRefreshTokenByHash(ctx, oldHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash old: %v", err)
	}
	if gotOld.RevokedAt == nil {
		t.Fatal("expected old token to be revoked after RotateRefreshToken")
	}

	// New token exists, is not revoked, and belongs to the user.
	gotNew, err := p.GetRefreshTokenByHash(ctx, newHash)
	if err != nil {
		t.Fatalf("GetRefreshTokenByHash new: %v", err)
	}
	if gotNew.ID != rotated.ID || gotNew.RevokedAt != nil || gotNew.UserID != user.ID {
		t.Fatalf("expected rotated token present and not revoked: %+v", gotNew)
	}
}
