import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  OrderStatus,
  OrderType,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from '../../../graphql/generated/schema';
import {
  PlaceOrderMutation,
  ProductsQuery,
  RecordPaymentMutation,
} from '../../../graphql/generated/graphql';
import { AuthStateService } from '../../services/auth-state.service';
import { OrderError, OrderService } from '../../services/order.service';
import { OrderComponent } from './order.component';

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

const placedOrder: PlaceOrderMutation['placeOrder'] = {
  id: 'order-1',
  orderNumber: '1001',
  status: OrderStatus.Pending,
  orderType: OrderType.Takeaway,
  customerName: null,
  customerEmail: null,
  notes: '',
  subtotal: '4.25',
  discountAmount: '0.00',
  taxAmount: '0.00',
  total: '4.25',
  currency: 'USD',
  createdAt: '2026-11-02T10:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
  completedAt: null,
  items: [
    {
      id: 'item-1',
      productId: 'product-flat-white',
      productName: 'Flat White',
      quantity: 1,
      unitPrice: '4.25',
      lineTotal: '4.25',
      specialInstructions: '',
      modifiers: [],
    },
  ],
  payments: [],
};

const payment: RecordPaymentMutation['recordPayment'] = {
  id: 'payment-1',
  kind: PaymentKind.Payment,
  status: PaymentStatus.Succeeded,
  method: PaymentMethod.Cash,
  amount: '4.25',
  externalReference: null,
  createdAt: '2026-11-02T10:05:00Z',
  settledAt: '2026-11-02T10:05:00Z',
};

