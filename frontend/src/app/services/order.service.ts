import { inject, Injectable } from '@angular/core';
import {
  OrderDocument,
  OrderQuery,
  PlaceOrderDocument,
  PlaceOrderMutation,
  ProductsDocument,
  ProductsQuery,
  RecordPaymentDocument,
  RecordPaymentMutation,
} from '../../graphql/generated/graphql';
import type {
  Order,
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
