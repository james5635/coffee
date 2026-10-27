package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/service/domain"
	"github.com/james5635/coffee/backend/utils/auth"
)

type orderService struct{ repository repository.OrderRepository }

func NewOrderService(repository repository.OrderRepository) OrderService {
	return &orderService{repository: repository}
}

type pricedLine struct {
	product   domain.Product
	quantity  int32
	lineTotal domain.Money
	modifiers []domain.OrderItemModifier
	note      string
}

func (s *orderService) PlaceOrder(ctx context.Context, input PlaceOrderInput) (domain.Order, error) {
	if len(input.Items) == 0 {
		return domain.Order{}, fmt.Errorf("%w: order must contain at least one item", ErrInvalidInput)
	}
	if !validOrderType(input.OrderType) {
		return domain.Order{}, fmt.Errorf("%w: unsupported order type", ErrInvalidInput)
	}
	principal, authenticated := auth.PrincipalFromContext(ctx)
	if authenticated {
		if err := requirePermission(principal, "order.create"); err != nil {
			return domain.Order{}, err
		}
	}

	var created domain.Order
	err := s.repository.WithinOrderTx(ctx, func(tx repository.OrderTx) error {
		settings, err := tx.GetShopSettings(ctx)
		if err != nil {
			return fmt.Errorf("get shop settings: %w", err)
		}
		var customer *domain.Customer
		if authenticated && principal.HasRole("customer") {
			resolved, err := tx.GetOrCreateCustomer(ctx, principal.UserID)
			if err != nil {
				return fmt.Errorf("resolve customer: %w", err)
			}
			customer = &resolved
		}

		lines := make([]pricedLine, 0, len(input.Items))
		var subtotal domain.Money
		for _, lineInput := range input.Items {
			if lineInput.Quantity <= 0 {
				return fmt.Errorf("%w: item quantity must be positive", ErrInvalidInput)
			}
			product, err := tx.GetSellableProduct(ctx, lineInput.ProductID)
			if errors.Is(err, repository.ErrNotFound) {
				return fmt.Errorf("%w: product %d is unavailable", ErrInvalidInput, lineInput.ProductID)
			}
			if err != nil {
				return fmt.Errorf("load product: %w", err)
			}
			modifiers, modifierTotal, err := priceModifiers(product, lineInput.ModifierIDs)
			if err != nil {
				return err
			}
			unitTotal, err := addMoney(product.Price, modifierTotal)
			if err != nil || unitTotal < 0 {
				return fmt.Errorf("%w: item price is out of range", ErrInvalidInput)
			}
			lineTotal, err := multiplyMoney(unitTotal, lineInput.Quantity)
			if err != nil {
				return err
			}
			subtotal, err = addMoney(subtotal, lineTotal)
			if err != nil {
				return err
			}
			lines = append(lines, pricedLine{
				product: product, quantity: lineInput.Quantity, lineTotal: lineTotal,
				modifiers: modifiers, note: strings.TrimSpace(lineInput.SpecialInstructions),
			})
		}

		tax, err := calculateTax(subtotal, settings.TaxRate)
		if err != nil {
			return err
		}
		total, err := addMoney(subtotal, tax)
		if err != nil {
			return err
		}
		order := domain.Order{
			Type: input.OrderType, Notes: strings.TrimSpace(input.Notes),
			Subtotal: subtotal, TaxAmount: tax, Total: total, Currency: settings.Currency,
		}
		if customer != nil {
			order.CustomerID = int64Pointer(customer.ID)
			order.CustomerName = stringPointer(customer.DisplayName)
			order.CustomerEmail = customer.Email
		} else {
			order.CustomerName = cleanedString(input.CustomerName)
			order.CustomerEmail = cleanedString(input.CustomerEmail)
		}
		if authenticated && isStaff(principal) && !principal.HasRole("customer") {
			order.CreatedBy = int64Pointer(principal.UserID)
		}
		created, err = tx.CreateOrder(ctx, order)
		if err != nil {
			return fmt.Errorf("create order: %w", err)
		}
		created.Items = make([]domain.OrderItem, 0, len(lines))
		created.Payments = make([]domain.Payment, 0)
		for _, line := range lines {
			item, err := tx.AddOrderItem(ctx, domain.OrderItem{
				OrderID: created.ID, ProductID: int64Pointer(line.product.ID),
				ProductName: line.product.Name, Quantity: line.quantity,
				UnitPrice: line.product.Price, LineTotal: line.lineTotal,
				SpecialInstructions: line.note,
			})
			if err != nil {
				return fmt.Errorf("create order item: %w", err)
			}
			item.Modifiers = make([]domain.OrderItemModifier, 0, len(line.modifiers))
			for _, modifier := range line.modifiers {
				modifier.OrderItemID = item.ID
				saved, err := tx.AddOrderItemModifier(ctx, modifier)
				if err != nil {
					return fmt.Errorf("create order item modifier: %w", err)
				}
				item.Modifiers = append(item.Modifiers, saved)
			}
			created.Items = append(created.Items, item)
		}
		return nil
	})
	if err != nil {
		return domain.Order{}, err
	}
	return created, nil
}

