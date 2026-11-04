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
	start30 := now.Add(-30 * 24 * time.Hour)

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

	hours, err := s.repository.HourlyOrderCounts(ctx, todayStart, tomorrowStart, tzName)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("hourly order counts: %w", err)
	}

	refunds, err := s.repository.RefundTotals(ctx, start30, now)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("refund totals: %w", err)
	}

	recentRefunds, err := s.repository.RecentRefunds(ctx, 5)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("recent refunds: %w", err)
	}

	split, err := s.repository.PaymentMethodTotals(ctx, start30, now)
	if err != nil {
		return repository.SalesSummary{}, fmt.Errorf("payment method totals: %w", err)
	}

	return repository.SalesSummary{
		Currency:  settings.Currency,
		Timezone:  settings.Timezone,
		Today:     snapshot(today),
		Yesterday: snapshot(yesterday),
		Trend:     trend,
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
// Zero orders ⇒ 0¢.
func averageOrderValue(net repository.Money, orders int) repository.Money {
	if orders <= 0 {
		return 0
	}
	return repository.Money((int64(net) + int64(orders)/2) / int64(orders))
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
