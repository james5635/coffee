package graph

import (
	"testing"

	"github.com/james5635/coffee/backend/service"
)

func TestErrorCodeTokenExpired(t *testing.T) {
	code, message := errorCodeAndMessage(service.ErrTokenExpired)
	if code != "TOKEN_EXPIRED" {
		t.Errorf("code = %q, want %q", code, "TOKEN_EXPIRED")
	}
	if message != "The access token has expired." {
		t.Errorf("message = %q, want %q", message, "The access token has expired.")
	}
}

func TestErrorCodeInvalidRefreshToken(t *testing.T) {
	code, message := errorCodeAndMessage(service.ErrInvalidRefreshToken)
	if code != "INVALID_REFRESH_TOKEN" {
		t.Errorf("code = %q, want %q", code, "INVALID_REFRESH_TOKEN")
	}
	if message != "The refresh token is invalid." {
		t.Errorf("message = %q, want %q", message, "The refresh token is invalid.")
	}
}

func TestErrorCodeExistingCodesUnchanged(t *testing.T) {
	code, message := errorCodeAndMessage(service.ErrUnauthenticated)
	if code != "UNAUTHENTICATED" {
		t.Errorf("code = %q, want %q", code, "UNAUTHENTICATED")
	}
	if message != "Authentication is required." {
		t.Errorf("message = %q, want %q", message, "Authentication is required.")
	}
}
