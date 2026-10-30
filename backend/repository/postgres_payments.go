package repository

import (
	"context"

	db "github.com/james5635/coffee/backend/db"
)

type postgresPaymentTx struct{ queries *db.Queries }

func (tx *postgresPaymentTx) GetOrderForUpdate(ctx context.Context, orderID int64) (Order, error) {
	row, err := tx.queries.GetOrderForUpdate(ctx, orderID)
	if err != nil {
		return Order{}, mapQueryError(err)
	}
	return orderFromDB(row)
}

func (tx *postgresPaymentTx) GetPaymentBalanceForUpdate(ctx context.Context, orderID int64) (PaymentBalance, error) {
	row, err := tx.queries.GetOrderPaymentBalance(ctx, orderID)
	if err != nil {
		return PaymentBalance{}, err
	}
	paid, err := ParseMoney(row.PaidTotal)
	if err != nil {
		return PaymentBalance{}, err
	}
	refunded, err := ParseMoney(row.RefundedTotal)
	if err != nil {
		return PaymentBalance{}, err
	}
	return PaymentBalance{Paid: paid, Refunded: refunded}, nil
}

func (tx *postgresPaymentTx) RecordSuccessfulPayment(ctx context.Context, payment Payment) (Payment, error) {
	row, err := tx.queries.RecordSuccessfulPayment(ctx, db.RecordSuccessfulPaymentParams{
		OrderID: payment.OrderID, RecordedBy: nullInt64(payment.RecordedBy),
		Method: string(payment.Method), Amount: FormatMoney(payment.Amount),
		ExternalReference: nullString(payment.ExternalReference),
	})
	if err != nil {
		return Payment{}, err
	}
	return paymentFromDB(row)
}

func (tx *postgresPaymentTx) CreateRefund(ctx context.Context, payment Payment) (Payment, error) {
	row, err := tx.queries.CreateRefund(ctx, db.CreateRefundParams{
		OrderID: payment.OrderID, RecordedBy: nullInt64(payment.RecordedBy),
		Method: string(payment.Method), Amount: FormatMoney(payment.Amount),
		ExternalReference: nullString(payment.ExternalReference),
	})
	if err != nil {
		return Payment{}, err
	}
	return paymentFromDB(row)
}

func paymentFromDB(row db.Payment) (Payment, error) {
	amount, err := ParseMoney(row.Amount)
	if err != nil {
		return Payment{}, err
	}
	payment := Payment{
		ID: row.ID, OrderID: row.OrderID, RecordedBy: nullableInt64(row.RecordedBy),
		Kind: PaymentKind(row.Kind), Status: PaymentStatus(row.Status),
		Method: PaymentMethod(row.Method), Amount: amount,
		ExternalReference: nullableString(row.ExternalReference), CreatedAt: row.CreatedAt,
	}
	if row.SettledAt.Valid {
		settledAt := row.SettledAt.Time
		payment.SettledAt = &settledAt
	}
	return payment, nil
}
