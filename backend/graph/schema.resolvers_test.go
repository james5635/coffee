package graph

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"time"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/service"
	"github.com/james5635/coffee/backend/utils/auth"
)

// fakeAuthService is a test double for service.AuthService used by the GraphQL
// resolver tests.
type fakeAuthService struct {
	loginPair    service.TokenPair
	loginErr     error
	refreshPair  service.TokenPair
	refreshErr   error
	refreshToken string
	logoutErr    error
	logoutToken  string
	logoutCalls  int
	viewer       service.Viewer
	viewerErr    error
}

func (f *fakeAuthService) Login(ctx context.Context, email, password string) (service.TokenPair, error) {
	return f.loginPair, f.loginErr
}

func (f *fakeAuthService) Refresh(ctx context.Context, refreshToken string) (service.TokenPair, error) {
	f.refreshToken = refreshToken
	return f.refreshPair, f.refreshErr
}

func (f *fakeAuthService) Logout(ctx context.Context, refreshToken string) error {
	f.logoutToken = refreshToken
	f.logoutCalls++
	return f.logoutErr
}

func (f *fakeAuthService) Authenticate(ctx context.Context, accessToken string) (auth.Principal, error) {
	return auth.Principal{}, nil
}

func (f *fakeAuthService) Viewer(ctx context.Context) (service.Viewer, error) {
	return f.viewer, f.viewerErr
}

func TestLoginResolverMapsTokenPair(t *testing.T) {
	svc := &fakeAuthService{
		loginPair: service.TokenPair{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			ExpiresIn:    900,
		},
	}
	r := &mutationResolver{&Resolver{Auth: svc}}

	payload, err := r.Login(context.Background(), "alice@example.com", "password")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if payload.AccessToken != "access-token" {
		t.Errorf("AccessToken = %q, want %q", payload.AccessToken, "access-token")
	}
	if payload.RefreshToken != "refresh-token" {
		t.Errorf("RefreshToken = %q, want %q", payload.RefreshToken, "refresh-token")
	}
	if payload.TokenType != "Bearer" {
		t.Errorf("TokenType = %q, want %q", payload.TokenType, "Bearer")
	}
	if payload.ExpiresIn != 900 {
		t.Errorf("ExpiresIn = %d, want 900", payload.ExpiresIn)
	}
}

func TestLoginResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{loginErr: service.ErrUnauthenticated}
	r := &mutationResolver{&Resolver{Auth: svc}}

	if _, err := r.Login(context.Background(), "alice@example.com", "password"); !errors.Is(err, service.ErrUnauthenticated) {
		t.Errorf("Login: expected %v, got %v", service.ErrUnauthenticated, err)
	}
}

func TestRefreshTokenResolverReadsContextAndRotates(t *testing.T) {
	svc := &fakeAuthService{
		refreshPair: service.TokenPair{
			AccessToken:  "new-access-token",
			RefreshToken: "new-refresh-token",
			ExpiresIn:    900,
		},
	}
	r := &mutationResolver{&Resolver{Auth: svc}}

	ctx := auth.WithRefreshToken(context.Background(), "old-refresh-token")
	payload, err := r.RefreshToken(ctx)
	if err != nil {
		t.Fatalf("RefreshToken: %v", err)
	}
	if svc.refreshToken != "old-refresh-token" {
		t.Errorf("refresh token passed to Refresh = %q, want %q", svc.refreshToken, "old-refresh-token")
	}
	if payload.AccessToken != "new-access-token" {
		t.Errorf("AccessToken = %q, want %q", payload.AccessToken, "new-access-token")
	}
	if payload.RefreshToken != "new-refresh-token" {
		t.Errorf("RefreshToken = %q, want %q", payload.RefreshToken, "new-refresh-token")
	}
}

func TestRefreshTokenResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{refreshErr: service.ErrInvalidRefreshToken}
	r := &mutationResolver{&Resolver{Auth: svc}}

	if _, err := r.RefreshToken(context.Background()); !errors.Is(err, service.ErrInvalidRefreshToken) {
		t.Errorf("RefreshToken: expected %v, got %v", service.ErrInvalidRefreshToken, err)
	}
}

