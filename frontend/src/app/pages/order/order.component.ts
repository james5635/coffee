import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductsQuery } from '../../../graphql/generated/graphql';
import {
  Order,
  OrderStatus,
  OrderType,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  PlaceOrderInput,
} from '../../../graphql/generated/schema';
import { AuthStateService } from '../../services/auth-state.service';
import { OrderError, OrderService } from '../../services/order.service';
import {
  centsToDecimalString,
  formatCents,
  formatMoney,
  parseDecimalToCents,
} from '../../utils/money';

/** One modifier option as rendered in the order builder. */
interface OrderModifierView {
  id: string;
  name: string;
  priceDeltaCents: number;
  priceDeltaLabel: string;
}

/** One modifier group with its selection rules. */
interface OrderModifierGroupView {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  ruleLabel: string;
  modifiers: OrderModifierView[];
}

/** A sellable product ready for the order builder. */
interface OrderProductView {
  id: string;
  name: string;
  description: string;
  basePriceCents: number;
  priceLabel: string;
  modifierGroups: OrderModifierGroupView[];
}

/** One line in the local cart, with money parsed to integer cents. */
interface CartLine {
  /** Product + selected modifiers, used to merge identical lines. */
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  modifierIds: string[];
  modifierNames: string[];
  unitPriceCents: number;
}

/** A placed order ready for the confirmation screen. */
interface PlacedOrderView {
  id: string;
  orderNumber: string;
  statusLabel: string;
  orderTypeLabel: string;
  customerName: string | null;
  notes: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  paidCents: number;
  balanceCents: number;
  paymentStatusLabel: string;
  paymentNote: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    lineTotalLabel: string;
    modifiersLabel: string;
  }[];
  payments: {
    id: string;
    kind: string;
    methodLabel: string;
    amountLabel: string;
  }[];
}

interface ModifierError {
  productId: string;
  message: string;
}

function compareBySortOrder<T extends { sortOrder: number; name: string }>(a: T, b: T): number {
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
  if (cents === null || cents === 0) {
    return '';
  }
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

function moneyToCents(value: string): number {
  return parseDecimalToCents(value) ?? 0;
}

function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Pending:
      return 'Awaiting acceptance';
    case OrderStatus.Accepted:
      return 'Accepted';
    case OrderStatus.Preparing:
      return 'Being prepared';
    case OrderStatus.Ready:
      return 'Ready';
    case OrderStatus.Completed:
      return 'Completed';
    case OrderStatus.Cancelled:
      return 'Cancelled';
    default:
      return status;
  }
}

function orderTypeLabel(type: OrderType): string {
  switch (type) {
    case OrderType.Takeaway:
      return 'Takeaway';
    case OrderType.DineIn:
      return 'Dine in';
    case OrderType.Delivery:
      return 'Delivery';
    default:
      return type;
  }
}

function paymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case PaymentMethod.Cash:
      return 'Cash';
    case PaymentMethod.Card:
      return 'Card';
    case PaymentMethod.Online:
      return 'Online';
    case PaymentMethod.Other:
      return 'Other';
    default:
      return method;
  }
}

function toProductView(product: ProductsQuery['products'][number]): OrderProductView {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    basePriceCents: moneyToCents(product.price),
    priceLabel: formatMoney(product.price),
    modifierGroups: [...product.modifierGroups].sort(compareBySortOrder).map((group) => ({
      id: group.id,
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      isRequired: group.isRequired,
      ruleLabel: modifierRuleLabel(group),
      modifiers: [...group.modifiers].sort(compareBySortOrder).map((modifier) => ({
        id: modifier.id,
        name: modifier.name,
        priceDeltaCents: moneyToCents(modifier.priceDelta),
        priceDeltaLabel: priceDeltaLabel(modifier.priceDelta),
      })),
    })),
  };
}

/**
 * Turns the server order into confirmation copy. Payment status is derived
 * from the payment events the backend returns; the balance itself is always
 * server totals minus recorded payments, never a client-side price calculation.
 */
