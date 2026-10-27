-- name: GetUserByID :one
SELECT id, email, password_hash, display_name, phone, is_active, created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, email, password_hash, display_name, phone, is_active, created_at, updated_at
FROM users
WHERE email = $1;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, display_name, phone)
VALUES ($1, $2, $3, $4)
RETURNING id, email, password_hash, display_name, phone, is_active, created_at, updated_at;

-- name: UpdateUserProfile :one
UPDATE users
SET display_name = $2, phone = $3, updated_at = now()
WHERE id = $1
RETURNING id, email, password_hash, display_name, phone, is_active, created_at, updated_at;

-- name: SetUserActive :execrows
UPDATE users
SET is_active = $2, updated_at = now()
WHERE id = $1;

-- name: ListUserRoles :many
SELECT r.id, r.name, r.description
FROM roles r
JOIN user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = $1
ORDER BY r.name;

-- name: ListRolePermissions :many
SELECT p.id, p.code, p.description
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
WHERE rp.role_id = $1
ORDER BY p.code;

-- name: AssignRoleToUser :exec
INSERT INTO user_roles (user_id, role_id)
VALUES ($1, $2)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- name: RemoveRoleFromUser :exec
DELETE FROM user_roles
WHERE user_id = $1 AND role_id = $2;
