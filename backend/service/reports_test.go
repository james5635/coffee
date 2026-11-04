package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/utils/auth"
)

// fakeReportsRepository is an in-memory ReportsRepository following the
// fakeAuthRepository pattern (maps + mutex + ctx).
type fakeReportsRepository struct {
	mu            sync.Mutex
	settings      repository.ShopSettings
	periodTotals  map[[2]int64]repository.PeriodTotals
	trendRows     []repository.DayPoint
	hourRows      []repository.HourPoint
	splitRows     []repository.PaymentMethodPoint
	refundTotals  map[[2]int64]repository.RefundTotals
	recentRefunds []repository.RefundLine
	err           error
}

func newFakeReportsRepository() *fakeReportsRepository {
	return &fakeReportsRepository{
		settings: repository.ShopSettings{
			Currency: "USD",
			Timezone: "Europe/Berlin",
		},
		periodTotals: make(map[[2]int64]repository.PeriodTotals),
		refundTotals: make(map[[2]int64]repository.RefundTotals),
	}
}

func keyFor(start, end time.Time) [2]int64 { return [2]int64{start.Unix(), end.Unix()} }

func (f *fakeReportsRepository) GetShopSettings(ctx context.Context) (repository.ShopSettings, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.settings, f.err
}

func (f *fakeReportsRepository) PeriodTotals(ctx context.Context, start, end time.Time) (repository.PeriodTotals, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return repository.PeriodTotals{}, f.err
	}
	if v, ok := f.periodTotals[keyFor(start, end)]; ok {
		return v, nil
	}
	return repository.PeriodTotals{}, nil
}

func (f *fakeReportsRepository) SalesTrend(ctx context.Context, tzName string, days int) ([]repository.DayPoint, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	if f.trendRows != nil {
		out := make([]repository.DayPoint, len(f.trendRows))
		copy(out, f.trendRows)
		return out, nil
	}
	return make([]repository.DayPoint, days), nil
}

func (f *fakeReportsRepository) TopItems(ctx context.Context, start, end time.Time, limit int) ([]repository.TopItem, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return nil, nil
}

func (f *fakeReportsRepository) HourlyOrderCounts(ctx context.Context, start, end time.Time, tzName string) ([]repository.HourPoint, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	out := make([]repository.HourPoint, len(f.hourRows))
	copy(out, f.hourRows)
	return out, nil
}

func (f *fakeReportsRepository) PaymentMethodTotals(ctx context.Context, start, end time.Time) ([]repository.PaymentMethodPoint, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]repository.PaymentMethodPoint, len(f.splitRows))
	copy(out, f.splitRows)
	return out, nil
}

func (f *fakeReportsRepository) RefundTotals(ctx context.Context, start, end time.Time) (repository.RefundTotals, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return repository.RefundTotals{}, f.err
	}
	if v, ok := f.refundTotals[keyFor(start, end)]; ok {
		return v, nil
	}
	return repository.RefundTotals{}, nil
}

func (f *fakeReportsRepository) RecentRefunds(ctx context.Context, limit int) ([]repository.RefundLine, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]repository.RefundLine, len(f.recentRefunds))
	copy(out, f.recentRefunds)
	return out, nil
}

func principalWith(perms ...string) auth.Principal {
	return auth.NewPrincipal(1, []string{"owner_admin"}, perms)
}

func principalNoPerms() auth.Principal {
	return auth.NewPrincipal(1, []string{"owner_admin"}, []string{"order.read.all"})
}

func TestGetSalesSummaryAnonymous(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	_, err := svc.GetSalesSummary(context.Background())
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("expected ErrUnauthenticated, got %v", err)
	}
}

func TestGetSalesSummaryRequiresPermission(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	// order.read.all only → forbidden
	_, err := svc.GetSalesSummary(auth.WithPrincipal(context.Background(), principalNoPerms()))
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}

	// report.sales.read → success
	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	_, err = svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
}

