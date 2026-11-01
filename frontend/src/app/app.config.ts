import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { AuthService } from './services/auth.service';
import { AuthStateService } from './services/auth-state.service';

/**
 * Restores the in-memory session from the HttpOnly refresh cookie before the
 * app renders, so a full page reload keeps the user signed in. Skipped during
 * SSR: there is no browser cookie jar, and rendering the protected shell is
 * client-only. Failures leave the user unauthenticated for the guard to route
 * to `/login`.
 */
const restoreSessionOnBoot = () => {
  const authState = inject(AuthStateService);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    authState.markInitialized();
    return;
  }
  return inject(AuthService).restoreSession();
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(),
    provideAppInitializer(restoreSessionOnBoot),
  ],
};
