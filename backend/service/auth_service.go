package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/utils/auth"
)

const (
	// refreshTokenTTL is the long-lived lifetime of a persisted refresh token.
	refreshTokenTTL = 30 * 24 * time.Hour
	// accessTokenExpiresIn is the access token lifetime in seconds (15 minutes),
	// matching auth.AccessTokenTTL in the token helpers.
	accessTokenExpiresIn = 15 * 60
)

// TokenPair is an access JWT plus the opaque refresh token that rotates it.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int // seconds until the access token expires
}

// AuthService is the application-layer auth surface: login, refresh, logout,
// and access-token authentication.
type AuthService interface {
	Login(ctx context.Context, email, password string) (TokenPair, error)
	Refresh(ctx context.Context, refreshToken string) (TokenPair, error)
	Logout(ctx context.Context, refreshToken string) error
	Authenticate(ctx context.Context, accessToken string) (auth.Principal, error)
}

type authService struct {
	repository repository.AuthRepository
	secret     string
	issuer     string
	audience   string
}

// NewAuthService constructs an AuthService backed by the given repository.
// The secret, issuer and audience are the values used to sign and verify
// access JWTs (typically from JWT_SECRET/JWT_ISSUER/JWT_AUDIENCE env vars).
func NewAuthService(repository repository.AuthRepository, secret, issuer, audience string) AuthService {
	return &authService{repository: repository, secret: secret, issuer: issuer, audience: audience}
}

func (s *authService) Login(ctx context.Context, email, password string) (TokenPair, error) {
	user, err := s.repository.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return TokenPair{}, ErrUnauthenticated
		}
		return TokenPair{}, fmt.Errorf("get user: %w", err)
	}
	if !user.IsActive {
		return TokenPair{}, ErrUnauthenticated
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return TokenPair{}, ErrUnauthenticated
	}
	roleNames, permissionCodes, err := s.loadRoleNamesAndPermissionCodes(ctx, user.ID)
	if err != nil {
		return TokenPair{}, err
	}
	accessToken, err := auth.SignAccessToken(s.secret, s.issuer, s.audience, user.ID, roleNames, permissionCodes)
	if err != nil {
		return TokenPair{}, fmt.Errorf("sign access token: %w", err)
	}
	rawToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return TokenPair{}, fmt.Errorf("generate refresh token: %w", err)
	}
	tokenHash := auth.HashRefreshToken(rawToken)
	expiresAt := time.Now().Add(refreshTokenTTL)
	if _, err := s.repository.InsertRefreshToken(ctx, tokenHash, user.ID, expiresAt); err != nil {
		return TokenPair{}, fmt.Errorf("insert refresh token: %w", err)
	}
	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawToken,
		ExpiresIn:    accessTokenExpiresIn,
	}, nil
}

func (s *authService) Refresh(ctx context.Context, refreshToken string) (TokenPair, error) {
	token, err := s.findRefreshToken(ctx, refreshToken)
	if err != nil {
		return TokenPair{}, err
	}
	if err := s.repository.RevokeRefreshToken(ctx, token.ID); err != nil {
		return TokenPair{}, fmt.Errorf("revoke refresh token: %w", err)
	}
	user, err := s.repository.GetUserByID(ctx, token.UserID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return TokenPair{}, ErrUnauthenticated
		}
		return TokenPair{}, fmt.Errorf("get user: %w", err)
	}
	if !user.IsActive {
		return TokenPair{}, ErrUnauthenticated
	}
	roleNames, permissionCodes, err := s.loadRoleNamesAndPermissionCodes(ctx, user.ID)
	if err != nil {
		return TokenPair{}, err
	}
	accessToken, err := auth.SignAccessToken(s.secret, s.issuer, s.audience, user.ID, roleNames, permissionCodes)
	if err != nil {
		return TokenPair{}, fmt.Errorf("sign access token: %w", err)
	}
	rawToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return TokenPair{}, fmt.Errorf("generate refresh token: %w", err)
	}
	tokenHash := auth.HashRefreshToken(rawToken)
	expiresAt := time.Now().Add(refreshTokenTTL)
	if _, err := s.repository.InsertRefreshToken(ctx, tokenHash, user.ID, expiresAt); err != nil {
		return TokenPair{}, fmt.Errorf("insert refresh token: %w", err)
	}
	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawToken,
		ExpiresIn:    accessTokenExpiresIn,
	}, nil
}

func (s *authService) Logout(ctx context.Context, refreshToken string) error {
	token, err := s.findRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil // unknown token: logout is idempotent
	}
	return s.repository.RevokeRefreshToken(ctx, token.ID)
}

func (s *authService) Authenticate(ctx context.Context, accessToken string) (auth.Principal, error) {
	userID, err := auth.VerifyAccessToken(s.secret, s.issuer, s.audience, accessToken)
	if err != nil {
		if errors.Is(err, auth.ErrExpired) {
			return auth.Principal{}, ErrTokenExpired
		}
		return auth.Principal{}, ErrUnauthenticated
	}
	user, err := s.repository.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return auth.Principal{}, ErrUnauthenticated
		}
		return auth.Principal{}, fmt.Errorf("get user: %w", err)
	}
	if !user.IsActive {
		return auth.Principal{}, ErrUnauthenticated
	}
	roleNames, permissionCodes, err := s.loadRoleNamesAndPermissionCodes(ctx, user.ID)
	if err != nil {
		return auth.Principal{}, err
	}
	return auth.NewPrincipal(user.ID, roleNames, permissionCodes), nil
}

// findRefreshToken looks up a raw refresh token by its hash and rejects
// missing, revoked and expired tokens with ErrInvalidRefreshToken.
func (s *authService) findRefreshToken(ctx context.Context, refreshToken string) (repository.RefreshToken, error) {
	tokenHash := auth.HashRefreshToken(refreshToken)
	token, err := s.repository.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return repository.RefreshToken{}, ErrInvalidRefreshToken
		}
		return repository.RefreshToken{}, fmt.Errorf("get refresh token: %w", err)
	}
	if token.RevokedAt != nil {
		return repository.RefreshToken{}, ErrInvalidRefreshToken
	}
	if time.Now().After(token.ExpiresAt) {
		return repository.RefreshToken{}, ErrInvalidRefreshToken
	}
	return token, nil
}

// loadRoleNamesAndPermissionCodes returns the role names and permission codes
// granted to the user, flattened across all of the user's roles.
func (s *authService) loadRoleNamesAndPermissionCodes(ctx context.Context, userID int64) ([]string, []string, error) {
	roles, err := s.repository.ListUserRoles(ctx, userID)
	if err != nil {
		return nil, nil, fmt.Errorf("list user roles: %w", err)
	}
	roleNames := make([]string, 0, len(roles))
	permissionCodes := make([]string, 0)
	for _, role := range roles {
		roleNames = append(roleNames, role.Name)
		permissions, err := s.repository.ListRolePermissions(ctx, role.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("list role permissions: %w", err)
		}
		for _, permission := range permissions {
			permissionCodes = append(permissionCodes, permission.Code)
		}
	}
	return roleNames, permissionCodes, nil
}
