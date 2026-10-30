package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ErrExpired is returned by VerifyAccessToken when an access token's
// expiry has passed.
var ErrExpired = errors.New("auth: token expired")

const (
	// accessTokenTTL is the short-lived lifetime of an issued access JWT.
	accessTokenTTL = 15 * time.Minute
)

// accessClaims is the JWT payload of an access token.
type accessClaims struct {
	UserID      int64    `json:"sub"`
	IssuedAt    int64    `json:"iat"`
	ExpiresAt   int64    `json:"exp"`
	Issuer      string   `json:"iss"`
	Audience    string   `json:"aud"`
	Roles       []string `json:"roles,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

// SignAccessToken signs an HS256 access JWT with sub, iat, exp, iss, aud,
// roles and permissions claims. The token expires after 15 minutes.
func SignAccessToken(secret, issuer, audience string, userID int64, roles, permissions []string) (string, error) {
	return signAccessToken(secret, issuer, audience, userID, roles, permissions, accessTokenTTL)
}

// signAccessToken builds and signs an access JWT with the given TTL.
// TTL is a seam for tests; SignAccessToken fixes it at 15 minutes.
func signAccessToken(secret, issuer, audience string, userID int64, roles, permissions []string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := accessClaims{
		UserID:      userID,
		IssuedAt:    now.Unix(),
		ExpiresAt:   now.Add(ttl).Unix(),
		Issuer:      issuer,
		Audience:    audience,
		Roles:       roles,
		Permissions: permissions,
	}
	return signJWT([]byte(secret), claims)
}

// VerifyAccessToken validates the signature, issuer, audience and expiry of
// an access JWT and returns the subject (user ID). An expired token returns
// ErrExpired.
func VerifyAccessToken(secret, issuer, audience, tokenString string) (int64, error) {
	claims, err := verifyJWT([]byte(secret), tokenString)
	if err != nil {
		return 0, err
	}
	if claims.Issuer != issuer {
		return 0, fmt.Errorf("invalid issuer: %q", claims.Issuer)
	}
	if claims.Audience != audience {
		return 0, fmt.Errorf("invalid audience: %q", claims.Audience)
	}
	if time.Now().Unix() >= claims.ExpiresAt {
		return 0, ErrExpired
	}
	return claims.UserID, nil
}

// GenerateRefreshToken returns an opaque, URL-safe refresh token of 32
// cryptographically random bytes encoded as base64url.
func GenerateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HashRefreshToken returns the SHA-256 hex digest of a raw refresh token.
func HashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func signJWT(secret []byte, claims accessClaims) (string, error) {
	header, err := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	signingInput := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingInput))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return signingInput + "." + signature, nil
}

func verifyJWT(secret []byte, tokenString string) (accessClaims, error) {
	var claims accessClaims
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return claims, fmt.Errorf("malformed token")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return claims, fmt.Errorf("invalid token signature")
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return claims, fmt.Errorf("invalid token signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return claims, fmt.Errorf("invalid token payload")
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, fmt.Errorf("invalid token payload")
	}
	if claims.UserID <= 0 {
		return claims, fmt.Errorf("invalid token subject")
	}
	return claims, nil
}
