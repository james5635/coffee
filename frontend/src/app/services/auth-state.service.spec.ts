import { TestBed } from '@angular/core/testing';
import { AuthStateService } from './auth-state.service';

/** Builds an unsigned JWT-shaped string with the given JSON payload. */
function tokenWith(payload: Record<string, unknown>): string {
  const encode = (value: string): string =>
    btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(
    JSON.stringify(payload),
  )}.signature`;
}

describe('AuthStateService', () => {
  let service: AuthStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthStateService);
  });

  it('starts unauthenticated with no access token', () => {
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('becomes authenticated after setAccessToken', () => {
    service.setAccessToken('token-123');

    expect(service.accessToken()).toBe('token-123');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears the session after clearSession', () => {
    service.setAccessToken('token-123');

    service.clearSession();

    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('decodes roles and permissions from the access token', () => {
    service.setAccessToken(
      tokenWith({ roles: ['cashier'], permissions: ['order.create', 'payment.accept'] }),
    );

    expect(service.roles()).toEqual(['cashier']);
    expect(service.permissions()).toEqual(['order.create', 'payment.accept']);
    expect(service.hasPermission('payment.accept')).toBe(true);
    expect(service.hasPermission('payment.refund')).toBe(false);
  });

  it('denies permissions when the claim is present but empty', () => {
    service.setAccessToken(tokenWith({ permissions: [] }));

    expect(service.permissions()).toEqual([]);
    expect(service.hasPermission('payment.accept')).toBe(false);
  });

  it('falls back to authentication when the permission claim is absent', () => {
    service.setAccessToken(tokenWith({ roles: ['barista'] }));

    expect(service.permissions()).toBeNull();
    expect(service.hasPermission('payment.accept')).toBe(true);
  });

  it('denies permissions when unauthenticated', () => {
    expect(service.hasPermission('payment.accept')).toBe(false);
  });

  it('starts with boot-time restore not yet settled', () => {
    expect(service.isInitialized()).toBe(false);
  });

  it('resolves whenInitialized once markInitialized is called', async () => {
    let settled = false;
    const pending = service.whenInitialized().then(() => {
      settled = true;
    });

    expect(service.isInitialized()).toBe(false);
    expect(settled).toBe(false);

    service.markInitialized();
    await pending;

    expect(service.isInitialized()).toBe(true);
    expect(settled).toBe(true);
  });

  it('returns an already-resolved promise when initialized', async () => {
    service.markInitialized();

    await expect(service.whenInitialized()).resolves.toBeUndefined();
  });
});
