-- +goose Up
INSERT INTO shop_settings (id, name, currency, timezone, tax_rate)
VALUES (1, 'Coffee Shop', 'USD', 'Asia/Phnom_Penh', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (name, description, sort_order) VALUES
    ('Coffee', 'Espresso and brewed coffee', 1),
    ('Tea', 'Tea and other non-coffee drinks', 2),
    ('Pastries', 'Fresh pastries', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO suppliers (name, contact_name, email, phone, notes) VALUES
    ('House Roaster', NULL, NULL, NULL, 'Demo supplier')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (category_id, name, description, price, sku)
SELECT c.id, seed.name, seed.description, seed.price, seed.sku
FROM (VALUES
    ('Coffee', 'Espresso', 'Double shot of house espresso', 2.50::NUMERIC(12,2), 'DRINK-ESP'),
    ('Coffee', 'Cappuccino', 'Espresso with steamed milk and foam', 3.75::NUMERIC(12,2), 'DRINK-CAP'),
    ('Tea', 'Black Tea', 'Cup of black tea', 2.75::NUMERIC(12,2), 'DRINK-TEA'),
    ('Pastries', 'Butter Croissant', 'Flaky butter croissant', 3.25::NUMERIC(12,2), 'FOOD-CRO')
) AS seed(category_name, name, description, price, sku)
JOIN categories c ON c.name = seed.category_name
ON CONFLICT (sku) DO NOTHING;

INSERT INTO modifier_groups (name, min_selections, max_selections, is_required)
VALUES ('Milk choice', 0, 1, FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO modifiers (group_id, name, price_delta, sort_order)
SELECT g.id, seed.name, seed.price_delta, seed.sort_order
FROM modifier_groups g
CROSS JOIN (VALUES
    ('Whole milk', 0.00::NUMERIC(12,2), 1),
    ('Oat milk', 0.75::NUMERIC(12,2), 2),
    ('Almond milk', 0.75::NUMERIC(12,2), 3)
) AS seed(name, price_delta, sort_order)
WHERE g.name = 'Milk choice'
ON CONFLICT (group_id, name) DO NOTHING;

INSERT INTO product_modifier_groups (product_id, group_id, sort_order)
SELECT p.id, g.id, 1
FROM products p
CROSS JOIN modifier_groups g
WHERE p.sku = 'DRINK-CAP' AND g.name = 'Milk choice'
ON CONFLICT (product_id, group_id) DO NOTHING;

INSERT INTO inventory_items (name, unit, low_stock_threshold, supplier_id, unit_cost)
VALUES
    ('Espresso beans', 'g', 500, (SELECT id FROM suppliers WHERE name = 'House Roaster'), 0.0250),
    ('Whole milk', 'ml', 2000, (SELECT id FROM suppliers WHERE name = 'House Roaster'), 0.0015),
    ('Black tea leaves', 'g', 200, (SELECT id FROM suppliers WHERE name = 'House Roaster'), 0.0180),
    ('Croissants', 'each', 6, (SELECT id FROM suppliers WHERE name = 'House Roaster'), 1.1000)
ON CONFLICT (name) DO NOTHING;

INSERT INTO product_recipes (product_id, inventory_item_id, quantity)
SELECT p.id, i.id, seed.quantity
FROM (VALUES
    ('DRINK-ESP', 'Espresso beans', 18.000::NUMERIC(14,3)),
    ('DRINK-CAP', 'Espresso beans', 18.000::NUMERIC(14,3)),
    ('DRINK-CAP', 'Whole milk', 180.000::NUMERIC(14,3)),
    ('DRINK-TEA', 'Black tea leaves', 3.000::NUMERIC(14,3)),
    ('FOOD-CRO', 'Croissants', 1.000::NUMERIC(14,3))
) AS seed(sku, inventory_name, quantity)
JOIN products p ON p.sku = seed.sku
JOIN inventory_items i ON i.name = seed.inventory_name
ON CONFLICT (product_id, inventory_item_id) DO NOTHING;

WITH opening_stock(item_name, quantity) AS (
    VALUES
        ('Espresso beans', 5000.000::NUMERIC(14,3)),
        ('Whole milk', 20000.000::NUMERIC(14,3)),
        ('Black tea leaves', 1000.000::NUMERIC(14,3)),
        ('Croissants', 24.000::NUMERIC(14,3))
), inserted_movements AS (
    INSERT INTO stock_movements (inventory_item_id, quantity_delta, reason, note)
    SELECT i.id, stock.quantity, 'purchase', 'Demo opening stock'
    FROM opening_stock stock
    JOIN inventory_items i ON i.name = stock.item_name
    WHERE NOT EXISTS (
        SELECT 1 FROM stock_movements m
        WHERE m.inventory_item_id = i.id AND m.note = 'Demo opening stock'
    )
    RETURNING inventory_item_id, quantity_delta
)
UPDATE inventory_items i
SET quantity = i.quantity + movement.quantity_delta, updated_at = now()
FROM inserted_movements movement
WHERE i.id = movement.inventory_item_id;

-- Demo users for every role. All accounts use the password "password123".
-- The bcrypt hashes below were generated with golang.org/x/crypto/bcrypt
-- (cost 10) and verified against that password.
INSERT INTO users (email, password_hash, display_name) VALUES
    ('owner@coffee.local', '$2a$10$lw45sKK.YKkwQ91oen7bo.1K/YiaZTHYbeoghGR8jKCafVaGokfWK', 'Olive Owner'),
    ('manager@coffee.local', '$2a$10$lw45sKK.YKkwQ91oen7bo.1K/YiaZTHYbeoghGR8jKCafVaGokfWK', 'Manny Manager'),
    ('cashier@coffee.local', '$2a$10$lw45sKK.YKkwQ91oen7bo.1K/YiaZTHYbeoghGR8jKCafVaGokfWK', 'Cass Cashier'),
    ('barista@coffee.local', '$2a$10$lw45sKK.YKkwQ91oen7bo.1K/YiaZTHYbeoghGR8jKCafVaGokfWK', 'Bree Barista'),
    ('customer@coffee.local', '$2a$10$lw45sKK.YKkwQ91oen7bo.1K/YiaZTHYbeoghGR8jKCafVaGokfWK', 'Cara Customer')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = CASE u.email
    WHEN 'owner@coffee.local' THEN 'owner_admin'
    WHEN 'manager@coffee.local' THEN 'manager'
    WHEN 'cashier@coffee.local' THEN 'cashier'
    WHEN 'barista@coffee.local' THEN 'barista'
    WHEN 'customer@coffee.local' THEN 'customer'
END
WHERE u.email IN (
    'owner@coffee.local', 'manager@coffee.local', 'cashier@coffee.local',
    'barista@coffee.local', 'customer@coffee.local'
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Product photos for the public menu (Unsplash photos; see assets/products/ATTRIBUTION.md).
UPDATE products SET image_url = '/products/espresso.jpg' WHERE sku = 'DRINK-ESP';
UPDATE products SET image_url = '/products/cappuccino.jpg' WHERE sku = 'DRINK-CAP';
UPDATE products SET image_url = '/products/black-tea.jpg' WHERE sku = 'DRINK-TEA';
UPDATE products SET image_url = '/products/butter-croissant.jpg' WHERE sku = 'FOOD-CRO';

-- +goose Down
WITH deleted_movements AS (
    DELETE FROM stock_movements WHERE note = 'Demo opening stock'
    RETURNING inventory_item_id, quantity_delta
)
UPDATE inventory_items i
SET quantity = i.quantity - deleted.quantity_delta, updated_at = now()
FROM deleted_movements deleted
WHERE i.id = deleted.inventory_item_id;
DELETE FROM product_recipes WHERE product_id IN (SELECT id FROM products WHERE sku IN ('DRINK-ESP', 'DRINK-CAP', 'DRINK-TEA', 'FOOD-CRO'));
DELETE FROM product_modifier_groups WHERE product_id IN (SELECT id FROM products WHERE sku = 'DRINK-CAP');
DELETE FROM modifiers WHERE group_id = (SELECT id FROM modifier_groups WHERE name = 'Milk choice');
DELETE FROM modifier_groups WHERE name = 'Milk choice';
DELETE FROM inventory_items WHERE name IN ('Espresso beans', 'Whole milk', 'Black tea leaves', 'Croissants');
DELETE FROM products WHERE sku IN ('DRINK-ESP', 'DRINK-CAP', 'DRINK-TEA', 'FOOD-CRO');
DELETE FROM suppliers WHERE name = 'House Roaster';
DELETE FROM categories WHERE name IN ('Coffee', 'Tea', 'Pastries');
DELETE FROM shop_settings WHERE id = 1 AND name = 'Coffee Shop';
DELETE FROM users WHERE email IN (
    'owner@coffee.local', 'manager@coffee.local', 'cashier@coffee.local',
    'barista@coffee.local', 'customer@coffee.local'
);
