import { OrderError } from '../services/order.service';
import { productErrorMessage } from './product-errors';

const messages = {
  codes: {
    INSUFFICIENT_BALANCE: 'That amount is too high.',
    FORBIDDEN: 'Your role cannot do that.',
  },
  auth: 'Sign in again.',
  unknown: 'Something went wrong.',
  offline: 'Check your connection.',
};

describe('productErrorMessage', () => {
  it('maps a known backend error code to its operation-specific message', () => {
    expect(productErrorMessage(new OrderError('INSUFFICIENT_BALANCE'), messages)).toBe(
      'That amount is too high.',
    );
    expect(productErrorMessage(new OrderError('FORBIDDEN'), messages)).toBe(
      'Your role cannot do that.',
    );
  });

  it.each(['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN'])(
    'maps %s to the shared session message',
    (code) => {
      expect(productErrorMessage(new OrderError(code), messages)).toBe('Sign in again.');
    },
  );

  it('falls back to the unknown-operation message for unmapped backend codes', () => {
    expect(productErrorMessage(new OrderError('INTERNAL'), messages)).toBe('Something went wrong.');
  });

  it('falls back to the connection message for errors without a backend code', () => {
    expect(productErrorMessage(new Error('network down'), messages)).toBe('Check your connection.');
  });

  it('reads the code from any coded error shape, not only OrderError', () => {
    expect(productErrorMessage({ code: 'FORBIDDEN' }, messages)).toBe('Your role cannot do that.');
  });

  it('treats a malformed code as a transport failure', () => {
    expect(productErrorMessage({ code: 500 }, messages)).toBe('Check your connection.');
  });
});
