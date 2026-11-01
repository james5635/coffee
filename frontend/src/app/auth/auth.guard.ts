import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

/**
 * Protects authenticated routes: the guard first waits for boot-time session
 * restore (silent refresh from the HttpOnly cookie) to settle, then allows the
 * navigation when an access token is held and redirects to `/login` otherwise.
 * Waiting prevents a page reload with a valid refresh cookie from being
 * bounced to `/login` before the restored token is available.
 */
export const authGuard: CanActivateFn = async () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  await authState.whenInitialized();
  return authState.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
