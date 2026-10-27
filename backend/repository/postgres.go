package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	db "github.com/james5635/coffee/backend/db"
)

type Postgres struct {
	conn    *sql.DB
	queries *db.Queries
}

func NewPostgres(conn *sql.DB) (*Postgres, error) {
	if conn == nil {
		return nil, errors.New("postgres connection is required")
	}
	return &Postgres{conn: conn, queries: db.New(conn)}, nil
}

func (p *Postgres) WithinOrderTx(ctx context.Context, fn func(OrderTx) error) error {
	if fn == nil {
		return errors.New("order transaction callback is required")
	}
	tx, err := p.conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin order transaction: %w", err)
	}
	defer tx.Rollback()
	if err := fn(&postgresOrderTx{queries: p.queries.WithTx(tx)}); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit order transaction: %w", err)
	}
	return nil
}

func (p *Postgres) WithinPaymentTx(ctx context.Context, fn func(PaymentTx) error) error {
	if fn == nil {
		return errors.New("payment transaction callback is required")
	}
	tx, err := p.conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin payment transaction: %w", err)
	}
	defer tx.Rollback()
	if err := fn(&postgresPaymentTx{queries: p.queries.WithTx(tx)}); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit payment transaction: %w", err)
	}
	return nil
}

func mapQueryError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