func TestLogoutResolverRevokesAndReturnsTrue(t *testing.T) {
	svc := &fakeAuthService{}
	r := &mutationResolver{&Resolver{Auth: svc}}

	ctx := auth.WithRefreshToken(context.Background(), "refresh-token")
	ok, err := r.Logout(ctx)
	if err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if !ok {
		t.Errorf("Logout = %v, want true", ok)
	}
	if svc.logoutToken != "refresh-token" {
		t.Errorf("logout token passed to Logout = %q, want %q", svc.logoutToken, "refresh-token")
	}
	if svc.logoutCalls != 1 {
		t.Errorf("Logout calls = %d, want 1", svc.logoutCalls)
	}
}

func TestLogoutResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{logoutErr: service.ErrUnauthenticated}
	r := &mutationResolver{&Resolver{Auth: svc}}

	if _, err := r.Logout(context.Background()); !errors.Is(err, service.ErrUnauthenticated) {
		t.Errorf("Logout: expected %v, got %v", service.ErrUnauthenticated, err)
	}
}

// fakeReportsService is a test double for service.ReportsService used by the
// GraphQL resolver tests.
type fakeReportsService struct {
	summary repository.SalesSummary
	err     error
}

func (f *fakeReportsService) GetSalesSummary(ctx context.Context) (repository.SalesSummary, error) {
	return f.summary, f.err
}

func TestSalesSummaryResolverMapsPayload(t *testing.T) {
	svc := &fakeReportsService{
		summary: repository.SalesSummary{
			Currency: "USD",
			Timezone: "UTC",
			Today: repository.SalesSnapshot{
				NetSales:          repository.Money(1299),
				GrossSales:        repository.Money(1500),
				OrderCount:        2,
				AverageOrderValue: repository.Money(650),
				RefundCount:       1,
				RefundTotal:       repository.Money(201),
			},
			Yesterday: repository.SalesSnapshot{
				NetSales:          repository.Money(1100),
				GrossSales:        repository.Money(1300),
				OrderCount:        1,
				AverageOrderValue: repository.Money(1100),
				RefundCount:       0,
				RefundTotal:       0,
			},
			Trend: []repository.DayPoint{
				{Day: "2026-11-01", NetSales: repository.Money(1299), OrderCount: 3},
			},
			TopItems: []repository.TopItem{
				{ProductName: "Latte", Quantity: 5, Revenue: repository.Money(2495)},
			},
			Hours: []repository.HourPoint{
				{Hour: 14, OrderCount: 7},
			},
			Split: []repository.PaymentMethodPoint{
				{Method: repository.PaymentCard, Count: 4, Amount: repository.Money(5000)},
			},
			Refunds: repository.RefundTotals{
				Count: 2,
				Total: repository.Money(950),
			},
			RecentRefunds: []repository.RefundLine{
				{OrderNumber: 42, Amount: repository.Money(500), CreatedAt: time.Date(2026, 11, 1, 14, 30, 0, 0, time.UTC)},
			},
		},
	}
	r := &queryResolver{&Resolver{Reports: svc}}

	payload, err := r.SalesSummary(context.Background())
	if err != nil {
		t.Fatalf("SalesSummary: %v", err)
	}
	if payload.Currency != "USD" {
		t.Errorf("Currency = %q, want %q", payload.Currency, "USD")
	}
	if payload.Timezone != "UTC" {
		t.Errorf("Timezone = %q, want %q", payload.Timezone, "UTC")
	}
	if payload.Today.NetSales != "12.99" {
		t.Errorf("Today.NetSales = %q, want %q", payload.Today.NetSales, "12.99")
	}
	if payload.Today.GrossSales != "15.00" {
		t.Errorf("Today.GrossSales = %q, want %q", payload.Today.GrossSales, "15.00")
	}
	if payload.Today.OrderCount != 2 {
		t.Errorf("Today.OrderCount = %d, want 2", payload.Today.OrderCount)
	}
	if payload.Today.AverageOrderValue != "6.50" {
		t.Errorf("Today.AverageOrderValue = %q, want %q", payload.Today.AverageOrderValue, "6.50")
	}
	if payload.Today.RefundCount != 1 {
		t.Errorf("Today.RefundCount = %d, want 1", payload.Today.RefundCount)
	}
	if payload.Today.RefundTotal != "2.01" {
		t.Errorf("Today.RefundTotal = %q, want %q", payload.Today.RefundTotal, "2.01")
	}
	if payload.Yesterday.NetSales != "11.00" {
		t.Errorf("Yesterday.NetSales = %q, want %q", payload.Yesterday.NetSales, "11.00")
	}
	if len(payload.Trend) != 1 || payload.Trend[0].Day != "2026-11-01" || payload.Trend[0].NetSales != "12.99" || payload.Trend[0].OrderCount != 3 {
		t.Errorf("Trend = %+v, want day 2026-11-01 netSales 12.99 orders 3", payload.Trend)
	}
	if len(payload.TopItems) != 1 || payload.TopItems[0].ProductName != "Latte" || payload.TopItems[0].Quantity != 5 || payload.TopItems[0].Revenue != "24.95" {
		t.Errorf("TopItems = %+v, want Latte x5 revenue 24.95", payload.TopItems)
	}
	if len(payload.Hours) != 1 || payload.Hours[0].Hour != 14 || payload.Hours[0].OrderCount != 7 {
		t.Errorf("Hours = %+v, want hour 14 count 7", payload.Hours)
	}
	if len(payload.Split) != 1 || payload.Split[0].Method != "CARD" || payload.Split[0].Count != 4 || payload.Split[0].Amount != "50.00" {
		t.Errorf("Split = %+v, want CARD x4 amount 50.00", payload.Split)
	}
	if payload.Refunds.Count != 2 || payload.Refunds.Total != "9.50" {
		t.Errorf("Refunds = %+v, want count 2 total 9.50", payload.Refunds)
	}
	if len(payload.Refunds.Recent) != 1 || payload.Refunds.Recent[0].OrderNumber != "42" || payload.Refunds.Recent[0].Amount != "5.00" {
		t.Errorf("Refunds.Recent = %+v, want orderNumber 42 amount 5.00", payload.Refunds.Recent)
	}
	wantCreatedAt := time.Date(2026, 11, 1, 14, 30, 0, 0, time.UTC)
	if !payload.Refunds.Recent[0].CreatedAt.Equal(wantCreatedAt) {
		t.Errorf("Refunds.Recent[0].CreatedAt = %v, want %v", payload.Refunds.Recent[0].CreatedAt, wantCreatedAt)
	}
}

