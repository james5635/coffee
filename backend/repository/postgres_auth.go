package repository

import (
	"context"
	"database/sql"
	"time"

	db "github.com/james5635/coffee/backend/db"
)

var _ AuthRepository = (*Postgres)(nil)

// GetUserByEmail returns the user with the given email, or ErrNotFound when none exists.
func (p *Postgres) GetUserByEmail(ctx context.Context, email string) (User, error) {
	row, err := p.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return User{}, mapQueryError(err)
	}
	return mapUser(row), nil
}

// GetUserByID returns the user with the given ID, or ErrNotFound when none exists.
func (p *Postgres) GetUserByID(ctx context.Context, userID int64) (User, error) {
	row, err := p.queries.GetUserByID(ctx, userID)
	if err != nil {
		return User{}, mapQueryError(err)
	}
	return mapUser(row), nil
}

// ListUserRoles returns the roles assigned to the given user, ordered by role name.
func (p *Postgres) ListUserRoles(ctx context.Context, userID int64) ([]Role, error) {
	rows, err := p.queries.ListUserRoles(ctx, userID)
	if err != nil {
		return nil, err
	}
	roles := make([]Role, 0, len(rows))
	for _, row := range rows {
		roles = append(roles, Role{
			ID:          row.ID,
			Name:        row.Name,
			Description: row.Description,
		})
	}
	return roles, nil
}

// ListRolePermissions returns the permissions granted to the given role, ordered by permission code.
func (p *Postgres) ListRolePermissions(ctx context.Context, roleID int64) ([]Permission, error) {
	rows, err := p.queries.ListRolePermissions(ctx, roleID)
	if err != nil {
		return nil, err
	}
	permissions := make([]Permission, 0, len(rows))
	for _, row := range rows {
		permissions = append(permissions, Permission{
			ID:          row.ID,
			Code:        row.Code,
			Description: row.Description,
		})
	}
	return permissions, nil
}

// InsertRefreshToken persists a new refresh token and returns the stored row.
func (p *Postgres) InsertRefreshToken(ctx context.Context, tokenHash string, userID int64, expiresAt time.Time) (RefreshToken, error) {
	row, err := p.queries.InsertRefreshToken(ctx, db.InsertRefreshTokenParams{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return RefreshToken{}, err
	}
	return mapRefreshToken(row), nil
}

// GetRefreshTokenByHash returns the refresh token matching the given hash, or ErrNotFound when none exists.
func (p *Postgres) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (RefreshToken, error) {
	row, err := p.queries.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		return RefreshToken{}, mapQueryError(err)
	}
	return mapRefreshToken(row), nil
}

// RevokeRefreshToken marks the refresh token with the given ID as revoked.
// It is idempotent: revoking an already-revoked token is a no-op.
func (p *Postgres) RevokeRefreshToken(ctx context.Context, tokenID int64) error {
	return p.queries.RevokeRefreshToken(ctx, tokenID)
}

func mapUser(row db.User) User {
	return User{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		DisplayName:  row.DisplayName,
		Phone:        nullableString(row.Phone),
		IsActive:     row.IsActive,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}

func mapRefreshToken(row db.RefreshToken) RefreshToken {
	return RefreshToken{
		ID:        row.ID,
		UserID:    row.UserID,
		TokenHash: row.TokenHash,
		ExpiresAt: row.ExpiresAt,
		RevokedAt: nullableTime(row.RevokedAt),
		CreatedAt: row.CreatedAt,
	}
}

func nullableTime(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	copy := value.Time
	return &copy
}
