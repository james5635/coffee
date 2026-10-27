package main

import (
	"context"
	"database/sql"
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
	resolvers := &graph.Resolver{
		Menu:     service.NewMenuService(store),
		Orders:   service.NewOrderService(store),
		Payments: service.NewPaymentService(store),
	}

	router := gin.Default()
	router.POST("/query", graphqlHandler(resolvers, logger))
	router.GET("/", playgroundHandler())
	if err := router.Run(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("run HTTP server", "error", err)
		os.Exit(1)
	}
}

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
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func playgroundHandler() gin.HandlerFunc {
	h := playground.Handler("GraphQL", "/query")
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}