function toPlacedOrderView(order: Order): PlacedOrderView {
  const totalCents = moneyToCents(order.total);
  const paidCents = order.payments
    .filter((payment) => payment.status === PaymentStatus.Succeeded)
    .reduce(
      (sum, payment) =>
        sum +
        (payment.kind === PaymentKind.Refund
          ? -moneyToCents(payment.amount)
          : moneyToCents(payment.amount)),
      0,
    );
  const balanceCents = Math.max(totalCents - paidCents, 0);

  let paymentStatusLabel: string;
  let paymentNote: string;
  if (balanceCents === 0) {
    paymentStatusLabel = 'Paid in full';
    paymentNote = 'This order is settled. Thank you!';
  } else if (paidCents > 0) {
    paymentStatusLabel = `Payment due: ${formatCents(balanceCents)}`;
    paymentNote = 'Staff will collect the remaining balance at the counter.';
  } else {
    paymentStatusLabel = `Payment due: ${formatCents(balanceCents)}`;
    paymentNote = 'Staff will collect payment at the counter. No online payment is taken here.';
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    statusLabel: orderStatusLabel(order.status),
    orderTypeLabel: orderTypeLabel(order.orderType),
    customerName: order.customerName ?? null,
    notes: order.notes,
    subtotalLabel: formatMoney(order.subtotal),
    taxLabel: formatMoney(order.taxAmount),
    totalLabel: formatMoney(order.total),
    paidCents,
    balanceCents,
    paymentStatusLabel,
    paymentNote,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      quantity: item.quantity,
      lineTotalLabel: formatMoney(item.lineTotal),
      modifiersLabel: item.modifiers.map((modifier) => modifier.modifierName).join(', '),
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      methodLabel: paymentMethodLabel(payment.method),
      amountLabel: formatMoney(payment.amount),
    })),
  };
}

function placeOrderErrorMessage(error: unknown): string {
  if (error instanceof OrderError) {
    switch (error.code) {
      case 'BAD_USER_INPUT':
        return 'Some items are unavailable or invalid. Please review your order.';
      case 'FORBIDDEN':
        return 'You do not have permission to place this order.';
      case 'UNAUTHENTICATED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
        return 'Your session ended. Sign in again or continue as a guest.';
      default:
        return 'We could not place your order. Please try again.';
    }
  }
  return 'We could not place your order. Check your connection and try again.';
}

function orderLookupErrorMessage(error: unknown): string {
  if (error instanceof OrderError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return 'No order found with that ID.';
      case 'FORBIDDEN':
        return 'Your role cannot view that order.';
      case 'UNAUTHENTICATED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
        return 'Sign in to look up orders.';
      default:
        return 'We could not load that order. Please try again.';
    }
  }
  return 'We could not load that order. Check your connection and try again.';
}

function paymentErrorMessage(error: unknown): string {
  if (error instanceof OrderError) {
    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        return 'That amount exceeds the outstanding balance for this order.';
      case 'INVALID_STATE':
        return 'This order is not awaiting payment.';
      case 'FORBIDDEN':
        return 'Your role cannot record payments.';
      case 'NOT_FOUND':
        return 'No order found with that ID.';
      case 'BAD_USER_INPUT':
        return 'Check the payment amount and method, then try again.';
      case 'UNAUTHENTICATED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_REFRESH_TOKEN':
        return 'Sign in to record payments.';
      default:
        return 'We could not record the payment. Please try again.';
    }
  }
  return 'We could not record the payment. Check your connection and try again.';
}

/**
 * Ordering/checkout screen.
 *
 * Customers build a cart from the sellable menu, place an order through
 * `placeOrder` (guest or signed in), and see an immediate confirmation with
 * the server-computed totals and payment status. There is no online payment
 * step: staff record payment separately with `recordPayment`.
 *
 * Staff with the `payment.accept` permission (decoded from the access token)
 * also get a payment panel; a token without permission claims falls back to
 * authentication-only gating. The backend is the real permission boundary;
 * `FORBIDDEN`, `INSUFFICIENT_BALANCE`, and `INVALID_STATE` are surfaced as
 * plain-language errors instead of being hidden.
 */
