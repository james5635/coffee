import { TestBed } from '@angular/core/testing';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  let service: AuthStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuthStateService] });
    service = TestBed.inject(AuthStateService);
  });

  it('starts unauthenticated with no access token', () => {
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
  });

  it('becomes authenticated after setAccessToken', () => {
    service.setAccessToken('test-token-123');
    expect(service.accessToken()).toBe('test-token-123');
    expect(service.isAuthenticated()).toBeTruthy();
  });

  it('clears the session after clearSession', () => {
    service.setAccessToken('test-token-123');
    service.clearSession();
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
  });
});