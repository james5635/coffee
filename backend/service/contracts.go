package service

import (
	"context"

	"github.com/james5635/coffee/backend/repository"
)

type MenuService interface {
	Categories(context.Context) ([]repository.Category, error)
	Products(context.Context, *int64) ([]repository.Product, error)
}

type OrderService interface {
	PlaceOrder(context.Context, repository.PlaceOrderInput) (repository.Order, error)
	GetOrder(context.Context, int64) (repository.Order, error)
	PreparationQueue(context.Context) ([]repository.Order, error)
	AdvanceStatus(context.Context, int64, repository.OrderStatus) (repository.Order, error)
}

type PaymentService interface {
	RecordPayment(context.Context, repository.RecordPaymentInput) (repository.Payment, error)
	IssueRefund(context.Context, repository.IssueRefundInput) (repository.Payment, error)
}
