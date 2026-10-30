package graph

import (
	"context"
	"errors"
	"testing"

	"github.com/james5635/coffee/backend/service"
	"github.com/james5635/coffee/backend/utils/auth"
)

// fakeAuthService is a test double for service.AuthService used by the GraphQL
// resolver tests.
type fakeAuthService struct {
	loginPair    service.TokenPair
	loginErr     error
	refreshPair  service.TokenPair
	refreshErr   error
	refreshToken string
	logoutErr    error
	logoutToken  string
	logoutCalls  int
}

func (f *fakeAuthService) Login(ctx context.Context, email, password string) (service.TokenPair, error) {
	return f.loginPair, f.loginErr
}

func (f *fakeAuthService) Refresh(ctx context.Context, refreshToken string) (service.TokenPair, error) {
	f.refreshToken = refreshToken
	return f.refreshPair, f.refreshErr
}

func (f *fakeAuthService) Logout(ctx context.Context, refreshToken string) error {
	f.logoutToken = refreshToken
	f.logoutCalls++
	return f.logoutErr
}

func (f *fakeAuthService) Authenticate(ctx context.Context, accessToken string) (auth.Principal, error) {
	return auth.Principal{}, nil
}

func TestLoginResolverMapsTokenPair(t *testing.T) {
	svc := &fakeAuthService{
		loginPair: service.TokenPair{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			ExpiresIn:    900,
		},
	}
	r := &mutationResolver{&Resolver{Auth: svc}}

	payload, err := r.Login(context.Background(), "alice@example.com", "password")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if payload.AccessToken != "access-token" {
		t.Errorf("AccessToken = %q, want %q", payload.AccessToken, "access-token")
	}
	if payload.RefreshToken != "refresh-token" {
		t.Errorf("RefreshToken = %q, want %q", payload.RefreshToken, "refresh-token")
	}
	if payload.TokenType != "Bearer" {
		t.Errorf("TokenType = %q, want %q", payload.TokenType, "Bearer")
	}
	if payload.ExpiresIn != 900 {
		t.Errorf("ExpiresIn = %d, want 900", payload.ExpiresIn)
	}
}

func TestLoginResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{loginErr: service.ErrUnauthenticated}
	r := &mutationResolver{&Resolver{Auth: svc}}

	if _, err := r.Login(context.Background(), "alice@example.com", "password"); !errors.Is(err, service.ErrUnauthenticated) {
		t.Errorf("Login: expected %v, got %v", service.ErrUnauthenticated, err)
	}
}

func TestRefreshTokenResolverReadsContextAndRotates(t *testing.T) {
	svc := &fakeAuthService{
		refreshPair: service.TokenPair{
			AccessToken:  "new-access-token",
			RefreshToken: "new-refresh-token",
			ExpiresIn:    900,
		},
	}
	r := &mutationResolver{&Resolver{Auth: svc}}

	ctx := auth.WithRefreshToken(context.Background(), "old-refresh-token")
	payload, err := r.RefreshToken(ctx)
	if err != nil {
		t.Fatalf("RefreshToken: %v", err)
	}
	if svc.refreshToken != "old-refresh-token" {
		t.Errorf("refresh token passed to Refresh = %q, want %q", svc.refreshToken, "old-refresh-token")
	}
	if payload.AccessToken != "new-access-token" {
		t.Errorf("AccessToken = %q, want %q", payload.AccessToken, "new-access-token")
	}
	if payload.RefreshToken != "new-refresh-token" {
		t.Errorf("RefreshToken = %q, want %q", payload.RefreshToken, "new-refresh-token")
	}
}

func TestRefreshTokenResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{refreshErr: service.ErrInvalidRefreshToken}
	r := &mutationResolver{&Resolver{Auth: svc}}

	if _, err := r.RefreshToken(context.Background()); !errors.Is(err, service.ErrInvalidRefreshToken) {
		t.Errorf("RefreshToken: expected %v, got %v", service.ErrInvalidRefreshToken, err)
	}
}

func TestLogoutResolverRevokesAndReturnsTrue(t *testing.T) {
	svc := &fakeAuthService{}
	r := &mutationResolver{&Resolver{Auth: svc}}

	ctx := auth.WithRefreshToken(context.Background(), "refresh-token")
	ok, err := r.Logout(ctx)
	if err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if !ok {
		t.Errorf("Logout = %v, want true", ok)
	}
	if svc.logoutToken != "refresh-token" {
		t.Errorf("logout token passed to Logout = %q, want %q", svc.logoutToken, "refresh-token")
	}
	if svc.logoutCalls != 1 {
		t.Errorf("Logout calls = %d, want 1", svc.logoutCalls)
	}
}

func TestLogoutResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{logoutErr: service.ErrUnauthenticated}
	r := &mutationResolver{&Resolver{Auth: svc}}

	if _, err := r.Logout(context.Background()); !errors.Is(err, service.ErrUnauthenticated) {
		t.Errorf("Logout: expected %v, got %v", service.ErrUnauthenticated, err)
	}
}
