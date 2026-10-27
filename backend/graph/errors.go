package graph

import (
	"context"
	"errors"
	"log/slog"

	"github.com/99designs/gqlgen/graphql"
	"github.com/james5635/coffee/backend/service"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func ErrorPresenter(logger *slog.Logger) graphql.ErrorPresenterFunc {
	if logger == nil {
		logger = slog.Default()
	}
	return func(ctx context.Context, err error) *gqlerror.Error {
		presented := graphql.DefaultErrorPresenter(ctx, err)
		var gqlErr *gqlerror.Error
		if errors.As(err, &gqlErr) && gqlErr.Err == nil {
			if presented.Extensions == nil {
				presented.Extensions = make(map[string]interface{})
			}
			if _, exists := presented.Extensions["code"]; !exists {
				presented.Extensions["code"] = "GRAPHQL_ERROR"
			}
			return presented
		}
		cause := err
		if errors.As(err, &gqlErr) && gqlErr.Err != nil {
			cause = gqlErr.Err
		}
		code, message := errorCodeAndMessage(cause)
		if code == "INTERNAL" {
			logger.ErrorContext(ctx, "GraphQL request failed", "error", cause)
		}
		presented.Message = message
		if presented.Extensions == nil {
			presented.Extensions = make(map[string]interface{})
		}
		presented.Extensions["code"] = code
		return presented
	}
}

func errorCodeAndMessage(err error) (string, string) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		return "BAD_USER_INPUT", "The supplied input is invalid."
	case errors.Is(err, service.ErrInvalidState):
		return "INVALID_STATE", "The operation is not allowed in the current state."
	case errors.Is(err, service.ErrNotFound):
		return "NOT_FOUND", "The requested record was not found."
	case errors.Is(err, service.ErrUnauthenticated):
		return "UNAUTHENTICATED", "Authentication is required."
	case errors.Is(err, service.ErrForbidden):
		return "FORBIDDEN", "You are not allowed to perform this operation."
	case errors.Is(err, service.ErrInsufficient):
		return "INSUFFICIENT_BALANCE", "The amount exceeds the available balance."
	default:
		return "INTERNAL", "An internal error occurred."
	}
}
