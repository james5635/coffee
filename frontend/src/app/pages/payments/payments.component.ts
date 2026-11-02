import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Order, OrderStatus, Payment, PaymentMethod } from '../../../graphql/generated/schema';
import { AuthStateService } from '../../services/auth-state.service';
import { OrderService } from '../../services/order.service';
import {
  centsToDecimalString,
  formatCents,
  formatMoney,
  parseDecimalToCents,
} from '../../utils/money';
import type { PaymentSummary } from '../../utils/payments';
import {
  paymentKindLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  summarizePayments,
} from '../../utils/payments';
import { productErrorMessage } from '../../utils/product-errors';

/** One payment event ready for the history list. */
interface PaymentHistoryView {
  id: string;
  kindLabel: string;
  methodLabel: string;
  statusLabel: string;
  amountLabel: string;
  reference: string | null;
}

/** The looked-up order with its server-recorded payment position. */
interface PaymentsOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  customerName: string | null;
  totalLabel: string;
  paidLabel: string;
  refundedLabel: string;
  balanceLabel: string;
  balanceCents: number;
  refundableCents: number;
  canRecordPayment: boolean;
  paymentBlockedReason: string | null;
  canRefund: boolean;
  refundBlockedReason: string | null;
  payments: PaymentHistoryView[];
}

const PAYMENT_ERRORS = {
  codes: {
    INSUFFICIENT_BALANCE: 'That amount exceeds the outstanding balance for this order.',
    INVALID_STATE:
      'This order is not accepting payments. Only pending or accepted orders can be paid.',
    FORBIDDEN: 'Your role cannot record payments.',
    NOT_FOUND: 'No order found with that ID.',
    BAD_USER_INPUT: 'Check the payment amount and method, then try again.',
  },
  auth: 'Your session ended. Sign in again to record payments.',
  unknown: 'We could not record the payment. Please try again.',
  offline: 'We could not record the payment. Check your connection and try again.',
} as const;

const REFUND_ERRORS = {
  codes: {
    INSUFFICIENT_BALANCE: 'That refund exceeds the amount that can be refunded for this order.',
    INVALID_STATE: 'This order cannot be refunded in its current state.',
    FORBIDDEN: 'Your role cannot issue refunds.',
    NOT_FOUND: 'No order found with that ID.',
    BAD_USER_INPUT: 'Check the refund amount and method, then try again.',
  },
  auth: 'Your session ended. Sign in again to issue refunds.',
  unknown: 'We could not issue the refund. Please try again.',
  offline: 'We could not issue the refund. Check your connection and try again.',
} as const;

const LOOKUP_ERRORS = {
  codes: {
    NOT_FOUND: 'No order found with that ID.',
    FORBIDDEN: 'Your role cannot view that order.',
  },
  auth: 'Your session ended. Sign in again to look up orders.',
  unknown: 'We could not load that order. Please try again.',
  offline: 'We could not load that order. Check your connection and try again.',
} as const;

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

/** Payments are accepted by the backend only while an order is pending/accepted. */
function paymentWindowOpen(status: OrderStatus): boolean {
  return status === OrderStatus.Pending || status === OrderStatus.Accepted;
}

function moneyToCents(value: string): number {
  return parseDecimalToCents(value) ?? 0;
}

