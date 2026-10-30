package service

import "errors"

var (
	ErrInvalidInput        = errors.New("invalid input")
	ErrInvalidState        = errors.New("invalid state")
	ErrNotFound            = errors.New("not found")
	ErrUnauthenticated     = errors.New("unauthenticated")
	ErrForbidden           = errors.New("forbidden")
	ErrInsufficient        = errors.New("insufficient balance")
	ErrTokenExpired        = errors.New("token expired")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
)
