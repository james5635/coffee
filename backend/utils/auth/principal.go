package auth

import "context"

type Principal struct {
	UserID      int64
	Roles       map[string]struct{}
	Permissions map[string]struct{}
}

func NewPrincipal(userID int64, roles, permissions []string) Principal {
	principal := Principal{
		UserID:      userID,
		Roles:       make(map[string]struct{}, len(roles)),
		Permissions: make(map[string]struct{}, len(permissions)),
	}
	for _, role := range roles {
		principal.Roles[role] = struct{}{}
	}
	for _, permission := range permissions {
		principal.Permissions[permission] = struct{}{}
	}
	return principal
}

func (p Principal) HasRole(role string) bool {
	_, ok := p.Roles[role]
	return ok
}

func (p Principal) HasPermission(permission string) bool {
	_, ok := p.Permissions[permission]
	return ok
}

type principalKey struct{}

func WithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, principal)
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalKey{}).(Principal)
	return principal, ok && principal.UserID > 0
}

type refreshTokenKey struct{}

// WithRefreshToken stores the opaque refresh token (e.g. from a cookie) in the
// request context so the refreshToken/logout resolvers can consume it without
// taking it as a GraphQL argument.
func WithRefreshToken(ctx context.Context, refreshToken string) context.Context {
	return context.WithValue(ctx, refreshTokenKey{}, refreshToken)
}

// RefreshTokenFromContext returns the refresh token stored in the context, if
// any. The token is opaque and is only validated by the auth service.
func RefreshTokenFromContext(ctx context.Context) (string, bool) {
	token, ok := ctx.Value(refreshTokenKey{}).(string)
	return token, ok
}
