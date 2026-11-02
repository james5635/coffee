import { PaymentKind, PaymentMethod, PaymentStatus } from '../../graphql/generated/schema';
import {
  paymentKindLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  summarizePayments,
} from './payments';

type SummaryPayment = Parameters<typeof summarizePayments>[1][number];

function payment(overrides: Partial<SummaryPayment> = {}): SummaryPayment {
  return {
    kind: PaymentKind.Payment,
    status: PaymentStatus.Succeeded,
    amount: '4.25',
    ...overrides,
  };
}

describe('summarizePayments', () => {
  it('returns a zero summary when no payments were recorded', () => {
    expect(summarizePayments(850, [])).toEqual({
      paidCents: 0,
      refundedCents: 0,
      netCents: 0,
      balanceCents: 850,
      refundableCents: 0,
    });
  });

  it('adds successful payments and subtracts successful refunds in integer cents', () => {
    const summary = summarizePayments(1000, [
      payment({ amount: '6.00' }),
      payment({ kind: PaymentKind.Refund, amount: '1.50' }),
    ]);

    expect(summary).toEqual({
      paidCents: 600,
      refundedCents: 150,
      netCents: 450,
      balanceCents: 550,
      refundableCents: 450,
    });
  });

  it('ignores pending, failed, and cancelled events', () => {
    const summary = summarizePayments(425, [
      payment({ amount: '4.25', status: PaymentStatus.Pending }),
      payment({ kind: PaymentKind.Refund, amount: '1.00', status: PaymentStatus.Failed }),
      payment({ amount: '4.25', status: PaymentStatus.Cancelled }),
    ]);

    expect(summary.paidCents).toBe(0);
    expect(summary.refundedCents).toBe(0);
    expect(summary.balanceCents).toBe(425);
  });

  it('never reports a negative balance or refundable amount', () => {
    const summary = summarizePayments(425, [payment({ amount: '10.00' })]);

    expect(summary.netCents).toBe(1000);
    expect(summary.balanceCents).toBe(0);
    expect(summary.refundableCents).toBe(1000);
  });

  it('treats a malformed Decimal amount as zero rather than guessing', () => {
    const summary = summarizePayments(425, [payment({ amount: '4.255' })]);

    expect(summary.paidCents).toBe(0);
  });
});

describe('payment labels', () => {
  it('labels payment kinds', () => {
    expect(paymentKindLabel(PaymentKind.Payment)).toBe('Payment');
    expect(paymentKindLabel(PaymentKind.Refund)).toBe('Refund');
  });

  it('labels payment methods', () => {
    expect(paymentMethodLabel(PaymentMethod.Cash)).toBe('Cash');
    expect(paymentMethodLabel(PaymentMethod.Card)).toBe('Card');
    expect(paymentMethodLabel(PaymentMethod.Online)).toBe('Online');
    expect(paymentMethodLabel(PaymentMethod.Other)).toBe('Other');
  });

  it('labels payment statuses', () => {
    expect(paymentStatusLabel(PaymentStatus.Succeeded)).toBe('Succeeded');
    expect(paymentStatusLabel(PaymentStatus.Pending)).toBe('Pending');
    expect(paymentStatusLabel(PaymentStatus.Failed)).toBe('Failed');
    expect(paymentStatusLabel(PaymentStatus.Cancelled)).toBe('Cancelled');
  });
});