func (s *orderService) GetOrder(ctx context.Context, id int64) (domain.Order, error) {
	principal, err := principalFor(ctx)
	if err != nil {
		return domain.Order{}, err
	}
	order, err := s.repository.GetOrder(ctx, id)
	if err != nil {
		return domain.Order{}, serviceRepositoryError(err)
	}
	if principal.HasPermission("order.read.all") {
		return redactPreparationOrder(principal, order), nil
	}
	if principal.HasPermission("order.read.assigned") && order.CreatedBy != nil && *order.CreatedBy == principal.UserID {
		return redactPreparationOrder(principal, order), nil
	}
	if principal.HasPermission("order.read.own") {
		customer, err := s.repository.GetCustomerByUserID(ctx, principal.UserID)
		if err == nil && order.CustomerID != nil && *order.CustomerID == customer.ID {
			return redactPreparationOrder(principal, order), nil
		}
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return domain.Order{}, err
		}
	}
	return domain.Order{}, ErrForbidden
}

func (s *orderService) PreparationQueue(ctx context.Context) ([]domain.Order, error) {
	principal, err := principalFor(ctx)
	if err != nil {
		return nil, err
	}
	if err := requirePermission(principal, "order.read.preparation_queue"); err != nil {
		return nil, err
	}
	orders, err := s.repository.ListPreparationQueue(ctx)
	if err != nil {
		return nil, err
	}
	for index := range orders {
		orders[index] = redactPreparationOrder(principal, orders[index])
	}
	return orders, nil
}

func (s *orderService) AdvanceStatus(ctx context.Context, id int64, target domain.OrderStatus) (domain.Order, error) {
	principal, err := principalFor(ctx)
	if err != nil {
		return domain.Order{}, err
	}
	var updated domain.Order
	err = s.repository.WithinOrderTx(ctx, func(tx repository.OrderTx) error {
		current, err := tx.GetOrderForUpdate(ctx, id)
		if err != nil {
			return serviceRepositoryError(err)
		}
		if target == domain.OrderCancelled {
			if err := requirePermission(principal, "order.cancel"); err != nil {
				return err
			}
			if principal.HasRole("customer") && !isStaff(principal) {
				if current.Status != domain.OrderPending {
					return ErrInvalidState
				}
				customer, err := tx.GetCustomerByUserID(ctx, principal.UserID)
				if err != nil || current.CustomerID == nil || *current.CustomerID != customer.ID {
					return ErrForbidden
				}
			} else if !isStaff(principal) || (current.Status != domain.OrderPending && current.Status != domain.OrderAccepted) {
				return ErrInvalidState
			}
		} else {
			if err := requirePermission(principal, "order.update_status"); err != nil {
				return err
			}
			if isBaristaOnly(principal) && !validBaristaTransition(current.Status, target) {
				return ErrForbidden
			}
		}
		if !validTransition(current.Status, target) {
			return ErrInvalidState
		}
		updated, err = tx.SetOrderStatus(ctx, id, current.Status, target)
		if errors.Is(err, repository.ErrConflict) {
			return ErrInvalidState
		}
		return err
	})
	if err != nil {
		return domain.Order{}, err
	}
	order, err := s.repository.GetOrder(ctx, updated.ID)
	if err != nil {
		return domain.Order{}, serviceRepositoryError(err)
	}
	return redactPreparationOrder(principal, order), nil
}

