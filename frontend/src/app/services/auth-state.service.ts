import { computed, Injectable, signal } from '@angular/core';

/**
 * In-memory auth state for the client session.
 *
 * The access token lives in memory only (never persisted); the refresh token
 * is held by the backend in an HttpOnly cookie and is never exposed to JS.
 */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly token = signal<string | null>(null);

  /** Current access token, or null when unauthenticated. */
  readonly accessToken = this.token.asReadonly();

  /** Whether an access token is currently held. */
  readonly isAuthenticated = computed(() => this.token() !== null);

  setAccessToken(token: string): void {
    this.token.set(token);
  }

  clearSession(): void {
    this.token.set(null);
  }
}
