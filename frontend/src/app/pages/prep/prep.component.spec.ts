import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AdvanceOrderStatusMutation,
  PreparationQueueQuery,
} from '../../../graphql/generated/graphql';
import { OrderStatus, OrderType } from '../../../graphql/generated/schema';
import { AuthStateService } from '../../services/auth-state.service';
import { OrderError, OrderService } from '../../services/order.service';
import { PrepComponent } from './prep.component';

type PrepOrder = PreparationQueueQuery['preparationQueue'][number];

function makeOrder(overrides: Partial<PrepOrder> = {}): PrepOrder {
  return {
    id: 'order-1',
    orderNumber: '1001',
    status: OrderStatus.Accepted,
    orderType: OrderType.Takeaway,
    customerName: 'Sam',
    customerEmail: null,
    notes: '',
    subtotal: '8.50',
    discountAmount: '0.00',
    taxAmount: '0.00',
    total: '8.50',
    currency: 'USD',
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    completedAt: null,
    items: [
      {
        id: 'item-1',
        productId: 'product-flat-white',
        productName: 'Flat White',
        quantity: 2,
        unitPrice: '4.25',
        lineTotal: '8.50',
        specialInstructions: '',
        modifiers: [
          {
            id: 'item-modifier-1',
            modifierId: 'modifier-oat',
            modifierName: 'Oat milk',
            priceDelta: '0.75',
          },
        ],
      },
    ],
    payments: [],
    ...overrides,
  };
}

