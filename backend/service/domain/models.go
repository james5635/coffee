package domain

import "time"

// Money stores currency values in the database's two-decimal scale.
type Money int64

// TaxRate stores a rate at the database's five-decimal scale (100000 = 100%).
type TaxRate int64

type Category struct {
	ID          int64
	Name        string
	Description string
	SortOrder   int32
	IsActive    bool
	CreatedAt   time.Time
}

type Modifier struct {
	ID         int64
	Name       string
	PriceDelta Money
	SortOrder  int32
}

type ModifierGroup struct {
	ID            int64
	Name          string
	MinSelections int32
	MaxSelections int32
	IsRequired    bool
	SortOrder     int32
	Options       []Modifier
}

type Product struct {
	ID          int64
	CategoryID  *int64
	Name        string
	Description string
	Price       Money
	SKU         *string
	IsAvailable bool
	Groups      []ModifierGroup
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Customer struct {
	ID          int64
	UserID      *int64
	DisplayName string
	Email       *string
	Phone       *string
	CreatedAt   time.Time
}

type ShopSettings struct {
	Name     string
	Currency string
	TaxRate  TaxRate
}

type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"
	OrderAccepted  OrderStatus = "accepted"
	OrderPreparing OrderStatus = "preparing"
	OrderReady     OrderStatus = "ready"
	OrderCompleted OrderStatus = "completed"
	OrderCancelled OrderStatus = "cancelled"
)

type OrderType string

const (
	OrderTakeaway OrderType = "takeaway"
	OrderDineIn   OrderType = "dine_in"
	OrderDelivery OrderType = "delivery"
)

type Order struct {
	ID             int64
	OrderNumber    int64
	CustomerID     *int64
	CreatedBy      *int64
	Status         OrderStatus
	Type           OrderType
	CustomerName   *string
	CustomerEmail  *string
	Notes          string
	Subtotal       Money
	DiscountAmount Money
	TaxAmount      Money
	Total          Money
	Currency       string
	CreatedAt      time.Time
	UpdatedAt      time.Time
	CompletedAt    *time.Time
	Items          []OrderItem
	Payments       []Payment
}

type OrderItem struct {
	ID                  int64
	OrderID             int64
	ProductID           *int64
	ProductName         string
	Quantity            int32
	UnitPrice           Money
	LineTotal           Money
	SpecialInstructions string
	Modifiers           []OrderItemModifier
}

type OrderItemModifier struct {
	ID           int64
	OrderItemID  int64
	ModifierID   *int64
	ModifierName string
	PriceDelta   Money
}

type PaymentKind string

const (
	PaymentKindPayment PaymentKind = "payment"
	PaymentKindRefund  PaymentKind = "refund"
)

type PaymentStatus string

const PaymentSucceeded PaymentStatus = "succeeded"

type PaymentMethod string

const (
	PaymentCash   PaymentMethod = "cash"
	PaymentCard   PaymentMethod = "card"
	PaymentOnline PaymentMethod = "online"
	PaymentOther  PaymentMethod = "other"
)

type Payment struct {
	ID                int64
	OrderID           int64
	RecordedBy        *int64
	Kind              PaymentKind
	Status            PaymentStatus
	Method            PaymentMethod
	Amount            Money
	ExternalReference *string
	CreatedAt         time.Time
	SettledAt         *time.Time
}

type PaymentBalance struct {
	Paid     Money
	Refunded Money
}

func (b PaymentBalance) Net() Money { return b.Paid - b.Refunded }
