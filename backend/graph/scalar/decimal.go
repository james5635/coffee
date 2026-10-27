package scalar

import (
	"fmt"
	"io"
	"strconv"

	"github.com/james5635/coffee/backend/service"
	"github.com/james5635/coffee/backend/service/domain"
)

type Decimal string

func (d Decimal) MarshalGQL(writer io.Writer) {
	_, _ = writer.Write(strconv.AppendQuote(nil, string(d)))
}

func (d *Decimal) UnmarshalGQL(value interface{}) error {
	text, ok := value.(string)
	if !ok {
		return fmt.Errorf("%w: Decimal must be supplied as a string", service.ErrInvalidInput)
	}
	money, err := domain.ParseMoney(text)
	if err != nil {
		return fmt.Errorf("%w: invalid Decimal", service.ErrInvalidInput)
	}
	*d = Decimal(domain.FormatMoney(money))
	return nil
}
