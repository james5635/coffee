import { TestBed } from '@angular/core/testing';
import {
  OrderStatus,
  OrderType,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  PlaceOrderInput,
  RecordPaymentInput,
} from '../../graphql/generated/schema';
import {
  OrderDocument,
  PlaceOrderDocument,
  PlaceOrderMutation,
  ProductsDocument,
  ProductsQuery,
  RecordPaymentDocument,
  RecordPaymentMutation,
} from '../../graphql/generated/graphql';
import { AuthService } from './auth.service';
import { OrderError, OrderService } from './order.service';

const order: PlaceOrderMutation['placeOrder'] = {
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

const products: ProductsQuery['products'] = [
  {
    id: 'product-flat-white',
    categoryId: 'cat-coffee',
    name: 'Flat White',
    description: 'Velvety espresso with steamed milk.',
    price: '4.25',
    sku: 'FW',
    modifierGroups: [],
  },
];

describe('OrderService', () => {
  const authService = { query: vi.fn() };
  let service: OrderService;

  beforeEach(() => {
    authService.query.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }],
    });
    service = TestBed.inject(OrderService);
  });

  it('loads the sellable menu through the auth-aware query path', async () => {
    authService.query.mockResolvedValue({ data: { products } });

    const result = await service.listProducts();

    expect(result).toEqual(products);
    expect(authService.query).toHaveBeenCalledWith({
      query: ProductsDocument,
      variables: { categoryId: null },
    });
  });

  it('places an order with the generated document and returns the server order', async () => {
    authService.query.mockResolvedValue({ data: { placeOrder: order } });
    const input: PlaceOrderInput = {
      orderType: OrderType.Takeaway,
      customerName: null,
      customerEmail: null,
      notes: null,
      items: [{ productId: 'product-flat-white', quantity: 1, modifierIds: null }],
    };

    const result = await service.placeOrder(input);

    expect(result).toEqual(order);
    expect(authService.query).toHaveBeenCalledWith({
      query: PlaceOrderDocument,
      variables: { input },
    });
  });

  it('maps placeOrder GraphQL errors to an OrderError code', async () => {
    authService.query.mockResolvedValue({
      errors: [
        {
          message: 'product 42 is unavailable',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ],
    });

    await expect(
      service.placeOrder({
        orderType: OrderType.Takeaway,
        items: [{ productId: '42', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ name: 'OrderError', code: 'BAD_USER_INPUT' });
  });

  it('loads an order by id through the generated document', async () => {
    authService.query.mockResolvedValue({ data: { order } });

    const result = await service.getOrder('order-1');

    expect(result).toEqual(order);
    expect(authService.query).toHaveBeenCalledWith({
      query: OrderDocument,
      variables: { id: 'order-1' },
    });
  });

  it('maps a missing order to NOT_FOUND', async () => {
    authService.query.mockResolvedValue({
      errors: [{ message: 'Order not found.', extensions: { code: 'NOT_FOUND' } }],
    });

    await expect(service.getOrder('missing')).rejects.toBeInstanceOf(OrderError);
    await expect(service.getOrder('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('records a payment through the generated document and returns the payment', async () => {
    authService.query.mockResolvedValue({ data: { recordPayment: payment } });
    const input: RecordPaymentInput = {
      orderId: 'order-1',
      method: PaymentMethod.Cash,
      amount: '4.25',
      externalReference: null,
    };

    const result = await service.recordPayment(input);

    expect(result).toEqual(payment);
    expect(authService.query).toHaveBeenCalledWith({
      query: RecordPaymentDocument,
      variables: { input },
    });
  });

  it('maps INSUFFICIENT_BALANCE from recordPayment', async () => {
    authService.query.mockResolvedValue({
      errors: [
        {
          message: 'Payment exceeds the outstanding balance.',
          extensions: { code: 'INSUFFICIENT_BALANCE' },
        },
      ],
    });

    await expect(
      service.recordPayment({
        orderId: 'order-1',
        method: PaymentMethod.Card,
        amount: '99.00',
      }),
    ).rejects.toMatchObject({ name: 'OrderError', code: 'INSUFFICIENT_BALANCE' });
  });
});
