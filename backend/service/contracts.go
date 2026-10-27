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
	PlaceOrder(context.Context, PlaceOrderInput) (domain.Order, error)
	GetOrder(context.Context, int64) (domain.Order, error)
	PreparationQueue(context.Context) ([]domain.Order, error)
	AdvanceStatus(context.Context, int64, domain.OrderStatus) (domain.Order, error)
}

type PaymentService interface {
	RecordPayment(context.Context, RecordPaymentInput) (domain.Payment, error)
	IssueRefund(context.Context, IssueRefundInput) (domain.Payment, error)
}

type PlaceOrderInput struct {
	OrderType     domain.OrderType
	CustomerName  *string
	CustomerEmail *string
	Notes         string
	Items         []PlaceOrderItemInput
}

type PlaceOrderItemInput struct {
	ProductID           int64
	Quantity            int32
	ModifierIDs         []int64
	SpecialInstructions string
}

type RecordPaymentInput struct {
	OrderID           int64
	Method            domain.PaymentMethod
	Amount            domain.Money
	ExternalReference *string
}

type IssueRefundInput struct {
	OrderID           int64
	Method            domain.PaymentMethod
	Amount            domain.Money
	ExternalReference *string
}
