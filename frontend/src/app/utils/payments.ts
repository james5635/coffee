import { PaymentKind, PaymentMethod, PaymentStatus } from '../../graphql/generated/schema';
import { parseDecimalToCents } from './money';

/** One recorded payment event, as returned by the backend. */
export interface PaymentLike {
  kind: PaymentKind;
  status: PaymentStatus;
  amount: string;
}

/**
 * Server-recorded money movements against an order, parsed to integer cents.
 *
 * Only succeeded events count toward the balance; pending/failed/cancelled
 * events are shown in history but never move money. `netCents` is what has
 * actually been collected (payments minus refunds); staff can refund up to
 * that amount and the customer owes `balanceCents`.
 */
export interface PaymentSummary {
  paidCents: number;
  refundedCents: number;
  netCents: number;
  balanceCents: number;
  refundableCents: number;
}

/** Summarizes an order's payment history without float math. */
export function summarizePayments(
  totalCents: number,
  payments: readonly PaymentLike[],
): PaymentSummary {
  let paidCents = 0;
  let refundedCents = 0;

  for (const payment of payments) {
    if (payment.status !== PaymentStatus.Succeeded) {
      continue;
    }
    const cents = parseDecimalToCents(payment.amount) ?? 0;
    if (payment.kind === PaymentKind.Refund) {
      refundedCents += cents;
    } else {
      paidCents += cents;
    }
  }

  const netCents = paidCents - refundedCents;
  return {
    paidCents,
    refundedCents,
    netCents,
    balanceCents: Math.max(totalCents - netCents, 0),
    refundableCents: Math.max(netCents, 0),
  };
}

/** Human-readable payment kind, e.g. "Refund". */
export function paymentKindLabel(kind: PaymentKind): string {
  switch (kind) {
    case PaymentKind.Payment:
      return 'Payment';
    case PaymentKind.Refund:
      return 'Refund';
    default:
      return kind;
  }
}

/** Human-readable payment method, e.g. "Cash". */
export function paymentMethodLabel(method: PaymentMethod): string {
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

/** Human-readable payment status, e.g. "Succeeded". */
export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.Succeeded:
      return 'Succeeded';
    case PaymentStatus.Pending:
      return 'Pending';
    case PaymentStatus.Failed:
      return 'Failed';
    case PaymentStatus.Cancelled:
      return 'Cancelled';
    default:
      return status;
  }
}