func TestSalesSummaryResolverPropagatesForbidden(t *testing.T) {
	svc := &fakeReportsService{err: fmt.Errorf("denied: %w", service.ErrForbidden)}
	r := &queryResolver{&Resolver{Reports: svc}}

	_, err := r.SalesSummary(context.Background())
	if !errors.Is(err, service.ErrForbidden) {
		t.Errorf("SalesSummary: expected %v, got %v", service.ErrForbidden, err)
	}

	presenter := ErrorPresenter(slog.Default())
	gqlErr := presenter(context.Background(), err)
	code, _ := gqlErr.Extensions["code"].(string)
	if code != "FORBIDDEN" {
		t.Errorf("extensions.code = %q, want %q", code, "FORBIDDEN")
	}
}

func TestMeResolverMapsViewer(t *testing.T) {
	svc := &fakeAuthService{
		viewer: service.Viewer{ID: 42, Email: "olive@coffee.local", DisplayName: "Olive Owner", Roles: []string{"owner_admin"}},
	}
	r := &queryResolver{&Resolver{Auth: svc}}

	got, err := r.Me(context.Background())
	if err != nil {
		t.Fatalf("Me: %v", err)
	}
	if got.ID != "42" || got.Email != "olive@coffee.local" || got.DisplayName != "Olive Owner" {
		t.Fatalf("Me payload mismatch: %+v", got)
	}
	if len(got.Roles) != 1 || got.Roles[0] != "owner_admin" {
		t.Fatalf("Me roles mismatch: %v", got.Roles)
	}
}

func TestMeResolverPropagatesServiceError(t *testing.T) {
	svc := &fakeAuthService{viewerErr: service.ErrUnauthenticated}
	r := &queryResolver{&Resolver{Auth: svc}}

	if _, err := r.Me(context.Background()); !errors.Is(err, service.ErrUnauthenticated) {
		t.Fatalf("Me: expected %v, got %v", service.ErrUnauthenticated, err)
	}
}
