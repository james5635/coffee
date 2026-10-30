package auth

import (
	"errors"
	"testing"
	"time"
)

func TestSignAndVerifyAccessTokenRoundTrip(t *testing.T) {
	const (
		secret   = "test-secret"
		issuer   = "coffee-test"
		audience = "coffee-test"
		userID   = 42
	)
	roles := []string{"owner_admin", "cashier"}
	permissions := []string{"menu.read", "order.create"}

	token, err := SignAccessToken(secret, issuer, audience, userID, roles, permissions)
	if err != nil {
		t.Fatalf("SignAccessToken: %v", err)
	}
	if token == "" {
		t.Fatal("SignAccessToken returned an empty token")
	}

	gotID, err := VerifyAccessToken(secret, issuer, audience, token)
	if err != nil {
		t.Fatalf("VerifyAccessToken: %v", err)
	}
	if gotID != userID {
		t.Fatalf("VerifyAccessToken returned user ID %d, want %d", gotID, userID)
	}
}

func TestVerifyAccessTokenRejectsWrongSecret(t *testing.T) {
	token, err := SignAccessToken("secret-a", "issuer", "audience", 7, nil, nil)
	if err != nil {
		t.Fatalf("SignAccessToken: %v", err)
	}
	if _, err := VerifyAccessToken("secret-b", "issuer", "audience", token); err == nil {
		t.Fatal("VerifyAccessToken accepted a token signed with a different secret")
	}
}

func TestVerifyAccessTokenRejectsExpiredToken(t *testing.T) {
	token, err := SignAccessTokenWithTTL("secret", "issuer", "audience", 9, nil, nil, -time.Second)
	if err != nil {
		t.Fatalf("signAccessToken: %v", err)
	}
	gotID, err := VerifyAccessToken("secret", "issuer", "audience", token)
	if err == nil {
		t.Fatalf("VerifyAccessToken accepted an expired token, got user ID %d", gotID)
	}
	if !errors.Is(err, ErrExpired) {
		t.Fatalf("VerifyAccessToken returned %v, want %v", err, ErrExpired)
	}
}

func TestGenerateRefreshTokenIsRandomAndURLSafe(t *testing.T) {
	first, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}
	second, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken: %v", err)
	}
	if first == second {
		t.Fatal("GenerateRefreshToken returned the same value twice")
	}
	for _, r := range first {
		if (r < 'A' || r > 'Z') && (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' && r != '_' {
			t.Fatalf("GenerateRefreshToken contains non-urlsafe character %q", r)
		}
	}
}

func TestHashRefreshTokenIsDeterministicSHA256Hex(t *testing.T) {
	hash1 := HashRefreshToken("opaque-token")
	hash2 := HashRefreshToken("opaque-token")
	if hash1 != hash2 {
		t.Fatal("HashRefreshToken is not deterministic")
	}
	if len(hash1) != 64 {
		t.Fatalf("HashRefreshToken returned %d hex chars, want 64", len(hash1))
	}
	if HashRefreshToken("other-token") == hash1 {
		t.Fatal("HashRefreshToken collided for different tokens")
	}
}
