package repository

import (
	"context"
	"database/sql"
	"fmt"

	db "github.com/james5635/coffee/backend/db"
	"github.com/james5635/coffee/backend/service/domain"
)

func (p *Postgres) GetOrder(ctx context.Context, id int64) (domain.Order, error) {
	return loadOrder(ctx, p.queries, id)
}

func (p *Postgres) GetCustomerByUserID(ctx context.Context, userID int64) (domain.Customer, error) {
	row, err := p.queries.GetCustomerByUserID(ctx, sql.NullInt64{Int64: userID, Valid: true})
	if err != nil {
		return domain.Customer{}, mapQueryError(err)
	}
	return customerFromDB(row), nil
}

func (p *Postgres) ListPreparationQueue(ctx context.Context) ([]domain.Order, error) {
	rows, err := p.queries.ListPreparationQueue(ctx)
	if err != nil {
		return nil, err
	}
	orders := make([]domain.Order, 0, len(rows))
	for _, row := range rows {
		order, err := loadOrder(ctx, p.queries, row.ID)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}
	return orders, nil
}

func loadOrder(ctx context.Context, queries *db.Queries, id int64) (domain.Order, error) {
	row, err := queries.GetOrderByID(ctx, id)
	if err != nil {
		return domain.Order{}, mapQueryError(err)
	}
	order, err := orderFromDB(row)
	if err != nil {
		return domain.Order{}, err
	}
	items, err := queries.ListOrderItems(ctx, id)
	if err != nil {
		return domain.Order{}, err
	}
	order.Items = make([]domain.OrderItem, 0, len(items))
	for _, itemRow := range items {
		item, err := orderItemFromDB(itemRow)
		if err != nil {
			return domain.Order{}, err
		}
		modifierRows, err := queries.ListOrderItemModifiers(ctx, itemRow.ID)
		if err != nil {
			return domain.Order{}, err
		}
		item.Modifiers = make([]domain.OrderItemModifier, 0, len(modifierRows))
		for _, modifierRow := range modifierRows {
			modifier, err := orderItemModifierFromDB(modifierRow)
			if err != nil {
				return domain.Order{}, err
			}
			item.Modifiers = append(item.Modifiers, modifier)
		}
		order.Items = append(order.Items, item)
	}
	paymentRows, err := queries.ListOrderPayments(ctx, id)
	if err != nil {
		return domain.Order{}, err
	}
	order.Payments = make([]domain.Payment, 0, len(paymentRows))
	for _, paymentRow := range paymentRows {
		payment, err := paymentFromDB(paymentRow)
		if err != nil {
			return domain.Order{}, err
		}
		order.Payments = append(order.Payments, payment)
	}
	return order, nil
}

