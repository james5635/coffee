-- name: CreateCustomer :one
INSERT INTO customers (user_id, display_name, email, phone)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, display_name, email, phone, created_at;

-- name: GetCustomerByUserID :one
SELECT id, user_id, display_name, email, phone, created_at
FROM customers
WHERE user_id = $1;

-- name: GetOrCreateCustomerForUser :one
INSERT INTO customers (user_id, display_name, email)
SELECT users.id, users.display_name, users.email
FROM users
WHERE users.id = $1 AND users.is_active
ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
RETURNING id, user_id, display_name, email, phone, created_at;

-- name: CreateOrder :one
INSERT INTO orders (
    customer_id, created_by, order_type, customer_name, customer_email, notes,
    subtotal, discount_amount, tax_amount, total, currency
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, order_number, customer_id, created_by, status, order_type,
          customer_name, customer_email, notes, subtotal, discount_amount,
          tax_amount, total, currency, created_at, updated_at, completed_at;

-- name: AddOrderItem :one
INSERT INTO order_items (
    order_id, product_id, product_name, quantity, unit_price, line_total, special_instructions
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, order_id, product_id, product_name, quantity, unit_price, line_total, special_instructions;

-- name: AddOrderItemModifier :one
INSERT INTO order_item_modifiers (order_item_id, modifier_id, modifier_name, price_delta)
VALUES ($1, $2, $3, $4)
RETURNING id, order_item_id, modifier_id, modifier_name, price_delta;

-- name: GetOrderByID :one
SELECT id, order_number, customer_id, created_by, status, order_type,
       customer_name, customer_email, notes, subtotal, discount_amount,
       tax_amount, total, currency, created_at, updated_at, completed_at
FROM orders
WHERE id = $1;

-- name: GetOrderForUpdate :one
SELECT id, order_number, customer_id, created_by, status, order_type,
       customer_name, customer_email, notes, subtotal, discount_amount,
       tax_amount, total, currency, created_at, updated_at, completed_at
FROM orders
WHERE id = $1
FOR UPDATE;

-- name: ListOrders :many
SELECT id, order_number, customer_id, created_by, status, order_type,
       customer_name, customer_email, notes, subtotal, discount_amount,
       tax_amount, total, currency, created_at, updated_at, completed_at
FROM orders
WHERE (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('page_size') OFFSET sqlc.arg('page_offset');

-- name: ListCustomerOrders :many
SELECT id, order_number, customer_id, created_by, status, order_type,
       customer_name, customer_email, notes, subtotal, discount_amount,
       tax_amount, total, currency, created_at, updated_at, completed_at
FROM orders
WHERE customer_id = $1
ORDER BY created_at DESC, id DESC
LIMIT $2 OFFSET $3;

-- name: ListPreparationQueue :many
SELECT id, order_number, customer_id, created_by, status, order_type,
       customer_name, customer_email, notes, subtotal, discount_amount,
       tax_amount, total, currency, created_at, updated_at, completed_at
FROM orders
WHERE status IN ('accepted', 'preparing')
ORDER BY created_at, id;

-- name: ListOrderItems :many
SELECT id, order_id, product_id, product_name, quantity, unit_price,
       line_total, special_instructions
FROM order_items
WHERE order_id = $1
ORDER BY id;

-- name: ListOrderItemModifiers :many
SELECT id, order_item_id, modifier_id, modifier_name, price_delta
FROM order_item_modifiers
WHERE order_item_id = $1
ORDER BY id;

-- name: UpdateOrderStatusIfCurrent :one
UPDATE orders
SET status = $2, updated_at = now(),
    completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE completed_at END
WHERE id = $1 AND status = $3
RETURNING id, order_number, customer_id, created_by, status, order_type,
          customer_name, customer_email, notes, subtotal, discount_amount,
          tax_amount, total, currency, created_at, updated_at, completed_at;

-- name: UpdatePendingOrderTotals :one
UPDATE orders
SET subtotal = $2, discount_amount = $3, tax_amount = $4, total = $5, updated_at = now()
WHERE id = $1 AND status = 'pending'
RETURNING id, order_number, subtotal, discount_amount, tax_amount, total, updated_at;

-- name: CreatePayment :one
INSERT INTO payments (order_id, recorded_by, kind, method, amount, external_reference)
VALUES ($1, $2, 'payment', $3, $4, $5)
RETURNING id, order_id, recorded_by, kind, status, method, amount,
          external_reference, created_at, settled_at;

-- name: RecordSuccessfulPayment :one
INSERT INTO payments (order_id, recorded_by, kind, status, method, amount, external_reference, settled_at)
VALUES ($1, $2, 'payment', 'succeeded', $3, $4, $5, now())
RETURNING id, order_id, recorded_by, kind, status, method, amount,
          external_reference, created_at, settled_at;

-- name: GetOrderPaymentBalance :one
SELECT
    COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE 0 END), 0)::NUMERIC(12,2) AS paid_total,
    COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END), 0)::NUMERIC(12,2) AS refunded_total
FROM payments
WHERE order_id = $1 AND status = 'succeeded';

-- name: SetPaymentStatus :one
UPDATE payments
SET status = $2, settled_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE settled_at END
WHERE id = $1
RETURNING id, order_id, recorded_by, kind, status, method, amount,
          external_reference, created_at, settled_at;

-- name: CreateRefund :one
INSERT INTO payments (order_id, recorded_by, kind, status, method, amount, external_reference, settled_at)
VALUES ($1, $2, 'refund', 'succeeded', $3, $4, $5, now())
RETURNING id, order_id, recorded_by, kind, status, method, amount,
          external_reference, created_at, settled_at;

-- name: ListOrderPayments :many
SELECT id, order_id, recorded_by, kind, status, method, amount,
       external_reference, created_at, settled_at
FROM payments
WHERE order_id = $1
ORDER BY created_at, id;
