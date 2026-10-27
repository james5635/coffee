package service

import (
	"context"
	"fmt"

	"github.com/james5635/coffee/backend/utils/auth"
)

func principalFor(ctx context.Context) (auth.Principal, error) {
	principal, ok := auth.PrincipalFromContext(ctx)
	if !ok {
		return auth.Principal{}, ErrUnauthenticated
	}
	return principal, nil
}

func requirePermission(principal auth.Principal, permission string) error {
	if !principal.HasPermission(permission) {
		return fmt.Errorf("%w: missing %s", ErrForbidden, permission)
	}
	return nil
}

func isStaff(principal auth.Principal) bool {
	return principal.HasRole("owner_admin") || principal.HasRole("manager") ||
		principal.HasRole("cashier") || principal.HasRole("barista")
}

func isBaristaOnly(principal auth.Principal) bool {
	return principal.HasRole("barista") && !principal.HasRole("owner_admin") &&
		!principal.HasRole("manager") && !principal.HasRole("cashier")
}
