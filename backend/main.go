package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/james5635/coffee/backend/graph"
	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/service"
	"github.com/james5635/coffee/backend/utils/auth"
	"github.com/vektah/gqlparser/v2/ast"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		logger.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	database, err := sql.Open("pgx", databaseURL)
	if err != nil {
		logger.Error("open database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := database.PingContext(ctx); err != nil {
		logger.Error("connect to database", "error", err)
		os.Exit(1)
	}

	store, err := repository.NewPostgres(database)
	if err != nil {
		logger.Error("initialize database repositories", "error", err)
		os.Exit(1)
	}

	// Auth service: JWT secret/issuer/audience from env with development defaults.
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		secret = "development-secret-do-not-use-in-production"
	}
	issuer := strings.TrimSpace(os.Getenv("JWT_ISSUER"))
	if issuer == "" {
		issuer = "coffee"
	}
	audience := strings.TrimSpace(os.Getenv("JWT_AUDIENCE"))
	if audience == "" {
		audience = "coffee-api"
	}
	authService := service.NewAuthService(store, secret, issuer, audience)

	resolvers := &graph.Resolver{
		Menu:     service.NewMenuService(store),
		Orders:   service.NewOrderService(store),
		Payments: service.NewPaymentService(store),
		Auth:     authService,
		Reports:  service.NewReportService(store),
	}

	router := gin.Default()
	router.POST("/query", bearerMiddleware(authService, logger), graphqlHandler(resolvers, logger))
	router.GET("/", playgroundHandler())
	if err := router.Run(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("run HTTP server", "error", err)
		os.Exit(1)
	}
}

// bearerMiddleware authenticates bearer access tokens and populates the request
// context. A valid bearer token resolves a principal (protected operations can
// then succeed); an expired or invalid bearer token short-circuits with 401 *unless*
// a refresh_token cookie is present, in which case the request proceeds
// anonymously so the refreshToken/logout resolvers can run the recovery path
// (expired access → 401 → client exchanges refresh token, or logout with an
// expired access token). No bearer token leaves the context anonymous, so public
// operations keep working while protected operations fail closed in the service
// layer. The refresh token (if present as a cookie) is stored in the context for
// the refreshToken/logout resolvers.
func bearerMiddleware(authService service.AuthService, logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// Refresh token travels in an HttpOnly cookie; expose it to resolvers
		// via context without taking it as a GraphQL argument.
		if refreshToken, err := c.Cookie("refresh_token"); err == nil && refreshToken != "" {
			ctx = auth.WithRefreshToken(ctx, refreshToken)
		}

		token := bearerToken(c.Request)
		if token == "" {
			// No bearer token: anonymous context, proceed.
			c.Request = c.Request.WithContext(ctx)
			c.Next()
			return
		}

		principal, err := authService.Authenticate(ctx, token)
		if err != nil {
			if errors.Is(err, service.ErrTokenExpired) || errors.Is(err, service.ErrUnauthenticated) {
				// If a refresh token cookie is present, proceed anonymously so the
				// refreshToken/logout resolvers can run (refresh-after-expiry and
				// logout recovery). The principal stays unset, so protected
				// operations still fail closed. Without a refresh cookie, keep the
				// existing 401 behavior.
				if _, cookieErr := c.Cookie("refresh_token"); cookieErr == nil {
					c.Request = c.Request.WithContext(ctx)
					c.Next()
					return
				}
				// Expired or invalid bearer token: 401, which clients treat as
				// "log out / discard tokens". This is the only case where a bad
				// token should clear client-side state.
				logger.WarnContext(ctx, "bearer authentication failed", "error", err)
				c.AbortWithStatus(http.StatusUnauthorized)
				return
			}
			// Infrastructure failures (e.g. a wrapped "get user: ..." error)
			// must not be surfaced as 401; log and return 500 instead.
			logger.ErrorContext(ctx, "bearer authentication failed", "error", err)
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		ctx = auth.WithPrincipal(ctx, principal)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// bearerToken extracts the token from an Authorization: Bearer <token> header.
func bearerToken(r *http.Request) string {
	const bearer = "Bearer "
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, bearer) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(auth, bearer))
}

