# Coffee Shop Web App

A comprehensive web application for managing coffee shop operations, built with a role-based access control (RBAC) system to handle different user types and their permissions.

## Tech Stack

### Backend
- **Language**: Go (Golang)
- **Database**: SQL with [sqlc](https://sqlc.dev/) for type-safe SQL code generation
- **Migrations**: [Goose](https://github.com/pressly/goose) for database migrations
- **API**: GraphQL

### Frontend
- **Framework**: Angular

## Overview

This coffee shop management system provides a complete solution for handling orders, inventory, staff management, and customer interactions. The application is designed around a robust authorization framework that supports five distinct user roles, each with carefully defined permissions.

## User Roles

### 1. Owner / Admin
**Full access** — Owns and configures the coffee shop.
- Manage users and roles
- Configure shop settings
- Manage menu and prices
- Access all orders and inventory
- View financial reports
- Issue refunds
- Manage branches

### 2. Manager
**Operational access** — Handles daily operations and supervises employees.
- Manage menu availability
- Oversee orders
- Manage stock and suppliers
- Supervise staff
- View sales reports
- Apply approved discounts
- Approve refunds within configured limits

### 3. Cashier
**Sales access** — Takes customer orders and handles payments.
- Create orders
- Edit unpaid orders
- Accept payments
- Print receipts
- Apply permitted discounts
- View relevant order history
- Refunds and cancellations after payment require authorization

### 4. Barista
**Order preparation** — Prepares drinks and updates order progress.
- View accepted orders
- See drink specifications and special requests
- Mark orders as preparing or ready
- Mark preparation complete
- Cannot change prices, record payments, or issue refunds

### 5. Customer
**Personal account** — Browses the menu and places orders (optional authenticated role).
- View available products and prices
- Place orders and pay
- View own order history
- Manage profile
- Use loyalty rewards
- Cancel own orders when eligible

> **Note:** Customers are optional as authenticated users. The system supports guest ordering, so customers don't necessarily need an account.

## Permission Matrix

| Feature / Permission | Owner/Admin | Manager | Cashier | Barista | Customer |
|---------------------|-------------|---------|---------|---------|----------|
| View menu | All | All | All | Relevant items | Public menu |
| Create/edit products and prices | Yes | Yes | No | No | No |
| Manage categories and modifiers | Yes | Yes | No | No | No |
| Create orders | Yes | Yes | Yes | No | Yes |
| View orders | All | All | Assigned/permitted | Preparation queue | Own |
| Update order status | Yes | Yes | Limited | Preparation statuses | No |
| Accept payments | Yes | Yes | Yes | No | Own checkout |
| Issue refunds | Yes | Limited | No by default | No | Request only |
| Manage inventory | Yes | Yes | Limited stock lookup | Report usage/low stock | No |
| Manage suppliers | Yes | Yes | No | No | No |
| View sales reports | All | Yes | Limited | No | Own orders |
| View profit and financial reports | Yes | Optional | No | No | No |
| Manage staff accounts and roles | Yes | Limited | No | No | No |
| Configure shop settings | Yes | Limited | No | No | No |
| Manage own profile | Yes | Yes | Yes | Yes | Yes |

## Granular Permission System

Rather than hardcoding role checks throughout the codebase, the system defines granular permissions that are assigned to roles:

### Permission Modules

| Module | Example Permissions |
|--------|---------------------|
| **Products** | `product.read`, `product.create`, `product.update`, `product.delete` |
| **Orders** | `order.create`, `order.read.all`, `order.read.own`, `order.update_status`, `order.cancel` |
| **Payments** | `payment.accept`, `payment.refund` |
| **Inventory** | `inventory.read`, `inventory.adjust`, `inventory.manage` |
| **Reports** | `report.sales.read`, `report.profit.read` |
| **Employees** | `user.read`, `user.create`, `user.update`, `user.disable`, `role.manage` |
| **Settings** | `settings.read`, `settings.update` |
| **Discounts** | `discount.apply`, `discount.manage` |

### Role-Permission Assignments

```
Owner/Admin
  -> All permissions

Manager
  -> product.*
  -> order.*
  -> inventory.*
  -> report.sales.read
  -> payment.refund (subject to limits)
  -> selected user-management permissions

Cashier
  -> product.read
  -> order.create
  -> order.read.assigned
  -> order.update_unpaid
  -> payment.accept
  -> discount.apply

Barista
  -> order.read.preparation_queue
  -> order.update_status

Customer
  -> product.read
  -> order.create
  -> order.read.own
  -> order.cancel.own (subject to order status)
  -> profile.manage.own
```

## System Architecture

### RBAC Implementation

The backend uses Role-Based Access Control with these core entities:

- **User** — Login and account information
- **Role** — Owner, Manager, Cashier, Barista, Customer
- **Permission** — Individual actions the system allows
- **UserRole** — Assigns roles to users
- **RolePermission** — Assigns permissions to roles

```
User → UserRole → Role → RolePermission → Permission
```

> **Security Note:** The backend enforces permissions on every protected operation. Hiding a button in the frontend is not security by itself.

## MVP Implementation Priority

For a single coffee shop MVP, implement in this order:

1. **Owner/Admin** — Full system control
2. **Manager** — Daily operations
3. **Cashier** — Order taking and payments
4. **Barista** — Order preparation

Add **Customer** as an authenticated role when implementing:
- Customer accounts
- Online ordering
- Loyalty programs

## Future Extensibility

- **Inventory Staff** — Dedicated role when stock management becomes a separate responsibility
- **Platform Admin** — For multi-shop SaaS products where your company manages multiple coffee shops
- **Configurable Permissions** — Refunds, discounts, and other permissions should be configurable rather than hard-coded to roles

## Project Structure

```
coffee/
├── backend/          # Backend API (to be implemented)
├── frontend/         # Frontend application (to be implemented)
├── docs/
│   └── plans.md      # This planning document
├── compose.yaml      # Docker Compose for local development
└── Taskfile.yml      # Task automation
```

## Getting Started

*Documentation for setup, development, and deployment will be added as the project progresses.*

## License

[Add your license here]