func TestNetSalesSubtractsRefunds(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	berlin, _ := time.LoadLocation("Europe/Berlin")
	// todayStart in Berlin = Nov 3 00:00 Berlin = Nov 2 23:00 UTC
	todayStart := time.Date(2026, 11, 3, 0, 0, 0, 0, berlin)
	tomorrowStart := todayStart.Add(24 * time.Hour)
	// today window (Berlin tz): gross 10000¢, refunds 2500¢ ⇒ net 7500¢
	repo.periodTotals[keyFor(todayStart, tomorrowStart)] = repository.PeriodTotals{
		GrossSales: 10000, Refunds: 2500, RefundCount: 1, OrderCount: 3,
	}
	// yesterday window unaffected by today's refunds
	yesterdayStart := todayStart.Add(-24 * time.Hour)
	yesterdayEnd := todayStart
	repo.periodTotals[keyFor(yesterdayStart, yesterdayEnd)] = repository.PeriodTotals{
		GrossSales: 4000, Refunds: 0, RefundCount: 0, OrderCount: 2,
	}

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if summary.Today.NetSales != 7500 {
		t.Fatalf("today net sales = %d, want 7500", summary.Today.NetSales)
	}
	if summary.Today.GrossSales != 10000 {
		t.Fatalf("today gross sales = %d, want 10000", summary.Today.GrossSales)
	}
	if summary.Yesterday.NetSales != 4000 {
		t.Fatalf("yesterday net sales = %d, want 4000 (unaffected by today's refunds)", summary.Yesterday.NetSales)
	}
}

func TestAverageOrderValueHalfUp(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	berlin, _ := time.LoadLocation("Europe/Berlin")
	todayStart := time.Date(2026, 11, 3, 0, 0, 0, 0, berlin)
	tomorrow := todayStart.Add(24 * time.Hour)
	// net 350¢ ÷ 3 orders ⇒ 117¢ (half-up: 116.66→117)
	repo.periodTotals[keyFor(todayStart, tomorrow)] = repository.PeriodTotals{
		GrossSales: 1000, Refunds: 650, RefundCount: 1, OrderCount: 3,
	}

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if summary.Today.AverageOrderValue != 117 {
		t.Fatalf("AOV = %d, want 117 (half-up of 350/3)", summary.Today.AverageOrderValue)
	}

	// zero orders ⇒ 0¢
	repo.periodTotals[keyFor(todayStart, tomorrow)] = repository.PeriodTotals{
		GrossSales: 0, Refunds: 0, RefundCount: 0, OrderCount: 0,
	}
	summary, err = svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if summary.Today.AverageOrderValue != 0 {
		t.Fatalf("zero-order AOV = %d, want 0", summary.Today.AverageOrderValue)
	}
}

func TestTimezoneBucketingRespected(t *testing.T) {
	repo := newFakeReportsRepository()
	repo.settings.Timezone = "Europe/Berlin"
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	// Payment at 2026-11-02T00:30+02:00 = 2026-11-01T22:30 UTC.
	// In Berlin (UTC+1 in Nov? actually CET = UTC+1) that's 2026-11-01T23:30 Berlin,
	// i.e. day 2026-11-01, NOT UTC day 2026-11-02.
	repo.trendRows = []repository.DayPoint{
		{Day: "2026-11-01", NetSales: 5000, OrderCount: 2},
		{Day: "2026-11-02", NetSales: 0, OrderCount: 0},
		{Day: "2026-11-03", NetSales: 7000, OrderCount: 4},
		{Day: "2026-11-04", NetSales: 0, OrderCount: 0},
		{Day: "2026-11-05", NetSales: 0, OrderCount: 0},
		{Day: "2026-11-06", NetSales: 0, OrderCount: 0},
		{Day: "2026-11-07", NetSales: 0, OrderCount: 0},
	}

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if summary.Timezone != "Europe/Berlin" {
		t.Fatalf("timezone echoed = %q, want Europe/Berlin", summary.Timezone)
	}
	found := false
	for _, d := range summary.Trend {
		if d.Day == "2026-11-01" && d.NetSales == 5000 {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected trend day 2026-11-01 with net 5000 (Berlin bucketing), got %+v", summary.Trend)
	}
	if len(summary.Trend) != 7 {
		t.Fatalf("trend rows = %d, want 7", len(summary.Trend))
	}
}

func TestHoursAllZeroFill(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	// no orders ⇒ Hours expands to 24 zero entries
	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if len(summary.Hours) != 24 {
		t.Fatalf("hours entries = %d, want 24", len(summary.Hours))
	}
	for i, h := range summary.Hours {
		if h.Hour != i || h.OrderCount != 0 {
			t.Fatalf("hour[%d] = %+v, want {Hour: %d, OrderCount: 0}", i, h, i)
		}
	}
}
