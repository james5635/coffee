package domain

import (
	"fmt"
	"math/big"
	"strings"
)

func ParseMoney(value string) (Money, error) {
	parsed, err := parseScaled(value, 2)
	if err != nil {
		return 0, fmt.Errorf("invalid money value %q: %w", value, err)
	}
	if !parsed.IsInt64() {
		return 0, fmt.Errorf("money value %q is out of range", value)
	}
	return Money(parsed.Int64()), nil
}

func FormatMoney(value Money) string {
	integer := big.NewInt(int64(value))
	negative := integer.Sign() < 0
	integer.Abs(integer)
	whole, cents := new(big.Int), new(big.Int)
	whole.QuoRem(integer, big.NewInt(100), cents)
	sign := ""
	if negative {
		sign = "-"
	}
	return fmt.Sprintf("%s%s.%02d", sign, whole.String(), cents.Int64())
}

func ParseTaxRate(value string) (TaxRate, error) {
	parsed, err := parseScaled(value, 5)
	if err != nil || !parsed.IsInt64() || parsed.Sign() < 0 || parsed.Cmp(big.NewInt(100000)) > 0 {
		return 0, fmt.Errorf("invalid tax rate %q", value)
	}
	return TaxRate(parsed.Int64()), nil
}

func FormatTaxRate(value TaxRate) string {
	integer := big.NewInt(int64(value))
	whole, fraction := new(big.Int), new(big.Int)
	whole.QuoRem(integer, big.NewInt(100000), fraction)
	return fmt.Sprintf("%s.%05d", whole.String(), fraction.Int64())
}

func parseScaled(value string, precision int) (*big.Int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, fmt.Errorf("empty value")
	}
	negative := strings.HasPrefix(value, "-")
	if negative || strings.HasPrefix(value, "+") {
		value = value[1:]
	}
	parts := strings.Split(value, ".")
	if len(parts) > 2 || parts[0] == "" {
		return nil, fmt.Errorf("invalid decimal format")
	}
	for _, r := range parts[0] {
		if r < '0' || r > '9' {
			return nil, fmt.Errorf("invalid decimal digit")
		}
	}
	fraction := ""
	if len(parts) == 2 {
		fraction = parts[1]
	}
	if len(fraction) > precision {
		return nil, fmt.Errorf("too many decimal places")
	}
	for _, r := range fraction {
		if r < '0' || r > '9' {
			return nil, fmt.Errorf("invalid decimal digit")
		}
	}
	fraction += strings.Repeat("0", precision-len(fraction))
	base := new(big.Int)
	if _, ok := base.SetString(parts[0], 10); !ok {
		return nil, fmt.Errorf("invalid integer part")
	}
	base.Mul(base, new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(precision)), nil))
	if fraction != "" {
		decimalFraction := new(big.Int)
		decimalFraction.SetString(fraction, 10)
		base.Add(base, decimalFraction)
	}
	if negative {
		base.Neg(base)
	}
	return base, nil
}