@Component({
  selector: 'app-order',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './order.component.html',
  styleUrl: './order.component.css',
})
export class OrderComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly authState = inject(AuthStateService);
  private readonly fb = inject(FormBuilder);

  /** Staff payment actions are gated on `payment.accept` when claims exist. */
  protected readonly canAcceptPayments = computed(() =>
    this.authState.hasPermission('payment.accept'),
  );

  protected readonly loadingProducts = signal(true);
  protected readonly productsError = signal<string | null>(null);
  protected readonly products = signal<OrderProductView[]>([]);

  protected readonly cart = signal<CartLine[]>([]);
  protected readonly cartError = signal<string | null>(null);
  private readonly selections = signal<Record<string, string[]>>({});
  protected readonly modifierError = signal<ModifierError | null>(null);

  protected readonly submitting = signal(false);
  protected readonly checkoutError = signal<string | null>(null);
  private readonly currentOrder = signal<Order | null>(null);
  protected readonly placedOrder = computed(() => {
    const order = this.currentOrder();
    return order ? toPlacedOrderView(order) : null;
  });

  protected readonly orderTypes = [
    { value: OrderType.Takeaway, label: 'Takeaway' },
    { value: OrderType.DineIn, label: 'Dine in' },
    { value: OrderType.Delivery, label: 'Delivery' },
  ];

  protected readonly paymentMethods = [
    { value: PaymentMethod.Cash, label: 'Cash' },
    { value: PaymentMethod.Card, label: 'Card' },
    { value: PaymentMethod.Online, label: 'Online' },
    { value: PaymentMethod.Other, label: 'Other' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    orderType: [OrderType.Takeaway, [Validators.required]],
    customerName: [''],
    customerEmail: ['', [Validators.email]],
    notes: [''],
  });

  protected readonly paymentForm = this.fb.nonNullable.group({
    orderId: [''],
    method: [PaymentMethod.Cash, [Validators.required]],
    amount: [''],
    externalReference: [''],
  });

  protected readonly paymentSubmitting = signal(false);
  protected readonly lookupSubmitting = signal(false);
  protected readonly paymentError = signal<string | null>(null);
  protected readonly paymentSuccess = signal<string | null>(null);

  protected readonly cartTotalCents = computed(() =>
    this.cart().reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0),
  );

  protected readonly formatCents = formatCents;
  protected readonly formatMoney = formatMoney;

  ngOnInit(): void {
    void this.loadProducts();
  }

  /** Loads the sellable menu; also used by the error-state retry action. */
  protected async loadProducts(): Promise<void> {
    this.loadingProducts.set(true);
    this.productsError.set(null);
    try {
      const products = await this.orderService.listProducts();
      this.products.set(products.map(toProductView));
    } catch {
      this.productsError.set('We could not load the menu. Check your connection and try again.');
    } finally {
      this.loadingProducts.set(false);
    }
  }

  protected selectedModifierIds(productId: string): string[] {
    return this.selections()[productId] ?? [];
  }

  protected isModifierSelected(productId: string, modifierId: string): boolean {
    return this.selectedModifierIds(productId).includes(modifierId);
  }

  /**
   * Toggles a modifier inside its group. Single-choice groups replace the
   * previous selection; capped multi-select groups ignore extra picks so the
   * add-to-cart validation stays the single source of truth.
   */
  protected toggleModifier(
    productId: string,
    group: OrderModifierGroupView,
    modifierId: string,
  ): void {
    const current = this.selectedModifierIds(productId);
    const groupIds = group.modifiers.map((modifier) => modifier.id);
    const selectedInGroup = current.filter((id) => groupIds.includes(id));

    let next: string[];
    if (selectedInGroup.includes(modifierId)) {
      next = current.filter((id) => id !== modifierId);
    } else if (group.maxSelections <= 0) {
      return;
    } else if (selectedInGroup.length >= group.maxSelections) {
      if (group.maxSelections !== 1) {
        return;
      }
      next = [...current.filter((id) => !groupIds.includes(id)), modifierId];
    } else {
      next = [...current, modifierId];
    }

    this.selections.set({ ...this.selections(), [productId]: next });
    if (this.modifierError()?.productId === productId) {
      this.modifierError.set(null);
    }
  }

  /** Validates modifier rules locally, then merges the line into the cart. */
  protected addToCart(product: OrderProductView): void {
    const selected = this.selectedModifierIds(product.id);
    for (const group of product.modifierGroups) {
      const count = selected.filter((id) =>
        group.modifiers.some((modifier) => modifier.id === id),
      ).length;
      if (
        count < group.minSelections ||
        count > group.maxSelections ||
        (group.isRequired && count === 0)
      ) {
        this.modifierError.set({
          productId: product.id,
          message: `${group.name}: ${group.ruleLabel.toLowerCase()}.`,
        });
        return;
      }
    }

    const modifiers = product.modifierGroups
      .flatMap((group) => group.modifiers)
      .filter((modifier) => selected.includes(modifier.id));
    const modifierIds = modifiers.map((modifier) => modifier.id);
    const unitPriceCents =
      product.basePriceCents +
      modifiers.reduce((sum, modifier) => sum + modifier.priceDeltaCents, 0);
    const key = `${product.id}|${[...modifierIds].sort().join(',')}`;

    this.cart.update((lines) => {
      const existing = lines.find((line) => line.key === key);
      if (existing) {
        return lines.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...lines,
        {
          key,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          modifierIds,
          modifierNames: modifiers.map((modifier) => modifier.name),
          unitPriceCents,
        },
      ];
    });

    this.selections.set({ ...this.selections(), [product.id]: [] });
    this.modifierError.set(null);
    this.cartError.set(null);
  }

  protected changeQuantity(line: CartLine, delta: number): void {
    this.cart.update((lines) =>
      lines.map((candidate) =>
        candidate.key === line.key
          ? { ...candidate, quantity: Math.max(1, candidate.quantity + delta) }
          : candidate,
      ),
    );
  }

  protected removeLine(line: CartLine): void {
    this.cart.update((lines) => lines.filter((candidate) => candidate.key !== line.key));
  }

  protected lineTotalLabel(line: CartLine): string {
    return formatCents(line.unitPriceCents * line.quantity);
  }

  /** Places the order; the confirmation replaces the builder on success. */
  protected async placeOrder(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.checkoutError.set(null);

    if (this.cart().length === 0) {
      this.checkoutError.set('Add at least one item to your order.');
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const { orderType, customerName, customerEmail, notes } = this.form.getRawValue();
    const input: PlaceOrderInput = {
      orderType,
      customerName: customerName.trim() || null,
      customerEmail: customerEmail.trim() || null,
      notes: notes.trim() || null,
      items: this.cart().map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        modifierIds: line.modifierIds.length > 0 ? line.modifierIds : null,
        specialInstructions: null,
      })),
    };

    this.submitting.set(true);
    try {
      const order = await this.orderService.placeOrder(input);
      this.currentOrder.set(order);
      this.cart.set([]);
      this.cartError.set(null);
      this.form.reset({
        orderType: OrderType.Takeaway,
        customerName: '',
        customerEmail: '',
        notes: '',
      });
      this.prefillPayment(order);
    } catch (error) {
      this.checkoutError.set(placeOrderErrorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected startNewOrder(): void {
    this.currentOrder.set(null);
    this.cart.set([]);
    this.cartError.set(null);
    this.checkoutError.set(null);
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.paymentForm.reset({
      orderId: '',
      method: PaymentMethod.Cash,
      amount: '',
      externalReference: '',
    });
  }

  /** Staff: loads an order by ID so its balance can be paid. */
  protected async lookUpOrder(): Promise<void> {
    if (this.lookupSubmitting()) {
      return;
    }
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    const id = this.paymentForm.controls.orderId.value.trim();
    if (!id) {
      this.paymentError.set('Enter an order ID to look up.');
      return;
    }

    this.lookupSubmitting.set(true);
    try {
      const order = await this.orderService.getOrder(id);
      this.currentOrder.set(order);
      this.prefillPayment(order);
    } catch (error) {
      this.paymentError.set(orderLookupErrorMessage(error));
    } finally {
      this.lookupSubmitting.set(false);
    }
  }

  /** Staff: records a payment against the current order balance. */
  protected async recordPayment(): Promise<void> {
    if (this.paymentSubmitting()) {
      return;
    }
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.paymentForm.markAllAsTouched();

    const { orderId, method, amount, externalReference } = this.paymentForm.getRawValue();
    const id = orderId.trim();
    if (!id) {
      this.paymentError.set('Enter the order ID for this payment.');
      return;
    }

    const amountCents = parseDecimalToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      this.paymentError.set('Enter a valid payment amount, for example 4.25.');
      return;
    }

    this.paymentSubmitting.set(true);
    try {
      const payment = await this.orderService.recordPayment({
        orderId: id,
        method,
        amount: centsToDecimalString(amountCents),
        externalReference: externalReference.trim() || null,
      });
      this.paymentSuccess.set(
        `Payment recorded (${formatMoney(payment.amount)} · ${paymentMethodLabel(payment.method)}).`,
      );
      this.currentOrder.update((order) =>
        order && order.id === id ? { ...order, payments: [...order.payments, payment] } : order,
      );
      const view = this.placedOrder();
      if (view && view.id === id) {
        this.paymentForm.controls.amount.setValue(
          view.balanceCents > 0 ? centsToDecimalString(view.balanceCents) : '',
        );
      }
    } catch (error) {
      this.paymentError.set(paymentErrorMessage(error));
    } finally {
      this.paymentSubmitting.set(false);
    }
  }

  /** Prefills the staff payment panel after a placement or lookup. */
  private prefillPayment(order: Order): void {
    const view = toPlacedOrderView(order);
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.paymentForm.patchValue({
      orderId: order.id,
      amount: view.balanceCents > 0 ? centsToDecimalString(view.balanceCents) : '',
    });
  }
}
