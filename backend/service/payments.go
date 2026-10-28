package service

import (
	"context"
	"fmt"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/service/domain"
)

type paymentService struct{ repository repository.PaymentRepository }

func NewPaymentService(repository repository.PaymentRepository) PaymentService {
	return &paymentService{repository: repository}
}

func (s *paymentService) RecordPayment(ctx context.Context, input domain.RecordPaymentInput) (domain.Payment, error) {
	principal, err := principalFor(ctx)
	if err != nil {
		return domain.Payment{}, err
	}
	if err := requirePermission(principal, "payment.accept"); err != nil {
		return domain.Payment{}, err
	}
	if input.OrderID < 1 || input.Amount <= 0 || !validPaymentMethod(input.Method) {
		return domain.Payment{}, fmt.Errorf("%w: invalid payment details", ErrInvalidInput)
	}
	input.ExternalReference = cleanedString(input.ExternalReference)
	inputCopy := input
	var recorded domain.Payment
	err = s.repository.WithinPaymentTx(ctx, func(tx repository.PaymentTx) error {
		order, err := tx.GetOrderForUpdate(ctx, inputCopy.OrderID)
		if err != nil {
			return serviceRepositoryError(err)
		}
		if order.Status != domain.OrderPending && order.Status != domain.OrderAccepted {
			return ErrInvalidState
		}
		balance, err := tx.GetPaymentBalanceForUpdate(ctx, inputCopy.OrderID)
		if err != nil {
			return err
		}
		remaining := order.Total - balance.Net()
		if remaining < 0 || inputCopy.Amount > remaining {
			return ErrInsufficient
		}
		recorded, err = tx.RecordSuccessfulPayment(ctx, domain.Payment{
			OrderID: inputCopy.OrderID, RecordedBy: int64Pointer(principal.UserID),
			Kind: domain.PaymentKindPayment, Status: domain.PaymentSucceeded,
			Method: inputCopy.Method, Amount: inputCopy.Amount,
			ExternalReference: inputCopy.ExternalReference,
		})
		return err
	})
	return recorded, err
}

func (s *paymentService) IssueRefund(ctx context.Context, input domain.IssueRefundInput) (domain.Payment, error) {
	principal, err := principalFor(ctx)
	if err != nil {
		return domain.Payment{}, err
	}
	if err := requirePermission(principal, "payment.refund"); err != nil {
		return domain.Payment{}, err
	}
	if input.OrderID < 1 || input.Amount <= 0 || !validPaymentMethod(input.Method) {
		return domain.Payment{}, fmt.Errorf("%w: invalid refund details", ErrInvalidInput)
	}
	input.ExternalReference = cleanedString(input.ExternalReference)
	inputCopy := input
	var refunded domain.Payment
	err = s.repository.WithinPaymentTx(ctx, func(tx repository.PaymentTx) error {
		if _, err := tx.GetOrderForUpdate(ctx, inputCopy.OrderID); err != nil {
			return serviceRepositoryError(err)
		}
		balance, err := tx.GetPaymentBalanceForUpdate(ctx, inputCopy.OrderID)
		if err != nil {
			return err
		}
		if inputCopy.Amount > balance.Net() {
			return ErrInsufficient
		}
		refunded, err = tx.CreateRefund(ctx, domain.Payment{
			OrderID: inputCopy.OrderID, RecordedBy: int64Pointer(principal.UserID),
			Kind: domain.PaymentKindRefund, Status: domain.PaymentSucceeded,
			Method: inputCopy.Method, Amount: inputCopy.Amount,
			ExternalReference: inputCopy.ExternalReference,
		})
		return err
	})
	return refunded, err
}

func validPaymentMethod(method domain.PaymentMethod) bool {
	switch method {
	case domain.PaymentCash, domain.PaymentCard, domain.PaymentOnline, domain.PaymentOther:
		return true
	default:
		return false
	}
}
