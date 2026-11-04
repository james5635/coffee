package service

import (
	"context"
	"fmt"
	"time"

	"github.com/james5635/coffee/backend/repository"
)

// nowFunc is the injected clock, swappable in tests.
var nowFunc = time.Now

type reportService struct {
	repository repository.ReportsRepository
}

// ReportsService is the read-only sales reports surface.
type ReportsService interface {
	GetSalesSummary(ctx context.Context) (repository.SalesSummary, error)
}

// NewReportService constructs a ReportsService backed by the given repository.
func NewReportService(repo repository.ReportsRepository) ReportsService {
	return &reportService{repository: repo}
}

func (s *reportService) GetSalesSummary(ctx context.Context) (repository.SalesSummary, error) {
	principal, err := principalFor(ctx)
	if err != nil {
		return repository.SalesSummary{}, err
	}
	if err := requirePermission(principal, "report.sales.read"); err != nil {
		return repository.SalesSummary{}, err
	}

	settings, err := s.repository.GetShopSettings(ctx)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("get shop settings: %w", err)
	}

	tzName := settings.Timezone
	loc, err := time.LoadLocation(tzName)
	if err != nil || tzName == "" {
		loc = time.UTC
		tzName = "UTC"
	}

	now := nowFunc()
	todayStart := time.Date(
		now.In(loc).Year(), now.In(loc).Month(), now.In(loc).Day(),
		0, 0, 0, 0, loc,
	)
	tomorrowStart := todayStart.AddDate(0, 0, 1)
	yesterdayStart := todayStart.AddDate(0, 0, -1)
	// trailing 7 calendar days ending today: [todayStart-6, tomorrowStart)
	start7 := todayStart.AddDate(0, 0, -6)
	// trailing 30 calendar days ending today: [todayStart-29, tomorrowStart)
	start30 := todayStart.AddDate(0, 0, -29)

	today, err := s.repository.PeriodTotals(ctx, todayStart, tomorrowStart)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("period totals today: %w", err)
	}
	yesterday, err := s.repository.PeriodTotals(ctx, yesterdayStart, todayStart)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("period totals yesterday: %w", err)
	}

	trend, err := s.repository.SalesTrend(ctx, tzName, 7)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("sales trend: %w", err)
	}

	// Top 5 items over the trailing 7 calendar days ending today.
	topItems, err := s.repository.TopItems(ctx, start7, tomorrowStart, 5)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("top items: %w", err)
	}

	// Orders by hour over the trailing 7 calendar days ending today, zero-filled 0–23.
	hours, err := s.repository.HourlyOrderCounts(ctx, start7, tomorrowStart, tzName)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("hourly order counts: %w", err)
	}

	// Refunds and payment split over the trailing 30 calendar days ending today.
	refunds, err := s.repository.RefundTotals(ctx, start30, tomorrowStart)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("refund totals: %w", err)
	}

	recentRefunds, err := s.repository.RecentRefunds(ctx, 5)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("recent refunds: %w", err)
	}

	split, err := s.repository.PaymentMethodTotals(ctx, start30, tomorrowStart)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("payment method totals: %w", err)
	}

	return repository.SalesSummary{
		Currency:  settings.Currency,
		Timezone:  settings.Timezone,
		Today:     snapshot(today),
		Yesterday: snapshot(yesterday),
		Trend:     trend,
		TopItems:  topItems,
		Hours:     expandHours(hours),
		Refunds:   refunds,
		RecentRefunds: recentRefunds,
		Split:     split,
	}, nil
}

func snapshot(p repository.PeriodTotals) repository.SalesSnapshot {
	net := p.GrossSales - p.Refunds
	return repository.SalesSnapshot{
		NetSales:          net,
		GrossSales:        p.GrossSales,
		OrderCount:        p.OrderCount,
		AverageOrderValue: averageOrderValue(net, p.OrderCount),
		RefundCount:       p.RefundCount,
		RefundTotal:       p.Refunds,
	}
}

// averageOrderValue returns net/orderCount in cents, rounded half-up.
// The rounding is sign-aware: a remainder of at least half the divisor rounds
// away from zero, so negative nets round correctly (e.g. -350¢/3 → -117¢,
// not -116¢). Zero orders ⇒ 0¢. Integer math only — no floats.
func averageOrderValue(net repository.Money, orders int) repository.Money {
	if orders <= 0 {
		return 0
	}
	n := int64(net)
	o := int64(orders)
	q := n / o // truncates toward zero
	r := n % o // same sign as n
	// half-up: a remainder of at least half the divisor rounds away from zero
	if 2*r >= o || 2*r <= -o {
		if n >= 0 {
			q++
		} else {
			q--
		}
	}
	return repository.Money(q)
}

// expandHours returns a fixed 0–23 slice, zero-filling hours absent from rows.
func expandHours(rows []repository.HourPoint) []repository.HourPoint {
	counts := make(map[int]int, len(rows))
	for _, r := range rows {
		counts[r.Hour] = r.OrderCount
	}
	out := make([]repository.HourPoint, 24)
	for h := 0; h < 24; h++ {
		out[h] = repository.HourPoint{Hour: h, OrderCount: counts[h]}
	}
	return out
}
