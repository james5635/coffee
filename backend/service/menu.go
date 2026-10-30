package service

import (
	"context"

	"github.com/james5635/coffee/backend/repository"
)

type menuService struct {
	repository repository.MenuRepository
}

func NewMenuService(repository repository.MenuRepository) MenuService {
	return &menuService{repository: repository}
}

func (s *menuService) Categories(ctx context.Context) ([]repository.Category, error) {
	return s.repository.ListCategories(ctx)
}

func (s *menuService) Products(ctx context.Context, categoryID *int64) ([]repository.Product, error) {
	return s.repository.ListProducts(ctx, categoryID)
}
