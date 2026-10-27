-- name: ListInventoryItems :many
SELECT i.id, i.name, i.unit, i.quantity, i.low_stock_threshold,
       i.supplier_id, s.name AS supplier_name, i.unit_cost, i.is_active, i.updated_at
FROM inventory_items i
LEFT JOIN suppliers s ON s.id = i.supplier_id
WHERE i.is_active
ORDER BY i.name;

-- name: ListLowStockInventory :many
SELECT id, name, unit, quantity, low_stock_threshold, supplier_id, unit_cost, updated_at
FROM inventory_items
WHERE is_active AND quantity <= low_stock_threshold
ORDER BY quantity - low_stock_threshold, name;

-- name: CreateInventoryItem :one
INSERT INTO inventory_items (name, unit, quantity, low_stock_threshold, supplier_id, unit_cost)
VALUES ($1, $2, 0, $3, $4, $5)
RETURNING id, name, unit, quantity, low_stock_threshold, supplier_id, unit_cost, is_active, updated_at;

-- name: AddStockMovement :one
WITH updated_item AS (
    UPDATE inventory_items
    SET quantity = inventory_items.quantity + $2, updated_at = now()
    WHERE inventory_items.id = $1
      AND inventory_items.quantity + $2 >= 0
    RETURNING inventory_items.id
), movement AS (
    INSERT INTO stock_movements (inventory_item_id, quantity_delta, reason, note, recorded_by)
    SELECT $1, $2, $3, $4, $5 FROM updated_item
    RETURNING id, inventory_item_id, quantity_delta, reason, note, recorded_by, created_at
)
SELECT * FROM movement;

-- name: ListStockMovements :many
SELECT id, inventory_item_id, quantity_delta, reason, note, recorded_by, created_at
FROM stock_movements
WHERE inventory_item_id = $1
ORDER BY created_at DESC, id DESC
LIMIT $2;

-- name: ListSuppliers :many
SELECT id, name, contact_name, email, phone, notes, is_active, created_at
FROM suppliers
WHERE is_active
ORDER BY name;

-- name: CreateSupplier :one
INSERT INTO suppliers (name, contact_name, email, phone, notes)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, contact_name, email, phone, notes, is_active, created_at;