func redactPreparationOrder(principal auth.Principal, order domain.Order) domain.Order {
	preparationOnly := principal.HasPermission("order.read.preparation_queue") &&
		!principal.HasPermission("order.read.all") &&
		!principal.HasPermission("order.read.assigned") &&
		!principal.HasPermission("order.read.own")
	if preparationOnly {
		order.CustomerEmail = nil
		order.Payments = make([]domain.Payment, 0)
	}
	return order
}

func priceModifiers(product domain.Product, selectedIDs []int64) ([]domain.OrderItemModifier, domain.Money, error) {
	selected := make(map[int64]struct{}, len(selectedIDs))
	for _, id := range selectedIDs {
		if id < 1 {
			return nil, 0, fmt.Errorf("%w: invalid modifier ID", ErrInvalidInput)
		}
		if _, exists := selected[id]; exists {
			return nil, 0, fmt.Errorf("%w: duplicate modifier selection", ErrInvalidInput)
		}
		selected[id] = struct{}{}
	}
	modifiers := make([]domain.OrderItemModifier, 0, len(selectedIDs))
	var total domain.Money
	for _, group := range product.Groups {
		var count int32
		for _, option := range group.Options {
			if _, exists := selected[option.ID]; !exists {
				continue
			}
			delete(selected, option.ID)
			count++
			var err error
			total, err = addMoney(total, option.PriceDelta)
			if err != nil {
				return nil, 0, err
			}
			modifiers = append(modifiers, domain.OrderItemModifier{
				ModifierID: int64Pointer(option.ID), ModifierName: option.Name, PriceDelta: option.PriceDelta,
			})
		}
		if count < group.MinSelections || count > group.MaxSelections || (group.IsRequired && count == 0) {
			return nil, 0, fmt.Errorf("%w: invalid selections for %s", ErrInvalidInput, group.Name)
		}
	}
	if len(selected) > 0 {
		return nil, 0, fmt.Errorf("%w: modifier does not belong to product", ErrInvalidInput)
	}
	return modifiers, total, nil
}

func validOrderType(value domain.OrderType) bool {
	return value == domain.OrderTakeaway || value == domain.OrderDineIn || value == domain.OrderDelivery
}

func validTransition(current, target domain.OrderStatus) bool {
	switch current {
	case domain.OrderPending:
		return target == domain.OrderAccepted || target == domain.OrderCancelled
	case domain.OrderAccepted:
		return target == domain.OrderPreparing || target == domain.OrderCancelled
	case domain.OrderPreparing:
		return target == domain.OrderReady
	case domain.OrderReady:
		return target == domain.OrderCompleted
	default:
		return false
	}
}

func validBaristaTransition(current, target domain.OrderStatus) bool {
	return (current == domain.OrderAccepted && target == domain.OrderPreparing) ||
		(current == domain.OrderPreparing && target == domain.OrderReady) ||
		(current == domain.OrderReady && target == domain.OrderCompleted)
}

func int64Pointer(value int64) *int64 { return &value }

func stringPointer(value string) *string { return &value }

func cleanedString(value *string) *string {
	if value == nil {
		return nil
	}
	cleaned := strings.TrimSpace(*value)
	if cleaned == "" {
		return nil
	}
	return &cleaned
}

func serviceRepositoryError(err error) error {
	if errors.Is(err, repository.ErrNotFound) {
		return ErrNotFound
	}
	return err
}