func orderFromDB(row db.Order) (domain.Order, error) {
	subtotal, err := domain.ParseMoney(row.Subtotal)
	if err != nil {
		return domain.Order{}, err
	}
	discount, err := domain.ParseMoney(row.DiscountAmount)
	if err != nil {
		return domain.Order{}, err
	}
	tax, err := domain.ParseMoney(row.TaxAmount)
	if err != nil {
		return domain.Order{}, err
	}
	total, err := domain.ParseMoney(row.Total)
	if err != nil {
		return domain.Order{}, err
	}
	order := domain.Order{
		ID: row.ID, CustomerID: nullableInt64(row.CustomerID), CreatedBy: nullableInt64(row.CreatedBy),
		Status: domain.OrderStatus(row.Status), Type: domain.OrderType(row.OrderType),
		CustomerName: nullableString(row.CustomerName), CustomerEmail: nullableString(row.CustomerEmail),
		Notes: row.Notes, Subtotal: subtotal, DiscountAmount: discount, TaxAmount: tax,
		Total: total, Currency: row.Currency, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
	if row.OrderNumber.Valid {
		order.OrderNumber = row.OrderNumber.Int64
	}
	if row.CompletedAt.Valid {
		completedAt := row.CompletedAt.Time
		order.CompletedAt = &completedAt
	}
	return order, nil
}

func orderItemFromDB(row db.OrderItem) (domain.OrderItem, error) {
	unitPrice, err := domain.ParseMoney(row.UnitPrice)
	if err != nil {
		return domain.OrderItem{}, err
	}
	lineTotal, err := domain.ParseMoney(row.LineTotal)
	if err != nil {
		return domain.OrderItem{}, err
	}
	return domain.OrderItem{
		ID: row.ID, OrderID: row.OrderID, ProductID: nullableInt64(row.ProductID),
		ProductName: row.ProductName, Quantity: row.Quantity, UnitPrice: unitPrice,
		LineTotal: lineTotal, SpecialInstructions: row.SpecialInstructions,
	}, nil
}

func orderItemModifierFromDB(row db.OrderItemModifier) (domain.OrderItemModifier, error) {
	priceDelta, err := domain.ParseMoney(row.PriceDelta)
	if err != nil {
		return domain.OrderItemModifier{}, err
	}
	return domain.OrderItemModifier{
		ID: row.ID, OrderItemID: row.OrderItemID, ModifierID: nullableInt64(row.ModifierID),
		ModifierName: row.ModifierName, PriceDelta: priceDelta,
	}, nil
}

func customerFromDB(row db.Customer) domain.Customer {
	return domain.Customer{
		ID: row.ID, UserID: nullableInt64(row.UserID), DisplayName: row.DisplayName,
		Email: nullableString(row.Email), Phone: nullableString(row.Phone), CreatedAt: row.CreatedAt,
	}
}

type postgresOrderTx struct{ queries *db.Queries }

func (tx *postgresOrderTx) GetCustomerByUserID(ctx context.Context, userID int64) (domain.Customer, error) {
	row, err := tx.queries.GetCustomerByUserID(ctx, sql.NullInt64{Int64: userID, Valid: true})
	if err != nil {
		return domain.Customer{}, mapQueryError(err)
	}
	return customerFromDB(row), nil
}

func (tx *postgresOrderTx) GetShopSettings(ctx context.Context) (domain.ShopSettings, error) {
	row, err := tx.queries.GetShopSettings(ctx)
	if err != nil {
		return domain.ShopSettings{}, mapQueryError(err)
	}
	taxRate, err := domain.ParseTaxRate(row.TaxRate)
	if err != nil {
		return domain.ShopSettings{}, err
	}
	return domain.ShopSettings{Name: row.Name, Currency: row.Currency, TaxRate: taxRate}, nil
}

func (tx *postgresOrderTx) GetOrCreateCustomer(ctx context.Context, userID int64) (domain.Customer, error) {
	row, err := tx.queries.GetOrCreateCustomerForUser(ctx, userID)
	if err != nil {
		return domain.Customer{}, mapQueryError(err)
	}
	return customerFromDB(row), nil
}

func (tx *postgresOrderTx) GetSellableProduct(ctx context.Context, productID int64) (domain.Product, error) {
	return sellableProduct(ctx, tx.queries, productID)
}

func (tx *postgresOrderTx) CreateOrder(ctx context.Context, order domain.Order) (domain.Order, error) {
	row, err := tx.queries.CreateOrder(ctx, db.CreateOrderParams{
		CustomerID: nullInt64(order.CustomerID), CreatedBy: nullInt64(order.CreatedBy),
		OrderType: string(order.Type), CustomerName: nullString(order.CustomerName),
		CustomerEmail: nullString(order.CustomerEmail), Notes: order.Notes,
		Subtotal: domain.FormatMoney(order.Subtotal), DiscountAmount: domain.FormatMoney(order.DiscountAmount),
		TaxAmount: domain.FormatMoney(order.TaxAmount), Total: domain.FormatMoney(order.Total), Currency: order.Currency,
	})
	if err != nil {
		return domain.Order{}, err
	}
	return orderFromDB(row)
}

func (tx *postgresOrderTx) AddOrderItem(ctx context.Context, item domain.OrderItem) (domain.OrderItem, error) {
	row, err := tx.queries.AddOrderItem(ctx, db.AddOrderItemParams{
		OrderID: item.OrderID, ProductID: nullInt64(item.ProductID), ProductName: item.ProductName,
		Quantity: item.Quantity, UnitPrice: domain.FormatMoney(item.UnitPrice),
		LineTotal: domain.FormatMoney(item.LineTotal), SpecialInstructions: item.SpecialInstructions,
	})
	if err != nil {
		return domain.OrderItem{}, err
	}
	return orderItemFromDB(row)
}

func (tx *postgresOrderTx) AddOrderItemModifier(ctx context.Context, modifier domain.OrderItemModifier) (domain.OrderItemModifier, error) {
	row, err := tx.queries.AddOrderItemModifier(ctx, db.AddOrderItemModifierParams{
		OrderItemID: modifier.OrderItemID, ModifierID: nullInt64(modifier.ModifierID),
		ModifierName: modifier.ModifierName, PriceDelta: domain.FormatMoney(modifier.PriceDelta),
	})
	if err != nil {
		return domain.OrderItemModifier{}, err
	}
	return orderItemModifierFromDB(row)
}

func (tx *postgresOrderTx) GetOrderForUpdate(ctx context.Context, orderID int64) (domain.Order, error) {
	row, err := tx.queries.GetOrderForUpdate(ctx, orderID)
	if err != nil {
		return domain.Order{}, mapQueryError(err)
	}
	return orderFromDB(row)
}

func (tx *postgresOrderTx) SetOrderStatus(ctx context.Context, orderID int64, expected, target domain.OrderStatus) (domain.Order, error) {
	row, err := tx.queries.UpdateOrderStatusIfCurrent(ctx, db.UpdateOrderStatusIfCurrentParams{
		ID: orderID, Status: string(target), Status_2: string(expected),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.Order{}, ErrConflict
		}
		return domain.Order{}, fmt.Errorf("update order status: %w", err)
	}
	return orderFromDB(row)
}

func nullInt64(value *int64) sql.NullInt64 {
	if value == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *value, Valid: true}
}

func nullString(value *string) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *value, Valid: true}
}
