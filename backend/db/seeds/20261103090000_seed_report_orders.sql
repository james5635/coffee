-- +goose Up
SELECT setseed(0.42);

DELETE FROM payments WHERE external_reference = 'report-demo';
DELETE FROM payments WHERE external_reference = 'report-demo-refund';
DELETE FROM payments
WHERE order_id IN (SELECT id FROM orders WHERE notes = 'report-demo');
DELETE FROM orders WHERE notes = 'report-demo';

-- Deterministic 45-day demo dataset:
-- days 44..0 ago (day_index 0 = today, UTC) x slots 07:15 / 12:30 / 18:10 UTC.
WITH days AS (
    SELECT (date_trunc('day', now() AT TIME ZONE 'UTC')::date - gs.idx) AS day_date,
           gs.idx AS day_index
    FROM generate_series(0, 44) AS gs(idx)
),
slots AS (
    SELECT 1 AS n, '07:15:00'::time AS slot_time
    UNION ALL SELECT 2, '12:30:00'::time
    UNION ALL SELECT 3, '18:10:00'::time
),
inserted AS (
    INSERT INTO orders (
        status, order_type, customer_name, customer_email, notes,
        subtotal, discount_amount, tax_amount, total, currency,
        created_at, updated_at, completed_at
    )
    SELECT
        CASE WHEN s.n = 3 AND d.day_index % 10 = 4 THEN 'cancelled' ELSE 'completed' END,
        CASE (d.day_index + s.n) % 3
            WHEN 0 THEN 'takeaway'
            WHEN 1 THEN 'dine_in'
            ELSE 'delivery'
        END,
        'Report Demo',
        NULL,
        'report-demo',
        0,
        0,
        0,
        0,
        'USD',
        (d.day_date + s.slot_time) AT TIME ZONE 'UTC',
        (d.day_date + s.slot_time) AT TIME ZONE 'UTC',
        CASE WHEN s.n <> 3 OR d.day_index % 10 <> 4
            THEN (d.day_date + s.slot_time) AT TIME ZONE 'UTC' + interval '15 minutes'
        END
    FROM days d
    CROSS JOIN slots s
    RETURNING id, status, created_at
)
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total, special_instructions)
SELECT
    i.id,
    p.id,
    p.name,
    CASE j.j WHEN 1 THEN 1 WHEN 2 THEN 2 ELSE 1 END,
    p.price,
    p.price * CASE j.j WHEN 1 THEN 1 WHEN 2 THEN 2 ELSE 1 END,
    ''
FROM inserted i
JOIN (SELECT 1 AS j UNION ALL SELECT 2 UNION ALL SELECT 3) AS j
  ON j.j <= CASE EXTRACT(HOUR FROM (i.created_at AT TIME ZONE 'UTC'))
             WHEN 7 THEN 1
             WHEN 12 THEN 2
             ELSE 3
        END
JOIN (
    SELECT id, name, price, row_number() OVER (ORDER BY id) - 1 AS product_rank
    FROM products
) AS p
  ON p.product_rank = (
        (date_trunc('day', now() AT TIME ZONE 'UTC')::date - (i.created_at AT TIME ZONE 'UTC')::date) * 3
        + CASE EXTRACT(HOUR FROM (i.created_at AT TIME ZONE 'UTC'))
            WHEN 7 THEN 1
            WHEN 12 THEN 2
            ELSE 3
          END
        + CASE j.j WHEN 1 THEN 0 WHEN 2 THEN 7 ELSE 13 END
      ) % (SELECT count(*) FROM products);

UPDATE orders o
SET subtotal = COALESCE((SELECT SUM(line_total) FROM order_items oi WHERE oi.order_id = o.id), 0),
    total = COALESCE((SELECT SUM(line_total) FROM order_items oi WHERE oi.order_id = o.id), 0)
WHERE o.notes = 'report-demo';

