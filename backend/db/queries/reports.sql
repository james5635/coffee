-- name: PeriodTotals :one
SELECT COALESCE(SUM(amount) FILTER (WHERE kind='payment' AND status='succeeded'),0)::numeric(14,2)::text AS gross,
       COALESCE(SUM(amount) FILTER (WHERE kind='refund'  AND status='succeeded'),0)::numeric(14,2)::text AS refunds,
       COUNT(*) FILTER (WHERE kind='refund' AND status='succeeded')::int AS refund_count
FROM payments
WHERE created_at >= $1 AND created_at < $2;

-- name: PeriodOrderCount :one
SELECT COUNT(*)::int AS order_count
FROM orders
WHERE created_at >= $1 AND created_at < $2 AND status <> 'cancelled';

-- name: SalesTrend :many
WITH days AS (
    SELECT generate_series(
        date_trunc('day', now() AT TIME ZONE $1::text) - ($2::int - 1) * interval '1 day',
        date_trunc('day', now() AT TIME ZONE $1::text),
        interval '1 day')::date AS d)
SELECT to_char(d.d, 'YYYY-MM-DD') AS day,
       (SELECT (COALESCE(SUM(amount) FILTER (WHERE kind='payment' AND status='succeeded'),0)
              - COALESCE(SUM(amount) FILTER (WHERE kind='refund' AND status='succeeded'),0))
            ::numeric(14,2) FROM payments
        WHERE (created_at AT TIME ZONE $1::text)::date = d.d)::text AS net_sales,
       (SELECT COUNT(*) FROM orders
         WHERE (created_at AT TIME ZONE $1::text)::date = d.d AND status <> 'cancelled')::int AS order_count
FROM days d
ORDER BY d.d;

-- name: TopItems :many
SELECT oi.product_name,
       SUM(oi.quantity)::int AS quantity,
       COALESCE(SUM(oi.line_total),0)::numeric(14,2)::text AS revenue
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE o.created_at >= $1 AND o.created_at < $2 AND o.status <> 'cancelled'
GROUP BY oi.product_name
ORDER BY quantity DESC, revenue DESC
LIMIT $3;

-- name: HourlyOrderCounts :many
SELECT EXTRACT(hour FROM created_at AT TIME ZONE $3::text)::int AS hour, COUNT(*)::int AS order_count
FROM orders
WHERE created_at >= $1 AND created_at < $2 AND status <> 'cancelled'
GROUP BY 1 ORDER BY 1;

-- name: PaymentMethodTotals :many
SELECT method, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(14,2)::text AS amount
FROM payments
WHERE kind='payment' AND status='succeeded' AND created_at >= $1 AND created_at < $2
GROUP BY method ORDER BY method;

-- name: RefundTotals :one
SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(14,2)::text AS total
FROM payments
WHERE kind='refund' AND status='succeeded' AND created_at >= $1 AND created_at < $2;

-- name: RecentRefunds :many
SELECT o.order_number, p.amount::numeric(14,2)::text AS amount, p.created_at
FROM payments p JOIN orders o ON o.id = p.order_id
WHERE p.kind='refund' AND p.status='succeeded'
ORDER BY p.created_at DESC LIMIT $1;
