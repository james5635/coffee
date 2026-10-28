package service

import (
	"context"

	"github.com/james5635/coffee/backend/service/domain"
)

type MenuService interface {
	Categories(context.Context) ([]domain.Category, error)
	Products(context.Context, *int64) ([]domain.Product, error)
}

type OrderService interface {
	PlaceOrder(context.Context, domain.PlaceOrderInput) (domain.Order, error)
	GetOrder(context.Context, int64) (domain.Order, error)
	PreparationQueue(context.Context) ([]domain.Order, error)
	AdvanceStatus(context.Context, int64, domain.OrderStatus) (domain.Order, error)
}

type PaymentService interface {
	RecordPayment(context.Context, domain.RecordPaymentInput) (domain.Payment, error)
	IssueRefund(context.Context, domain.IssueRefundInput) (domain.Payment, error)
}
