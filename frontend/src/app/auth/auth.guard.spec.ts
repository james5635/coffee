import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStateService } from '../services/auth-state.service';

describe('authGuard', () => {
  /** Runs the guard in an injection context, as the router would. */
  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      authGuard(new ActivatedRouteSnapshot(), {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('redirects unauthenticated to /login', () => {
    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows an authenticated user through', () => {
    TestBed.inject(AuthStateService).setAccessToken('token-123');

    expect(runGuard()).toBe(true);
  });
});
