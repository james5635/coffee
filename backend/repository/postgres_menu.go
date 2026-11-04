package repository

import (
	"context"
	"database/sql"

	db "github.com/james5635/coffee/backend/db"
)

func (p *Postgres) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := p.queries.ListActiveCategories(ctx)
	if err != nil {
		return nil, err
	}
	categories := make([]Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, Category{
			ID: row.ID, Name: row.Name, Description: row.Description,
			SortOrder: row.SortOrder, IsActive: row.IsActive, CreatedAt: row.CreatedAt,
		})
	}
	return categories, nil
}

func (p *Postgres) ListProducts(ctx context.Context, categoryID *int64) ([]Product, error) {
	rows, err := p.queries.ListAvailableProducts(ctx)
	if err != nil {
		return nil, err
	}
	products := make([]Product, 0, len(rows))
	for _, row := range rows {
		if categoryID != nil && (!row.CategoryID.Valid || row.CategoryID.Int64 != *categoryID) {
			continue
		}
		price, err := ParseMoney(row.Price)
		if err != nil {
			return nil, err
		}
		products = append(products, Product{
			ID: row.ID, CategoryID: nullableInt64(row.CategoryID), Name: row.Name,
			Description: row.Description, Price: price, SKU: nullableString(row.Sku),
			ImageURL: row.ImageUrl,
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

func (p *Postgres) GetSellableProduct(ctx context.Context, productID int64) (Product, error) {
	return sellableProduct(ctx, p.queries, productID)
}

func sellableProduct(ctx context.Context, queries *db.Queries, productID int64) (Product, error) {
	row, err := queries.GetSellableProduct(ctx, productID)
	if err != nil {
		return Product{}, mapQueryError(err)
	}
	price, err := ParseMoney(row.Price)
	if err != nil {
		return Product{}, err
	}
	product := Product{
		ID: row.ID, CategoryID: nullableInt64(row.CategoryID), Name: row.Name,
		Description: row.Description, Price: price, SKU: nullableString(row.Sku),
		IsAvailable: row.IsAvailable, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}
	product.Groups, err = loadModifierGroups(ctx, queries, productID)
	if err != nil {
		return Product{}, err
	}
	return product, nil
}

func loadModifierGroups(ctx context.Context, queries *db.Queries, productID int64) ([]ModifierGroup, error) {
	groupRows, err := queries.ListProductModifierGroups(ctx, productID)
	if err != nil {
		return nil, err
	}
	groups := make([]ModifierGroup, 0)
	groupIndices := make(map[int64]int)
	for _, groupRow := range groupRows {
		index, exists := groupIndices[groupRow.GroupID]
		if !exists {
			index = len(groups)
			groupIndices[groupRow.GroupID] = index
			groups = append(groups, ModifierGroup{
				ID: groupRow.GroupID, Name: groupRow.GroupName,
				MinSelections: groupRow.MinSelections, MaxSelections: groupRow.MaxSelections,
				IsRequired: groupRow.IsRequired, SortOrder: groupRow.ProductSortOrder,
				Options: make([]Modifier, 0),
			})
		}
		if !groupRow.ModifierID.Valid {
			continue
		}
		priceDelta, err := ParseMoney(groupRow.PriceDelta.String)
		if err != nil {
			return nil, err
		}
		groups[index].Options = append(groups[index].Options, Modifier{
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
