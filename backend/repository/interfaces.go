package repository

import (
	"context"
	"errors"

	"github.com/james5635/coffee/backend/service/domain"
)

var (
	ErrNotFound = errors.New("repository: not found")
	ErrConflict = errors.New("repository: conflict")
)

type MenuRepository interface {
	ListCategories(context.Context) ([]domain.Category, error)
	ListProducts(context.Context, *int64) ([]domain.Product, error)
	GetSellableProduct(context.Context, int64) (domain.Product, error)
}

type OrderRepository interface {
	GetOrder(context.Context, int64) (domain.Order, error)
	GetCustomerByUserID(context.Context, int64) (domain.Customer, error)
	ListPreparationQueue(context.Context) ([]domain.Order, error)
	WithinOrderTx(context.Context, func(OrderTx) error) error
}

type OrderTx interface {
	GetShopSettings(context.Context) (domain.ShopSettings, error)
	GetCustomerByUserID(context.Context, int64) (domain.Customer, error)
	GetOrCreateCustomer(context.Context, int64) (domain.Customer, error)
	GetSellableProduct(context.Context, int64) (domain.Product, error)
	CreateOrder(context.Context, domain.Order) (domain.Order, error)
	AddOrderItem(context.Context, domain.OrderItem) (domain.OrderItem, error)
	AddOrderItemModifier(context.Context, domain.OrderItemModifier) (domain.OrderItemModifier, error)
	GetOrderForUpdate(context.Context, int64) (domain.Order, error)
	SetOrderStatus(context.Context, int64, domain.OrderStatus, domain.OrderStatus) (domain.Order, error)
}

type PaymentRepository interface {
	WithinPaymentTx(context.Context, func(PaymentTx) error) error
}

type PaymentTx interface {
	GetOrderForUpdate(context.Context, int64) (domain.Order, error)
	GetPaymentBalanceForUpdate(context.Context, int64) (domain.PaymentBalance, error)
	RecordSuccessfulPayment(context.Context, domain.Payment) (domain.Payment, error)
	CreateRefund(context.Context, domain.Payment) (domain.Payment, error)
}
