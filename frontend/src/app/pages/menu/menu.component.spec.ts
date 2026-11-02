import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  CategoriesDocument,
  CategoriesQuery,
  ProductsDocument,
  ProductsQuery,
} from '../../../graphql/generated/graphql';
import { AuthService } from '../../services/auth.service';
import { MenuComponent } from './menu.component';

const categories: CategoriesQuery['categories'] = [
  { id: 'cat-coffee', name: 'Coffee', description: 'Espresso drinks', sortOrder: 1 },
  { id: 'cat-tea', name: 'Tea', description: 'Brewed teas', sortOrder: 2 },
];

const products: ProductsQuery['products'] = [
  {
    id: 'product-flat-white',
    categoryId: 'cat-coffee',
    name: 'Flat White',
    description: 'Velvety espresso with steamed milk.',
    price: '4.25',
    sku: 'FW',
    modifierGroups: [
      {
        id: 'group-milk',
        name: 'Milk',
        minSelections: 0,
        maxSelections: 1,
        isRequired: false,
        sortOrder: 1,
        modifiers: [
          { id: 'modifier-oat', name: 'Oat milk', priceDelta: '0.75', sortOrder: 1 },
          { id: 'modifier-whole', name: 'Whole milk', priceDelta: '0.00', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    id: 'product-green-tea',
    categoryId: 'cat-tea',
    name: 'Green Tea',
    description: 'Sencha, brewed to order.',
    price: '3.50',
    sku: null,
    modifierGroups: [],
  },
];

/** Builds an AuthService mock that answers the public menu documents. */
function mockMenuQueries(
  categoryData: CategoriesQuery['categories'] = categories,
  productData: ProductsQuery['products'] = products,
) {
  return vi.fn((request: { query: unknown }) => {
    if (request.query === CategoriesDocument) {
      return Promise.resolve({ data: { categories: categoryData } });
    }
    if (request.query === ProductsDocument) {
      return Promise.resolve({ data: { products: productData } });
    }
    return Promise.reject(new Error('Unexpected menu query document.'));
  });
}

describe('MenuComponent', () => {
  const authService = { query: vi.fn() };

  /** Lets the component's floating load promise settle before assertions. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const createComponent = async (): Promise<ComponentFixture<MenuComponent>> => {
    const fixture = TestBed.createComponent(MenuComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    authService.query.mockReset();
    authService.query.mockImplementation(mockMenuQueries());

    await TestBed.configureTestingModule({
      imports: [MenuComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('loads categories and products through the auth-aware query path', async () => {
    await createComponent();

    expect(authService.query).toHaveBeenCalledWith({ query: CategoriesDocument });
    expect(authService.query).toHaveBeenCalledWith({
      query: ProductsDocument,
      variables: { categoryId: null },
    });
  });

  it('links guests to the public checkout screen', async () => {
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const orderLink = compiled.querySelector<HTMLAnchorElement>('[data-order-link]');

    expect(orderLink?.getAttribute('href')).toBe('/order');
  });

  it('renders categories, products, prices, and modifier groups', async () => {
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(text).toContain('Coffee');
    expect(text).toContain('Tea');
    expect(text).toContain('Flat White');
    expect(text).toContain('Velvety espresso with steamed milk.');
    expect(text).toContain('$4.25');
    expect(text).toContain('Green Tea');
    expect(text).toContain('$3.50');

    // Modifier group rules and price deltas are visible for ordering.
    expect(text).toContain('Milk');
    expect(text).toContain('Optional · Choose up to 1');
    expect(text).toContain('Oat milk');
    expect(text).toContain('+$0.75');
    expect(text).toContain('Whole milk');
  });

  it('filters products when a category is selected', async () => {
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    const teaButton = compiled.querySelector<HTMLButtonElement>('[data-category-id="cat-tea"]');
    expect(teaButton).toBeTruthy();
    teaButton!.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Green Tea');
    expect(compiled.textContent).not.toContain('Flat White');
    expect(teaButton!.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a loading state while the menu queries are in flight', async () => {
    let resolveCategories!: (value: unknown) => void;
    let resolveProducts!: (value: unknown) => void;
    authService.query.mockImplementation((request: { query: unknown }) =>
      request.query === CategoriesDocument
        ? new Promise((resolve) => (resolveCategories = resolve))
        : new Promise((resolve) => (resolveProducts = resolve)),
    );

    const fixture = TestBed.createComponent(MenuComponent);
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Loading menu');

    resolveCategories({ data: { categories } });
    resolveProducts({ data: { products } });
    await settle();
  });

  it('surfaces a query error gracefully and retries on request', async () => {
    authService.query.mockImplementation((request: { query: unknown }) => {
      if (request.query === CategoriesDocument) {
        return Promise.resolve({ data: { categories } });
      }
      return Promise.resolve({
        errors: [
          {
            message: 'You do not have permission to perform this action.',
            extensions: { code: 'FORBIDDEN' },
          },
        ],
      });
    });

    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const alert = compiled.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert!.textContent).toContain('permission');

    authService.query.mockImplementation(mockMenuQueries());
    compiled.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="alert"]')).toBeFalsy();
    expect(compiled.textContent).toContain('Flat White');
  });

  it('shows an empty state when no categories are configured', async () => {
    authService.query.mockImplementation(mockMenuQueries([], []));

    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('No menu categories');
  });

  it('renders modifier groups required by the backend', async () => {
    authService.query.mockImplementation(
      mockMenuQueries(categories, [
        {
          ...products[0],
          modifierGroups: [
            {
              id: 'group-size',
              name: 'Size',
              minSelections: 1,
              maxSelections: 1,
              isRequired: true,
              sortOrder: 1,
              modifiers: [
                { id: 'modifier-small', name: 'Small', priceDelta: '0.00', sortOrder: 1 },
              ],
            },
          ],
        },
      ]),
    );

    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Required · Choose 1');
    expect(text).toContain('Small');
    // No unrequested extra cost is displayed for a zero delta.
    expect(text).not.toContain('+$0.00');
  });

  it('highlights the selected category and can return to all items', async () => {
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('[data-category-id="cat-coffee"]')!.click();
    fixture.detectChanges();
    expect(compiled.textContent).not.toContain('Green Tea');

    compiled.querySelector<HTMLButtonElement>('[data-category-id="all"]')!.click();
    fixture.detectChanges();
    const byDebug = fixture.debugElement.query(By.css('[data-category-id="all"]'));
    expect(byDebug.nativeElement.getAttribute('aria-pressed')).toBe('true');
    expect(compiled.textContent).toContain('Green Tea');
  });
});
