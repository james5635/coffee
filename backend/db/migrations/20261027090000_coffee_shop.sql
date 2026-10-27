-- +goose Up
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT users_display_name_not_blank CHECK (length(trim(display_name)) > 0)
);

CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO roles (name, description) VALUES
    ('owner_admin', 'Full access to shop configuration and operations'),
    ('manager', 'Daily operations and staff supervision'),
    ('cashier', 'Order taking and payment processing'),
    ('barista', 'Order preparation'),
    ('customer', 'Customer account for online ordering');

INSERT INTO permissions (code, description) VALUES
    ('product.read', 'View products and prices'),
    ('product.manage', 'Create and edit products, categories, and modifiers'),
    ('order.create', 'Create orders'),
    ('order.read.all', 'View all shop orders'),
    ('order.read.assigned', 'View permitted cashier orders'),
    ('order.read.preparation_queue', 'View orders awaiting preparation'),
    ('order.read.own', 'View own customer orders'),
    ('order.update_unpaid', 'Edit unpaid orders'),
    ('order.update_status', 'Advance preparation status'),
    ('order.cancel', 'Cancel eligible orders'),
    ('payment.accept', 'Accept customer payments'),
    ('payment.refund', 'Issue authorized refunds'),
    ('inventory.read', 'View inventory levels'),
    ('inventory.manage', 'Manage stock, suppliers, and adjustments'),
    ('report.sales.read', 'View sales reports'),
    ('report.profit.read', 'View profit and financial reports'),
    ('user.manage', 'Manage staff accounts and role assignments'),
    ('settings.manage', 'Configure shop settings'),
    ('discount.apply', 'Apply permitted discounts'),
    ('discount.manage', 'Configure discounts');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'owner_admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'product.read', 'product.manage', 'order.create', 'order.read.all',
    'order.update_unpaid', 'order.update_status', 'order.cancel', 'payment.accept',
    'payment.refund', 'inventory.read', 'inventory.manage', 'report.sales.read',
    'user.manage', 'settings.manage', 'discount.apply', 'discount.manage'
) WHERE r.name = 'manager';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'product.read', 'order.create', 'order.read.assigned', 'order.update_unpaid',
    'payment.accept', 'discount.apply'
) WHERE r.name = 'cashier';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'order.read.preparation_queue', 'order.update_status'
) WHERE r.name = 'barista';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'product.read', 'order.create', 'order.read.own', 'order.cancel'
) WHERE r.name = 'customer';

CREATE TABLE shop_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name TEXT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    tax_rate NUMERIC(6,5) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    sku TEXT UNIQUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE modifier_groups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    min_selections INTEGER NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
    max_selections INTEGER NOT NULL DEFAULT 1 CHECK (max_selections > 0),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT modifier_group_selection_range CHECK (min_selections <= max_selections),
    CONSTRAINT modifier_required_min CHECK (NOT is_required OR min_selections > 0)
);

CREATE TABLE modifiers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (group_id, name)
);

CREATE TABLE product_modifier_groups (
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, group_id)
);

CREATE TABLE suppliers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL,
    quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_threshold NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
    supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
    unit_cost NUMERIC(12,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_recipes (
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (product_id, inventory_item_id)
);

CREATE TABLE stock_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_delta NUMERIC(14,3) NOT NULL CHECK (quantity_delta <> 0),
    reason TEXT NOT NULL CHECK (reason IN ('purchase', 'sale', 'waste', 'correction', 'return')),
    note TEXT NOT NULL DEFAULT '',
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'
    )),
    order_type TEXT NOT NULL DEFAULT 'takeaway' CHECK (order_type IN ('takeaway', 'dine_in', 'delivery')),
    customer_name TEXT,
    customer_email TEXT,
    notes TEXT NOT NULL DEFAULT '',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT order_total_nonnegative_after_discount CHECK (discount_amount <= subtotal + tax_amount)
);

CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    special_instructions TEXT NOT NULL DEFAULT ''
);

CREATE TABLE order_item_modifiers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id BIGINT REFERENCES modifiers(id) ON DELETE SET NULL,
    modifier_name TEXT NOT NULL,
    price_delta NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment', 'refund')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'online', 'other')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    external_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ
);

CREATE INDEX products_category_id_idx ON products(category_id);
CREATE INDEX orders_status_created_at_idx ON orders(status, created_at);
CREATE INDEX orders_customer_id_created_at_idx ON orders(customer_id, created_at DESC);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX payments_order_id_created_at_idx ON payments(order_id, created_at);
CREATE INDEX stock_movements_item_created_at_idx ON stock_movements(inventory_item_id, created_at DESC);

-- +goose Down
DROP TABLE payments;
DROP TABLE order_item_modifiers;
DROP TABLE order_items;
DROP TABLE orders;
DROP TABLE stock_movements;
DROP TABLE product_recipes;
DROP TABLE inventory_items;
DROP TABLE suppliers;
DROP TABLE product_modifier_groups;
DROP TABLE modifiers;
DROP TABLE modifier_groups;
DROP TABLE products;
DROP TABLE categories;
DROP TABLE customers;
DROP TABLE shop_settings;
DROP TABLE role_permissions;
DROP TABLE user_roles;
DROP TABLE permissions;
DROP TABLE roles;
DROP TABLE users;
