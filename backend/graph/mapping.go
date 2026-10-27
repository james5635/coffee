package graph

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/james5635/coffee/backend/graph/model"
	"github.com/james5635/coffee/backend/graph/scalar"
	"github.com/james5635/coffee/backend/service"
	"github.com/james5635/coffee/backend/service/domain"
)

func graphID(id int64) string { return strconv.FormatInt(id, 10) }

func parseGraphID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id < 1 {
		return 0, fmt.Errorf("%w: invalid ID", service.ErrInvalidInput)
	}
	return id, nil
}

func parseGraphMoney(value scalar.Decimal) (domain.Money, error) {
	money, err := domain.ParseMoney(string(value))
	if err != nil {
		return 0, fmt.Errorf("%w: invalid amount", service.ErrInvalidInput)
	}
	return money, nil
}

func graphCategory(category domain.Category) *model.Category {
	return &model.Category{
		ID: graphID(category.ID), Name: category.Name,
		Description: category.Description, SortOrder: category.SortOrder,
	}
}

func graphProduct(product domain.Product) *model.Product {
	result := &model.Product{
		ID: graphID(product.ID), Name: product.Name, Description: product.Description,
		Price: scalar.Decimal(domain.FormatMoney(product.Price)), Sku: product.SKU,
		ModifierGroups: make([]*model.ModifierGroup, 0, len(product.Groups)),
	}
	if product.CategoryID != nil {
		categoryID := graphID(*product.CategoryID)
		result.CategoryID = &categoryID
	}
	for _, group := range product.Groups {
		mappedGroup := &model.ModifierGroup{
			ID: graphID(group.ID), Name: group.Name, MinSelections: group.MinSelections,
			MaxSelections: group.MaxSelections, IsRequired: group.IsRequired,
			SortOrder: group.SortOrder, Modifiers: make([]*model.Modifier, 0, len(group.Options)),
		}
		for _, modifier := range group.Options {
			mappedGroup.Modifiers = append(mappedGroup.Modifiers, &model.Modifier{
				ID: graphID(modifier.ID), Name: modifier.Name,
				PriceDelta: scalar.Decimal(domain.FormatMoney(modifier.PriceDelta)),
				SortOrder:  modifier.SortOrder,
			})
		}
		result.ModifierGroups = append(result.ModifierGroups, mappedGroup)
	}
	return result
}

func graphOrder(order domain.Order) *model.Order {
	result := &model.Order{
		ID: graphID(order.ID), OrderNumber: graphID(order.OrderNumber),
		Status:       model.OrderStatus(strings.ToUpper(string(order.Status))),
		OrderType:    model.OrderType(strings.ToUpper(string(order.Type))),
		CustomerName: order.CustomerName, CustomerEmail: order.CustomerEmail, Notes: order.Notes,
		Subtotal:       scalar.Decimal(domain.FormatMoney(order.Subtotal)),
		DiscountAmount: scalar.Decimal(domain.FormatMoney(order.DiscountAmount)),
		TaxAmount:      scalar.Decimal(domain.FormatMoney(order.TaxAmount)),
		Total:          scalar.Decimal(domain.FormatMoney(order.Total)), Currency: order.Currency,
		CreatedAt: order.CreatedAt, UpdatedAt: order.UpdatedAt,
		CompletedAt: order.CompletedAt, Items: make([]*model.OrderItem, 0, len(order.Items)),
		Payments: make([]*model.Payment, 0, len(order.Payments)),
	}
	for _, item := range order.Items {
		mappedItem := &model.OrderItem{
			ID: graphID(item.ID), ProductName: item.ProductName, Quantity: item.Quantity,
			UnitPrice:           scalar.Decimal(domain.FormatMoney(item.UnitPrice)),
			LineTotal:           scalar.Decimal(domain.FormatMoney(item.LineTotal)),
			SpecialInstructions: item.SpecialInstructions,
			Modifiers:           make([]*model.OrderItemModifier, 0, len(item.Modifiers)),
		}
		if item.ProductID != nil {
			id := graphID(*item.ProductID)
			mappedItem.ProductID = &id
		}
		for _, modifier := range item.Modifiers {
			mappedModifier := &model.OrderItemModifier{
				ID: graphID(modifier.ID), ModifierName: modifier.ModifierName,
				PriceDelta: scalar.Decimal(domain.FormatMoney(modifier.PriceDelta)),
			}
			if modifier.ModifierID != nil {
				id := graphID(*modifier.ModifierID)
				mappedModifier.ModifierID = &id
			}
			mappedItem.Modifiers = append(mappedItem.Modifiers, mappedModifier)
		}
		result.Items = append(result.Items, mappedItem)
	}
	for _, payment := range order.Payments {
		result.Payments = append(result.Payments, graphPayment(payment))
	}
	return result
}

func graphPayment(payment domain.Payment) *model.Payment {
	return &model.Payment{
		ID: graphID(payment.ID), Kind: model.PaymentKind(strings.ToUpper(string(payment.Kind))),
		Status:            model.PaymentStatus(strings.ToUpper(string(payment.Status))),
		Method:            model.PaymentMethod(strings.ToUpper(string(payment.Method))),
		Amount:            scalar.Decimal(domain.FormatMoney(payment.Amount)),
		ExternalReference: payment.ExternalReference, CreatedAt: payment.CreatedAt,
		SettledAt: payment.SettledAt,
	}
}
