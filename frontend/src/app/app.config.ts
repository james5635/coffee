import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  Provider,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { AuthService } from './services/auth.service';
import { AuthStateService } from './services/auth-state.service';

/**
 * Apollo Client transport for the backend's single GraphQL endpoint.
 *
 * - `HttpLink` posts to `/query` and always sends cookies so the HttpOnly
 *   refresh token reaches the backend (the dev proxy forwards it).
 * - A `SetContextLink` reads the in-memory access token from `AuthStateService`
 *   at request time and attaches it as a bearer header. Operations can opt out
 *   with `context: { skipAuth: true }` (cookie-only refresh, credential login).
 * - `InMemoryCache` is the standard normalized cache; the auth-aware service
 *   still chooses per-operation fetch policies.
 */
export function provideAppApollo(): Provider {
  return provideApollo(() => {
    const httpLink = inject(HttpLink);
    const authState = inject(AuthStateService);

    const authLink = new SetContextLink((prevContext) => {
      const skipAuth = prevContext['skipAuth'] === true;
      const token = skipAuth ? null : authState.accessToken();
      if (!token) {
        return {};
      }
      return {
        headers: {
          ...(prevContext['headers'] as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`,
        },
      };
    });

    return {
      link: authLink.concat(httpLink.create({ uri: '/query', withCredentials: true })),
      cache: new InMemoryCache(),
    };
  });
}

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
    provideAppApollo(),
    provideAppInitializer(restoreSessionOnBoot),
  ],
};
