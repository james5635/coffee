package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/utils/auth"
)

const testPassword = "secret-password"

type fakeAuthRepository struct {
	mu      sync.Mutex
	users   map[int64]repository.User
	byEmail map[string]int64
	roles   map[int64][]repository.Role
	perms   map[int64][]repository.Permission
	tokens  map[string]repository.RefreshToken // tokenHash -> token
	nextID  int64
}

func newFakeAuthRepository() *fakeAuthRepository {
	hash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	user := repository.User{
		ID:           1,
		Email:        "alice@example.com",
		PasswordHash: string(hash),
		DisplayName:  "Alice",
		IsActive:     true,
	}
	repo := &fakeAuthRepository{
		users:   map[int64]repository.User{1: user},
		byEmail: map[string]int64{"alice@example.com": 1},
		roles: map[int64][]repository.Role{
			1: {{ID: 1, Name: "owner_admin", Description: "full access"}},
		},
		perms: map[int64][]repository.Permission{
			1: {{ID: 1, Code: "menu.read", Description: "read menu"}, {ID: 2, Code: "order.create", Description: "create orders"}},
		},
		tokens: map[string]repository.RefreshToken{},
	}
	return repo
}

func (f *fakeAuthRepository) GetUserByEmail(ctx context.Context, email string) (repository.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id, ok := f.byEmail[email]
	if !ok {
		return repository.User{}, repository.ErrNotFound
	}
	return f.users[id], nil
}

func (f *fakeAuthRepository) GetUserByID(ctx context.Context, userID int64) (repository.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	user, ok := f.users[userID]
	if !ok {
		return repository.User{}, repository.ErrNotFound
	}
	return user, nil
}

func (f *fakeAuthRepository) ListUserRoles(ctx context.Context, userID int64) ([]repository.Role, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	roles, ok := f.roles[userID]
	if !ok {
		return nil, nil
	}
	out := make([]repository.Role, len(roles))
	copy(out, roles)
	return out, nil
}

func (f *fakeAuthRepository) ListRolePermissions(ctx context.Context, roleID int64) ([]repository.Permission, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	perms, ok := f.perms[roleID]
	if !ok {
		return nil, nil
	}
	out := make([]repository.Permission, len(perms))
	copy(out, perms)
	return out, nil
}

func (f *fakeAuthRepository) InsertRefreshToken(ctx context.Context, tokenHash string, userID int64, expiresAt time.Time) (repository.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.nextID++
	token := repository.RefreshToken{
		ID:        f.nextID,
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	f.tokens[tokenHash] = token
	return token, nil
}

func (f *fakeAuthRepository) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (repository.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	token, ok := f.tokens[tokenHash]
	if !ok {
		return repository.RefreshToken{}, repository.ErrNotFound
	}
	return token, nil
}

func (f *fakeAuthRepository) RevokeRefreshToken(ctx context.Context, tokenID int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, token := range f.tokens {
		if token.ID == tokenID {
			now := time.Now()
			token.RevokedAt = &now
			f.tokens[token.TokenHash] = token
			break
		}
	}
	return nil
}

func (f *fakeAuthRepository) RotateRefreshToken(ctx context.Context, tokenID int64, tokenHash string, userID int64, expiresAt time.Time) (repository.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	// Revoke the presented token.
	for _, token := range f.tokens {
		if token.ID == tokenID {
			now := time.Now()
			token.RevokedAt = &now
			f.tokens[token.TokenHash] = token
			break
		}
	}
	// Insert the rotated token.
	f.nextID++
	token := repository.RefreshToken{
		ID:        f.nextID,
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	f.tokens[tokenHash] = token
	return token, nil
}

func newAuthService(t *testing.T, repo repository.AuthRepository) *authService {
	t.Helper()
	return &authService{repository: repo, secret: "test-secret", issuer: "coffee-test", audience: "coffee-test"}
}

func TestLoginIssuesPairAndPersistsHashedRefreshToken(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	pair, err := svc.Login(context.Background(), "alice@example.com", testPassword)
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatalf("Login returned empty tokens: %+v", pair)
	}
	if pair.ExpiresIn != 15*60 {
		t.Fatalf("Login ExpiresIn = %d, want %d", pair.ExpiresIn, 15*60)
	}

	userID, err := auth.VerifyAccessToken("test-secret", "coffee-test", "coffee-test", pair.AccessToken)
	if err != nil {
		t.Fatalf("access token does not verify: %v", err)
	}
	if userID != 1 {
		t.Fatalf("access token subject = %d, want 1", userID)
	}

	repo.mu.Lock()
	var stored *repository.RefreshToken
	for _, token := range repo.tokens {
		if token.UserID == 1 && token.TokenHash == auth.HashRefreshToken(pair.RefreshToken) && token.RevokedAt == nil {
			stored = &token
		}
	}
	repo.mu.Unlock()
	if stored == nil {
		t.Fatalf("Login did not persist a hashed refresh token for user 1")
	}
	if stored.ExpiresAt.Before(time.Now().Add(29*24*time.Hour)) || stored.ExpiresAt.After(time.Now().Add(31*24*time.Hour)) {
		t.Fatalf("persisted refresh token expires at %v, expected ~30 days from now", stored.ExpiresAt)
	}
}

func TestLoginRejectsUnknownUserAndWrongPassword(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	if _, err := svc.Login(context.Background(), "nobody@example.com", testPassword); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("Login unknown user: expected %v, got %v", ErrUnauthenticated, err)
	}
	if _, err := svc.Login(context.Background(), "alice@example.com", "wrong-password"); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("Login wrong password: expected %v, got %v", ErrUnauthenticated, err)
	}
}

