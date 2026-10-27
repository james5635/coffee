package service

import (
	"context"

	"github.com/james5635/coffee/backend/repository"
	"github.com/james5635/coffee/backend/service/domain"
)

type menuService struct {
	repository repository.MenuRepository
}

func NewMenuService(repository repository.MenuRepository) MenuService {
	return &menuService{repository: repository}
}

func (s *menuService) Categories(ctx context.Context) ([]domain.Category, error) {
	return s.repository.ListCategories(ctx)
}

func (s *menuService) Products(ctx context.Context, categoryID *int64) ([]domain.Product, error) {
	return s.repository.ListProducts(ctx, categoryID)
}
