package repository

import (
	"context"
	"fmt"
	"time"

	db "github.com/james5635/coffee/backend/db"
)

func (p *Postgres) GetShopSettings(ctx context.Context) (ShopSettings, error) {
	row, err := p.queries.GetShopSettings(ctx)
	if err != nil {
		return ShopSettings{}, mapQueryError(err)
	}
	taxRate, err := ParseTaxRate(row.TaxRate)
	if err != nil {
		return ShopSettings{}, err
	}
	return ShopSettings{Name: row.Name, Currency: row.Currency, Timezone: row.Timezone, TaxRate: taxRate}, nil
}

func (p *Postgres) PeriodTotals(ctx context.Context, start, end time.Time) (PeriodTotals, error) {
	row, err := p.queries.PeriodTotals(ctx, db.PeriodTotalsParams{CreatedAt: start, CreatedAt_2: end})
	if err != nil {
		return PeriodTotals{}, mapQueryError(err)
	}
	totals, err := mapPeriodTotals(row)
	if err != nil {
		return PeriodTotals{}, err
	}
	orderCount, err := p.queries.PeriodOrderCount(ctx, db.PeriodOrderCountParams{CreatedAt: start, CreatedAt_2: end})
	if err != nil {
		return PeriodTotals{}, fmt.Errorf("reports: period order count: %w", err)
	}
	totals.OrderCount = int(orderCount)
	return totals, nil
}

func (p *Postgres) SalesTrend(ctx context.Context, tz string, days int) ([]DayPoint, error) {
	rows, err := p.queries.SalesTrend(ctx, db.SalesTrendParams{Column1: tz, Column2: int32(days)})
	if err != nil {
		return nil, err
	}
	return mapDayPoints(rows)
}

func (p *Postgres) TopItems(ctx context.Context, start, end time.Time, limit int) ([]TopItem, error) {
	rows, err := p.queries.TopItems(ctx, db.TopItemsParams{
		CreatedAt: start, CreatedAt_2: end, Limit: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	return mapTopItems(rows)
}

func (p *Postgres) HourlyOrderCounts(ctx context.Context, start, end time.Time, tz string) ([]HourPoint, error) {
	rows, err := p.queries.HourlyOrderCounts(ctx, db.HourlyOrderCountsParams{
		CreatedAt: start, CreatedAt_2: end, Column3: tz,
	})
	if err != nil {
		return nil, err
	}
	return mapHourlyOrderCounts(rows)
}

func (p *Postgres) PaymentMethodTotals(ctx context.Context, start, end time.Time) ([]PaymentMethodPoint, error) {
	rows, err := p.queries.PaymentMethodTotals(ctx, db.PaymentMethodTotalsParams{
		CreatedAt: start, CreatedAt_2: end,
	})
	if err != nil {
		return nil, err
	}
	return mapPaymentMethodPoints(rows)
}

func (p *Postgres) RefundTotals(ctx context.Context, start, end time.Time) (RefundTotals, error) {
	row, err := p.queries.RefundTotals(ctx, db.RefundTotalsParams{CreatedAt: start, CreatedAt_2: end})
	if err != nil {
		return RefundTotals{}, mapQueryError(err)
	}
	return mapRefundTotals(row)
}

func (p *Postgres) RecentRefunds(ctx context.Context, limit int) ([]RefundLine, error) {
	rows, err := p.queries.RecentRefunds(ctx, int32(limit))
	if err != nil {
		return nil, err
	}
	return mapRecentRefunds(rows)
}

func mapPeriodTotals(row db.PeriodTotalsRow) (PeriodTotals, error) {
	gross, err := ParseMoney(row.Gross)
	if err != nil {
		return PeriodTotals{}, fmt.Errorf("reports: map period totals gross: %w", err)
	}
	refunds, err := ParseMoney(row.Refunds)
	if err != nil {
		return PeriodTotals{}, fmt.Errorf("reports: map period totals refunds: %w", err)
	}
	return PeriodTotals{GrossSales: gross, Refunds: refunds, RefundCount: int(row.RefundCount)}, nil
}

func mapDayPoints(rows []db.SalesTrendRow) ([]DayPoint, error) {
	points := make([]DayPoint, 0, len(rows))
	for _, row := range rows {
		netSales, err := ParseMoney(row.NetSales)
		if err != nil {
			return nil, fmt.Errorf("reports: map sales trend day %q: %w", row.Day, err)
		}
		points = append(points, DayPoint{Day: row.Day, NetSales: netSales, OrderCount: int(row.OrderCount)})
	}
	return points, nil
}

func mapTopItems(rows []db.TopItemsRow) ([]TopItem, error) {
	topItems := make([]TopItem, 0, len(rows))
	for _, row := range rows {
		revenue, err := ParseMoney(row.Revenue)
		if err != nil {
			return nil, fmt.Errorf("reports: map top item %q: %w", row.ProductName, err)
		}
		topItems = append(topItems, TopItem{
			ProductName: row.ProductName, Quantity: int(row.Quantity), Revenue: revenue,
		})
	}
	return topItems, nil
}

func mapHourlyOrderCounts(rows []db.HourlyOrderCountsRow) ([]HourPoint, error) {
	hourPoints := make([]HourPoint, 0, len(rows))
	for _, row := range rows {
		hourPoints = append(hourPoints, HourPoint{Hour: int(row.Hour), OrderCount: int(row.OrderCount)})
	}
	return hourPoints, nil
}

func mapPaymentMethodPoints(rows []db.PaymentMethodTotalsRow) ([]PaymentMethodPoint, error) {
	points := make([]PaymentMethodPoint, 0, len(rows))
	for _, row := range rows {
		amount, err := ParseMoney(row.Amount)
		if err != nil {
			return nil, fmt.Errorf("reports: map payment method %q: %w", row.Method, err)
		}
		points = append(points, PaymentMethodPoint{
			Method: PaymentMethod(row.Method), Count: int(row.Count), Amount: amount,
		})
	}
	return points, nil
}

func mapRefundTotals(row db.RefundTotalsRow) (RefundTotals, error) {
	total, err := ParseMoney(row.Total)
	if err != nil {
		return RefundTotals{}, fmt.Errorf("reports: map refund totals: %w", err)
	}
	return RefundTotals{Count: int(row.Count), Total: total}, nil
}

func mapRecentRefunds(rows []db.RecentRefundsRow) ([]RefundLine, error) {
	refundLines := make([]RefundLine, 0, len(rows))
	for _, row := range rows {
		amount, err := ParseMoney(row.Amount)
		if err != nil {
			return nil, fmt.Errorf("reports: map recent refund: %w", err)
		}
		orderNumber := int64(0)
		if row.OrderNumber.Valid {
			orderNumber = row.OrderNumber.Int64
		}
		refundLines = append(refundLines, RefundLine{
			OrderNumber: orderNumber, Amount: amount, CreatedAt: row.CreatedAt,
		})
	}
	return refundLines, nil
}
