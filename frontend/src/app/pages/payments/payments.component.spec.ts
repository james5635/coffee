import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  IssueRefundMutation,
  OrderQuery,
  RecordPaymentMutation,
} from '../../../graphql/generated/graphql';
import {
  OrderStatus,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
} from '../../../graphql/generated/schema';
import { AuthStateService } from '../../services/auth-state.service';
import { OrderError, OrderService } from '../../services/order.service';
import { PaymentsComponent } from './payments.component';

type PaymentsOrder = OrderQuery['order'];
type PaymentsPayment = RecordPaymentMutation['recordPayment'];

function makeOrder(overrides: Partial<PaymentsOrder> = {}): PaymentsOrder {
  return {
    id: 'order-1',
    orderNumber: '1001',
    status: OrderStatus.Accepted,
    orderType: 'TAKEAWAY' as PaymentsOrder['orderType'],
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
    items: [],
    payments: [],
    ...overrides,
  };
}

function makePayment(overrides: Partial<PaymentsPayment> = {}): PaymentsPayment {
  return {
    id: 'payment-1',
    kind: PaymentKind.Payment,
    status: PaymentStatus.Succeeded,
    method: PaymentMethod.Cash,
    amount: '4.25',
    externalReference: null,
    createdAt: '2026-11-02T10:05:00Z',
    settledAt: '2026-11-02T10:05:00Z',
    ...overrides,
  };
}

