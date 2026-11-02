import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CategoriesDocument,
  CategoriesQuery,
  ProductsDocument,
  ProductsQuery,
} from '../../../graphql/generated/graphql';
import { AuthService } from '../../services/auth.service';
import { GraphQLError, graphQLErrorCode } from '../../services/graphql.service';
import { formatCents, formatMoney, parseDecimalToCents } from '../../utils/money';

/** One modifier option as rendered on the menu. */
interface MenuModifierView {
  id: string;
  name: string;
  /** Pre-formatted delta, or an empty string when the modifier has no extra cost. */
  priceDeltaLabel: string;
}

/** One modifier group with its selection rules. */
interface MenuModifierGroupView {
  id: string;
  name: string;
  ruleLabel: string;
  modifiers: MenuModifierView[];
}

/** A product ready for display, with money already parsed to integer cents. */
interface MenuProductView {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  priceLabel: string;
  modifierGroups: MenuModifierGroupView[];
}

/** A menu category used for the filter rail. */
interface MenuCategoryView {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

interface Sortable {
  sortOrder: number;
  name: string;
}

function compareBySortOrder<T extends Sortable>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/** Human-readable selection rule, e.g. "Required · Choose 1". */
function modifierRuleLabel(group: {
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
}): string {
  let range: string;
  if (group.maxSelections <= 0) {
    range = 'No selections';
  } else if (group.minSelections === group.maxSelections) {
    range = `Choose ${group.minSelections}`;
  } else if (group.minSelections === 0) {
    range = `Choose up to ${group.maxSelections}`;
  } else {
    range = `Choose ${group.minSelections}–${group.maxSelections}`;
  }
  return group.isRequired ? `Required · ${range}` : `Optional · ${range}`;
}

/** Formats a modifier price delta, hiding a zero delta. */
function priceDeltaLabel(value: string): string {
  const cents = parseDecimalToCents(value);
  if (cents === null) {
    return value;
  }
  if (cents === 0) {
    return '';
  }
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/** Maps backend menu errors to UI copy; public menu reads fail closed. */
function menuErrorMessage(error: GraphQLError): string {
  switch (graphQLErrorCode(error)) {
    case 'FORBIDDEN':
      return 'You do not have permission to view the menu.';
    case 'NOT_FOUND':
      return 'The menu is not available right now.';
    default:
      return 'We could not load the menu. Please try again.';
  }
}

function toProductView(product: ProductsQuery['products'][number]): MenuProductView {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    priceLabel: formatMoney(product.price),
    modifierGroups: [...product.modifierGroups].sort(compareBySortOrder).map((group) => ({
      id: group.id,
      name: group.name,
      ruleLabel: modifierRuleLabel(group),
      modifiers: [...group.modifiers].sort(compareBySortOrder).map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        priceDeltaLabel: priceDeltaLabel(modifier.priceDelta),
      })),
    })),
  };
}

/**
 * Public menu browsing screen.
 *
 * Categories and the full product list (with modifier groups and modifiers)
 * are fetched through `AuthService.query`, so the Phase 1 refresh orchestration
 * still applies if a signed-in staff member's token expires while browsing.
 * The reads themselves are public: no bearer is required, and guest visitors
 * see the same menu. Categories are filtered in the browser from the single
 * product query so switching categories needs no extra round-trip.
 */
@Component({
  selector: 'app-menu',
  imports: [RouterLink],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
})
export class MenuComponent implements OnInit {
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly categories = signal<MenuCategoryView[]>([]);
  protected readonly products = signal<MenuProductView[]>([]);

  /** `null` means "All items". */
  protected readonly selectedCategoryId = signal<string | null>(null);

  protected readonly selectedCategory = computed(
    () => this.categories().find((category) => category.id === this.selectedCategoryId()) ?? null,
  );

  protected readonly visibleProducts = computed(() => {
    const categoryId = this.selectedCategoryId();
    const products = this.products();
    return categoryId === null
      ? products
      : products.filter((product) => product.categoryId === categoryId);
  });

  ngOnInit(): void {
    void this.load();
  }

  /** Loads the public menu; also used by the error-state retry action. */
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const [categoriesResponse, productsResponse] = await Promise.all([
        this.auth.query<CategoriesQuery>({ query: CategoriesDocument }),
        this.auth.query<ProductsQuery>({
          query: ProductsDocument,
          variables: { categoryId: null },
        }),
      ]);

      const error = categoriesResponse.errors?.[0] ?? productsResponse.errors?.[0];
      if (error) {
        this.errorMessage.set(menuErrorMessage(error));
        return;
      }

      this.categories.set(
        [...(categoriesResponse.data?.categories ?? [])].sort(compareBySortOrder),
      );
      this.products.set((productsResponse.data?.products ?? []).map(toProductView));

      // A retry can change the category set; drop a stale filter selection.
      const selected = this.selectedCategoryId();
      if (selected !== null && !this.categories().some((category) => category.id === selected)) {
        this.selectedCategoryId.set(null);
      }
    } catch {
      this.errorMessage.set('We could not load the menu. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
  }
}