-- Successful demo payments for every completed demo order (one per order).
WITH methods AS (
    SELECT m AS method, ord - 1 AS ord
    FROM unnest(ARRAY['card', 'cash', 'card', 'online', 'cash', 'card']) WITH ORDINALITY AS u(m, ord)
),
demo AS (
    SELECT o.id, o.status, o.total, o.created_at,
           (date_trunc('day', now() AT TIME ZONE 'UTC')::date - (o.created_at AT TIME ZONE 'UTC')::date) AS day_index,
           CASE EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'UTC'))
               WHEN 7 THEN 1
               WHEN 12 THEN 2
               ELSE 3
           END AS n
    FROM orders o
    WHERE o.notes = 'report-demo'
),
failed_target AS (
    SELECT id, total, created_at, day_index, n
    FROM demo
    WHERE status = 'completed' AND day_index % 15 = 2
    ORDER BY created_at ASC, id ASC
    LIMIT 1
),
pending_target AS (
    SELECT id, total, created_at, day_index, n
    FROM demo
    WHERE status = 'completed' AND day_index % 30 = 7
    ORDER BY created_at DESC, id DESC
    LIMIT 1
)
INSERT INTO payments (order_id, kind, status, method, amount, external_reference, created_at, settled_at)
SELECT d.id, 'payment', 'succeeded', m.method, d.total, 'report-demo', d.created_at, d.created_at
FROM demo d
JOIN methods m ON m.ord = (d.day_index + d.n) % 6
WHERE d.status = 'completed'
  AND d.id <> (SELECT id FROM failed_target)
  AND d.id <> (SELECT id FROM pending_target);

-- Days whose day_index % 15 = 2 get one FAILED payment instead of the successful one.
WITH methods AS (
    SELECT m AS method, ord - 1 AS ord
    FROM unnest(ARRAY['card', 'cash', 'card', 'online', 'cash', 'card']) WITH ORDINALITY AS u(m, ord)
),
demo AS (
    SELECT o.id, o.total, o.created_at,
           (date_trunc('day', now() AT TIME ZONE 'UTC')::date - (o.created_at AT TIME ZONE 'UTC')::date) AS day_index,
           CASE EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'UTC'))
               WHEN 7 THEN 1
               WHEN 12 THEN 2
               ELSE 3
           END AS n
    FROM orders o
    WHERE o.notes = 'report-demo' AND o.status = 'completed'
),
failed_target AS (
    SELECT id, total, created_at, day_index, n
    FROM demo
    WHERE day_index % 15 = 2
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
INSERT INTO payments (order_id, kind, status, method, amount, external_reference, created_at, settled_at)
SELECT f.id, 'payment', 'failed', m.method, f.total, 'report-demo', f.created_at, NULL
FROM failed_target f
JOIN methods m ON m.ord = (f.day_index + f.n) % 6;

-- Days whose day_index % 30 = 7 get one PENDING payment instead of the successful one.
WITH methods AS (
    SELECT m AS method, ord - 1 AS ord
    FROM unnest(ARRAY['card', 'cash', 'card', 'online', 'cash', 'card']) WITH ORDINALITY AS u(m, ord)
),
demo AS (
    SELECT o.id, o.total, o.created_at,
           (date_trunc('day', now() AT TIME ZONE 'UTC')::date - (o.created_at AT TIME ZONE 'UTC')::date) AS day_index,
           CASE EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'UTC'))
               WHEN 7 THEN 1
               WHEN 12 THEN 2
               ELSE 3
           END AS n
    FROM orders o
    WHERE o.notes = 'report-demo' AND o.status = 'completed'
),
pending_target AS (
    SELECT id, total, created_at, day_index, n
    FROM demo
    WHERE day_index % 30 = 7
    ORDER BY created_at DESC, id DESC
    LIMIT 1
)
INSERT INTO payments (order_id, kind, status, method, amount, external_reference, created_at, settled_at)
SELECT p.id, 'payment', 'pending', m.method, p.total, 'report-demo', p.created_at, NULL
FROM pending_target p
JOIN methods m ON m.ord = (p.day_index + p.n) % 6;

-- Three refunds against the latest three completed demo payments, in the trailing window.
WITH recent AS (
    SELECT p.id, p.order_id, p.method, p.amount
    FROM payments p
    WHERE p.external_reference = 'report-demo'
      AND p.kind = 'payment'
      AND p.status = 'succeeded'
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 3
)
INSERT INTO payments (order_id, kind, status, method, amount, external_reference, created_at, settled_at)
SELECT r.order_id, 'refund', 'succeeded', r.method, ROUND(r.amount * 0.2, 2), 'report-demo-refund', now(), now()
FROM recent r;

-- +goose Down
DELETE FROM payments WHERE external_reference = 'report-demo-refund';
DELETE FROM payments WHERE external_reference = 'report-demo';
DELETE FROM payments
WHERE order_id IN (SELECT id FROM orders WHERE notes = 'report-demo');
DELETE FROM orders WHERE notes = 'report-demo';
