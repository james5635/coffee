package service

import (
	"fmt"
	"math/big"

	"github.com/james5635/coffee/backend/service/domain"
)

func multiplyMoney(value domain.Money, quantity int32) (domain.Money, error) {
	result := new(big.Int).Mul(big.NewInt(int64(value)), big.NewInt(int64(quantity)))
	return moneyFromBig(result)
}

func addMoney(values ...domain.Money) (domain.Money, error) {
	result := new(big.Int)
	for _, value := range values {
		result.Add(result, big.NewInt(int64(value)))
	}
	return moneyFromBig(result)
}

func calculateTax(subtotal domain.Money, rate domain.TaxRate) (domain.Money, error) {
	product := new(big.Int).Mul(big.NewInt(int64(subtotal)), big.NewInt(int64(rate)))
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(product, big.NewInt(100000), remainder)
	if new(big.Int).Mul(remainder, big.NewInt(2)).Cmp(big.NewInt(100000)) >= 0 {
		quotient.Add(quotient, big.NewInt(1))
	}
	return moneyFromBig(quotient)
}

func moneyFromBig(value *big.Int) (domain.Money, error) {
	if !value.IsInt64() {
		return 0, fmt.Errorf("%w: amount exceeds supported range", ErrInvalidInput)
	}
	return domain.Money(value.Int64()), nil
}
