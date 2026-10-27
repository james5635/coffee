package repository

import (
	"context"

	db "github.com/james5635/coffee/backend/db"
	"github.com/james5635/coffee/backend/service/domain"
)

type postgresPaymentTx struct{ queries *db.Queries }

func (tx *postgresPaymentTx) GetOrderForUpdate(ctx context.Context, orderID int64) (domain.Order, error) {
	row, err := tx.queries.GetOrderForUpdate(ctx, orderID)
	if err != nil {
		return domain.Order{}, mapQueryError(err)
	}
	return orderFromDB(row)
}

func (tx *postgresPaymentTx) GetPaymentBalanceForUpdate(ctx context.Context, orderID int64) (domain.PaymentBalance, error) {
	row, err := tx.queries.GetOrderPaymentBalance(ctx, orderID)
	if err != nil {
		return domain.PaymentBalance{}, err
	}
	paid, err := domain.ParseMoney(row.PaidTotal)
	if err != nil {
		return domain.PaymentBalance{}, err
	}
	refunded, err := domain.ParseMoney(row.RefundedTotal)
	if err != nil {
		return domain.PaymentBalance{}, err
	}
	return domain.PaymentBalance{Paid: paid, Refunded: refunded}, nil
}

func (tx *postgresPaymentTx) RecordSuccessfulPayment(ctx context.Context, payment domain.Payment) (domain.Payment, error) {
	row, err := tx.queries.RecordSuccessfulPayment(ctx, db.RecordSuccessfulPaymentParams{
		OrderID: payment.OrderID, RecordedBy: nullInt64(payment.RecordedBy),
		Method: string(payment.Method), Amount: domain.FormatMoney(payment.Amount),
		ExternalReference: nullString(payment.ExternalReference),
	})
	if err != nil {
		return domain.Payment{}, err
	}
	return paymentFromDB(row)
}

func (tx *postgresPaymentTx) CreateRefund(ctx context.Context, payment domain.Payment) (domain.Payment, error) {
	row, err := tx.queries.CreateRefund(ctx, db.CreateRefundParams{
		OrderID: payment.OrderID, RecordedBy: nullInt64(payment.RecordedBy),
		Method: string(payment.Method), Amount: domain.FormatMoney(payment.Amount),
		ExternalReference: nullString(payment.ExternalReference),
	})
	if err != nil {
		return domain.Payment{}, err
	}
	return paymentFromDB(row)
}

func paymentFromDB(row db.Payment) (domain.Payment, error) {
	amount, err := domain.ParseMoney(row.Amount)
	if err != nil {
		return domain.Payment{}, err
	}
	payment := domain.Payment{
		ID: row.ID, OrderID: row.OrderID, RecordedBy: nullableInt64(row.RecordedBy),
		Kind: domain.PaymentKind(row.Kind), Status: domain.PaymentStatus(row.Status),
		Method: domain.PaymentMethod(row.Method), Amount: amount,
		ExternalReference: nullableString(row.ExternalReference), CreatedAt: row.CreatedAt,
	}
	if row.SettledAt.Valid {
		settledAt := row.SettledAt.Time
		payment.SettledAt = &settledAt
	}
	return payment, nil
}
