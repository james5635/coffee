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
});
