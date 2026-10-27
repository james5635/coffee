-- name: ListActiveCategories :many
SELECT id, name, description, sort_order, is_active, created_at
FROM categories
WHERE is_active
ORDER BY sort_order, name;

-- name: CreateCategory :one
INSERT INTO categories (name, description, sort_order)
VALUES ($1, $2, $3)
RETURNING id, name, description, sort_order, is_active, created_at;

-- name: UpdateCategory :one
UPDATE categories
SET name = $2, description = $3, sort_order = $4, is_active = $5
WHERE id = $1
RETURNING id, name, description, sort_order, is_active, created_at;

-- name: ListAvailableProducts :many
SELECT p.id, p.category_id, c.name AS category_name, p.name, p.description,
       p.price, p.sku, p.is_available, p.created_at, p.updated_at
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_available AND (p.category_id IS NULL OR c.is_active)
ORDER BY c.sort_order NULLS LAST, c.name, p.name;

-- name: GetSellableProduct :one
SELECT p.id, p.category_id, p.name, p.description, p.price, p.sku,
       p.is_available, p.created_at, p.updated_at
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.id = $1
  AND p.is_available
  AND (p.category_id IS NULL OR c.is_active)
FOR SHARE OF p;

-- name: ListProductsByCategory :many
SELECT id, category_id, name, description, price, sku, is_available, created_at, updated_at
FROM products
WHERE category_id = $1
ORDER BY name;

-- name: CreateProduct :one
INSERT INTO products (category_id, name, description, price, sku)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, category_id, name, description, price, sku, is_available, created_at, updated_at;

-- name: UpdateProduct :one
UPDATE products
SET category_id = $2, name = $3, description = $4, price = $5, sku = $6,
    is_available = $7, updated_at = now()
WHERE id = $1
RETURNING id, category_id, name, description, price, sku, is_available, created_at, updated_at;

-- name: SetProductAvailability :execrows
UPDATE products
SET is_available = $2, updated_at = now()
WHERE id = $1;

-- name: ListProductModifierGroups :many
SELECT g.id AS group_id, g.name AS group_name, g.min_selections, g.max_selections,
       g.is_required, pmg.sort_order AS product_sort_order,
       m.id AS modifier_id, m.name AS modifier_name,
       m.price_delta, m.is_available, m.sort_order
FROM product_modifier_groups pmg
JOIN modifier_groups g ON g.id = pmg.group_id AND g.is_active
LEFT JOIN modifiers m ON m.group_id = g.id AND m.is_available
WHERE pmg.product_id = $1
ORDER BY pmg.sort_order, m.sort_order NULLS LAST, m.name NULLS LAST;

-- name: ListActiveModifiersInGroup :many
SELECT id, group_id, name, price_delta, is_available, sort_order
FROM modifiers
WHERE group_id = $1 AND is_available
ORDER BY sort_order, name;

-- name: GetShopSettings :one
SELECT id, name, currency, timezone, tax_rate, updated_at, updated_by
FROM shop_settings
WHERE id = 1;

-- name: UpdateShopSettings :one
UPDATE shop_settings
SET name = $1, currency = $2, timezone = $3, tax_rate = $4,
    updated_at = now(), updated_by = $5
WHERE id = 1
RETURNING id, name, currency, timezone, tax_rate, updated_at, updated_by;