describe('PaymentsComponent', () => {
  const orderService = {
    getOrder: vi.fn(),
    recordPayment: vi.fn(),
    issueRefund: vi.fn(),
  };
  const permissions = signal<string[] | null>(null);
  const authenticated = signal(true);

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const createComponent = async (): Promise<ComponentFixture<PaymentsComponent>> => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: ComponentFixture<PaymentsComponent>): string =>
    (fixture.nativeElement as HTMLElement).textContent as string;

  const setInput = (
    fixture: ComponentFixture<PaymentsComponent>,
    selector: string,
    value: string,
  ): void => {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
    expect(input, `expected ${selector} to exist`).toBeTruthy();
    input!.value = value;
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submit = async (
    fixture: ComponentFixture<PaymentsComponent>,
    selector: string,
  ): Promise<void> => {
    const form = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>(selector);
    expect(form, `expected ${selector} to exist`).toBeTruthy();
    form!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const lookUp = async (
    fixture: ComponentFixture<PaymentsComponent>,
    id = 'order-1',
  ): Promise<void> => {
    setInput(fixture, '[data-order-id]', id);
    await submit(fixture, '[data-order-lookup-form]');
  };

  const setCashier = () => permissions.set(['payment.accept']);
  const setManager = () => permissions.set(['payment.accept', 'payment.refund']);

  beforeEach(async () => {
    permissions.set(null);
    authenticated.set(true);
    orderService.getOrder.mockReset();
    orderService.recordPayment.mockReset();
    orderService.issueRefund.mockReset();

    await TestBed.configureTestingModule({
      imports: [PaymentsComponent],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        {
          provide: AuthStateService,
          useValue: {
            permissions,
            hasPermission: (permission: string) => {
              const granted = permissions();
              if (granted === null) {
                return authenticated();
              }
              return granted.includes(permission);
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('shows a no-permission state without calling the API', async () => {
    permissions.set(['order.create', 'order.read.own']);
    const fixture = await createComponent();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-no-payment-permission]')
        ?.textContent,
    ).toContain('do not have permission');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-payment-panel]'),
    ).toBeFalsy();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-refund-panel]')).toBeFalsy();
    expect(orderService.getOrder).not.toHaveBeenCalled();
  });

  it('shows the payment panel but not refunds to a cashier', async () => {
    setCashier();
    const fixture = await createComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-payment-panel]')).toBeTruthy();
    expect(compiled.querySelector('[data-refund-panel]')).toBeFalsy();
  });

  it('looks up an order and renders the server payment summary and history', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(
      makeOrder({
        total: '10.00',
        payments: [
          makePayment({ id: 'payment-1', amount: '6.00' }),
          makePayment({
            id: 'payment-2',
            kind: PaymentKind.Refund,
            amount: '1.50',
            externalReference: 'REF-9',
          }),
        ],
      }),
    );
    const fixture = await createComponent();

    await lookUp(fixture, 'order-1');

    expect(orderService.getOrder).toHaveBeenCalledWith('order-1');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-order-summary]')?.textContent).toContain('Order #1001');
    expect(compiled.querySelector('[data-summary-total]')?.textContent).toContain('$10.00');
    expect(compiled.querySelector('[data-summary-paid]')?.textContent).toContain('$6.00');
    expect(compiled.querySelector('[data-summary-refunded]')?.textContent).toContain('$1.50');
    expect(compiled.querySelector('[data-summary-balance]')?.textContent).toContain('$5.50');
    const history = compiled.querySelector('[data-payment-history]')?.textContent as string;
    expect(history).toContain('Payment');
    expect(history).toContain('Refund');
    expect(history).toContain('Cash');
    expect(history).toContain('REF-9');
  });

  it('records a payment through the service and updates the balance', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(makeOrder({ total: '8.50' }));
    orderService.recordPayment.mockResolvedValue(makePayment({ amount: '8.50' }));
    const fixture = await createComponent();
    await lookUp(fixture);

    await submit(fixture, '[data-payment-form]');

    expect(orderService.recordPayment).toHaveBeenCalledWith({
      orderId: 'order-1',
      method: PaymentMethod.Cash,
      amount: '8.50',
      externalReference: null,
    });
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-payment-success]')?.textContent).toContain(
      'Payment recorded',
    );
    expect(compiled.querySelector('[data-summary-balance]')?.textContent).toContain('$0.00');
  });

  it('explains an INSUFFICIENT_BALANCE payment failure', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(makeOrder());
    orderService.recordPayment.mockRejectedValue(new OrderError('INSUFFICIENT_BALANCE'));
    const fixture = await createComponent();
    await lookUp(fixture);

    setInput(fixture, '[data-payment-amount]', '99.00');
    await submit(fixture, '[data-payment-form]');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-payment-error]')?.textContent,
    ).toContain('exceeds the outstanding balance');
  });

  it('explains a FORBIDDEN payment failure without hiding the screen', async () => {
    setCashier();
    orderService.getOrder.mockResolvedValue(makeOrder());
    orderService.recordPayment.mockRejectedValue(new OrderError('FORBIDDEN'));
    const fixture = await createComponent();
    await lookUp(fixture);

    await submit(fixture, '[data-payment-form]');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-payment-error]')?.textContent,
    ).toContain('cannot record payments');
  });

  it('issues a refund through the service and updates the refundable balance', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(
      makeOrder({
        payments: [makePayment({ id: 'payment-1', amount: '8.50' })],
      }),
    );
    orderService.issueRefund.mockResolvedValue(
      makePayment({
        id: 'refund-1',
        kind: PaymentKind.Refund,
        amount: '2.00',
        externalReference: 'REF-1',
      }),
    );
    const fixture = await createComponent();
    await lookUp(fixture);

    setInput(fixture, '[data-refund-amount]', '2.00');
    setInput(fixture, '[data-refund-reference]', 'REF-1');
    await submit(fixture, '[data-refund-form]');

    expect(orderService.issueRefund).toHaveBeenCalledWith({
      orderId: 'order-1',
      method: PaymentMethod.Cash,
      amount: '2.00',
      externalReference: 'REF-1',
    });
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-refund-success]')?.textContent).toContain('Refund issued');
    expect(compiled.querySelector('[data-summary-refunded]')?.textContent).toContain('$2.00');
    expect(compiled.querySelector('[data-summary-balance]')?.textContent).toContain('$2.00');
  });

  it('explains an INSUFFICIENT_BALANCE refund failure as exceeding the refundable amount', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(
      makeOrder({ payments: [makePayment({ amount: '4.25' })] }),
    );
    orderService.issueRefund.mockRejectedValue(new OrderError('INSUFFICIENT_BALANCE'));
    const fixture = await createComponent();
    await lookUp(fixture);

    setInput(fixture, '[data-refund-amount]', '9.00');
    await submit(fixture, '[data-refund-form]');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-refund-error]')?.textContent,
    ).toContain('exceeds the amount that can be refunded');
  });

  it('explains a FORBIDDEN refund failure', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(
      makeOrder({ payments: [makePayment({ amount: '4.25' })] }),
    );
    orderService.issueRefund.mockRejectedValue(new OrderError('FORBIDDEN'));
    const fixture = await createComponent();
    await lookUp(fixture);

    setInput(fixture, '[data-refund-amount]', '1.00');
    await submit(fixture, '[data-refund-form]');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-refund-error]')?.textContent,
    ).toContain('cannot issue refunds');
  });

  it('explains a NOT_FOUND order lookup', async () => {
    setManager();
    orderService.getOrder.mockRejectedValue(new OrderError('NOT_FOUND'));
    const fixture = await createComponent();

    await lookUp(fixture, 'missing');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-lookup-error]')?.textContent,
    ).toContain('No order found');
  });

  it('validates lookup and amount inputs before calling the API', async () => {
    setManager();
    const fixture = await createComponent();

    await submit(fixture, '[data-order-lookup-form]');
    expect(orderService.getOrder).not.toHaveBeenCalled();

    orderService.getOrder.mockResolvedValue(makeOrder());
    await lookUp(fixture);
    setInput(fixture, '[data-payment-amount]', 'abc');
    await submit(fixture, '[data-payment-form]');
    expect(orderService.recordPayment).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-payment-error]')?.textContent,
    ).toContain('valid payment amount');
  });

  it('explains that a paid-in-full order has nothing left to pay', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(
      makeOrder({ payments: [makePayment({ amount: '8.50' })] }),
    );
    const fixture = await createComponent();
    await lookUp(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-payment-blocked]')?.textContent).toContain(
      'nothing outstanding',
    );
    expect(compiled.querySelector('[data-refund-panel]')).toBeTruthy();
  });

  it('blocks refunds until a payment has been recorded', async () => {
    setManager();
    orderService.getOrder.mockResolvedValue(makeOrder({ payments: [] }));
    const fixture = await createComponent();
    await lookUp(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-refund-blocked]')?.textContent).toContain(
      'No payments have been recorded',
    );
    expect(compiled.querySelector('[data-payment-panel]')).toBeTruthy();
  });

  it('documents the incomplete payment and refund workflows on the screen', async () => {
    setManager();
    const fixture = await createComponent();

    const limits = (fixture.nativeElement as HTMLElement).querySelector('[data-workflow-limits]')
      ?.textContent as string;
    expect(limits).toContain('look up an order by ID');
    expect(limits).toContain('completed orders');
    expect(limits).toContain('refund');
  });
});
