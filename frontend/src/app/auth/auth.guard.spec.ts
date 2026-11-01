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

  it('redirects unauthenticated to /login', async () => {
    // The app initializer normally settles boot restore before routing.
    TestBed.inject(AuthStateService).markInitialized();

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows an authenticated user through', async () => {
    const authState = TestBed.inject(AuthStateService);
    authState.setAccessToken('token-123');
    authState.markInitialized();

    expect(await runGuard()).toBe(true);
  });

  it('waits for boot-time restore before deciding', async () => {
    const authState = TestBed.inject(AuthStateService);

    // The restore is still in flight when the guard starts.
    const result = runGuard();
    authState.setAccessToken('restored-token');
    authState.markInitialized();

    expect(await result).toBe(true);
  });
});
