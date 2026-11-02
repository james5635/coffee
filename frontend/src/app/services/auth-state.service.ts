import { computed, Injectable, signal } from '@angular/core';
import { decodeAccessTokenClaims } from '../utils/jwt';

/**
 * In-memory auth state for the client session.
 *
 * The access token lives in memory only (never persisted); the refresh token
 * is held by the backend in an HttpOnly cookie and is never exposed to JS.
 * Roles and permissions are decoded from the access token for UI gating only;
 * the backend still authorizes every protected operation.
 */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly token = signal<string | null>(null);
  private readonly initialized = signal(false);

  private initializedPromise: Promise<void> | null = null;
  private resolveInitialized: (() => void) | null = null;

  /** Current access token, or null when unauthenticated. */
  readonly accessToken = this.token.asReadonly();

  /** Whether an access token is currently held. */
  readonly isAuthenticated = computed(() => this.token() !== null);

  /** Decoded access-token claims, or null when unavailable/malformed. */
  readonly claims = computed(() => decodeAccessTokenClaims(this.token()));

  /** Roles from the access token, or null when the claim is absent. */
  readonly roles = computed(() => this.claims()?.roles ?? null);

  /** Permissions from the access token, or null when the claim is absent. */
  readonly permissions = computed(() => this.claims()?.permissions ?? null);

  /**
   * Whether the current user may perform an action, for UI gating only.
   *
   * Uses decoded `permissions` when the access token carries that claim. When
   * claims are absent (or the token is malformed), falls back to
   * authentication-only gating; the backend remains the permission boundary.
   */
  hasPermission(permission: string): boolean {
    const permissions = this.permissions();
    if (permissions !== null) {
      return permissions.includes(permission);
    }
    return this.isAuthenticated();
  }

  /**
   * Whether the boot-time session restore has settled. Routing waits on this
   * so the guard cannot redirect to `/login` while a cookie-backed session is
   * still being restored.
   */
  readonly isInitialized = this.initialized.asReadonly();

  setAccessToken(token: string): void {
    this.token.set(token);
  }

  clearSession(): void {
    this.token.set(null);
  }

  /** Marks boot-time session restore as settled (success or failure). */
  markInitialized(): void {
    if (this.initialized()) {
      return;
    }
    this.initialized.set(true);
    this.resolveInitialized?.();
    this.resolveInitialized = null;
  }

  /** Resolves once boot-time session restore has settled. */
  whenInitialized(): Promise<void> {
    if (this.initialized()) {
      return Promise.resolve();
    }
    this.initializedPromise ??= new Promise<void>((resolve) => {
      this.resolveInitialized = resolve;
    });
    return this.initializedPromise;
  }
}
