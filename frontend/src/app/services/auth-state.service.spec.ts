import { TestBed } from '@angular/core/testing';
import { AuthStateService } from './auth-state.service';

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