function toOrderView(order: Order): PaymentsOrderView {
  const summary: PaymentSummary = summarizePayments(moneyToCents(order.total), order.payments);
  const windowOpen = paymentWindowOpen(order.status);

  let paymentBlockedReason: string | null = null;
  if (!windowOpen) {
    paymentBlockedReason =
      'This order is past the payment window. Only pending or accepted orders can be paid.';
  } else if (summary.balanceCents === 0) {
    paymentBlockedReason = 'This order has nothing outstanding — it is paid in full.';
  }

  const refundBlockedReason =
    summary.refundableCents === 0
      ? 'No payments have been recorded on this order, so there is nothing to refund.'
      : null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: orderStatusLabel(order.status),
    customerName: order.customerName ?? null,
    totalLabel: formatMoney(order.total),
    paidLabel: formatCents(summary.paidCents),
    refundedLabel: formatCents(summary.refundedCents),
    balanceLabel: formatCents(summary.balanceCents),
    balanceCents: summary.balanceCents,
    refundableCents: summary.refundableCents,
    canRecordPayment: windowOpen && summary.balanceCents > 0,
    paymentBlockedReason,
    canRefund: summary.refundableCents > 0,
    refundBlockedReason,
    payments: order.payments.map((payment) => ({
      id: payment.id,
      kindLabel: paymentKindLabel(payment.kind),
      methodLabel: paymentMethodLabel(payment.method),
      statusLabel: paymentStatusLabel(payment.status),
      amountLabel: formatMoney(payment.amount),
      reference: payment.externalReference ?? null,
    })),
  };
}

/**
 * Staff payments and refunds screen.
 *
 * Cashiers (`payment.accept`) record payments; managers/owners (`payment.refund`)
 * also issue refunds. All actions go through `OrderService` → `AuthService.query`
 * so the Phase 1 refresh/retry orchestration applies, and the backend remains
 * the permission and balance boundary. Tokens without permission claims fall
 * back to authentication-only gating per the Phase 2 design; `FORBIDDEN` is
 * always surfaced instead of hidden.
 *
 * Known limitations, documented on the screen: the backend has no shop-wide
 * payment/refund listing and no completed-order discovery, so staff must look
 * up an order by ID. Refunds are per-order and capped server-side at the net
 * amount collected.
 */
@Component({
  selector: 'app-payments',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css',
})
export class PaymentsComponent {
  private readonly orderService = inject(OrderService);
  private readonly authState = inject(AuthStateService);
  private readonly fb = inject(FormBuilder);

  /** Cashiers and managers/owners can record payments. */
  protected readonly canAcceptPayments = computed(() =>
    this.authState.hasPermission('payment.accept'),
  );

  /** Managers/owners can issue refunds; cashiers cannot. */
  protected readonly canIssueRefunds = computed(() =>
    this.authState.hasPermission('payment.refund'),
  );

  protected readonly hasPaymentAccess = computed(
    () => this.canAcceptPayments() || this.canIssueRefunds(),
  );

  private readonly currentOrder = signal<Order | null>(null);
  protected readonly order = computed(() => {
    const order = this.currentOrder();
    return order ? toOrderView(order) : null;
  });

  protected readonly orderForm = this.fb.nonNullable.group({
    orderId: [''],
  });

  protected readonly paymentForm = this.fb.nonNullable.group({
    method: [PaymentMethod.Cash, [Validators.required]],
    amount: [''],
    externalReference: [''],
  });

  protected readonly refundForm = this.fb.nonNullable.group({
    method: [PaymentMethod.Cash, [Validators.required]],
    amount: [''],
    externalReference: [''],
  });

  protected readonly paymentMethods = [
    { value: PaymentMethod.Cash, label: 'Cash' },
    { value: PaymentMethod.Card, label: 'Card' },
    { value: PaymentMethod.Online, label: 'Online' },
    { value: PaymentMethod.Other, label: 'Other' },
  ];

  protected readonly lookupSubmitting = signal(false);
  protected readonly lookupError = signal<string | null>(null);

  protected readonly paymentSubmitting = signal(false);
  protected readonly paymentError = signal<string | null>(null);
  protected readonly paymentSuccess = signal<string | null>(null);

  protected readonly refundSubmitting = signal(false);
  protected readonly refundError = signal<string | null>(null);
  protected readonly refundSuccess = signal<string | null>(null);

  protected readonly formatCents = formatCents;

