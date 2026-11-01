import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

/**
 * Protects authenticated routes: with an in-memory access token held the
 * navigation proceeds; otherwise the user is redirected to `/login`. Silent
 * session restore from the HttpOnly refresh cookie is out of Phase 1 scope,
 * so a full page reload (which loses the in-memory token) lands on `/login`.
 */
export const authGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);
  return authState.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
