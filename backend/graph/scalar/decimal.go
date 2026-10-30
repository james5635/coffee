package scalar

import (
	"fmt"
	"io"
	"strconv"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/service"
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
	money, err := repository.ParseMoney(text)
	if err != nil {
		return fmt.Errorf("%w: invalid Decimal", service.ErrInvalidInput)
	}
	*d = Decimal(repository.FormatMoney(money))
	return nil
}
