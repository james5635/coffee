package repository

import (
	"context"
	"database/sql"

	db "github.com/james5635/coffee/backend/db"
	"github.com/james5635/coffee/backend/service/domain"
)

func (p *Postgres) ListCategories(ctx context.Context) ([]domain.Category, error) {
	rows, err := p.queries.ListActiveCategories(ctx)
	if err != nil {
		return nil, err
	}
	categories := make([]domain.Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, domain.Category{
			ID: row.ID, Name: row.Name, Description: row.Description,
			SortOrder: row.SortOrder, IsActive: row.IsActive, CreatedAt: row.CreatedAt,
		})
	}
	return categories, nil
}

func (p *Postgres) ListProducts(ctx context.Context, categoryID *int64) ([]domain.Product, error) {
	rows, err := p.queries.ListAvailableProducts(ctx)
	if err != nil {
		return nil, err
	}
	products := make([]domain.Product, 0, len(rows))
	for _, row := range rows {
		if categoryID != nil && (!row.CategoryID.Valid || row.CategoryID.Int64 != *categoryID) {
			continue
		}
		price, err := domain.ParseMoney(row.Price)
		if err != nil {
			return nil, err
		}
		products = append(products, domain.Product{
			ID: row.ID, CategoryID: nullableInt64(row.CategoryID), Name: row.Name,
			Description: row.Description, Price: price, SKU: nullableString(row.Sku),
			IsAvailable: row.IsAvailable, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		})
		product := &products[len(products)-1]
		product.Groups, err = loadModifierGroups(ctx, p.queries, product.ID)
		if err != nil {
			return nil, err
		}
	}
	return products, nil
}

func (p *Postgres) GetSellableProduct(ctx context.Context, productID int64) (domain.Product, error) {
	return sellableProduct(ctx, p.queries, productID)
}

func sellableProduct(ctx context.Context, queries *db.Queries, productID int64) (domain.Product, error) {
	row, err := queries.GetSellableProduct(ctx, productID)
	if err != nil {
		return domain.Product{}, mapQueryError(err)
	}
	price, err := domain.ParseMoney(row.Price)
	if err != nil {
		return domain.Product{}, err
	}
	product := domain.Product{
		ID: row.ID, CategoryID: nullableInt64(row.CategoryID), Name: row.Name,
		Description: row.Description, Price: price, SKU: nullableString(row.Sku),
		IsAvailable: row.IsAvailable, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
	product.Groups, err = loadModifierGroups(ctx, queries, productID)
	if err != nil {
		return domain.Product{}, err
	}
	return product, nil
}

func loadModifierGroups(ctx context.Context, queries *db.Queries, productID int64) ([]domain.ModifierGroup, error) {
	groupRows, err := queries.ListProductModifierGroups(ctx, productID)
	if err != nil {
		return nil, err
	}
	groups := make([]domain.ModifierGroup, 0)
	groupIndices := make(map[int64]int)
	for _, groupRow := range groupRows {
		index, exists := groupIndices[groupRow.GroupID]
		if !exists {
			index = len(groups)
			groupIndices[groupRow.GroupID] = index
			groups = append(groups, domain.ModifierGroup{
				ID: groupRow.GroupID, Name: groupRow.GroupName,
				MinSelections: groupRow.MinSelections, MaxSelections: groupRow.MaxSelections,
				IsRequired: groupRow.IsRequired, SortOrder: groupRow.ProductSortOrder,
				Options: make([]domain.Modifier, 0),
			})
		}
		if !groupRow.ModifierID.Valid {
			continue
		}
		priceDelta, err := domain.ParseMoney(groupRow.PriceDelta.String)
		if err != nil {
			return nil, err
		}
		groups[index].Options = append(groups[index].Options, domain.Modifier{
			ID: groupRow.ModifierID.Int64, Name: groupRow.ModifierName.String,
			PriceDelta: priceDelta, SortOrder: groupRow.SortOrder.Int32,
		})
	}
	return groups, nil
}

func nullableInt64(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	copy := value.Int64
	return &copy
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	copy := value.String
	return &copy
}