describe('OrderComponent', () => {
  const orderService = {
    listProducts: vi.fn(),
    placeOrder: vi.fn(),
    getOrder: vi.fn(),
    recordPayment: vi.fn(),
  };
  const authenticated = signal(false);

  /** Lets the component's floating async work settle before assertions. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const createComponent = async (): Promise<ComponentFixture<OrderComponent>> => {
    const fixture = TestBed.createComponent(OrderComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const setInput = (fixture: ComponentFixture<OrderComponent>, selector: string, value: string) => {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
    expect(input).toBeTruthy();
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submit = async (fixture: ComponentFixture<OrderComponent>, selector: string) => {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>(selector)!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    authenticated.set(false);
    orderService.listProducts.mockReset().mockResolvedValue(products);
    orderService.placeOrder.mockReset();
    orderService.getOrder.mockReset();
    orderService.recordPayment.mockReset();

    await TestBed.configureTestingModule({
      imports: [OrderComponent],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        { provide: AuthStateService, useValue: { isAuthenticated: authenticated } },
      ],
    }).compileComponents();
  });

  it('loads the sellable menu for building a cart', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent as string;

    expect(orderService.listProducts).toHaveBeenCalled();
    expect(text).toContain('Flat White');
    expect(text).toContain('$4.25');
    expect(text).toContain('Green Tea');
    expect(text).toContain('$3.50');
  });

  it('adds products to the cart and places a guest order with a confirmation', async () => {
    orderService.placeOrder.mockResolvedValue(placedOrder);
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('[data-add-product="product-flat-white"]')!.click();
    fixture.detectChanges();
    expect(compiled.querySelector('[data-cart]')?.textContent).toContain('Flat White');

    await submit(fixture, '[data-checkout-form]');

    expect(orderService.placeOrder).toHaveBeenCalledWith({
      orderType: OrderType.Takeaway,
      customerName: null,
      customerEmail: null,
      notes: null,
      items: [
        {
          productId: 'product-flat-white',
          quantity: 1,
          modifierIds: null,
          specialInstructions: null,
        },
      ],
    });
    const confirmation = compiled.querySelector('[data-confirmation]');
    expect(confirmation).toBeTruthy();
    expect(confirmation!.textContent).toContain('Order #1001');
    expect(confirmation!.textContent).toContain('Payment due');
    // Guests do not get the staff payment form.
    expect(compiled.querySelector('[data-staff-payment]')).toBeFalsy();
  });

  it('includes selected modifiers in the cart total and placeOrder input', async () => {
    orderService.placeOrder.mockResolvedValue(placedOrder);
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLInputElement>('[data-modifier-id="modifier-oat"]')!.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('[data-add-product="product-flat-white"]')!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-cart]')?.textContent).toContain('Oat milk');
    expect(compiled.querySelector('[data-cart]')?.textContent).toContain('$5.00');

    await submit(fixture, '[data-checkout-form]');

    expect(orderService.placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            productId: 'product-flat-white',
            quantity: 1,
            modifierIds: ['modifier-oat'],
            specialInstructions: null,
          },
        ],
      }),
    );
  });

  it('blocks adding a product when a required modifier group is empty', async () => {
    orderService.listProducts.mockResolvedValue([
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
            modifiers: [{ id: 'modifier-small', name: 'Small', priceDelta: '0.00', sortOrder: 1 }],
          },
        ],
      },
    ]);
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('[data-add-product="product-flat-white"]')!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-modifier-error]')?.textContent).toContain('Size');
    expect(compiled.querySelector('[data-cart]')).toBeFalsy();
  });

  it('requires at least one item before placing an order', async () => {
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    await submit(fixture, '[data-checkout-form]');

    expect(orderService.placeOrder).not.toHaveBeenCalled();
    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      'Add at least one item',
    );
  });

  it('surfaces a BAD_USER_INPUT failure without losing the cart', async () => {
    orderService.placeOrder.mockRejectedValue(new OrderError('BAD_USER_INPUT'));
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('[data-add-product="product-flat-white"]')!.click();
    fixture.detectChanges();
    await submit(fixture, '[data-checkout-form]');

    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain('review your order');
    expect(compiled.querySelector('[data-cart]')?.textContent).toContain('Flat White');
  });

  it('shows the staff payment form to authenticated staff and prefills it after an order', async () => {
    authenticated.set(true);
    orderService.placeOrder.mockResolvedValue(placedOrder);
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-staff-payment]')).toBeTruthy();

    compiled.querySelector<HTMLButtonElement>('[data-add-product="product-flat-white"]')!.click();
    fixture.detectChanges();
    await submit(fixture, '[data-checkout-form]');

    const orderId = compiled.querySelector<HTMLInputElement>('[data-payment-order-id]');
    const amount = compiled.querySelector<HTMLInputElement>('[data-payment-amount]');
    expect(orderId?.value).toBe('order-1');
    expect(amount?.value).toBe('4.25');
  });

  it('records a staff payment through the service and confirms it', async () => {
    authenticated.set(true);
    orderService.recordPayment.mockResolvedValue(payment);
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    setInput(fixture, '[data-payment-order-id]', 'order-1');
    setInput(fixture, '[data-payment-amount]', '4.25');
    await submit(fixture, '[data-payment-form]');

    expect(orderService.recordPayment).toHaveBeenCalledWith({
      orderId: 'order-1',
      method: PaymentMethod.Cash,
      amount: '4.25',
      externalReference: null,
    });
    expect(compiled.querySelector('[data-payment-success]')?.textContent).toContain(
      'Payment recorded',
    );
  });

  it('explains an INSUFFICIENT_BALANCE payment failure', async () => {
    authenticated.set(true);
    orderService.recordPayment.mockRejectedValue(new OrderError('INSUFFICIENT_BALANCE'));
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    setInput(fixture, '[data-payment-order-id]', 'order-1');
    setInput(fixture, '[data-payment-amount]', '99.00');
    await submit(fixture, '[data-payment-form]');

    expect(compiled.querySelector('[data-payment-error]')?.textContent).toContain(
      'exceeds the outstanding balance',
    );
  });

  it('rejects malformed payment amounts before calling the API', async () => {
    authenticated.set(true);
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    setInput(fixture, '[data-payment-order-id]', 'order-1');
    setInput(fixture, '[data-payment-amount]', 'abc');
    await submit(fixture, '[data-payment-form]');

    expect(orderService.recordPayment).not.toHaveBeenCalled();
    expect(compiled.querySelector('[data-payment-error]')?.textContent).toContain(
      'valid payment amount',
    );
  });
});
