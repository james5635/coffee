package repository

import (
	"database/sql"
	"testing"
	"time"

	db "github.com/james5635/coffee/backend/db"
)

func TestMapPeriodTotals(t *testing.T) {
	row := db.PeriodTotalsRow{Gross: "123.45", Refunds: "25.00", RefundCount: 2}

	got, err := mapPeriodTotals(row)
	if err != nil {
		t.Fatalf("mapPeriodTotals: %v", err)
	}
	if got.GrossSales != 12345 {
		t.Fatalf("expected gross sales of 12345 cents, got %d", got.GrossSales)
	}
	if got.Refunds != 2500 {
		t.Fatalf("expected refunds of 2500 cents, got %d", got.Refunds)
	}
	if got.RefundCount != 2 {
		t.Fatalf("expected refund count of 2, got %d", got.RefundCount)
	}
}

func TestMapDayPoints(t *testing.T) {
	rows := []db.SalesTrendRow{
		{Day: "2026-11-01", NetSales: "150.00", OrderCount: 3},
		{Day: "2026-11-02", NetSales: "0", OrderCount: 0},
	}

	got, err := mapDayPoints(rows)
	if err != nil {
		t.Fatalf("mapDayPoints: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 day points, got %d", len(got))
	}
	if got[0].Day != "2026-11-01" || got[0].NetSales != 15000 || got[0].OrderCount != 3 {
		t.Fatalf("unexpected first day point: %+v", got[0])
	}
	if got[1].Day != "2026-11-02" || got[1].NetSales != 0 || got[1].OrderCount != 0 {
		t.Fatalf("unexpected zero day point: %+v", got[1])
	}
}

func TestMapTopItems(t *testing.T) {
	rows := []db.TopItemsRow{
		{ProductName: "Espresso", Quantity: 4, Revenue: "123.45"},
	}

	got, err := mapTopItems(rows)
	if err != nil {
		t.Fatalf("mapTopItems: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 top item, got %d", len(got))
	}
	if got[0].ProductName != "Espresso" || got[0].Quantity != 4 || got[0].Revenue != 12345 {
		t.Fatalf("unexpected top item: %+v", got[0])
	}
}

func TestMapHourlyOrderCounts(t *testing.T) {
	rows := []db.HourlyOrderCountsRow{
		{Hour: 9, OrderCount: 2},
		{Hour: 0, OrderCount: 1},
	}

	got, err := mapHourlyOrderCounts(rows)
	if err != nil {
		t.Fatalf("mapHourlyOrderCounts: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 hour points, got %d", len(got))
	}
	if got[0].Hour != 9 || got[0].OrderCount != 2 {
		t.Fatalf("unexpected first hour point: %+v", got[0])
	}
	if got[1].Hour != 0 || got[1].OrderCount != 1 {
		t.Fatalf("expected hour 0 passthrough, got %+v", got[1])
	}
}

func TestMapPaymentMethodPoints(t *testing.T) {
	rows := []db.PaymentMethodTotalsRow{
		{Method: "card", Count: 4, Amount: "123.45"},
		{Method: "cash", Count: 2, Amount: "10.00"},
	}

	got, err := mapPaymentMethodPoints(rows)
	if err != nil {
		t.Fatalf("mapPaymentMethodPoints: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 payment method points, got %d", len(got))
	}
	if got[0].Method != PaymentCard || got[0].Count != 4 || got[0].Amount != 12345 {
		t.Fatalf("unexpected first payment method point: %+v", got[0])
	}
	if got[1].Method != PaymentCash || got[1].Count != 2 || got[1].Amount != 1000 {
		t.Fatalf("unexpected second payment method point: %+v", got[1])
	}
}

func TestMapRefundTotals(t *testing.T) {
	row := db.RefundTotalsRow{Count: 3, Total: "75.50"}

	got, err := mapRefundTotals(row)
	if err != nil {
		t.Fatalf("mapRefundTotals: %v", err)
	}
	if got.Count != 3 {
		t.Fatalf("expected refund count of 3, got %d", got.Count)
	}
	if got.Total != 7550 {
		t.Fatalf("expected refund total of 7550 cents, got %d", got.Total)
	}
}

func TestMapRecentRefunds(t *testing.T) {
	createdAt := time.Date(2026, 11, 2, 14, 30, 0, 0, time.UTC)
	rows := []db.RecentRefundsRow{
		{OrderNumber: sql.NullInt64{Int64: 42, Valid: true}, Amount: "25.00", CreatedAt: createdAt},
	}

	got, err := mapRecentRefunds(rows)
	if err != nil {
		t.Fatalf("mapRecentRefunds: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 recent refund, got %d", len(got))
	}
	if got[0].OrderNumber != 42 || got[0].Amount != 2500 || !got[0].CreatedAt.Equal(createdAt) {
		t.Fatalf("unexpected recent refund: %+v", got[0])
	}
}
