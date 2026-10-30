package graph

import "github.com/james5635/coffee/backend/service"

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require
// here.

type Resolver struct {
	Menu     service.MenuService
	Orders   service.OrderService
	Payments service.PaymentService
	Auth     service.AuthService
}