  /** Loads an order by ID; staff order discovery is limited to ID lookup. */
  protected async lookUpOrder(): Promise<void> {
    if (this.lookupSubmitting()) {
      return;
    }
    this.lookupError.set(null);
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.refundError.set(null);
    this.refundSuccess.set(null);

    const id = this.orderForm.controls.orderId.value.trim();
    if (!id) {
      this.lookupError.set('Enter an order ID to look up.');
      return;
    }

    this.lookupSubmitting.set(true);
    try {
      const order = await this.orderService.getOrder(id);
      this.currentOrder.set(order);
      this.prefill(order);
    } catch (error) {
      this.currentOrder.set(null);
      this.lookupError.set(productErrorMessage(error, LOOKUP_ERRORS));
    } finally {
      this.lookupSubmitting.set(false);
    }
  }

  /** Records a payment against the looked-up order's outstanding balance. */
  protected async recordPayment(): Promise<void> {
    if (this.paymentSubmitting()) {
      return;
    }
    const order = this.currentOrder();
    if (!order) {
      this.paymentError.set('Look up an order before recording a payment.');
      return;
    }

    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    const { method, amount, externalReference } = this.paymentForm.getRawValue();
    const amountCents = parseDecimalToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      this.paymentError.set('Enter a valid payment amount, for example 4.25.');
      return;
    }

    this.paymentSubmitting.set(true);
    try {
      const payment = await this.orderService.recordPayment({
        orderId: order.id,
        method,
        amount: centsToDecimalString(amountCents),
        externalReference: externalReference.trim() || null,
      });
      this.applyPayment(payment);
      this.paymentSuccess.set(
        `Payment recorded (${formatMoney(payment.amount)} · ${paymentMethodLabel(payment.method)}).`,
      );
      const view = this.order();
      this.paymentForm.controls.amount.setValue(
        view && view.balanceCents > 0 ? centsToDecimalString(view.balanceCents) : '',
      );
      if (view && view.refundableCents > 0) {
        this.refundForm.controls.amount.setValue(centsToDecimalString(view.refundableCents));
      }
    } catch (error) {
      this.paymentError.set(productErrorMessage(error, PAYMENT_ERRORS));
    } finally {
      this.paymentSubmitting.set(false);
    }
  }

  /** Issues a refund against the order's recorded payments. */
  protected async issueRefund(): Promise<void> {
    if (this.refundSubmitting()) {
      return;
    }
    const order = this.currentOrder();
    if (!order) {
      this.refundError.set('Look up an order before issuing a refund.');
      return;
    }

    this.refundError.set(null);
    this.refundSuccess.set(null);
    const { method, amount, externalReference } = this.refundForm.getRawValue();
    const amountCents = parseDecimalToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      this.refundError.set('Enter a valid refund amount, for example 4.25.');
      return;
    }

    this.refundSubmitting.set(true);
    try {
      const refund = await this.orderService.issueRefund({
        orderId: order.id,
        method,
        amount: centsToDecimalString(amountCents),
        externalReference: externalReference.trim() || null,
      });
      this.applyPayment(refund);
      this.refundSuccess.set(
        `Refund issued (${formatMoney(refund.amount)} · ${paymentMethodLabel(refund.method)}).`,
      );
      const view = this.order();
      this.refundForm.controls.amount.setValue(
        view && view.refundableCents > 0 ? centsToDecimalString(view.refundableCents) : '',
      );
    } catch (error) {
      this.refundError.set(productErrorMessage(error, REFUND_ERRORS));
    } finally {
      this.refundSubmitting.set(false);
    }
  }

  /** Appends the server-returned payment event to the loaded order. */
  private applyPayment(payment: Payment): void {
    this.currentOrder.update((order) =>
      order ? { ...order, payments: [...order.payments, payment] } : order,
    );
  }

  /** Prefills both money inputs from the freshly loaded order position. */
  private prefill(order: Order): void {
    const view = toOrderView(order);
    this.paymentForm.controls.amount.setValue(
      view.canRecordPayment ? centsToDecimalString(view.balanceCents) : '',
    );
    this.refundForm.controls.amount.setValue(
      view.canRefund ? centsToDecimalString(view.refundableCents) : '',
    );
  }
}
