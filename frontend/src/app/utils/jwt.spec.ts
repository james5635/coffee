import { decodeAccessTokenClaims } from './jwt';

/** Builds an unsigned JWT-shaped string with the given JSON payload. */
function tokenWith(payload: unknown): string {
  const encode = (value: string): string =>
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(
    JSON.stringify(payload),
  )}.signature`;
}

describe('decodeAccessTokenClaims', () => {
  it('decodes roles and permissions from the token payload', () => {
    const token = tokenWith({
      sub: 7,
      roles: ['cashier'],
      permissions: ['order.create', 'payment.accept'],
    });

    expect(decodeAccessTokenClaims(token)).toEqual({
      roles: ['cashier'],
      permissions: ['order.create', 'payment.accept'],
    });
  });

  it('reports missing claims as null so callers can fall back', () => {
    expect(decodeAccessTokenClaims(tokenWith({ sub: 7 }))).toEqual({
      roles: null,
      permissions: null,
    });
  });

  it('treats a non-array permission claim as absent', () => {
    expect(decodeAccessTokenClaims(tokenWith({ permissions: 'payment.accept' }))).toEqual({
      roles: null,
      permissions: null,
    });
  });

  it('keeps an empty permission array as a claim that grants nothing', () => {
    expect(decodeAccessTokenClaims(tokenWith({ permissions: [] }))).toEqual({
      roles: null,
      permissions: [],
    });
  });

  it('returns null for a missing or malformed token', () => {
    expect(decodeAccessTokenClaims(null)).toBeNull();
    expect(decodeAccessTokenClaims('not-a-jwt')).toBeNull();
    expect(decodeAccessTokenClaims('header.%%%.signature')).toBeNull();
  });

  it('returns null when the payload is not a JSON object', () => {
    expect(decodeAccessTokenClaims(tokenWith(['not', 'an', 'object']))).toBeNull();
  });
});
