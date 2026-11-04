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
	topItems      []repository.TopItem
	err           error

	// captured args, used to pin the service's window arguments.
	lastTopStart, lastTopEnd time.Time
	lastTopLimit             int
	lastHourStart, lastHourEnd time.Time
	lastHourTZ                 string
	lastRefundStart, lastRefundEnd time.Time
	lastSplitStart, lastSplitEnd   time.Time
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
	f.lastTopStart, f.lastTopEnd = start, end
	f.lastTopLimit = limit
	out := make([]repository.TopItem, len(f.topItems))
	copy(out, f.topItems)
	return out, nil
}

func (f *fakeReportsRepository) HourlyOrderCounts(ctx context.Context, start, end time.Time, tzName string) ([]repository.HourPoint, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastHourStart, f.lastHourEnd = start, end
	f.lastHourTZ = tzName
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
	f.lastSplitStart, f.lastSplitEnd = start, end
	out := make([]repository.PaymentMethodPoint, len(f.splitRows))
	copy(out, f.splitRows)
	return out, nil
}

func (f *fakeReportsRepository) RefundTotals(ctx context.Context, start, end time.Time) (repository.RefundTotals, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastRefundStart, f.lastRefundEnd = start, end
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
	// November Berlin is CET (UTC+1), so that's 2026-11-01T23:30 Berlin,
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

func TestTopItemsPopulated(t *testing.T) {
	repo := newFakeReportsRepository()
	repo.topItems = []repository.TopItem{
		{ProductName: "Latte", Quantity: 10, Revenue: repository.Money(4500)},
		{ProductName: "Cappuccino", Quantity: 5, Revenue: repository.Money(2000)},
	}
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	berlin, _ := time.LoadLocation("Europe/Berlin")
	todayStart := time.Date(2026, 11, 3, 0, 0, 0, 0, berlin)
	wantStart7 := todayStart.AddDate(0, 0, -6)
	wantTomorrow := todayStart.AddDate(0, 0, 1)

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if len(summary.TopItems) != 2 {
		t.Fatalf("topItems = %d, want 2", len(summary.TopItems))
	}
	if summary.TopItems[0].ProductName != "Latte" || summary.TopItems[0].Quantity != 10 {
		t.Fatalf("topItems[0] = %+v, want Latte x10", summary.TopItems[0])
	}
	if summary.TopItems[1].ProductName != "Cappuccino" || summary.TopItems[1].Quantity != 5 {
		t.Fatalf("topItems[1] = %+v, want Cappuccino x5", summary.TopItems[1])
	}
	// pinned to the trailing-7-day window ending today, limit 5
	if !repo.lastTopStart.Equal(wantStart7) {
		t.Fatalf("topItems start = %v, want %v", repo.lastTopStart, wantStart7)
	}
	if !repo.lastTopEnd.Equal(wantTomorrow) {
		t.Fatalf("topItems end = %v, want %v", repo.lastTopEnd, wantTomorrow)
	}
	if repo.lastTopLimit != 5 {
		t.Fatalf("topItems limit = %d, want 5", repo.lastTopLimit)
	}
}

func TestHoursTrailingSevenDaysWindow(t *testing.T) {
	repo := newFakeReportsRepository()
	repo.hourRows = []repository.HourPoint{
		{Hour: 10, OrderCount: 4},
		{Hour: 11, OrderCount: 7},
	}
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	berlin, _ := time.LoadLocation("Europe/Berlin")
	todayStart := time.Date(2026, 11, 3, 0, 0, 0, 0, berlin)
	wantStart7 := todayStart.AddDate(0, 0, -6)
	wantTomorrow := todayStart.AddDate(0, 0, 1)

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if len(summary.Hours) != 24 {
		t.Fatalf("hours entries = %d, want 24", len(summary.Hours))
	}
	if summary.Hours[10].OrderCount != 4 || summary.Hours[11].OrderCount != 7 {
		t.Fatalf("hours not aggregated: %+v", summary.Hours)
	}
	for h := 0; h < 24; h++ {
		if summary.Hours[h].Hour != h {
			t.Fatalf("hours[%d].Hour = %d, want %d", h, summary.Hours[h].Hour, h)
		}
	}
	// pinned to the trailing-7-day window ending today, shop tz
	if !repo.lastHourStart.Equal(wantStart7) {
		t.Fatalf("hour start = %v, want %v", repo.lastHourStart, wantStart7)
	}
	if !repo.lastHourEnd.Equal(wantTomorrow) {
		t.Fatalf("hour end = %v, want %v", repo.lastHourEnd, wantTomorrow)
	}
	if repo.lastHourTZ != "Europe/Berlin" {
		t.Fatalf("hour tz = %q, want Europe/Berlin", repo.lastHourTZ)
	}
}

func TestAverageOrderValueSignAware(t *testing.T) {
	// positive half-up
	if got := averageOrderValue(repository.Money(350), 3); got != 117 {
		t.Fatalf("averageOrderValue(350, 3) = %d, want 117", got)
	}
	// negative half-up, away from zero: -350/3 = -116.66 -> -117
	if got := averageOrderValue(repository.Money(-350), 3); got != -117 {
		t.Fatalf("averageOrderValue(-350, 3) = %d, want -117", got)
	}
	// negative exact
	if got := averageOrderValue(repository.Money(-351), 3); got != -117 {
		t.Fatalf("averageOrderValue(-351, 3) = %d, want -117", got)
	}
	// negative below half
	if got := averageOrderValue(repository.Money(-349), 3); got != -116 {
		t.Fatalf("averageOrderValue(-349, 3) = %d, want -116", got)
	}
	// zero orders
	if got := averageOrderValue(0, 0); got != 0 {
		t.Fatalf("averageOrderValue(0, 0) = %d, want 0", got)
	}
}

func TestAverageOrderValueNegativeNetViaService(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	berlin, _ := time.LoadLocation("Europe/Berlin")
	todayStart := time.Date(2026, 11, 3, 0, 0, 0, 0, berlin)
	tomorrow := todayStart.Add(24 * time.Hour)
	// gross 1000¢, refunds 1500¢ recorded today ⇒ net -500¢ over 3 orders ⇒ -167¢ (sign-aware half-up)
	repo.periodTotals[keyFor(todayStart, tomorrow)] = repository.PeriodTotals{
		GrossSales: 1000, Refunds: 1500, RefundCount: 2, OrderCount: 3,
	}

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	summary, err := svc.GetSalesSummary(ctx)
	if err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	if summary.Today.NetSales != -500 {
		t.Fatalf("today net sales = %d, want -500", summary.Today.NetSales)
	}
	if summary.Today.AverageOrderValue != -167 {
		t.Fatalf("today AOV = %d, want -167 (sign-aware half-up of -500/3)", summary.Today.AverageOrderValue)
	}
}

func TestThirtyDayCalendarWindow(t *testing.T) {
	repo := newFakeReportsRepository()
	svc := NewReportService(repo)

	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	nowFunc = func() time.Time { return now }
	defer func() { nowFunc = time.Now }()

	berlin, _ := time.LoadLocation("Europe/Berlin")
	todayStart := time.Date(2026, 11, 3, 0, 0, 0, 0, berlin)
	wantStart30 := todayStart.AddDate(0, 0, -29)
	wantTomorrow := todayStart.AddDate(0, 0, 1)

	ctx := auth.WithPrincipal(context.Background(), principalWith("report.sales.read"))
	if _, err := svc.GetSalesSummary(ctx); err != nil {
		t.Fatalf("GetSalesSummary: %v", err)
	}
	// refunds and payment split both span the trailing 30 calendar days ending today
	if !repo.lastRefundStart.Equal(wantStart30) || !repo.lastRefundEnd.Equal(wantTomorrow) {
		t.Fatalf("refund window = [%v, %v), want [%v, %v)",
			repo.lastRefundStart, repo.lastRefundEnd, wantStart30, wantTomorrow)
	}
	if !repo.lastSplitStart.Equal(wantStart30) || !repo.lastSplitEnd.Equal(wantTomorrow) {
		t.Fatalf("split window = [%v, %v), want [%v, %v)",
			repo.lastSplitStart, repo.lastSplitEnd, wantStart30, wantTomorrow)
	}
}