func TestLoginRejectsInactiveUser(t *testing.T) {
	repo := newFakeAuthRepository()
	repo.mu.Lock()
	user := repo.users[1]
	user.IsActive = false
	repo.users[1] = user
	repo.mu.Unlock()
	svc := newAuthService(t, repo)

	if _, err := svc.Login(context.Background(), "alice@example.com", testPassword); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("Login inactive user: expected %v, got %v", ErrUnauthenticated, err)
	}
}

func TestRefreshRejectsUnknownToken(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	if _, err := svc.Refresh(context.Background(), "never-issued-token"); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("Refresh unknown token: expected %v, got %v", ErrInvalidRefreshToken, err)
	}
}

func TestRefreshRotatesToken(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	first, err := svc.Login(context.Background(), "alice@example.com", testPassword)
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	second, err := svc.Refresh(context.Background(), first.RefreshToken)
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if second.RefreshToken == first.RefreshToken {
		t.Fatal("Refresh did not rotate the refresh token")
	}

	repo.mu.Lock()
	var oldToken, newToken *repository.RefreshToken
	for _, token := range repo.tokens {
		if token.UserID == 1 {
			if token.TokenHash == auth.HashRefreshToken(first.RefreshToken) {
				oldToken = &token
			}
			if token.TokenHash == auth.HashRefreshToken(second.RefreshToken) {
				newToken = &token
			}
		}
	}
	repo.mu.Unlock()
	if oldToken == nil || oldToken.RevokedAt == nil {
		t.Fatal("Refresh did not revoke the presented refresh token")
	}
	if newToken == nil || newToken.RevokedAt != nil {
		t.Fatal("Refresh did not insert the new refresh token")
	}
	if newToken.ExpiresAt.Before(time.Now().Add(29*24*time.Hour)) || newToken.ExpiresAt.After(time.Now().Add(31*24*time.Hour)) {
		t.Fatalf("rotated refresh token expires at %v, expected ~30 days from now", newToken.ExpiresAt)
	}

	// The rotated-away token must no longer be usable.
	if _, err := svc.Refresh(context.Background(), first.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("Refresh revoked token: expected %v, got %v", ErrInvalidRefreshToken, err)
	}

	userID, err := auth.VerifyAccessToken("test-secret", "coffee-test", "coffee-test", second.AccessToken)
	if err != nil || userID != 1 {
		t.Fatalf("rotated access token subject = %d (%v), want 1", userID, err)
	}
}

func TestAuthenticateVerifiesAccessTokenAndLoadsPrincipal(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	pair, err := svc.Login(context.Background(), "alice@example.com", testPassword)
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	principal, err := svc.Authenticate(context.Background(), pair.AccessToken)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if principal.UserID != 1 {
		t.Fatalf("principal user ID = %d, want 1", principal.UserID)
	}
	if !principal.HasRole("owner_admin") {
		t.Fatal("principal missing role owner_admin")
	}
	if !principal.HasPermission("menu.read") || !principal.HasPermission("order.create") {
		t.Fatalf("principal missing permissions: %+v", principal.Permissions)
	}
}

func TestAuthenticateRejectsInvalidTokens(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	if _, err := svc.Authenticate(context.Background(), "not.a.jwt"); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("Authenticate malformed token: expected %v, got %v", ErrUnauthenticated, err)
	}
	if _, err := svc.Authenticate(context.Background(), "wrong.wrong.wrong"); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("Authenticate bad signature: expected %v, got %v", ErrUnauthenticated, err)
	}
}

func TestAuthenticateRejectsExpiredToken(t *testing.T) {
	repo := newFakeAuthRepository()
	svc := newAuthService(t, repo)

	expiredToken, err := auth.SignAccessTokenWithTTL("test-secret", "coffee-test", "coffee-test", 1, nil, nil, -time.Second)
	if err != nil {
		t.Fatalf("SignAccessTokenWithTTL: %v", err)
	}

	if _, err := svc.Authenticate(context.Background(), expiredToken); !errors.Is(err, ErrTokenExpired) {
		t.Fatalf("Authenticate expired token: expected %v, got %v", ErrTokenExpired, err)
	}
}