// bufferWriter captures a handler's body and status without committing headers
// to the underlying response, so the GraphQL response can be inspected (for
// refresh-token cookie issuance) before being flushed.
type bufferWriter struct {
	http.ResponseWriter
	buf       bytes.Buffer
	status    int
	wroteHead bool
}

func (w *bufferWriter) Header() http.Header { return w.ResponseWriter.Header() }

func (w *bufferWriter) Write(p []byte) (int, error) {
	if !w.wroteHead {
		w.WriteHeader(http.StatusOK)
	}
	return w.buf.Write(p)
}

func (w *bufferWriter) WriteHeader(code int) {
	w.wroteHead = true
	w.status = code
}

// graphqlHandler builds the gqlgen handler and wraps it so the refresh-token
// cookie is issued or cleared based on the GraphQL response: a successful
// login or refresh sets the cookie from the returned refresh token; a
// successful logout clears it.
func graphqlHandler(resolvers *graph.Resolver, logger *slog.Logger) gin.HandlerFunc {
	h := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolvers}))
	h.AddTransport(transport.Options{})
	h.AddTransport(transport.GET{})
	h.AddTransport(transport.POST{})
	h.SetQueryCache(lru.New[*ast.QueryDocument](1000))
	h.SetErrorPresenter(graph.ErrorPresenter(logger))
	h.Use(extension.Introspection{})
	h.Use(extension.AutomaticPersistedQuery{Cache: lru.New[string](100)})
	return func(c *gin.Context) {
		bw := &bufferWriter{ResponseWriter: c.Writer}
		h.ServeHTTP(bw, c.Request)

		token, action := refreshCookieAction(bw.buf.Bytes())
		switch action {
		case "set":
			setRefreshTokenCookie(c, token)
		case "clear":
			clearRefreshTokenCookie(c)
		}

		status := bw.status
		if status == 0 {
			status = http.StatusOK
		}
		c.Writer.WriteHeader(status)
		if _, err := c.Writer.Write(bw.buf.Bytes()); err != nil {
			logger.ErrorContext(c.Request.Context(), "write graphql response", "error", err)
		}
	}
}

// refreshCookieAction inspects a buffered GraphQL response body and returns the
// refresh token and the cookie action to take: "set" on a successful login or
// refresh, "clear" on a successful logout, "none" otherwise.
func refreshCookieAction(body []byte) (string, string) {
	var parsed struct {
		Data   map[string]json.RawMessage `json:"data"`
		Errors []json.RawMessage          `json:"errors"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil || len(parsed.Errors) > 0 {
		return "", "none"
	}

	// Successful login or refresh: issue the cookie with the returned refresh
	// token. The data key is the GraphQL field name ("login" / "refreshToken");
	// the payload field is "refreshToken" (per model.AuthPayload).
	for _, key := range []string{"login", "refreshToken"} {
		raw, ok := parsed.Data[key]
		if !ok || len(raw) == 0 || string(raw) == "null" {
			continue
		}
		var payload struct {
			RefreshToken string `json:"refreshToken"`
		}
		if err := json.Unmarshal(raw, &payload); err != nil || payload.RefreshToken == "" {
			continue
		}
		return payload.RefreshToken, "set"
	}

	// Successful logout: clear the cookie.
	if raw, ok := parsed.Data["logout"]; ok && len(raw) > 0 && string(raw) != "null" {
		var loggedOut bool
		if err := json.Unmarshal(raw, &loggedOut); err == nil && loggedOut {
			return "", "clear"
		}
	}

	return "", "none"
}

func refreshTokenCookieSecure() bool {
	return gin.Mode() == gin.ReleaseMode
}

func setRefreshTokenCookie(c *gin.Context, token string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		Path:     "/",
		MaxAge:   int(service.RefreshTokenTTL.Seconds()),
		HttpOnly: true,
		Secure:   refreshTokenCookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func clearRefreshTokenCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   refreshTokenCookieSecure(),
		SameSite: http.SameSiteLaxMode,
	})
}

func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL", "/query")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
