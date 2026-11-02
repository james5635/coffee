import { inject, Injectable } from '@angular/core';
import {
  AdvanceOrderStatusDocument,
  AdvanceOrderStatusMutation,
  IssueRefundDocument,
  IssueRefundMutation,
  OrderDocument,
  OrderQuery,
  PlaceOrderDocument,
  PlaceOrderMutation,
  PreparationQueueDocument,
  PreparationQueueQuery,
  ProductsDocument,
  ProductsQuery,
  RecordPaymentDocument,
  RecordPaymentMutation,
} from '../../graphql/generated/graphql';
import type {
  IssueRefundInput,
  Order,
  OrderStatus,
  Payment,
  PlaceOrderInput,
  RecordPaymentInput,
} from '../../graphql/generated/schema';
import { AuthService } from './auth.service';
import { GraphQLError, GraphQLResponse, graphQLErrorCode } from './graphql.service';

/**
 * Thrown by `OrderService`; `code` carries the backend GraphQL error code
 * (`BAD_USER_INPUT`, `INVALID_STATE`, `NOT_FOUND`, `FORBIDDEN`,
 * `INSUFFICIENT_BALANCE`, auth codes, or `INTERNAL`).
 */
export class OrderError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OrderError';
  }
}

/**
 * Ordering and payment operations via the generated typed documents.
 *
 * Every call goes through `AuthService.query`, so the Phase 1 refresh-on-expiry
 * orchestration applies unchanged. Guest ordering works because the transport
 * only attaches a bearer when a token is held; protected staff operations rely
 * on the backend to enforce permissions and surface `FORBIDDEN`.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly auth = inject(AuthService);

  /** Loads the sellable menu used to build an order. */
  async listProducts(): Promise<ProductsQuery['products']> {
    const response = await this.auth.query<ProductsQuery>({
      query: ProductsDocument,
      variables: { categoryId: null },
    });
    return this.unwrap(response, response.data?.products, 'load the menu');
  }

  /** Places a guest or authenticated order; totals are computed server-side. */
  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const response = await this.auth.query<PlaceOrderMutation>({
      query: PlaceOrderDocument,
      variables: { input },
    });
    return this.unwrap(response, response.data?.placeOrder, 'place the order');
  }

  /** Loads an order (staff/own-customer reads; the backend enforces access). */
  async getOrder(id: string): Promise<Order> {
    const response = await this.auth.query<OrderQuery>({
      query: OrderDocument,
      variables: { id },
    });
    return this.unwrap(response, response.data?.order, 'load the order');
  }

  /** Records a staff payment against an order balance. */
  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const response = await this.auth.query<RecordPaymentMutation>({
      query: RecordPaymentDocument,
      variables: { input },
    });
    return this.unwrap(response, response.data?.recordPayment, 'record the payment');
  }

  /**
   * Issues a staff refund against an order's recorded payments. The backend
   * requires `payment.refund` and enforces the refundable balance, surfacing
   * `INSUFFICIENT_BALANCE` when the amount exceeds what was collected.
   */
  async issueRefund(input: IssueRefundInput): Promise<Payment> {
    const response = await this.auth.query<IssueRefundMutation>({
      query: IssueRefundDocument,
      variables: { input },
    });
    return this.unwrap(response, response.data?.issueRefund, 'issue the refund');
  }

  /**
   * Loads the staff preparation queue. The backend returns orders awaiting or
   * in preparation and enforces `order.read.preparation_queue`.
   */
  async preparationQueue(): Promise<PreparationQueueQuery['preparationQueue']> {
    const response = await this.auth.query<PreparationQueueQuery>({
      query: PreparationQueueDocument,
    });
    return this.unwrap(response, response.data?.preparationQueue, 'load the prep queue');
  }

  /**
   * Advances an order to the next preparation status. Transition validity and
   * per-role allowances are enforced by the backend (`INVALID_STATE` for a
   * stale/illegal transition, `FORBIDDEN` for a disallowed role).
   */
  async advanceOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const response = await this.auth.query<AdvanceOrderStatusMutation>({
      query: AdvanceOrderStatusDocument,
      variables: { orderId, status },
    });
    return this.unwrap(response, response.data?.advanceOrderStatus, 'update the order status');
  }

  /** Converts a GraphQL error response into a typed `OrderError`. */
  private unwrap<T>(
    response: GraphQLResponse<unknown>,
    value: T | null | undefined,
    action: string,
  ): T {
    const error: GraphQLError | undefined = response.errors?.[0];
    if (error) {
      throw new OrderError(graphQLErrorCode(error) ?? 'INTERNAL', error.message);
    }
    if (value === undefined || value === null) {
      throw new OrderError('INTERNAL', `Unable to ${action}.`);
    }
    return value;
  }
}
