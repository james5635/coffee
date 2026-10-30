package repository

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound = errors.New("repository: not found")
	ErrConflict = errors.New("repository: conflict")
)

type MenuRepository interface {
	ListCategories(context.Context) ([]Category, error)
	ListProducts(context.Context, *int64) ([]Product, error)
	GetSellableProduct(context.Context, int64) (Product, error)
}

type OrderRepository interface {
	GetOrder(context.Context, int64) (Order, error)
	GetCustomerByUserID(context.Context, int64) (Customer, error)
	ListPreparationQueue(context.Context) ([]Order, error)
	WithinOrderTx(context.Context, func(OrderTx) error) error
}

type OrderTx interface {
	GetShopSettings(context.Context) (ShopSettings, error)
	GetCustomerByUserID(context.Context, int64) (Customer, error)
	GetOrCreateCustomer(context.Context, int64) (Customer, error)
	GetSellableProduct(context.Context, int64) (Product, error)
	CreateOrder(context.Context, Order) (Order, error)
	AddOrderItem(context.Context, OrderItem) (OrderItem, error)
	AddOrderItemModifier(context.Context, OrderItemModifier) (OrderItemModifier, error)
	GetOrderForUpdate(context.Context, int64) (Order, error)
	SetOrderStatus(context.Context, int64, OrderStatus, OrderStatus) (Order, error)
}

type PaymentRepository interface {
	WithinPaymentTx(context.Context, func(PaymentTx) error) error
}

type PaymentTx interface {
	GetOrderForUpdate(context.Context, int64) (Order, error)
	GetPaymentBalanceForUpdate(context.Context, int64) (PaymentBalance, error)
	RecordSuccessfulPayment(context.Context, Payment) (Payment, error)
	CreateRefund(context.Context, Payment) (Payment, error)
}

// AuthRepository is the repository-layer auth surface consumed by AuthService.
// It maps generated sqlc query results into shared repository business types.
type AuthRepository interface {
	GetUserByEmail(context.Context, string) (User, error)
	GetUserByID(context.Context, int64) (User, error)
	ListUserRoles(context.Context, int64) ([]Role, error)
	ListRolePermissions(context.Context, int64) ([]Permission, error)
	InsertRefreshToken(context.Context, string, int64, time.Time) (RefreshToken, error)
	GetRefreshTokenByHash(context.Context, string) (RefreshToken, error)
	RevokeRefreshToken(context.Context, int64) error
	// RotateRefreshToken revokes the refresh token with the given ID and inserts
	// a new refresh token for the user in a single transaction. If either
	// operation fails the transaction is rolled back, so a user is never left
	// with a revoked token and no replacement.
	RotateRefreshToken(context.Context, int64, string, int64, time.Time) (RefreshToken, error)
}