describe('PrepComponent', () => {
  const orderService = {
    preparationQueue: vi.fn(),
    advanceOrderStatus: vi.fn(),
    getOrder: vi.fn(),
  };
  const roles = signal<string[] | null>(null);
  const permissions = signal<string[] | null>(null);

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const createComponent = async (): Promise<ComponentFixture<PrepComponent>> => {
    const fixture = TestBed.createComponent(PrepComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const click = async (
    fixture: ComponentFixture<PrepComponent>,
    selector: string,
  ): Promise<void> => {
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      selector,
    );
    expect(button, `expected ${selector} to exist`).toBeTruthy();
    button!.click();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const enterOrderId = (fixture: ComponentFixture<PrepComponent>, value: string): void => {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-pending-order-id]',
    );
    expect(input).toBeTruthy();
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submitLookup = async (fixture: ComponentFixture<PrepComponent>): Promise<void> => {
    const form = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>(
      '[data-accept-pending] form',
    );
    expect(form).toBeTruthy();
    form!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const setBarista = () => {
    roles.set(['barista']);
    permissions.set(['order.read.preparation_queue', 'order.update_status']);
  };

  const setManager = () => {
    roles.set(['manager']);
    permissions.set(['order.read.all', 'order.update_status', 'order.cancel', 'payment.accept']);
  };

  const setOwner = () => {
    roles.set(['owner_admin']);
    permissions.set([
      'order.read.all',
      'order.read.preparation_queue',
      'order.update_status',
      'order.cancel',
      'payment.accept',
    ]);
  };

  beforeEach(async () => {
    roles.set(null);
    permissions.set(null);
    orderService.preparationQueue.mockReset().mockResolvedValue([]);
    orderService.advanceOrderStatus.mockReset();
    orderService.getOrder.mockReset();

    await TestBed.configureTestingModule({
      imports: [PrepComponent],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        {
          provide: AuthStateService,
          useValue: {
            roles,
            permissions,
            hasPermission: (permission: string) => {
              const granted = permissions();
              return granted === null ? true : granted.includes(permission);
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('renders accepted and preparing orders from the preparation queue', async () => {
    setBarista();
    orderService.preparationQueue.mockResolvedValue([
      makeOrder({ notes: 'No lid' }),
      makeOrder({
        id: 'order-2',
        orderNumber: '1002',
        status: OrderStatus.Preparing,
        customerName: null,
        items: [
          {
            id: 'item-2',
            productId: 'product-tea',
            productName: 'Green Tea',
            quantity: 1,
            unitPrice: '3.50',
            lineTotal: '3.50',
            specialInstructions: 'Extra hot',
            modifiers: [],
          },
        ],
      }),
    ]);

    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(orderService.preparationQueue).toHaveBeenCalled();
    expect(text).toContain('Order #1001');
    expect(text).toContain('Order #1002');
    expect(text).toContain('Awaiting prep');
    expect(text).toContain('Being prepared');
    expect(text).toContain('Flat White');
    expect(text).toContain('Oat milk');
    expect(text).toContain('No lid');
    expect(text).toContain('Green Tea');
    expect(text).toContain('Extra hot');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-advance="order-1"]'),
    ).toBeTruthy();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-advance="order-2"]'),
    ).toBeTruthy();
  });

  it('does not load the queue when the user lacks the preparation-queue permission', async () => {
    permissions.set(['order.read.own']);
    roles.set(['customer']);

    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(orderService.preparationQueue).not.toHaveBeenCalled();
    expect(text).toContain('do not have permission');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-prep-queue]')).toBeNull();
  });

  it('advances an accepted order to preparing and keeps it in the queue', async () => {
    setBarista();
    const accepted = makeOrder();
    const preparing: AdvanceOrderStatusMutation['advanceOrderStatus'] = {
      ...accepted,
      status: OrderStatus.Preparing,
    };
    orderService.preparationQueue.mockResolvedValue([accepted]);
    orderService.advanceOrderStatus.mockResolvedValue(preparing);

    const fixture = await createComponent();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-advance="order-1"]')?.textContent,
    ).toContain('Start preparing');

    await click(fixture, '[data-advance="order-1"]');
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(orderService.advanceOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Preparing);
    expect(text).toContain('Order #1001 is now being prepared');
    expect(text).toContain('Being prepared');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-advance="order-1"]')?.textContent,
    ).toContain('Mark ready');
  });

  it('removes an order from the queue once it is marked ready', async () => {
    setBarista();
    const preparing = makeOrder({ status: OrderStatus.Preparing });
    orderService.preparationQueue.mockResolvedValue([preparing]);
    orderService.advanceOrderStatus.mockResolvedValue({
      ...preparing,
      status: OrderStatus.Ready,
    });

    const fixture = await createComponent();
    await click(fixture, '[data-advance="order-1"]');
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(orderService.advanceOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Ready);
    expect(text).toContain('Order #1001 is ready');
    expect(text).toContain('No orders in the prep queue');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-order-id="order-1"]'),
    ).toBeNull();
  });

  it('never offers READY to COMPLETED or cancellation to a barista', async () => {
    setBarista();
    orderService.preparationQueue.mockResolvedValue([makeOrder({ status: OrderStatus.Preparing })]);

    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).not.toContain('Complete');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-cancel]')).toBeNull();
  });

  it('surfaces INVALID_STATE and refreshes the queue', async () => {
    setBarista();
    const accepted = makeOrder();
    orderService.preparationQueue
      .mockResolvedValueOnce([accepted])
      .mockResolvedValueOnce([{ ...accepted, status: OrderStatus.Preparing }]);
    orderService.advanceOrderStatus.mockRejectedValue(
      new OrderError('INVALID_STATE', 'Order status changed.'),
    );

    const fixture = await createComponent();
    await click(fixture, '[data-advance="order-1"]');
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('already moved on');
    expect(orderService.preparationQueue).toHaveBeenCalledTimes(2);
    expect(text).toContain('Being prepared');
  });

  it('surfaces FORBIDDEN when the backend rejects a transition', async () => {
    setBarista();
    orderService.preparationQueue.mockResolvedValue([makeOrder()]);
    orderService.advanceOrderStatus.mockRejectedValue(
      new OrderError('FORBIDDEN', 'missing order.update_status'),
    );

    const fixture = await createComponent();
    await click(fixture, '[data-advance="order-1"]');
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('cannot update this order');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-order-id="order-1"]'),
    ).toBeTruthy();
  });

  it('lets a manager accept a pending order looked up by ID', async () => {
    setManager();
    const pending = makeOrder({ status: OrderStatus.Pending });
    orderService.getOrder.mockResolvedValue(pending);
    orderService.advanceOrderStatus.mockResolvedValue({
      ...pending,
      status: OrderStatus.Accepted,
    });

    const fixture = await createComponent();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-accept-pending]'),
    ).toBeTruthy();

    enterOrderId(fixture, 'order-1');
    await submitLookup(fixture);
    let text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(orderService.getOrder).toHaveBeenCalledWith('order-1');
    expect(text).toContain('Awaiting acceptance');

    await click(fixture, '[data-accept-order]');
    text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(orderService.advanceOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Accepted);
    expect(text).toContain('Order #1001 accepted');
    expect(text).toContain('Awaiting prep');
  });

  it('does not offer pending acceptance to a barista', async () => {
    setBarista();
    const fixture = await createComponent();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-accept-pending]'),
    ).toBeNull();
  });

  it('requires a second click before cancelling an accepted order', async () => {
    setOwner();
    const accepted = makeOrder();
    orderService.preparationQueue.mockResolvedValue([accepted]);
    orderService.advanceOrderStatus.mockResolvedValue({
      ...accepted,
      status: OrderStatus.Cancelled,
    });

    const fixture = await createComponent();
    await click(fixture, '[data-cancel="order-1"]');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Confirm cancel');
    expect(orderService.advanceOrderStatus).not.toHaveBeenCalled();

    await click(fixture, '[data-confirm-cancel="order-1"]');
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(orderService.advanceOrderStatus).toHaveBeenCalledWith('order-1', OrderStatus.Cancelled);
    expect(text).toContain('Order #1001 cancelled');
    expect(text).toContain('No orders in the prep queue');
  });

  it('shows a load error with a retry action', async () => {
    setBarista();
    orderService.preparationQueue
      .mockRejectedValueOnce(new OrderError('INTERNAL', 'boom'))
      .mockResolvedValueOnce([makeOrder()]);

    const fixture = await createComponent();
    let text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('could not load the prep queue');

    await click(fixture, '[data-retry-queue]');
    text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('Order #1001');
  });
});
